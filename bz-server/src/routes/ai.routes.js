/**
 * ============================================================================
 * AI Routes - API Endpoints for AI Features
 * ============================================================================
 * Exposes AI capabilities via REST API.
 *
 * All routes require authentication except /status
 * ============================================================================
 */

import express from "express";
import {
    getAICoaching,
    getCodeReview,
    getInterviewQuestion,
    getSupportResponse,
    getAIStatus,
    clearAICache,
} from "../controllers/ai.controller.js";
import { userAuthentication } from "../middlewares/authentication.js";

const router = express.Router();

/**
 * AI Coach - Get personalized learning coaching
 * GET /api/ai/coach
 * Query params: ?provider=local|openai|gemini|groq (optional)
 */
router.get("/coach", userAuthentication, getAICoaching);

/**
 * AI Code Review - Get feedback on submitted code
 * POST /api/ai/code-review
 * Body: { code, language, problemId (optional), provider (optional) }
 */
router.post("/code-review", userAuthentication, getCodeReview);

/**
 * AI Interview - Get interview questions/feedback
 * POST /api/ai/interview/question
 * Body: { topic, difficulty, role, history, provider (optional) }
 */
router.post("/interview/question", userAuthentication, getInterviewQuestion);

/**
 * AI Support Chat - Get support responses
 * POST /api/ai/support
 * Body: { message, context (optional), conversationHistory (optional), provider (optional) }
 */
router.post("/support", getSupportResponse);

/**
 * AI Status - Check provider availability and features
 * GET /api/ai/status
 * Public endpoint
 */
router.get("/status", getAIStatus);

/**
 * Clear AI Cache - Admin utility
 * POST /api/ai/cache/clear
 * TODO: Add admin authentication
 */
router.post("/cache/clear", clearAICache);

export default router;
