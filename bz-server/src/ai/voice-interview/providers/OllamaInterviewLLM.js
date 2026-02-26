/**
 * ============================================================================
 * Ollama Interview LLM Provider Implementation
 * ============================================================================
 * Uses Ollama (local LLM) for interview question generation and evaluation
 * Integrates with existing LLM Gateway service
 *
 * Responsibilities:
 * - Generate context-aware interview questions
 * - Evaluate answers with detailed feedback
 * - Adapt difficulty dynamically
 * ============================================================================
 */

import IInterviewLLM from "../interfaces/IInterviewLLM.js";
import axios from "axios";

export default class OllamaInterviewLLM extends IInterviewLLM {
    name = "ollama";
    version = "1.0.0";
    modelName = "llama3.1:latest";

    constructor(config = {}) {
        super();
        this.baseURL = config.baseURL || process.env.OLLAMA_BASE_URL || "http://localhost:11434";
        this.modelName = config.model || process.env.OLLAMA_MODEL_NAME || "llama3.1:latest";
        this.temperature = config.temperature || 0.7;
        this.maxTokens = config.maxTokens || 500;
        this.timeout = config.timeout || 120000; // 120s timeout (llama3.1 is slower)
    }

    /**
     * Generate interview question based on context
     * @param {Object} context - Question generation context
     * @returns {Promise<Object>} Generated question
     */
    async generateQuestion(context) {
        try {
            console.log(
                `[OllamaInterviewLLM] Generating ${context.difficulty} question for topic: ${context.topic || context.role}`,
            );

            const prompt = this._buildQuestionPrompt(context);
            const response = await this._callOllama(prompt);

            // Parse structured response
            const question = this._parseQuestionResponse(response);

            console.log(`[OllamaInterviewLLM] Generated question: ${question.question.substring(0, 50)}...`);

            return question;
        } catch (error) {
            console.error("[OllamaInterviewLLM] Question generation failed:", error.message);
            throw new Error(`Failed to generate question: ${error.message}`);
        }
    }

    /**
     * Evaluate user's answer
     * @param {Object} context - Evaluation context
     * @returns {Promise<Object>} Evaluation result
     */
    async evaluateAnswer(context) {
        try {
            console.log(`[OllamaInterviewLLM] Evaluating answer for: ${context.question.substring(0, 50)}...`);

            const prompt = this._buildEvaluationPrompt(context);
            const response = await this._callOllama(prompt);

            // Parse evaluation
            const evaluation = this._parseEvaluationResponse(response);

            console.log(`[OllamaInterviewLLM] Evaluation complete: ${evaluation.verdict} (${evaluation.score}/100)`);

            return evaluation;
        } catch (error) {
            console.error("[OllamaInterviewLLM] Answer evaluation failed:", error.message);
            throw new Error(`Failed to evaluate answer: ${error.message}`);
        }
    }

    /**
     * Generate follow-up question
     * @param {Object} previousQA - Previous question and answer
     * @returns {Promise<Object>} Follow-up question
     */
    async generateFollowUp(previousQA) {
        try {
            const prompt = this._buildFollowUpPrompt(previousQA);
            const response = await this._callOllama(prompt);
            return this._parseQuestionResponse(response);
        } catch (error) {
            console.error("[OllamaInterviewLLM] Follow-up generation failed:", error.message);
            throw new Error(`Failed to generate follow-up: ${error.message}`);
        }
    }

    /**
     * Build prompt for question generation
     * @private
     * @param {Object} context - Generation context
     * @returns {string} Prompt
     */
    _buildQuestionPrompt(context) {
        let basePrompt = `You are an expert technical interviewer. Generate a single interview question.

**Context:**
`;

        if (context.topic) {
            basePrompt += `- Topic: ${context.topic}\n`;
            basePrompt += `- Difficulty: ${context.difficulty}\n`;
        } else if (context.role) {
            basePrompt += `- Target Role: ${context.role}\n`;
            if (context.jd) {
                basePrompt += `- Job Description: ${context.jd.substring(0, 500)}...\n`;
            }
        }

        if (context.previousQuestions && context.previousQuestions.length > 0) {
            basePrompt += `\n**Already Asked:**\n`;
            context.previousQuestions.forEach((q, idx) => {
                basePrompt += `${idx + 1}. ${q}\n`;
            });
        }

        basePrompt += `\n**Instructions:**
1. Generate ONE interview question appropriate for the context
2. Make it specific and technical
3. Avoid repeating previous questions
4. Return ONLY a JSON object with this structure:
{
  "question": "your question text",
  "type": "technical|behavioral|system_design|coding",
  "difficulty": "easy|medium|hard",
  "expectedKeywords": ["keyword1", "keyword2"]
}

Return ONLY valid JSON, no additional text.`;

        return basePrompt;
    }

    /**
     * Build prompt for answer evaluation
     * @private
     * @param {Object} context - Evaluation context
     * @returns {string} Prompt
     */
    _buildEvaluationPrompt(context) {
        return `You are an expert technical interviewer evaluating a candidate's answer.

**Question Asked:**
${context.question}

**Candidate's Answer:**
${context.answer}

**Evaluation Criteria:**
- Topic: ${context.topic}
- Difficulty: ${context.difficulty}
${context.timeToAnswer ? `- Time Taken: ${context.timeToAnswer}s` : ""}

**Instructions:**
Evaluate the answer and return a JSON object with:
{
  "score": <0-100>,
  "verdict": "excellent|good|average|poor|failed",
  "feedback": "detailed feedback on the answer",
  "detectedMistakes": ["mistake1", "mistake2"],
  "strengths": ["strength1", "strength2"],
  "improvements": ["improvement1", "improvement2"],
  "followUpSuggested": true|false
}

Scoring Guide:
- 90-100: Excellent (comprehensive, accurate, well-explained)
- 70-89: Good (correct concepts, minor gaps)
- 50-69: Average (partial understanding, some mistakes)
- 30-49: Poor (significant gaps, major mistakes)
- 0-29: Failed (incorrect or irrelevant)

Return ONLY valid JSON, no additional text.`;
    }

    /**
     * Build prompt for follow-up question
     * @private
     * @param {Object} previousQA - Previous Q&A
     * @returns {string} Prompt
     */
    _buildFollowUpPrompt(previousQA) {
        return `Based on this previous Q&A, generate a relevant follow-up question:

**Previous Question:** ${previousQA.question}
**Answer:** ${previousQA.answer}
**Score:** ${previousQA.score}/100

Generate a follow-up question that:
1. Digs deeper into the topic
2. Addresses gaps in the previous answer
3. Maintains appropriate difficulty

Return JSON with same structure as before.`;
    }

    /**
     * Call Ollama API
     * @private
     * @param {string} prompt - Prompt text
     * @returns {Promise<string>} Response text
     */
    async _callOllama(prompt) {
        try {
            const response = await axios.post(
                `${this.baseURL}/api/generate`,
                {
                    model: this.modelName,
                    prompt,
                    temperature: this.temperature,
                    max_tokens: this.maxTokens,
                    stream: false,
                },
                {
                    timeout: this.timeout,
                    headers: { "Content-Type": "application/json" },
                },
            );

            return response.data.response;
        } catch (error) {
            if (error.code === "ECONNREFUSED") {
                throw new Error(`Ollama server not reachable at ${this.baseURL}. Is Ollama running?`);
            }
            throw error;
        }
    }

    /**
     * Parse question generation response
     * @private
     * @param {string} response - LLM response
     * @returns {Object} Parsed question
     */
    _parseQuestionResponse(response) {
        try {
            // Remove markdown code fences if present
            let cleanResponse = response.trim();

            // Strip ```json and `````` fences
            cleanResponse = cleanResponse.replace(/^```json\s*/i, "");
            cleanResponse = cleanResponse.replace(/^```\s*/, "");
            cleanResponse = cleanResponse.replace(/\s*```$/, "");
            cleanResponse = cleanResponse.trim();

            // Now try to extract JSON object
            const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
            const jsonStr = jsonMatch ? jsonMatch[0] : cleanResponse;

            const parsed = JSON.parse(jsonStr);

            return {
                question: parsed.question,
                type: parsed.type || "technical",
                difficulty: parsed.difficulty || "medium",
                expectedKeywords: parsed.expectedKeywords || [],
                metadata: { rawResponse: response },
            };
        } catch (error) {
            console.error("[OllamaInterviewLLM] Failed to parse question response:", error.message);
            console.error("[OllamaInterviewLLM] Raw response:", response);
            // Fallback: use raw response as question
            return {
                question: response.trim(),
                type: "technical",
                difficulty: "medium",
                expectedKeywords: [],
                metadata: { parseError: true },
            };
        }
    }

    /**
     * Parse evaluation response
     * @private
     * @param {string} response - LLM response
     * @returns {Object} Parsed evaluation
     */
    _parseEvaluationResponse(response) {
        try {
            // Remove markdown code fences if present
            let cleanResponse = response.trim();

            // Strip ```json and ``` fences
            cleanResponse = cleanResponse.replace(/^```json\s*/i, "");
            cleanResponse = cleanResponse.replace(/^```\s*/, "");
            cleanResponse = cleanResponse.replace(/\s*```$/, "");
            cleanResponse = cleanResponse.trim();

            // Now try to extract JSON object
            const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
            const jsonStr = jsonMatch ? jsonMatch[0] : cleanResponse;

            const parsed = JSON.parse(jsonStr);

            return {
                score: Math.min(100, Math.max(0, parsed.score || 50)),
                verdict: parsed.verdict || "average",
                feedback: parsed.feedback || "No feedback provided",
                detectedMistakes: parsed.detectedMistakes || [],
                strengths: parsed.strengths || [],
                improvements: parsed.improvements || [],
                followUpSuggested: parsed.followUpSuggested || false,
                metadata: { rawResponse: response },
            };
        } catch (error) {
            console.error("[OllamaInterviewLLM] Failed to parse evaluation response:", error.message);
            console.error("[OllamaInterviewLLM] Raw response:", response);
            // Fallback: basic evaluation
            return {
                score: 50,
                verdict: "average",
                feedback: response.trim(),
                detectedMistakes: [],
                strengths: [],
                improvements: [],
                followUpSuggested: false,
                metadata: { parseError: true },
            };
        }
    }

    /**
     * Health check for Ollama
     * @returns {Promise<boolean>}
     */
    async healthCheck() {
        try {
            const response = await axios.get(`${this.baseURL}/api/tags`, { timeout: 5000 });

            // Check if our model is available
            const models = response.data.models || [];
            const modelAvailable = models.some((m) => m.name === this.modelName);

            if (!modelAvailable) {
                console.warn(
                    `[OllamaInterviewLLM] Model ${this.modelName} not found. Available: ${models.map((m) => m.name).join(", ")}`,
                );
            }

            return true;
        } catch (error) {
            console.error("[OllamaInterviewLLM] Health check failed:", error.message);
            return false;
        }
    }
}
