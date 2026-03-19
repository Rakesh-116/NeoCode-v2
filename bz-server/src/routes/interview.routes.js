/**
 * ============================================================================
 * Voice Interview Routes
 * ============================================================================
 * API routes for AI voice interview system
 *
 * All routes require authentication
 * Routes with audio uploads use multer middleware
 * ============================================================================
 */

import express from "express";
import multer from "multer";
import { userAuthentication } from "../middlewares/authentication.js";
import * as interviewController from "../controllers/interview.controller.js";
import { executeInterviewCode, submitInterviewCode } from "../controllers/interviewCode.controller.js";
import * as smartReviewController from "../controllers/smartReview.controller.js";

const router = express.Router();

// Configure multer for audio file uploads (in-memory storage)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max file size
    },
    fileFilter: (req, file, cb) => {
        // Accept audio files only
        const allowedMimes = ["audio/wav", "audio/mpeg", "audio/mp3", "audio/ogg", "audio/webm"];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Invalid file type. Only audio files are allowed."));
        }
    },
});

// All routes require authentication
router.use(userAuthentication);

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/**
 * GET /api/interview/smart-review/due
 * Get due concepts for Smart Review
 */
router.get("/smart-review/due", smartReviewController.getDueConcepts);

/**
 * POST /api/interview/smart-review/start
 * Start a Smart Review session
 */
router.post("/smart-review/start", smartReviewController.startSmartReview);

/**
 * POST /api/interview/smart-review/complete
 * Complete a Smart Review session and update cards
 */
router.post("/smart-review/complete", smartReviewController.completeSmartReview);

/**
 * GET /api/interview/smart-review/stats
 * Smart Review analytics
 */
router.get("/smart-review/stats", smartReviewController.getSmartReviewStats);

/**
 * POST /api/interview/start
 * Start new voice interview session
 *
 * Body:
 * {
 *   "mode": "topic" | "role",
 *   "topic": "Arrays" (if mode=topic),
 *   "difficulty": "easy" | "medium" | "hard",
 *   "targetRole": "Backend Engineer" (if mode=role),
 *   "jobDescription": "...",
 *   "resumeText": "..."
 * }
 */
router.post("/start", interviewController.startInterview);

/**
 * POST /api/interview/:sessionId/question
 * Get next interview question with audio
 */
router.post("/:sessionId/question", interviewController.getNextQuestion);

/**
 * POST /api/interview/:sessionId/answer
 * Submit audio answer for evaluation
 * Content-Type: multipart/form-data
 *
 * Form Data:
 * - turnId: string (UUID)
 * - audio: file (audio file)
 */
router.post("/:sessionId/answer", upload.single("audio"), interviewController.submitAnswer);

/**
 * POST /api/interview/:sessionId/end
 * End interview session and get summary
 */
router.post("/:sessionId/end", interviewController.endInterview);

/**
 * POST /api/interview/:sessionId/retake
 * Retake (clone) an existing interview session (same settings + questions)
 */
router.post("/:sessionId/retake", interviewController.retakeInterview);

// ============================================================================
// CODING (SEPARATE FROM NORMAL SUBMISSIONS)
// ============================================================================

/**
 * POST /api/interview/:sessionId/turn/:turnId/code/execute
 * Execute code for a coding interview turn (no normal submission record)
 */
router.post("/:sessionId/turn/:turnId/code/execute", executeInterviewCode);

/**
 * POST /api/interview/:sessionId/turn/:turnId/code/submit
 * Store a code submission tied to this interview session/turn
 */
router.post("/:sessionId/turn/:turnId/code/submit", submitInterviewCode);

// ============================================================================
// DATA RETRIEVAL
// ============================================================================

/**
 * GET /api/interview/history
 * Get user's interview history
 * Query Params:
 * - limit: number (default: 10)
 * - offset: number (default: 0)
 * - mode: "topic" | "role" (optional filter)
 */
router.get("/history", interviewController.getInterviewHistory);

/**
 * GET /api/interview/analytics
 * Get interview performance analytics
 * Query Params:
 * - period: "daily" | "weekly" | "monthly" | "all_time"
 */
router.get("/analytics", interviewController.getAnalytics);

// ============================================================================
// SYSTEM & PROVIDERS
// ============================================================================

/**
 * GET /api/interview/providers
 * Get available voice providers (STT, TTS, LLM) and health status
 */
router.get("/providers", interviewController.getProviders);

/**
 * GET /api/interview/:sessionId
 * Get session details and current state
 */
router.get("/:sessionId", interviewController.getSession);

/**
 * GET /api/interview/:sessionId/questions
 * Get all questions for a session with their status
 */
router.get("/:sessionId/questions", interviewController.getSessionQuestions);

/**
 * GET /api/interview/:sessionId/question/:turnNumber
 * Get a specific question by turn number with audio
 */
router.get("/:sessionId/question/:turnNumber", interviewController.getQuestionByTurn);

/**
 * GET /api/interview/:sessionId/transcript
 * Get full Q&A transcript for a session
 */
router.get("/:sessionId/transcript", interviewController.getTranscript);

// ============================================================================
// ADMIN OPERATIONS
// ============================================================================

/**
 * DELETE /api/interview/:sessionId
 * Delete interview session and all associated data (Admin only)
 *
 * Response: 200 - Session deleted
 * {
 *   "success": true,
 *   "message": "Interview session deleted successfully",
 *   "sessionId": "uuid",
 *   "turnsDeleted": 5
 * }
 */
router.delete("/:sessionId", interviewController.deleteInterview);

// ============================================================================
// ERROR HANDLING
// ============================================================================

// Multer error handling
router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({
                success: false,
                message: "File too large. Maximum size is 10MB.",
            });
        }
        return res.status(400).json({
            success: false,
            message: `Upload error: ${error.message}`,
        });
    }

    if (error.message === "Invalid file type. Only audio files are allowed.") {
        return res.status(400).json({
            success: false,
            message: error.message,
        });
    }

    next(error);
});

export default router;
