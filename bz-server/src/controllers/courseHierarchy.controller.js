/**
 * courseHierarchy.controller.js
 * 
 * Handles course hierarchy operations: modules, topics, and content.
 * Extends the basic course CRUD with multi-level organization.
 * 
 * Features:
 * - Module management (create, update, get hierarchy)
 * - Topic management within modules
 * - Content management within topics
 * - Progress tracking across hierarchy
 * - Role-based permissions
 */

import { pool } from "../database/connect.db.js";
import CourseManagementService from "../services/courseManagement.service.js";
import { canAccessCourse } from "../services/courseAccess.service.js";

const courseService = new CourseManagementService();

/**
 * Create a module within a course
 * POST /api/courses/:courseId/modules
 */
const createModuleController = async (req, res) => {
    const { courseId } = req.params;
    const {
        title,
        description,
        displayOrder,
        isDefault,
        isCustom,
        rolePermission,
    } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role || "user";

    // Validation
    if (!title) {
        return res.status(400).json({
            success: false,
            message: "Module title is required",
        });
    }

    try {
        // Check role permissions
        const requiredRole = rolePermission || "admin";
        if (!courseService.hasModuleCreationPermission(userRole, requiredRole)) {
            return res.status(403).json({
                success: false,
                message: `Insufficient permissions. Required role: ${requiredRole}`,
            });
        }

        const module = await courseService.createModule(courseId, {
            title,
            description,
            displayOrder,
            isDefault,
            isCustom,
            rolePermission: requiredRole,
            createdBy: userId,
        });

        return res.status(201).json({
            success: true,
            message: "Module created successfully",
            module,
        });
    } catch (error) {
        console.error(
            `[CourseHierarchyController] Error creating module for course ${courseId}:`,
            error.message
        );
        return res.status(500).json({
            success: false,
            message: "Failed to create module. Please try again later.",
        });
    }
};

/**
 * Create a topic within a module
 * POST /api/courses/:courseId/modules/:moduleId/topics
 */
const createTopicController = async (req, res) => {
    const { moduleId } = req.params;
    const {
        title,
        description,
        displayOrder,
        estimatedDurationMinutes,
        difficultyLevel,
        isPrerequisite,
        prerequisiteTopics,
    } = req.body;
    const userId = req.user.id;

    // Validation
    if (!title) {
        return res.status(400).json({
            success: false,
            message: "Topic title is required",
        });
    }

    try {
        const topic = await courseService.createTopic(moduleId, {
            title,
            description,
            displayOrder,
            estimatedDurationMinutes,
            difficultyLevel,
            isPrerequisite,
            prerequisiteTopics,
            createdBy: userId,
        });

        return res.status(201).json({
            success: true,
            message: "Topic created successfully",
            topic,
        });
    } catch (error) {
        console.error(
            `[CourseHierarchyController] Error creating topic for module ${moduleId}:`,
            error.message
        );
        return res.status(500).json({
            success: false,
            message: "Failed to create topic. Please try again later.",
        });
    }
};

/**
 * Add content to a topic
 * POST /api/courses/:courseId/modules/:moduleId/topics/:topicId/content
 */
const addContentController = async (req, res) => {
    const { topicId } = req.params;
    const {
        contentType,
        title,
        description,
        displayOrder,
        problemId,
        fileUrl,
        markdownContent,
        codeSnippet,
        quizData,
        videoUrl,
        externalUrl,
        metadata,
        points,
        isMandatory,
        estimatedDurationMinutes,
    } = req.body;
    const userId = req.user.id;

    // Validation
    if (!contentType || !title) {
        return res.status(400).json({
            success: false,
            message: "Content type and title are required",
        });
    }

    const validContentTypes = [
        "problem",
        "pdf",
        "video",
        "markdown",
        "code",
        "quiz",
        "external_link",
    ];
    if (!validContentTypes.includes(contentType)) {
        return res.status(400).json({
            success: false,
            message: `Invalid content type. Allowed: ${validContentTypes.join(", ")}`,
        });
    }

    try {
        const content = await courseService.addContent(topicId, {
            contentType,
            title,
            description,
            displayOrder,
            problemId,
            fileUrl,
            markdownContent,
            codeSnippet,
            quizData,
            videoUrl,
            externalUrl,
            metadata,
            points,
            isMandatory,
            estimatedDurationMinutes,
            createdBy: userId,
        });

        return res.status(201).json({
            success: true,
            message: "Content added successfully",
            content,
        });
    } catch (error) {
        console.error(
            `[CourseHierarchyController] Error adding content to topic ${topicId}:`,
            error.message
        );
        return res.status(500).json({
            success: false,
            message: "Failed to add content. Please try again later.",
        });
    }
};

/**
 * Get full course hierarchy (modules → topics → content)
 * GET /api/courses/:courseId/hierarchy
 */
const getCourseHierarchyController = async (req, res) => {
    const { courseId } = req.params;
    const userId = req.userId;

    try {
        const hasAccess = await canAccessCourse(userId, courseId);
        if (!hasAccess) {
            const courseResult = await pool.query(
                `SELECT id, title, category, description, is_paid, price_amount, price_currency, access_type
                 FROM public.courses
                 WHERE id = $1`,
                [courseId]
            );

            if (courseResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Course not found",
                });
            }

            return res.status(403).json({
                success: false,
                error: "payment_required",
                message: "Purchase this course to access content",
                course: {
                    ...courseResult.rows[0],
                    modules: [],
                    user_has_access: false,
                },
            });
        }

        const hierarchy = await courseService.getCourseHierarchy(
            courseId,
            userId
        );

        return res.status(200).json({
            success: true,
            course: {
                ...hierarchy,
                user_has_access: true,
            },
        });
    } catch (error) {
        console.error(
            `[CourseHierarchyController] Error fetching course hierarchy for ${courseId}:`,
            error.message
        );

        if (error.message.includes("not found")) {
            return res.status(404).json({
                success: false,
                message: "Course not found",
            });
        }

        return res.status(500).json({
            success: false,
            message: "Failed to fetch course hierarchy. Please try again later.",
        });
    }
};

/**
 * Update content progress
 * PUT /api/courses/content/:contentId/progress
 */
const updateContentProgressController = async (req, res) => {
    const { contentId } = req.params;
    const { status, completionPercentage, timeSpentMinutes, notes } = req.body;
    const userId = req.user.id;

    // Validation
    if (!status) {
        return res.status(400).json({
            success: false,
            message: "Progress status is required",
        });
    }

    const validStatuses = ["not_started", "in_progress", "completed", "skipped"];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({
            success: false,
            message: `Invalid status. Allowed: ${validStatuses.join(", ")}`,
        });
    }

    try {
        const progress = await courseService.updateContentProgress(
            userId,
            contentId,
            {
                status,
                completionPercentage,
                timeSpentMinutes,
                notes,
            }
        );

        return res.status(200).json({
            success: true,
            message: "Progress updated successfully",
            progress,
        });
    } catch (error) {
        console.error(
            `[CourseHierarchyController] Error updating content progress for ${contentId}:`,
            error.message
        );

        if (error.message.includes("not found")) {
            return res.status(404).json({
                success: false,
                message: "Content not found",
            });
        }

        return res.status(500).json({
            success: false,
            message: "Failed to update progress. Please try again later.",
        });
    }
};

/**
 * Get user's course progress summary
 * GET /api/courses/:courseId/progress
 */
const getCourseProgressController = async (req, res) => {
    const { courseId } = req.params;
    const userId = req.user.id;

    try {
        const progress = await courseService.getCourseProgress(userId, courseId);

        return res.status(200).json({
            success: true,
            progress,
        });
    } catch (error) {
        console.error(
            `[CourseHierarchyController] Error fetching course progress for ${courseId}:`,
            error.message
        );
        return res.status(500).json({
            success: false,
            message: "Failed to fetch progress. Please try again later.",
        });
    }
};

/**
 * Get all modules for a course
 * GET /api/courses/:courseId/modules
 */
const getModulesController = async (req, res) => {
    const { courseId } = req.params;

    try {
        const result = await pool.query(
            `
            SELECT * FROM public.course_modules
            WHERE course_id = $1 AND status = 'active'
            ORDER BY display_order
            `,
            [courseId]
        );

        return res.status(200).json({
            success: true,
            modules: result.rows,
            count: result.rowCount,
        });
    } catch (error) {
        console.error(
            `[CourseHierarchyController] Error fetching modules for course ${courseId}:`,
            error.message
        );
        return res.status(500).json({
            success: false,
            message: "Failed to fetch modules. Please try again later.",
        });
    }
};

/**
 * Get all topics for a module
 * GET /api/courses/:courseId/modules/:moduleId/topics
 */
const getTopicsController = async (req, res) => {
    const { moduleId } = req.params;

    try {
        const result = await pool.query(
            `
            SELECT * FROM public.course_topics
            WHERE module_id = $1 AND status = 'active'
            ORDER BY display_order
            `,
            [moduleId]
        );

        return res.status(200).json({
            success: true,
            topics: result.rows,
            count: result.rowCount,
        });
    } catch (error) {
        console.error(
            `[CourseHierarchyController] Error fetching topics for module ${moduleId}:`,
            error.message
        );
        return res.status(500).json({
            success: false,
            message: "Failed to fetch topics. Please try again later.",
        });
    }
};

/**
 * Get all content for a topic
 * GET /api/courses/:courseId/modules/:moduleId/topics/:topicId/content
 */
const getContentController = async (req, res) => {
    const { topicId } = req.params;

    try {
        const result = await pool.query(
            `
            SELECT * FROM public.course_content
            WHERE topic_id = $1
            ORDER BY display_order
            `,
            [topicId]
        );

        return res.status(200).json({
            success: true,
            content: result.rows,
            count: result.rowCount,
        });
    } catch (error) {
        console.error(
            `[CourseHierarchyController] Error fetching content for topic ${topicId}:`,
            error.message
        );
        return res.status(500).json({
            success: false,
            message: "Failed to fetch content. Please try again later.",
        });
    }
};

export {
    createModuleController,
    createTopicController,
    addContentController,
    getCourseHierarchyController,
    updateContentProgressController,
    getCourseProgressController,
    getModulesController,
    getTopicsController,
    getContentController,
};
