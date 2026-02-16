import EvaluationService from "../learning-core/services/evaluation.service.js";

const evaluationService = new EvaluationService();

/**
 * New unified submission endpoint (replaces submitProblemController)
 */
export const submitEvaluationController = async (req, res) => {
    try {
        const {
            questionId,
            evaluationType, // 'code' | 'quiz' | etc.
            answer, // {code, language} for code | {answers: []} for quiz
            context, // Optional: {hintsUsed, timeSpent, userFailureReason, confidenceLevel}
        } = req.body;

        const userId = req.userId; // From JWT middleware

        // Validate input
        if (!questionId || !evaluationType || !answer) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: questionId, evaluationType, answer",
            });
        }

        // Call learning core
        const result = await evaluationService.evaluate({
            userId,
            questionId,
            evaluationType,
            answer,
            context: context || {},
        });

        return res.status(200).json(result);
    } catch (error) {
        console.error("Evaluation controller error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error during evaluation",
            error: error.message,
        });
    }
};

/**
 * Get user's learning profile
 */
export const getLearningProfileController = async (req, res) => {
    try {
        const userId = req.userId;
        const profileService = new (await import("../learning-core/services/learningProfile.service.js")).default();

        const summary = await profileService.getLearningummary(userId);

        return res.status(200).json({
            success: true,
            profile: summary,
        });
    } catch (error) {
        console.error("Get profile error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch learning profile",
        });
    }
};

/**
 * Get personalized recommendations
 */
export const getRecommendationsController = async (req, res) => {
    try {
        const userId = req.userId;
        const { count = 3 } = req.query;

        const plannerService = new (await import("../learning-core/services/trainingPlanner.service.js")).default();
        const recommendations = await plannerService.getNextRecommendations(userId, parseInt(count));

        return res.status(200).json({
            success: true,
            recommendations: recommendations.map((q) => ({
                id: q.id || q.legacy_problem_id,
                title: q.title,
                difficulty: q.difficulty,
                topics: q.topics || q.category,
            })),
        });
    } catch (error) {
        console.error("Get recommendations error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch recommendations",
        });
    }
};

/**
 * Generate training plan
 */
export const generateTrainingPlanController = async (req, res) => {
    try {
        const userId = req.userId;
        const { planType = "weak_topic_focus", durationDays = 7, dailyTarget = 3 } = req.body;

        const plannerService = new (await import("../learning-core/services/trainingPlanner.service.js")).default();
        const plan = await plannerService.generatePlan(userId, {
            planType,
            durationDays,
            dailyTarget,
        });

        return res.status(200).json({
            success: true,
            plan,
        });
    } catch (error) {
        console.error("Generate plan error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to generate training plan",
        });
    }
};

/**
 * Get evaluation history
 */
export const getEvaluationHistoryController = async (req, res) => {
    try {
        const userId = req.userId;
        const { limit = 20, evaluationType, verdict } = req.query;

        const history = await evaluationService.getEvaluationHistory(userId, {
            limit: parseInt(limit),
            evaluationType,
            verdict,
        });

        return res.status(200).json({
            success: true,
            history,
        });
    } catch (error) {
        console.error("Get history error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch evaluation history",
        });
    }
};

/**
 * Get evaluation statistics
 */
export const getEvaluationStatsController = async (req, res) => {
    try {
        const userId = req.userId;
        const stats = await evaluationService.getEvaluationStats(userId);

        return res.status(200).json({
            success: true,
            stats,
        });
    } catch (error) {
        console.error("Get stats error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch evaluation stats",
        });
    }
};

/**
 * Get weak topics
 */
export const getWeakTopicsController = async (req, res) => {
    try {
        const userId = req.userId;
        const profileService = new (await import("../learning-core/services/learningProfile.service.js")).default();
        const weakTopics = await profileService.getWeakTopics(userId);

        return res.status(200).json({
            success: true,
            weakTopics,
        });
    } catch (error) {
        console.error("Get weak topics error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch weak topics",
        });
    }
};

/**
 * Get strong topics
 */
export const getStrongTopicsController = async (req, res) => {
    try {
        const userId = req.userId;
        const profileService = new (await import("../learning-core/services/learningProfile.service.js")).default();
        const strongTopics = await profileService.getStrongTopics(userId);

        return res.status(200).json({
            success: true,
            strongTopics,
        });
    } catch (error) {
        console.error("Get strong topics error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch strong topics",
        });
    }
};

/**
 * Reset a topic
 */
export const resetTopicController = async (req, res) => {
    try {
        const userId = req.userId;
        const { topic } = req.body;

        if (!topic) {
            return res.status(400).json({
                success: false,
                message: "Topic name is required",
            });
        }

        const profileService = new (await import("../learning-core/services/learningProfile.service.js")).default();
        await profileService.resetTopic(userId, topic);

        return res.status(200).json({
            success: true,
            message: `Topic '${topic}' reset successfully`,
        });
    } catch (error) {
        console.error("Reset topic error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to reset topic",
        });
    }
};

/**
 * Get user mistakes
 */
export const getUserMistakesController = async (req, res) => {
    try {
        const userId = req.userId;
        const { limit = 50, mistakeType, resolved } = req.query;

        const mistakeService = new (await import("../learning-core/services/mistakeEngine.service.js")).default();
        const mistakes = await mistakeService.getUserMistakes(userId, {
            limit: parseInt(limit),
            mistakeType,
            resolved: resolved !== undefined ? resolved === "true" : null,
        });

        return res.status(200).json({
            success: true,
            mistakes,
        });
    } catch (error) {
        console.error("Get mistakes error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch mistakes",
        });
    }
};

/**
 * Get recurring patterns
 */
export const getRecurringPatternsController = async (req, res) => {
    try {
        const userId = req.userId;
        const mistakeService = new (await import("../learning-core/services/mistakeEngine.service.js")).default();
        const patterns = await mistakeService.getRecurringPatterns(userId);

        return res.status(200).json({
            success: true,
            patterns,
        });
    } catch (error) {
        console.error("Get patterns error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch recurring patterns",
        });
    }
};

/**
 * Get common mistakes
 */
export const getCommonMistakesController = async (req, res) => {
    try {
        const userId = req.userId;
        const profileService = new (await import("../learning-core/services/learningProfile.service.js")).default();
        const commonMistakes = await profileService.getCommonMistakes(userId);

        return res.status(200).json({
            success: true,
            mistakes: commonMistakes,
        });
    } catch (error) {
        console.error("Get common mistakes error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch common mistakes",
        });
    }
};

/**
 * Get mistake statistics
 */
export const getMistakeStatsController = async (req, res) => {
    try {
        const userId = req.userId;
        const mistakeService = new (await import("../learning-core/services/mistakeEngine.service.js")).default();
        const stats = await mistakeService.getMistakeStats(userId);

        return res.status(200).json({
            success: true,
            stats,
        });
    } catch (error) {
        console.error("Get mistake stats error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch mistake stats",
        });
    }
};

/**
 * Resolve a mistake
 */
export const resolveMistakeController = async (req, res) => {
    try {
        const { id } = req.params;
        const { notes } = req.body;

        const mistakeService = new (await import("../learning-core/services/mistakeEngine.service.js")).default();
        const result = await mistakeService.resolveMistake(id, notes);

        return res.status(200).json({
            success: true,
            message: "Mistake marked as resolved",
            mistake: result,
        });
    } catch (error) {
        console.error("Resolve mistake error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to resolve mistake",
        });
    }
};

/**
 * Get active training plan
 */
export const getActivePlanController = async (req, res) => {
    try {
        const userId = req.userId;
        const plannerService = new (await import("../learning-core/services/trainingPlanner.service.js")).default();
        const plan = await plannerService.getActivePlan(userId);

        if (!plan) {
            return res.status(404).json({
                success: false,
                message: "No active training plan found",
            });
        }

        return res.status(200).json({
            success: true,
            plan,
        });
    } catch (error) {
        console.error("Get active plan error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch active plan",
        });
    }
};

/**
 * Mark question as completed in plan
 */
export const markQuestionCompletedController = async (req, res) => {
    try {
        const { planId, questionId } = req.params;
        const plannerService = new (await import("../learning-core/services/trainingPlanner.service.js")).default();
        const updatedPlan = await plannerService.markQuestionCompleted(planId, questionId);

        return res.status(200).json({
            success: true,
            message: "Question marked as completed",
            plan: updatedPlan,
        });
    } catch (error) {
        console.error("Mark completed error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to mark question as completed",
        });
    }
};
