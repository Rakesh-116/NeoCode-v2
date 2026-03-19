/**
 * ============================================================================
 * Voice Assistant Service
 * ============================================================================
 * Main orchestrator for voice assistant interactions
 * Pipeline: Audio → STT → Intent → Action → TTS → Audio
 * 
 * Reuses existing voice-interview infrastructure:
 * - WhisperSTTProvider for speech-to-text
 * - PiperTTSProvider for text-to-speech
 * - OllamaLLM for intelligent responses
 * ============================================================================
 */

import voiceProviderRegistry from "../../voice-interview/providers/ProviderRegistry.js";
import intentRouter from "../intents/IntentRouter.js";
import actionExecutor from "../intents/ActionExecutor.js";
import { pool } from "../../../database/connect.db.js";
import { v4 as uuidv4 } from "uuid";

class VoiceAssistantService {
    constructor() {
        this.activeSessions = new Map(); // Track active assistant conversations
    }

    /**
     * Process voice input and return voice response
     * Full pipeline: Audio → STT → Intent → Action → TTS
     * 
     * @param {Buffer} audioBuffer - Audio input from user
     * @param {string} userId - User ID
     * @param {Object} context - Current context (page, problem, course, etc.)
     * @returns {Promise<Object>} Response with audio buffer and metadata
     */
    async processVoiceCommand(audioBuffer, userId, context = {}) {
        const sessionId = uuidv4();
        
        console.log(`[VoiceAssistant] Processing command for user ${userId}`);

        try {
            // Step 1: Speech-to-Text
            const transcription = await this._transcribeAudio(audioBuffer);
            console.log(`[VoiceAssistant] Transcribed: "${transcription.text}"`);

            // Step 2: Parse Intent
            const intent = await intentRouter.parseIntent(transcription.text, context);
            console.log(`[VoiceAssistant] Intent: ${intent.intent} (confidence: ${intent.confidence})`);

            // Step 3: Execute Action
            const actionResult = await actionExecutor.execute(intent, userId);
            console.log(`[VoiceAssistant] Action result: ${actionResult.success ? "Success" : "Failed"}`);

            // Step 4: Generate Response Text
            let responseText = actionResult.response;

            // If action needs LLM generation (e.g., explain_concept, hints), use LLM
            if (actionResult.data?.needsLLMGeneration) {
                responseText = await this._generateLLMResponse(intent, actionResult, context);
            }

            // Step 5: Text-to-Speech
            const speechAudio = await this._synthesizeSpeech(responseText);

            // Step 6: Store interaction in database
            await this._logInteraction({
                sessionId,
                userId,
                transcription: transcription.text,
                intent: intent.intent,
                confidence: intent.confidence,
                response: responseText,
                success: actionResult.success,
                context,
            });

            return {
                success: true,
                sessionId,
                transcription: transcription.text,
                intent: intent.intent,
                confidence: intent.confidence,
                response: responseText,
                audioBuffer: speechAudio,
                action: actionResult.action,
                navigate: actionResult.navigate,
                data: actionResult.data,
            };
        } catch (error) {
            console.error("[VoiceAssistant] Processing error:", error);

            // Generate error audio response
            const errorText = "Sorry, I encountered an error. Please try again.";
            const errorAudio = await this._synthesizeSpeech(errorText);

            return {
                success: false,
                sessionId,
                error: error.message,
                response: errorText,
                audioBuffer: errorAudio,
            };
        }
    }

    /**
     * Process text command (for text-based assistant mode)
     * Pipeline: Text → Intent → Action → TTS
     * 
     * @param {string} text - User text input
     * @param {string} userId - User ID
     * @param {Object} context - Current context
     * @returns {Promise<Object>} Response with audio buffer and metadata
     */
    async processTextCommand(text, userId, context = {}) {
        const sessionId = uuidv4();
        
        console.log(`[VoiceAssistant] Processing text: "${text}"`);

        try {
            // Step 1: Parse Intent
            const intent = await intentRouter.parseIntent(text, context);

            // Step 2: Execute Action
            const actionResult = await actionExecutor.execute(intent, userId);

            // Step 3: Generate Response Text
            let responseText = actionResult.response;

            if (actionResult.data?.needsLLMGeneration) {
                responseText = await this._generateLLMResponse(intent, actionResult, context);
            }

            // Step 4: Text-to-Speech (optional for text mode)
            const speechAudio = context.needsAudio 
                ? await this._synthesizeSpeech(responseText)
                : null;

            // Step 5: Log interaction
            await this._logInteraction({
                sessionId,
                userId,
                transcription: text,
                intent: intent.intent,
                confidence: intent.confidence,
                response: responseText,
                success: actionResult.success,
                context,
            });

            return {
                success: true,
                sessionId,
                input: text,
                intent: intent.intent,
                confidence: intent.confidence,
                response: responseText,
                audioBuffer: speechAudio,
                action: actionResult.action,
                navigate: actionResult.navigate,
                data: actionResult.data,
            };
        } catch (error) {
            console.error("[VoiceAssistant] Text processing error:", error);

            return {
                success: false,
                sessionId,
                error: error.message,
                response: "Sorry, I encountered an error. Please try again.",
            };
        }
    }

    /**
     * Get conversation history for user
     * @param {string} userId - User ID
     * @param {number} limit - Number of recent interactions
     * @returns {Promise<Array>} Interaction history
     */
    async getHistory(userId, limit = 20) {
        try {
            const result = await pool.query(
                `SELECT * FROM assistant_interactions 
                 WHERE user_id = $1 
                 ORDER BY created_at DESC 
                 LIMIT $2`,
                [userId, limit]
            );

            return result.rows;
        } catch (error) {
            console.error("[VoiceAssistant] History fetch error:", error);
            return [];
        }
    }

    /**
     * Transcribe audio using Whisper STT
     * @private
     */
    async _transcribeAudio(audioBuffer) {
        const sttProvider = await voiceProviderRegistry.getDefault("stt");

        if (!sttProvider) {
            throw new Error("STT provider not available");
        }

        return await sttProvider.transcribe(audioBuffer);
    }

    /**
     * Synthesize speech using Piper TTS
     * @private
     */
    async _synthesizeSpeech(text) {
        const ttsProvider = await voiceProviderRegistry.getDefault("tts");

        if (!ttsProvider) {
            throw new Error("TTS provider not available");
        }

        return await ttsProvider.synthesize(text);
    }

    /**
     * Generate intelligent response using LLM
     * @private
     */
    async _generateLLMResponse(intent, actionResult, context) {
        const llmProvider = await voiceProviderRegistry.getDefault("llm_interview");

        if (!llmProvider) {
            return actionResult.response; // Fallback to action response
        }

        let prompt = "";

        if (actionResult.action === "explain_concept") {
            const concept = actionResult.data.concept;
            prompt = `Explain the concept of "${concept}" in simple terms for a software engineering student. Keep it concise (2-3 sentences).`;
        } else if (actionResult.action === "generate_hint") {
            const problemId = actionResult.data.problemId;
            // TODO: Fetch problem details and generate contextual hint
            prompt = `Give a subtle hint for solving this coding problem without revealing the solution.`;
        } else {
            return actionResult.response;
        }

        try {
            const llmResponse = await llmProvider.generateResponse(prompt, []);
            return llmResponse.text || actionResult.response;
        } catch (error) {
            console.error("[VoiceAssistant] LLM generation error:", error);
            return actionResult.response; // Fallback
        }
    }

    /**
     * Log interaction to database
     * @private
     */
    async _logInteraction(data) {
        try {
            await pool.query(
                `INSERT INTO assistant_interactions 
                (id, user_id, transcription, intent, confidence, response, success, context, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
                [
                    data.sessionId,
                    data.userId,
                    data.transcription,
                    data.intent,
                    data.confidence,
                    data.response,
                    data.success,
                    JSON.stringify(data.context),
                ]
            );
        } catch (error) {
            // Don't fail the request if logging fails
            console.error("[VoiceAssistant] Logging error:", error);
        }
    }

    /**
     * Health check for assistant service
     * @returns {Promise<Object>} Health status
     */
    async healthCheck() {
        const sttHealth = await voiceProviderRegistry.healthCheck("stt", "whisper");
        const ttsHealth = await voiceProviderRegistry.healthCheck("tts", "piper");
        const llmHealth = await voiceProviderRegistry.healthCheck("llm_interview", "ollama");

        return {
            healthy: sttHealth.healthy && ttsHealth.healthy && llmHealth.healthy,
            providers: {
                stt: sttHealth,
                tts: ttsHealth,
                llm: llmHealth,
            },
        };
    }
}

// Singleton export
const voiceAssistantService = new VoiceAssistantService();
export default voiceAssistantService;
