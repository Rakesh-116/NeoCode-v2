/**
 * mentor.controller.js
 *
 * API controller for AI Mentor System - the brain of personalized learning.
 * Integrates: Skills, Goals, Validations, Roadmaps, and AI Chat.
 */

import SkillManagementService from "../learning-core/services/skillManagement.service.js";
import GoalTrackingService from "../learning-core/services/goalTracking.service.js";
import ValidationEngineService from "../learning-core/services/validationEngine.service.js";
import EnhancedRoadmapEngine from "../learning-core/services/enhancedRoadmap.service.js";
import LearningProfileService from "../learning-core/services/learningProfile.service.js";
import LearningDashboardService from "../learning-core/services/learningDashboard.service.js";
import { chat } from "../ai/llmGateway.service.js";
import mentorPrompt from "../ai/prompts/mentor.prompt.js";

const skillService = new SkillManagementService();
const goalService = new GoalTrackingService();
const validationService = new ValidationEngineService();
const roadmapEngine = new EnhancedRoadmapEngine();
const profileService = new LearningProfileService();
const dashboardService = new LearningDashboardService();

// ============================================================================
// SKILL MANAGEMENT ENDPOINTS
// ============================================================================

export const getUserSkills = async (req, res) => {
    try {
        const userId = req.userId;

        const skills = await skillService.getUserSkillProfile(userId);
        const stats = await skillService.getSkillStatistics(userId);

        res.json({
            success: true,
            skills,
            statistics: stats,
        });
    } catch (error) {
        console.error("[MentorController] Error getting user skills:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get user skills",
            error: error.message,
        });
    }
};

export const submitSkillAssessment = async (req, res) => {
    try {
        const userId = req.userId;
        const { assessmentId, answers } = req.body;

        if (!assessmentId || !answers) {
            return res.status(400).json({
                success: false,
                message: "Assessment ID and answers are required",
            });
        }

        const result = await skillService.submitAssessment(userId, assessmentId, answers);

        res.json({
            success: true,
            ...result,
            message: result.passed ? "Assessment passed!" : "Assessment not passed. Please review and try again.",
        });
    } catch (error) {
        console.error("[MentorController] Error submitting assessment:", error);
        res.status(500).json({
            success: false,
            message: "Failed to submit assessment",
            error: error.message,
        });
    }
};

export const getSkillAssessments = async (req, res) => {
    try {
        const { skillName } = req.params;
        const { difficulty } = req.query;

        const assessments = await skillService.getSkillAssessments(skillName, difficulty ? parseInt(difficulty) : null);

        res.json({
            success: true,
            assessments,
        });
    } catch (error) {
        console.error("[MentorController] Error getting skill assessments:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get assessments",
            error: error.message,
        });
    }
};

// ============================================================================
// GOAL MANAGEMENT ENDPOINTS
// ============================================================================

export const createGoal = async (req, res) => {
    try {
        const userId = req.userId;
        const goalData = req.body;

        if (!goalData.title) {
            return res.status(400).json({
                success: false,
                message: "Goal title is required",
            });
        }

        const goal = await goalService.createGoal(userId, goalData);

        res.status(201).json({
            success: true,
            goal,
            message: "Goal created successfully",
        });
    } catch (error) {
        console.error("[MentorController] Error creating goal:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create goal",
            error: error.message,
        });
    }
};

export const getUserGoals = async (req, res) => {
    try {
        const userId = req.userId;
        const { status } = req.query;

        const goals = await goalService.getUserGoals(userId, status);
        const stats = await goalService.getGoalStatistics(userId);

        res.json({
            success: true,
            goals,
            statistics: stats,
        });
    } catch (error) {
        console.error("[MentorController] Error getting user goals:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get goals",
            error: error.message,
        });
    }
};

export const getGoalBreakdown = async (req, res) => {
    try {
        const { goalId } = req.params;

        const breakdown = await goalService.getGoalBreakdown(goalId);

        res.json({
            success: true,
            ...breakdown,
        });
    } catch (error) {
        console.error("[MentorController] Error getting goal breakdown:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get goal breakdown",
            error: error.message,
        });
    }
};

export const getCareerPaths = async (req, res) => {
    try {
        const careerPaths = await goalService.getAvailableCareerPaths();

        res.json({
            success: true,
            careerPaths,
        });
    } catch (error) {
        console.error("[MentorController] Error getting career paths:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get career paths",
            error: error.message,
        });
    }
};

export const suggestCareerPath = async (req, res) => {
    try {
        const userId = req.userId;

        const suggestions = await goalService.suggestCareerPath(userId);

        res.json({
            success: true,
            suggestions,
            message: "Career paths ranked by your current skill match",
        });
    } catch (error) {
        console.error("[MentorController] Error suggesting career path:", error);
        res.status(500).json({
            success: false,
            message: "Failed to suggest career path",
            error: error.message,
        });
    }
};

// ============================================================================
// VALIDATION ENDPOINTS
// ============================================================================

export const submitValidation = async (req, res) => {
    try {
        const userId = req.userId;
        const validationData = req.body;

        const result = await validationService.submitValidation(userId, validationData);

        res.json({
            success: true,
            ...result,
        });
    } catch (error) {
        console.error("[MentorController] Error submitting validation:", error);
        res.status(500).json({
            success: false,
            message: "Failed to submit validation",
            error: error.message,
        });
    }
};

export const getValidationRequirements = async (req, res) => {
    try {
        const userId = req.userId;
        const { skillName } = req.params;

        const requirements = await validationService.getRequirementsForNextLevel(userId, skillName);

        res.json({
            success: true,
            ...requirements,
        });
    } catch (error) {
        console.error("[MentorController] Error getting validation requirements:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get requirements",
            error: error.message,
        });
    }
};

export const getValidationHistory = async (req, res) => {
    try {
        const userId = req.userId;
        const { skillName } = req.params;
        const { limit = 10 } = req.query;

        const history = await validationService.getValidationHistory(userId, skillName, parseInt(limit));

        res.json({
            success: true,
            history,
        });
    } catch (error) {
        console.error("[MentorController] Error getting validation history:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get validation history",
            error: error.message,
        });
    }
};

// ============================================================================
// ROADMAP ENDPOINTS
// ============================================================================

export const generateRoadmap = async (req, res) => {
    try {
        const userId = req.userId;
        const { goalId, weeks, intensity, startDate } = req.body;

        if (!goalId) {
            return res.status(400).json({
                success: false,
                message: "Goal ID is required",
            });
        }

        const roadmap = await roadmapEngine.generateRoadmapForGoal(userId, goalId, {
            weeks,
            intensity,
            startDate,
        });

        res.json({
            success: true,
            roadmap,
            message: "Personalized roadmap generated!",
        });
    } catch (error) {
        console.error("[MentorController] Error generating roadmap:", error);
        res.status(500).json({
            success: false,
            message: "Failed to generate roadmap",
            error: error.message,
        });
    }
};

export const getActiveRoadmap = async (req, res) => {
    try {
        const userId = req.userId;

        const roadmap = await roadmapEngine.getActiveRoadmap(userId);

        if (!roadmap) {
            return res.json({
                success: true,
                roadmap: null,
                message: "No active roadmap found. Create a goal to generate one!",
            });
        }

        res.json({
            success: true,
            roadmap,
        });
    } catch (error) {
        console.error("[MentorController] Error getting active roadmap:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get roadmap",
            error: error.message,
        });
    }
};

export const getTodaysTasks = async (req, res) => {
    try {
        const userId = req.userId;

        const tasks = await roadmapEngine.getTodaysTasks(userId);

        res.json({
            success: true,
            tasks,
            count: tasks.length,
        });
    } catch (error) {
        console.error("[MentorController] Error getting today tasks:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get tasks",
            error: error.message,
        });
    }
};

export const completeTask = async (req, res) => {
    try {
        const userId = req.userId;
        const { taskId } = req.params;
        const { validationId } = req.body;

        const task = await roadmapEngine.completeTask(taskId, userId, validationId);

        res.json({
            success: true,
            task,
            message: "Task completed!",
        });
    } catch (error) {
        console.error("[MentorController] Error completing task:", error);
        res.status(500).json({
            success: false,
            message: "Failed to complete task",
            error: error.message,
        });
    }
};

export const adaptRoadmap = async (req, res) => {
    try {
        const userId = req.userId;
        const { planId } = req.params;

        const result = await roadmapEngine.adaptRoadmap(userId, planId);

        res.json({
            success: true,
            ...result,
        });
    } catch (error) {
        console.error("[MentorController] Error adapting roadmap:", error);
        res.status(500).json({
            success: false,
            message: "Failed to adapt roadmap",
            error: error.message,
        });
    }
};

// ============================================================================
// AI MENTOR CHAT ENDPOINT
// ============================================================================

export const chatWithMentor = async (req, res) => {
    try {
        const userId = req.userId;
        const { message, conversationHistory = [] } = req.body;

        if (!message) {
            return res.status(400).json({
                success: false,
                message: "Message is required",
            });
        }

        // Build comprehensive context for AI
        const [skills, profile, goals, activeRoadmap, todaysTasks] = await Promise.all([
            skillService.getUserSkillProfile(userId),
            profileService.getProfile(userId),
            goalService.getUserGoals(userId, "active"),
            roadmapEngine.getActiveRoadmap(userId),
            roadmapEngine.getTodaysTasks(userId),
        ]);

        // Get current goal (first active goal)
        const currentGoal = goals && goals.length > 0 ? goals[0] : null;

        // Build mentor context
        const context = mentorPrompt.buildContext({
            user: { id: userId, username: req.username || "User" },
            skills,
            weakTopics: profile?.weak_topics || [],
            strongTopics: profile?.strong_topics || [],
            recentMistakes: [], // TODO: Get from mistake log
            activePlan: activeRoadmap,
            todaysTasks,
            courseProgress: [], // TODO: Get from course progress
            learningStyle: profile?.learning_style || {},
            currentGoal,
        });

        // Prepare messages for AI
        const messages = [
            {
                role: "system",
                content: mentorPrompt.systemPrompt,
            },
            {
                role: "system",
                content: `CURRENT USER CONTEXT:\n${JSON.stringify(context, null, 2)}`,
            },
            ...conversationHistory,
            {
                role: "user",
                content: message,
            },
        ];

        // Call AI
        const response = await chat("mentor", messages, {
            provider: req.body.provider || "local",
            temperature: 0.7,
            max_tokens: 1000,
        });

        res.json({
            success: true,
            response: response.text,
            context: {
                skillsAnalyzed: skills.length,
                hasActiveGoal: !!currentGoal,
                hasActivePlan: !!activeRoadmap,
                tasksToday: todaysTasks.length,
            },
        });
    } catch (error) {
        console.error("[MentorController] Error in mentor chat:", error);
        res.status(500).json({
            success: false,
            message: "Failed to chat with mentor",
            error: error.message,
        });
    }
};

// ============================================================================
// DASHBOARD ENDPOINT
// ============================================================================

export const getMentorDashboard = async (req, res) => {
    try {
        const userId = req.userId;

        // Get unified dashboard - aggregates across ALL courses
        const dashboard = await dashboardService.getDashboard(userId);

        res.json({
            success: true,
            dashboard,
        });
    } catch (error) {
        console.error("[MentorController] Error getting mentor dashboard:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get dashboard",
            error: error.message,
        });
    }
};
