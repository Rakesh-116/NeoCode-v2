/**
 * mentor.routes.js
 *
 * API routes for AI Mentor System - personalized learning with goals, skills, and validation.
 */

import express from "express";
import { verifyToken } from "../middlewares/authentication.js";
import * as mentorController from "../controllers/mentor.controller.js";

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// ============================================================================
// DASHBOARD
// ============================================================================

/**
 * GET /api/mentor/dashboard
 * Get comprehensive mentor dashboard with all user data
 */
router.get("/dashboard", mentorController.getMentorDashboard);

// ============================================================================
// SKILLS
// ============================================================================

/**
 * GET /api/mentor/skills
 * Get user's complete skill profile
 */
router.get("/skills", mentorController.getUserSkills);

/**
 * GET /api/mentor/skills/:skillName/assessments
 * Get available assessments for a skill
 */
router.get("/skills/:skillName/assessments", mentorController.getSkillAssessments);

/**
 * POST /api/mentor/skills/assessments/submit
 * Submit a skill assessment
 * Body: { assessmentId, answers[] }
 */
router.post("/skills/assessments/submit", mentorController.submitSkillAssessment);

/**
 * GET /api/mentor/skills/:skillName/validation-history
 * Get validation history for a skill
 */
router.get("/skills/:skillName/validation-history", mentorController.getValidationHistory);

/**
 * GET /api/mentor/skills/:skillName/requirements
 * Get validation requirements for next skill level
 */
router.get("/skills/:skillName/requirements", mentorController.getValidationRequirements);

// ============================================================================
// GOALS
// ============================================================================

/**
 * POST /api/mentor/goals
 * Create a new learning goal
 * Body: { title, description?, target_role?, deadline?, priority? }
 */
router.post("/goals", mentorController.createGoal);

/**
 * GET /api/mentor/goals
 * Get all user goals
 * Query: ?status=active|completed|paused
 */
router.get("/goals", mentorController.getUserGoals);

/**
 * GET /api/mentor/goals/:goalId
 * Get detailed goal breakdown with skill gaps
 */
router.get("/goals/:goalId", mentorController.getGoalBreakdown);

/**
 * GET /api/mentor/career-paths
 * Get all available career path templates
 */
router.get("/career-paths", mentorController.getCareerPaths);

/**
 * GET /api/mentor/career-paths/suggestions
 * Get career path suggestions based on current skills
 */
router.get("/career-paths/suggestions", mentorController.suggestCareerPath);

// ============================================================================
// VALIDATIONS
// ============================================================================

/**
 * POST /api/mentor/validations
 * Submit a validation (quiz, code, explain, project)
 * Body: { skill_name, validation_type, reference_id, score, time_spent_seconds? }
 */
router.post("/validations", mentorController.submitValidation);

// ============================================================================
// ROADMAP
// ============================================================================

/**
 * POST /api/mentor/roadmap/generate
 * Generate a personalized roadmap for a goal
 * Body: { goalId, weeks?, intensity?, startDate? }
 */
router.post("/roadmap/generate", mentorController.generateRoadmap);

/**
 * GET /api/mentor/roadmap/active
 * Get user's active roadmap
 */
router.get("/roadmap/active", mentorController.getActiveRoadmap);

/**
 * GET /api/mentor/roadmap/today
 * Get today's tasks
 */
router.get("/roadmap/today", mentorController.getTodaysTasks);

/**
 * POST /api/mentor/roadmap/tasks/:taskId/complete
 * Mark a task as completed
 * Body: { validationId? }
 */
router.post("/roadmap/tasks/:taskId/complete", mentorController.completeTask);

/**
 * POST /api/mentor/roadmap/:planId/adapt
 * Adapt roadmap based on performance (add easier tasks if struggling)
 */
router.post("/roadmap/:planId/adapt", mentorController.adaptRoadmap);

// ============================================================================
// AI MENTOR CHAT
// ============================================================================

/**
 * POST /api/mentor/chat
 * Chat with AI mentor
 * Body: { message, conversationHistory?, provider? }
 */
router.post("/chat", mentorController.chatWithMentor);

export default router;
