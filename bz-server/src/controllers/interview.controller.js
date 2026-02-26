/**
 * ============================================================================
 * Voice Interview Controller
 * ============================================================================
 * API controller for AI voice interview system
 *
 * Endpoints:
 * - POST   /api/interview/start - Start interview session
 * - POST   /api/interview/:sessionId/question - Get next question
 * - POST   /api/interview/:sessionId/answer - Submit audio answer
 * - POST   /api/interview/:sessionId/end - End session
 * - GET    /api/interview/:sessionId - Get session details
 * - GET    /api/interview/history - Get user's interview history
 * - GET    /api/interview/providers - Get available providers
 * ============================================================================
 */

import interviewOrchestrator from "../ai/voice-interview/services/InterviewOrchestrator.service.js";
import voiceProviderRegistry from "../ai/voice-interview/providers/ProviderRegistry.js";
import { pool } from "../database/connect.db.js";

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/**
 * Start new voice interview session
 * Authenticated: Yes
 * Method: POST
 * Endpoint: /api/interview/start
 *
 * Payload:
 * {
 *   "mode": "topic" | "role",
 *   "topic": "Arrays" (if mode=topic),
 *   "difficulty": "easy" | "medium" | "hard",
 *   "targetRole": "Backend Engineer" (if mode=role),
 *   "jobDescription": "...",
 *   "resumeText": "..."
 * }
 *
 * Response: 200 - Session started
 * {
 *   "success": true,
 *   "session": { sessionId, mode, topic, ... }
 * }
 */
export const startInterview = async (req, res) => {
    try {
        const userId = req.userId;
        const { mode, topic, difficulty, targetQuestions, targetRole, jobDescription, resumeText } = req.body;

        console.log(`[InterviewController] Received difficulty: ${difficulty}, targetQuestions: ${targetQuestions}`);

        // Validation
        if (!mode || !["topic", "role"].includes(mode)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or missing mode. Must be "topic" or "role"',
            });
        }

        if (mode === "topic" && !topic) {
            return res.status(400).json({
                success: false,
                message: "Topic is required for topic-based interviews",
            });
        }

        if (mode === "role" && !targetRole) {
            return res.status(400).json({
                success: false,
                message: "Target role is required for role-based interviews",
            });
        }

        console.log(`[InterviewController] User ${userId} starting ${mode} interview`);

        const session = await interviewOrchestrator.startSession({
            userId,
            mode,
            topic,
            difficulty: difficulty || "medium",
            targetQuestions: targetQuestions || 5, // Default to 5 questions if not specified
            targetRole,
            jobDescription,
            resumeText,
        });

        res.status(200).json({
            success: true,
            session,
            message: "Interview session started successfully",
        });
    } catch (error) {
        console.error("[InterviewController] Error starting interview:", error);
        res.status(500).json({
            success: false,
            message: "Failed to start interview session",
            error: error.message,
        });
    }
};

/**
 * Get next question
 * Authenticated: Yes
 * Method: POST
 * Endpoint: /api/interview/:sessionId/question
 *
 * Response: 200 - Question with audio
 * {
 *   "success": true,
 *   "question": {
 *     "turnId": "uuid",
 *     "turnNumber": 1,
 *     "question": "Explain how dynamic programming works",
 *     "audio": "base64_encoded_audio",
 *     "audioDuration": 15
 *   }
 * }
 */
export const getNextQuestion = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const userId = req.userId;

        // Verify session belongs to user
        const sessionCheck = await pool.query("SELECT user_id FROM interview_sessions WHERE id = $1", [sessionId]);

        if (sessionCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Session not found",
            });
        }

        if (sessionCheck.rows[0].user_id !== userId) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized access to session",
            });
        }

        console.log(`[InterviewController] Generating question for session ${sessionId}`);

        const question = await interviewOrchestrator.askNextQuestion(sessionId);

        res.status(200).json({
            success: true,
            question,
        });
    } catch (error) {
        console.error("[InterviewController] Error getting next question:", error);
        res.status(500).json({
            success: false,
            message: "Failed to generate question",
            error: error.message,
        });
    }
};

/**
 * Submit audio answer
 * Authenticated: Yes
 * Method: POST
 * Endpoint: /api/interview/:sessionId/answer
 * Content-Type: multipart/form-data
 *
 * Form Data:
 * - turnId: string
 * - audio: file (wav, mp3, etc.)
 *
 * Response: 200 - Answer evaluated
 * {
 *   "success": true,
 *   "evaluation": {
 *     "transcription": "...",
 *     "score": 85,
 *     "verdict": "good",
 *     "feedback": "...",
 *     "feedbackAudio": "base64_encoded_audio"
 *   }
 * }
 */
export const submitAnswer = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { turnId } = req.body;
        const userId = req.userId;

        // Verify session
        const sessionCheck = await pool.query("SELECT user_id FROM interview_sessions WHERE id = $1", [sessionId]);

        if (sessionCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Session not found",
            });
        }

        if (sessionCheck.rows[0].user_id !== userId) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized access to session",
            });
        }

        // Get audio file from request
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Audio file is required",
            });
        }

        const audioBuffer = req.file.buffer;

        console.log(`[InterviewController] Processing answer for session ${sessionId}, turn ${turnId}`);

        const evaluation = await interviewOrchestrator.processAnswer(sessionId, turnId, audioBuffer);

        res.status(200).json({
            success: true,
            evaluation,
        });
    } catch (error) {
        console.error("[InterviewController] Error processing answer:", error);
        res.status(500).json({
            success: false,
            message: "Failed to process answer",
            error: error.message,
        });
    }
};

/**
 * End interview session
 * Authenticated: Yes
 * Method: POST
 * Endpoint: /api/interview/:sessionId/end
 *
 * Response: 200 - Session ended
 * {
 *   "success": true,
 *   "summary": {
 *     "totalQuestions": 5,
 *     "averageScore": 78.5,
 *     "excellentCount": 2,
 *     "duration": 1200
 *   }
 * }
 */
export const endInterview = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const userId = req.userId;

        // Verify session
        const sessionCheck = await pool.query("SELECT user_id FROM interview_sessions WHERE id = $1", [sessionId]);

        if (sessionCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Session not found",
            });
        }

        if (sessionCheck.rows[0].user_id !== userId) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized access to session",
            });
        }

        console.log(`[InterviewController] Ending session ${sessionId}`);

        const summary = await interviewOrchestrator.endSession(sessionId);

        res.status(200).json({
            success: true,
            summary,
            message: "Interview completed successfully",
        });
    } catch (error) {
        console.error("[InterviewController] Error ending interview:", error);
        res.status(500).json({
            success: false,
            message: "Failed to end interview",
            error: error.message,
        });
    }
};

// ============================================================================
// DATA RETRIEVAL
// ============================================================================

/**
 * Get session details
 * Authenticated: Yes
 * Method: GET
 * Endpoint: /api/interview/:sessionId
 *
 * Response: 200 - Session data
 */
export const getSession = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const userId = req.userId;

        const result = await pool.query(
            `
            SELECT 
                iss.*,
                COUNT(it.id) AS questions_answered,
                AVG(it.score)::NUMERIC(5,2) AS avg_score
            FROM interview_sessions iss
            LEFT JOIN interview_turns it ON iss.id = it.session_id
            WHERE iss.id = $1 AND iss.user_id = $2
            GROUP BY iss.id
        `,
            [sessionId, userId],
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Session not found",
            });
        }

        res.status(200).json({
            success: true,
            session: result.rows[0],
        });
    } catch (error) {
        console.error("[InterviewController] Error getting session:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get session details",
            error: error.message,
        });
    }
};

/**
 * Get user's interview history
 * Authenticated: Yes
 * Method: GET
 * Endpoint: /api/interview/history
 * Parameters: ?limit=10&offset=0&mode=topic
 *
 * Response: 200 - Interview history
 */
export const getInterviewHistory = async (req, res) => {
    try {
        const userId = req.userId;
        const { limit = 10, offset = 0, mode } = req.query;

        let query = `
            SELECT * FROM recent_interview_sessions
            WHERE user_id = $1
        `;
        const params = [userId];

        if (mode) {
            query += ` AND session_mode = $2`;
            params.push(mode);
        }

        query += ` ORDER BY started_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(parseInt(limit), parseInt(offset));

        const result = await pool.query(query, params);

        res.status(200).json({
            success: true,
            interviews: result.rows,
            total: result.rows.length,
        });
    } catch (error) {
        console.error("[InterviewController] Error getting history:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get interview history",
            error: error.message,
        });
    }
};

/**
 * Get session transcript
 * Authenticated: Yes
 * Method: GET
 * Endpoint: /api/interview/:sessionId/transcript
 *
 * Response: 200 - Full Q&A transcript
 */
export const getTranscript = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const userId = req.userId;

        // Verify ownership
        const sessionCheck = await pool.query("SELECT user_id FROM interview_sessions WHERE id = $1", [sessionId]);

        if (sessionCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Session not found",
            });
        }

        if (sessionCheck.rows[0].user_id !== userId) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized access",
            });
        }

        // Get all turns
        const result = await pool.query(
            `
            SELECT 
                turn_number,
                question_text,
                question_type,
                user_answer_text,
                score,
                verdict,
                feedback,
                detected_mistakes,
                created_at
            FROM interview_turns
            WHERE session_id = $1
            ORDER BY turn_number ASC
        `,
            [sessionId],
        );

        res.status(200).json({
            success: true,
            transcript: result.rows,
        });
    } catch (error) {
        console.error("[InterviewController] Error getting transcript:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get transcript",
            error: error.message,
        });
    }
};

/**
 * Get all questions for a session
 * Authenticated: Yes
 * Method: GET
 * Endpoint: /api/interview/:sessionId/questions
 *
 * Response: 200 - List of all questions
 */
export const getSessionQuestions = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const userId = req.userId;

        // Verify session belongs to user
        const sessionCheck = await pool.query("SELECT user_id FROM interview_sessions WHERE id = $1", [sessionId]);

        if (sessionCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Session not found",
            });
        }

        if (sessionCheck.rows[0].user_id !== userId) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized access to session",
            });
        }

        const questions = await interviewOrchestrator.getSessionQuestions(sessionId);

        res.status(200).json({
            success: true,
            questions,
        });
    } catch (error) {
        console.error("[InterviewController] Error getting session questions:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get session questions",
            error: error.message,
        });
    }
};

/**
 * Get a specific question by turn number
 * Authenticated: Yes
 * Method: GET
 * Endpoint: /api/interview/:sessionId/question/:turnNumber
 *
 * Response: 200 - Question with audio
 */
export const getQuestionByTurn = async (req, res) => {
    try {
        const { sessionId, turnNumber } = req.params;
        const userId = req.userId;

        // Verify session belongs to user
        const sessionCheck = await pool.query("SELECT user_id FROM interview_sessions WHERE id = $1", [sessionId]);

        if (sessionCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Session not found",
            });
        }

        if (sessionCheck.rows[0].user_id !== userId) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized access to session",
            });
        }

        const question = await interviewOrchestrator.getQuestionByTurn(sessionId, parseInt(turnNumber));

        res.status(200).json({
            success: true,
            question,
        });
    } catch (error) {
        console.error("[InterviewController] Error getting question:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get question",
            error: error.message,
        });
    }
};

// ============================================================================
// PROVIDER & CONFIG MANAGEMENT
// ============================================================================

/**
 * Get available voice providers
 * Authenticated: Yes
 * Method: GET
 * Endpoint: /api/interview/providers
 *
 * Response: 200 - Available providers
 */
export const getProviders = async (req, res) => {
    try {
        const health = await voiceProviderRegistry.healthCheckAll();
        const summary = voiceProviderRegistry.getSummary();

        res.status(200).json({
            success: true,
            summary,
            health,
        });
    } catch (error) {
        console.error("[InterviewController] Error getting providers:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get providers",
            error: error.message,
        });
    }
};

/**
 * Get interview analytics
 * Authenticated: Yes
 * Method: GET
 * Endpoint: /api/interview/analytics
 * Parameters: ?period=weekly
 *
 * Response: 200 - Analytics data
 */
export const getAnalytics = async (req, res) => {
    try {
        const userId = req.userId;
        const { period = "all_time" } = req.query;

        const result = await pool.query(
            `
            SELECT * FROM interview_analytics
            WHERE user_id = $1 AND period_type = $2
            ORDER BY period_start DESC
            LIMIT 1
        `,
            [userId, period],
        );

        if (result.rows.length === 0) {
            return res.status(200).json({
                success: true,
                analytics: null,
                message: "No analytics data available yet",
            });
        }

        res.status(200).json({
            success: true,
            analytics: result.rows[0],
        });
    } catch (error) {
        console.error("[InterviewController] Error getting analytics:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get analytics",
            error: error.message,
        });
    }
};

// ============================================================================
// ADMIN OPERATIONS
// ============================================================================

/**
 * Delete interview session (Admin only)
 * Authenticated: Yes (TODO: Add admin role check)
 * Method: DELETE
 * Endpoint: /api/interview/:sessionId
 *
 * Response: 200 - Session deleted
 * {
 *   "success": true,
 *   "message": "Interview session deleted successfully",
 *   "sessionId": "uuid",
 *   "turnsDeleted": 5
 * }
 */
export const deleteInterview = async (req, res) => {
    try {
        const { sessionId } = req.params;

        console.log(`[InterviewController] Admin deleting interview session: ${sessionId}`);

        // TODO: Add admin role check
        // const user = await pool.query('SELECT role FROM users WHERE id = $1', [req.userId]);
        // if (user.rows[0]?.role !== 'admin') {
        //     return res.status(403).json({ success: false, message: 'Admin access required' });
        // }

        const result = await interviewOrchestrator.deleteSession(sessionId);

        res.status(200).json(result);
    } catch (error) {
        console.error("[InterviewController] Error deleting interview:", error);

        if (error.message.includes("not found")) {
            return res.status(404).json({
                success: false,
                message: "Interview session not found",
            });
        }

        res.status(500).json({
            success: false,
            message: "Failed to delete interview session",
            error: error.message,
        });
    }
};
