/**
 * ============================================================================
 * AI Controller - Handles AI Feature Requests
 * ============================================================================
 * Exposes AI features via REST API:
 * - AI Coach (mistake-based coaching)
 * - AI Code Review (feedback on accepted code)
 * - AI Interview (technical interview simulation)
 * - AI Support Chat (help chatbot)
 * - AI Status (check provider availability)
 * ============================================================================
 */

import llmGateway from "../ai/index.js";
import MistakeEngineService from "../learning-core/services/mistakeEngine.service.js";
import config from "../config/index.js";
import { pool } from "../database/connect.db.js";

const mistakeEngine = new MistakeEngineService();

/**
 * Get AI coaching based on user's learning patterns
 * GET /api/ai/coach
 */
export const getAICoaching = async (req, res) => {
    try {
        const userId = req.userId;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized. Please login.",
            });
        }

        // Get coaching from MistakeEngine
        const result = await mistakeEngine.getAICoaching(userId, {
            provider: req.query.provider, // Allow provider override
        });

        return res.status(200).json(result);
    } catch (error) {
        console.error("AI Coach controller error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error. Please retry later.",
            error: error.message,
        });
    }
};

/**
 * Get AI code review for a submission
 * POST /api/ai/code-review
 * Body: { evaluationResultId, code, language, problemId }
 */
export const getCodeReview = async (req, res) => {
    try {
        const userId = req.userId;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized. Please login.",
            });
        }

        const { evaluationResultId, code, language, problemId } = req.body;

        // Validate payload
        if (!code || !language) {
            return res.status(400).json({
                success: false,
                message: "Invalid payload. Required: code, language",
            });
        }

        // Check if feature enabled
        if (!config.AI.ENABLE_AI_CODE_REVIEW) {
            return res.status(403).json({
                success: false,
                message: "AI Code Review is currently disabled.",
            });
        }

        // Get problem details if provided
        let problem = {};
        if (problemId) {
            const problemQuery = await pool.query(
                "SELECT title, description, difficulty FROM problems WHERE problem_id = $1",
                [problemId],
            );
            problem = problemQuery.rows[0] || {};
        }

        // Generate code review
        const review = await llmGateway.generate({
            purpose: "codeReview",
            context: {
                code,
                language,
                problem,
            },
            provider: req.body.provider, // Allow provider override
        });

        return res.status(200).json({
            success: true,
            review,
            metadata: {
                language,
                problemId,
                evaluationResultId,
            },
        });
    } catch (error) {
        console.error("AI Code Review controller error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error. Please retry later.",
            error: error.message,
        });
    }
};

/**
 * AI Interview - Ask question
 * POST /api/ai/interview/question
 * Body: { topic, difficulty, role, history }
 */
export const getInterviewQuestion = async (req, res) => {
    try {
        const userId = req.userId;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized. Please login.",
            });
        }

        const { topic, difficulty = "medium", role = "opening", history = [] } = req.body;

        // Validate
        if (!topic) {
            return res.status(400).json({
                success: false,
                message: "Invalid payload. Required: topic",
            });
        }

        // Check if feature enabled
        if (!config.AI.ENABLE_AI_INTERVIEW) {
            return res.status(403).json({
                success: false,
                message: "AI Interview is currently disabled.",
            });
        }

        // Generate question/feedback
        const response = await llmGateway.generate({
            purpose: "interview",
            context: {
                topic,
                difficulty,
                role,
                history,
            },
            provider: req.body.provider,
        });

        return res.status(200).json({
            success: true,
            response,
            metadata: {
                topic,
                difficulty,
                role,
            },
        });
    } catch (error) {
        console.error("AI Interview controller error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error. Please retry later.",
            error: error.message,
        });
    }
};

/**
 * AI Support Chat
 * POST /api/ai/support
 * Body: {
 *   message: string,
 *   context: {
 *     currentPage?: string,      // e.g. "Learning Profile"
 *     userType?: string,         // "Student" | "Admin"
 *     authStatus?: string,       // "authenticated" | "guest"
 *     errorMessage?: string,     // active error shown in UI
 *     providerStatus?: object,   // AI provider availability map
 *     featureFlags?: object      // enabled/disabled flags
 *   },
 *   conversationHistory?: [{ role: "user"|"assistant", content: string }]
 * }
 */
export const getSupportResponse = async (req, res) => {
    try {
        const userId = req.userId; // optional - support chat doesn't require auth

        const { message, context = {}, conversationHistory = [] } = req.body;

        // Validate
        if (!message) {
            return res.status(400).json({
                success: false,
                message: "Invalid payload. Required: message",
            });
        }

        // Check if feature enabled
        if (!config.AI.ENABLE_AI_SUPPORT) {
            return res.status(403).json({
                success: false,
                message: "AI Support is currently disabled.",
            });
        }

        // Generate support response and track latency
        const requestedProvider = req.body.provider || config.AI.DEFAULT_PROVIDER;
        const startTime = Date.now();

        const reply = await llmGateway.generate({
            purpose: "support",
            context: {
                userMessage: message,
                context,
                conversationHistory,
            },
            provider: requestedProvider,
        });

        const latencyMs = Date.now() - startTime;

        return res.status(200).json({
            success: true,
            reply,
            provider: requestedProvider,
            latencyMs,
        });
    } catch (error) {
        console.error("AI Support controller error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error. Please retry later.",
            error: error.message,
        });
    }
};

/**
 * Get AI Gateway status
 * GET /api/ai/status
 */
export const getAIStatus = async (req, res) => {
    try {
        const status = await llmGateway.getStatus();

        return res.status(200).json({
            success: true,
            status,
        });
    } catch (error) {
        console.error("AI Status controller error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to get AI status",
            error: error.message,
        });
    }
};

/**
 * Clear AI cache (admin only)
 * POST /api/ai/cache/clear
 */
export const clearAICache = async (req, res) => {
    try {
        // TODO: Add admin check
        // if (!req.user?.isAdmin) {
        //   return res.status(403).json({ message: "Admin only" });
        // }

        llmGateway.clearCache();

        return res.status(200).json({
            success: true,
            message: "AI cache cleared successfully",
        });
    } catch (error) {
        console.error("Clear cache controller error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to clear cache",
            error: error.message,
        });
    }
};
