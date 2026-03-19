/**
 * courseHierarchy.routes.js
 * 
 * Routes for course hierarchy management (modules, topics, content, progress).
 * Supports role-based access control for module creation.
 * 
 * Base path: /api/courses
 */

import express from "express";
import {
    createModuleController,
    createTopicController,
    addContentController,
    getCourseHierarchyController,
    updateContentProgressController,
    getCourseProgressController,
    getModulesController,
    getTopicsController,
    getContentController,
} from "../controllers/courseHierarchy.controller.js";
import { authentication } from "../middlewares/authentication.js";

const router = express.Router();

// ============================================================================
// Course Hierarchy Routes
// ============================================================================

/**
 * GET /api/courses/:courseId/hierarchy
 * Get full course hierarchy (modules → topics → content) with optional progress
 * Auth: Optional (progress only if authenticated)
 */
router.get("/:courseId/hierarchy", authentication, getCourseHierarchyController);

/**
 * GET /api/courses/:courseId/progress
 * Get user's overall progress for a course
 * Auth: Required
 */
router.get("/:courseId/progress", authentication, getCourseProgressController);

// ============================================================================
// Module Routes
// ============================================================================

/**
 * GET /api/courses/:courseId/modules
 * Get all modules for a course
 * Auth: Optional
 */
router.get("/:courseId/modules", getModulesController);

/**
 * POST /api/courses/:courseId/modules
 * Create a new module within a course
 * Auth: Required (role-based)
 */
router.post("/:courseId/modules", authentication, createModuleController);

// ============================================================================
// Topic Routes
// ============================================================================

/**
 * GET /api/courses/:courseId/modules/:moduleId/topics
 * Get all topics for a module
 * Auth: Optional
 */
router.get("/:courseId/modules/:moduleId/topics", getTopicsController);

/**
 * POST /api/courses/:courseId/modules/:moduleId/topics
 * Create a new topic within a module
 * Auth: Required
 */
router.post(
    "/:courseId/modules/:moduleId/topics",
    authentication,
    createTopicController
);

// ============================================================================
// Content Routes
// ============================================================================

/**
 * GET /api/courses/:courseId/modules/:moduleId/topics/:topicId/content
 * Get all content for a topic
 * Auth: Optional
 */
router.get(
    "/:courseId/modules/:moduleId/topics/:topicId/content",
    getContentController
);

/**
 * POST /api/courses/:courseId/modules/:moduleId/topics/:topicId/content
 * Add content to a topic
 * Auth: Required
 */
router.post(
    "/:courseId/modules/:moduleId/topics/:topicId/content",
    authentication,
    addContentController
);

// ============================================================================
// Progress Tracking Routes
// ============================================================================

/**
 * PUT /api/courses/content/:contentId/progress
 * Update user's progress for specific content
 * Auth: Required
 */
router.put(
    "/content/:contentId/progress",
    authentication,
    updateContentProgressController
);

export default router;
