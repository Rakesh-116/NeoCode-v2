/**
 * ============================================================================
 * LEARNING CORE API ROUTES
 * ============================================================================
 * New unified routes for the Learning OS platform.
 * These replace the scattered routes in old system.
 * ============================================================================
 */

import express from "express";
import { userAuthentication } from "../middlewares/authentication.js";
import {
    submitEvaluationController,
    getLearningProfileController,
    getRecommendationsController,
    generateTrainingPlanController,
    getEvaluationHistoryController,
    getEvaluationStatsController,
    getWeakTopicsController,
    getStrongTopicsController,
    resetTopicController,
    getUserMistakesController,
    getRecurringPatternsController,
    getCommonMistakesController,
    getMistakeStatsController,
    resolveMistakeController,
    getActivePlanController,
    markQuestionCompletedController,
} from "../controllers/evaluation.controller.js";

const router = express.Router();

// ============================================================================
// HEALTH CHECK (Public - no auth required)
// ============================================================================

/**
 * GET /api/learning/health
 * Health check for learning core system (no auth required)
 */
router.get("/health", async (req, res) => {
    try {
        const { healthCheck } = await import("../learning-core/index.js");
        const health = await healthCheck();

        return res.status(health.healthy ? 200 : 503).json({
            success: health.healthy,
            ...health,
        });
    } catch (error) {
        return res.status(503).json({
            success: false,
            message: "Health check failed",
        });
    }
});

// ============================================================================
// PROTECTED ROUTES (Authentication required for all routes below)
// ============================================================================

// All routes below require authentication
router.use(userAuthentication);

// ============================================================================
// EVALUATION
// ============================================================================

/**
 * POST /api/learning/evaluate
 * Main evaluation endpoint - works with ANY question type
 */
router.post("/evaluate", submitEvaluationController);

/**
 * GET /api/learning/evaluation-history
 * Get user's evaluation history
 */
router.get("/evaluation-history", getEvaluationHistoryController);

/**
 * GET /api/learning/evaluation-stats
 * Get evaluation statistics
 */
router.get("/evaluation-stats", getEvaluationStatsController);

// ============================================================================
// LEARNING PROFILE
// ============================================================================

/**
 * GET /api/learning/profile
 * Get user's learning profile summary
 */
router.get("/profile", getLearningProfileController);

/**
 * GET /api/learning/weak-topics
 * Get user's weak topics
 */
router.get("/weak-topics", getWeakTopicsController);

/**
 * GET /api/learning/strong-topics
 * Get user's strong topics
 */
router.get("/strong-topics", getStrongTopicsController);

/**
 * POST /api/learning/reset-topic
 * Reset a specific topic (if user improved)
 */
router.post("/reset-topic", resetTopicController);

// ============================================================================
// MISTAKES
// ============================================================================

/**
 * GET /api/learning/mistakes
 * Get user's mistake history
 */
router.get("/mistakes", getUserMistakesController);

/**
 * GET /api/learning/recurring-patterns
 * Get recurring mistake patterns
 */
router.get("/recurring-patterns", getRecurringPatternsController);

/**
 * GET /api/learning/common-mistakes
 * Get user's most common mistakes
 */
router.get("/common-mistakes", getCommonMistakesController);

/**
 * GET /api/learning/mistake-stats
 * Get mistake statistics
 */
router.get("/mistake-stats", getMistakeStatsController);

/**
 * POST /api/learning/resolve-mistake/:id
 * Mark a mistake as resolved
 */
router.post("/resolve-mistake/:id", resolveMistakeController);

// ============================================================================
// RECOMMENDATIONS & TRAINING PLANS
// ============================================================================

/**
 * GET /api/learning/recommendations
 * Get personalized question recommendations
 */
router.get("/recommendations", getRecommendationsController);

/**
 * POST /api/learning/training-plan
 * Generate a training plan
 */
router.post("/training-plan", generateTrainingPlanController);

/**
 * GET /api/learning/active-plan
 * Get user's active training plan
 */
router.get("/active-plan", getActivePlanController);

/**
 * POST /api/learning/mark-completed/:planId/:questionId
 * Mark a question as completed in a plan
 */
router.post("/mark-completed/:planId/:questionId", markQuestionCompletedController);

export default router;
