/**
 * ============================================================================
 * Voice Assistant Controller
 * ============================================================================
 * HTTP endpoints for voice assistant interactions
 * ============================================================================
 */

import voiceAssistantService from "../services/VoiceAssistantService.js";
import { pool } from "../../../database/connect.db.js";

/**
 * POST /api/assistant/voice
 * Process voice command (audio input)
 * 
 * Body: multipart/form-data with 'audio' file
 * Context: { currentPage, currentProblem, currentCourse }
 */
export const processVoiceCommandController = async (req, res) => {
    try {
        const userId = req.userId; // From authentication middleware

        const clientTranscript = req.body.clientTranscript || "";

        if ((!req.files || !req.files.audio) && !clientTranscript) {
            return res.status(400).json({
                success: false,
                message: "Audio file or client transcript is required",
            });
        }

        const audioBuffer = req.files?.audio?.data || null;
        const context = req.body.context ? JSON.parse(req.body.context) : {};

        console.log(`[AssistantController] Processing voice command for user ${userId}`);

        const result = await voiceAssistantService.processVoiceCommand(
            audioBuffer,
            userId,
            context,
            clientTranscript
        );

        // Send audio response
        res.set({
            "Content-Type": "audio/wav",
            "X-Transcription": encodeURIComponent(result.transcription || ""),
            "X-Intent": result.intent || "unknown",
            "X-Response-Text": encodeURIComponent(result.response || ""),
            "X-Navigate": result.navigate || "",
            "X-Open-Url": result.openUrl || "",
            "X-Action": result.action || "",
        });

        res.send(result.audioBuffer);
    } catch (error) {
        console.error("[AssistantController] Voice processing error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to process voice command",
            error: error.message,
        });
    }
};

/**
 * POST /api/assistant/text
 * Process text command (text input, returns JSON + optional audio)
 * 
 * Body: { text: string, context: object, needsAudio: boolean }
 */
export const processTextCommandController = async (req, res) => {
    try {
        const userId = req.userId;
        const { text, context = {}, needsAudio = false } = req.body;

        if (!text || typeof text !== "string") {
            return res.status(400).json({
                success: false,
                message: "Text input is required",
            });
        }

        console.log(`[AssistantController] Processing text: "${text}"`);

        const result = await voiceAssistantService.processTextCommand(
            text,
            userId,
            { ...context, needsAudio }
        );

        // Return JSON response
        res.json({
            success: result.success,
            sessionId: result.sessionId,
            input: result.input,
            response: result.response,
            intent: result.intent,
            confidence: result.confidence,
            action: result.action,
            navigate: result.navigate,
            openUrl: result.openUrl,
            data: result.data,
            hasAudio: !!result.audioBuffer,
        });
    } catch (error) {
        console.error("[AssistantController] Text processing error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to process text command",
            error: error.message,
        });
    }
};

/**
 * GET /api/assistant/history
 * Get user's conversation history
 * 
 * Query: ?limit=20
 */
export const getHistoryController = async (req, res) => {
    try {
        const userId = req.userId;
        const limit = parseInt(req.query.limit) || 20;

        const history = await voiceAssistantService.getHistory(userId, limit);

        res.json({
            success: true,
            history,
            count: history.length,
        });
    } catch (error) {
        console.error("[AssistantController] History fetch error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch history",
            error: error.message,
        });
    }
};

/**
 * GET /api/assistant/health
 * Health check for assistant service
 */
export const healthCheckController = async (req, res) => {
    try {
        const health = await voiceAssistantService.healthCheck();

        res.json({
            success: true,
            ...health,
        });
    } catch (error) {
        console.error("[AssistantController] Health check error:", error);
        res.status(500).json({
            success: false,
            message: "Health check failed",
            error: error.message,
        });
    }
};

/**
 * POST /api/assistant/greeting
 * Get personalized greeting
 * 
 * Body: { context: object }
 */
export const getGreetingController = async (req, res) => {
    try {
        const userId = req.userId;
        const { context = {} } = req.body;

        // Get user name
        const userResult = await pool.query(
            `SELECT name FROM users WHERE id = $1`,
            [userId]
        );

        const userName = userResult.rows[0]?.name || "there";

        const intentRouter = (await import("../intents/IntentRouter.js")).default;
        const greeting = await intentRouter.getGreeting({ userId, userName, ...context });

        res.json({
            success: true,
            greeting,
        });
    } catch (error) {
        console.error("[AssistantController] Greeting error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to generate greeting",
            error: error.message,
        });
    }
};
