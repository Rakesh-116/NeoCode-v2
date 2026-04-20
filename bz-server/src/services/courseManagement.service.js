/**
 * courseManagement.service.js
 * 
 * Manages hierarchical course structure: Courses → Modules → Topics → Content.
 * Extends the existing flat course system with multi-level organization.
 * 
 * Features:
 * - Role-based module creation (admin full control, user limited)
 * - Default templates with custom submodule support
 * - Progress tracking across hierarchy
 * - Backward compatible with existing course_problems
 * 
 * Dependencies:
 * - Database: course_modules, course_topics, course_content, course_progress
 * - Integrates with: courseIntegration.service.js for skill tracking
 */

import { pool } from "../database/connect.db.js";

class CourseManagementService {
    /**
     * Create a new course module
     * @param {UUID} courseId - Course ID
     * @param {Object} moduleData - { title, description, isDefault, isCustom, rolePermission, createdBy }
     * @param {Object} client - Optional database client for transactions
     * @returns {Object} Created module
     */
    async createModule(courseId, moduleData, client = null) {
        const db = client || pool;
        const {
            title,
            description,
            displayOrder = 1,
            isDefault = false,
            isCustom = false,
            rolePermission = "admin",
            createdBy,
        } = moduleData;

        try {
            // Validate course exists
            const courseCheck = await db.query(
                `SELECT id FROM public.courses WHERE id = $1`,
                [courseId]
            );

            if (courseCheck.rows.length === 0) {
                throw new Error(`Course with ID ${courseId} not found`);
            }

            // Validate role permission
            const allowedRoles = ["admin", "user", "mentor"];
            if (!allowedRoles.includes(rolePermission)) {
                throw new Error(`Invalid role permission: ${rolePermission}`);
            }

            // Insert module
            const result = await db.query(
                `
                INSERT INTO public.course_modules 
                (course_id, title, description, display_order, created_by, is_default, is_custom, role_permission)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *
                `,
                [
                    courseId,
                    title,
                    description,
                    displayOrder,
                    createdBy,
                    isDefault,
                    isCustom,
                    rolePermission,
                ]
            );

            console.log(
                `[CourseManagement] Created module "${title}" for course ${courseId}`
            );
            return result.rows[0];
        } catch (error) {
            console.error(
                `[CourseManagement] Error creating module for course ${courseId}:`,
                error.message
            );
            throw error;
        }
    }

    /**
     * Create a new topic within a module
     * @param {UUID} moduleId - Module ID
     * @param {Object} topicData - { title, description, difficultyLevel, estimatedDuration, prerequisiteTopics, createdBy }
     * @param {Object} client - Optional database client for transactions
     * @returns {Object} Created topic
     */
    async createTopic(moduleId, topicData, client = null) {
        const db = client || pool;
        const {
            title,
            description,
            displayOrder = 1,
            estimatedDurationMinutes = null,
            difficultyLevel = 2,
            isPrerequisite = false,
            prerequisiteTopics = [],
            createdBy,
        } = topicData;

        try {
            // Validate module exists
            const moduleCheck = await db.query(
                `SELECT public.course_modules.id, public.course_modules.course_id FROM public.course_modules WHERE public.course_modules.id = $1`,
                [moduleId]
            );

            if (moduleCheck.rows.length === 0) {
                throw new Error(`Module with ID ${moduleId} not found`);
            }

            // Validate difficulty level
            if (difficultyLevel < 1 || difficultyLevel > 5) {
                throw new Error(`Difficulty level must be between 1 and 5`);
            }

            // Insert topic
            const result = await db.query(
                `
                INSERT INTO public.course_topics 
                (module_id, title, description, display_order, estimated_duration_minutes, 
                 difficulty_level, is_prerequisite, prerequisite_topics, created_by)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *
                `,
                [
                    moduleId,
                    title,
                    description,
                    displayOrder,
                    estimatedDurationMinutes,
                    difficultyLevel,
                    isPrerequisite,
                    prerequisiteTopics,
                    createdBy,
                ]
            );

            console.log(
                `[CourseManagement] Created topic "${title}" in module ${moduleId}`
            );
            return result.rows[0];
        } catch (error) {
            console.error(
                `[CourseManagement] Error creating topic in module ${moduleId}:`,
                error.message
            );
            throw error;
        }
    }

    /**
     * Add content to a topic
     * @param {UUID} topicId - Topic ID
     * @param {Object} contentData - { contentType, title, description, problemId, fileUrl, markdownContent, etc. }
     * @param {Object} client - Optional database client for transactions
     * @returns {Object} Created content
     */
    async addContent(topicId, contentData, client = null) {
        const db = client || pool;
        const {
            contentType,
            title,
            description,
            displayOrder = 1,
            problemId = null,
            fileUrl = null,
            markdownContent = null,
            codeSnippet = null,
            quizData = null,
            videoUrl = null,
            externalUrl = null,
            metadata = {},
            points = 0,
            isMandatory = true,
            estimatedDurationMinutes = null,
            createdBy,
        } = contentData;

        try {
            // Validate topic exists
            const topicCheck = await db.query(
                `SELECT public.course_topics.id FROM public.course_topics WHERE public.course_topics.id = $1`,
                [topicId]
            );

            if (topicCheck.rows.length === 0) {
                throw new Error(`Topic with ID ${topicId} not found`);
            }

            // Validate content type
            const allowedTypes = [
                "problem",
                "pdf",
                "video",
                "markdown",
                "code",
                "quiz",
                "external_link",
            ];
            if (!allowedTypes.includes(contentType)) {
                throw new Error(`Invalid content type: ${contentType}`);
            }

            // Validate problem reference if content type is problem
            if (contentType === "problem" && problemId) {
                const problemCheck = await db.query(
                    `SELECT id FROM public.problem WHERE id = $1`,
                    [problemId]
                );

                if (problemCheck.rows.length === 0) {
                    throw new Error(`Problem with ID ${problemId} not found`);
                }
            }

            // Insert content
            const result = await db.query(
                `
                INSERT INTO public.course_content 
                (topic_id, content_type, title, description, display_order, problem_id, file_url, 
                 markdown_content, code_snippet, quiz_data, video_url, external_url, metadata, 
                 points, is_mandatory, estimated_duration_minutes, created_by)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
                RETURNING *
                `,
                [
                    topicId,
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
                    createdBy,
                ]
            );

            console.log(
                `[CourseManagement] Added ${contentType} content "${title}" to topic ${topicId}`
            );
            return result.rows[0];
        } catch (error) {
            console.error(
                `[CourseManagement] Error adding content to topic ${topicId}:`,
                error.message
            );
            throw error;
        }
    }

    /**
     * Get full course hierarchy with modules, topics, and content
     * @param {UUID} courseId - Course ID
     * @param {UUID} userId - Optional user ID for progress tracking
     * @param {Object} client - Optional database client
     * @returns {Object} Full course hierarchy
     */
    async getCourseHierarchy(courseId, userId = null, client = null) {
        const db = client || pool;

        try {
            // Get course details
            const courseResult = await db.query(
                `SELECT * FROM public.courses WHERE id = $1`,
                [courseId]
            );

            if (courseResult.rows.length === 0) {
                throw new Error(`Course with ID ${courseId} not found`);
            }

            const course = courseResult.rows[0];

            // Get all modules for this course
            const modulesResult = await db.query(
                `
                SELECT * FROM public.course_modules 
                WHERE course_id = $1 AND status = 'active'
                ORDER BY display_order
                `,
                [courseId]
            );

            const modules = modulesResult.rows;

            // Get all topics with their module IDs
            const moduleIds = modules.map((m) => m.id);
            let topics = [];

            if (moduleIds.length > 0) {
                const topicsResult = await db.query(
                    `
                    SELECT * FROM public.course_topics 
                    WHERE module_id = ANY($1::uuid[]) AND status = 'active'
                    ORDER BY module_id, display_order
                    `,
                    [moduleIds]
                );
                topics = topicsResult.rows;
            }

            // Get all content with their topic IDs
            const topicIds = topics.map((t) => t.id);
            let contents = [];

            if (topicIds.length > 0) {
                const contentsResult = await db.query(
                    `
                    SELECT * FROM public.course_content 
                    WHERE topic_id = ANY($1::uuid[])
                    ORDER BY topic_id, display_order
                    `,
                    [topicIds]
                );
                contents = contentsResult.rows;
            }

            const legacyProblemsResult = await db.query(
                `
                SELECT
                    cp.id,
                    cp.problem_id,
                    cp.points,
                    cp.visibility,
                    cp.created_at,
                    p.title AS problem_title,
                    p.description AS problem_description,
                    p.difficulty,
                    p.category AS problem_category,
                    p.score
                FROM public.course_problems cp
                JOIN public.problem p ON p.id = cp.problem_id
                WHERE cp.course_id = $1
                  AND NOT EXISTS (
                    SELECT 1
                    FROM public.course_content cc
                    JOIN public.course_topics ct ON ct.id = cc.topic_id
                    JOIN public.course_modules cm ON cm.id = ct.module_id
                    WHERE cm.course_id = cp.course_id
                      AND cc.problem_id = cp.problem_id
                  )
                ORDER BY cp.created_at ASC
                `,
                [courseId]
            );
            const legacyProblems = legacyProblemsResult.rows;

            // Get user progress if userId provided
            let progressMap = {};
            if (userId && (moduleIds.length > 0 || topicIds.length > 0)) {
                const progressResult = await db.query(
                    `
                    SELECT * FROM public.course_progress 
                    WHERE user_id = $1 AND course_id = $2
                    `,
                    [userId, courseId]
                );

                // Create a map for quick lookup
                progressResult.rows.forEach((progress) => {
                    const key = `${progress.module_id || ""}_${progress.topic_id || ""}_${progress.content_id || ""}`;
                    progressMap[key] = progress;
                });
            }

            // Build nested hierarchy
            const hierarchyModules = modules.map((module) => {
                const moduleProgress = progressMap[`${module.id}__`] || null;
                return {
                    ...module,
                    progress: moduleProgress,
                    topics: topics
                        .filter((t) => t.module_id === module.id)
                        .map((topic) => {
                            const topicProgress =
                                progressMap[`${module.id}_${topic.id}_`] || null;
                            return {
                                ...topic,
                                progress: topicProgress,
                                contents: contents
                                    .filter((c) => c.topic_id === topic.id)
                                    .map((content) => {
                                        const contentProgress =
                                            progressMap[
                                                `${module.id}_${topic.id}_${content.id}`
                                            ] || null;
                                        return {
                                            ...content,
                                            progress: contentProgress,
                                        };
                                    }),
                            };
                        }),
                };
            });

            if (legacyProblems.length > 0) {
                hierarchyModules.push({
                    id: `legacy-problems-${courseId}`,
                    course_id: courseId,
                    title: "Course Problems",
                    description: "Problems added through the classic course builder.",
                    display_order: hierarchyModules.length + 1,
                    is_default: true,
                    is_custom: false,
                    role_permission: "user",
                    status: "active",
                    progress: null,
                    topics: [
                        {
                            id: `legacy-topic-${courseId}`,
                            module_id: `legacy-problems-${courseId}`,
                            title: "Practice Set",
                            description: "Curated coding problems for this course.",
                            display_order: 1,
                            difficulty_level: 2,
                            status: "active",
                            progress: null,
                            contents: legacyProblems.map((problem, index) => ({
                                id: `legacy-content-${problem.id}`,
                                topic_id: `legacy-topic-${courseId}`,
                                content_type: "problem",
                                title: problem.problem_title,
                                description: problem.problem_description,
                                display_order: index + 1,
                                problem_id: problem.problem_id,
                                points: problem.points,
                                is_mandatory: true,
                                metadata: {
                                    source: "course_problems",
                                    course_problem_id: problem.id,
                                    difficulty: problem.difficulty,
                                    category: problem.problem_category,
                                    score: problem.score,
                                    visibility: problem.visibility,
                                },
                                progress: null,
                            })),
                        },
                    ],
                });
            }

            const hierarchy = {
                ...course,
                modules: hierarchyModules,
            };

            return hierarchy;
        } catch (error) {
            console.error(
                `[CourseManagement] Error fetching course hierarchy for ${courseId}:`,
                error.message
            );
            throw error;
        }
    }

    /**
     * Track user progress for a specific content item
     * @param {UUID} userId - User ID
     * @param {UUID} contentId - Content ID
     * @param {Object} progressData - { status, completionPercentage, timeSpentMinutes, notes }
     * @param {Object} client - Optional database client
     * @returns {Object} Updated progress record
     */
    async updateContentProgress(userId, contentId, progressData, client = null) {
        const db = client || pool;
        const {
            status = "in_progress",
            completionPercentage = 0,
            timeSpentMinutes = 0,
            notes = null,
        } = progressData;

        try {
            // Get content and its hierarchy
            const contentResult = await db.query(
                `
                SELECT 
                    cc.id AS content_id,
                    cc.topic_id,
                    ct.module_id,
                    cm.course_id
                FROM public.course_content cc
                JOIN public.course_topics ct ON ct.id = cc.topic_id
                JOIN public.course_modules cm ON cm.id = ct.module_id
                WHERE cc.id = $1
                `,
                [contentId]
            );

            if (contentResult.rows.length === 0) {
                throw new Error(`Content with ID ${contentId} not found`);
            }

            const { topic_id, module_id, course_id } = contentResult.rows[0];

            // Validate status
            const allowedStatuses = ["not_started", "in_progress", "completed", "skipped"];
            if (!allowedStatuses.includes(status)) {
                throw new Error(`Invalid status: ${status}`);
            }

            // Validate completion percentage
            if (completionPercentage < 0 || completionPercentage > 100) {
                throw new Error(`Completion percentage must be between 0 and 100`);
            }

            // Determine completion timestamp
            const completedAt = status === "completed" ? new Date() : null;

            // Upsert progress record
            const result = await db.query(
                `
                INSERT INTO public.course_progress 
                (user_id, course_id, module_id, topic_id, content_id, status, 
                 completion_percentage, time_spent_minutes, last_accessed_at, completed_at, notes)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9, $10)
                ON CONFLICT (user_id, course_id, module_id, topic_id, content_id)
                DO UPDATE SET
                    status = EXCLUDED.status,
                    completion_percentage = EXCLUDED.completion_percentage,
                    time_spent_minutes = public.course_progress.time_spent_minutes + EXCLUDED.time_spent_minutes,
                    last_accessed_at = NOW(),
                    completed_at = EXCLUDED.completed_at,
                    notes = COALESCE(EXCLUDED.notes, public.course_progress.notes),
                    updated_at = NOW()
                RETURNING *
                `,
                [
                    userId,
                    course_id,
                    module_id,
                    topic_id,
                    contentId,
                    status,
                    completionPercentage,
                    timeSpentMinutes,
                    completedAt,
                    notes,
                ]
            );

            console.log(
                `[CourseManagement] Updated progress for user ${userId} on content ${contentId}`
            );
            return result.rows[0];
        } catch (error) {
            console.error(
                `[CourseManagement] Error updating content progress:`,
                error.message
            );
            throw error;
        }
    }

    /**
     * Get user's overall progress for a course
     * @param {UUID} userId - User ID
     * @param {UUID} courseId - Course ID
     * @param {Object} client - Optional database client
     * @returns {Object} Course progress summary
     */
    async getCourseProgress(userId, courseId, client = null) {
        const db = client || pool;

        try {
            // Get total content count
            const totalResult = await db.query(
                `
                SELECT COUNT(cc.id) AS total_content
                FROM public.course_content cc
                JOIN public.course_topics ct ON ct.id = cc.topic_id
                JOIN public.course_modules cm ON cm.id = ct.module_id
                WHERE cm.course_id = $1 AND cm.status = 'active' AND ct.status = 'active'
                `,
                [courseId]
            );

            const totalContent = parseInt(totalResult.rows[0]?.total_content || 0);

            // Get completed content count
            const completedResult = await db.query(
                `
                SELECT COUNT(*) AS completed_content
                FROM public.course_progress
                WHERE user_id = $1 AND course_id = $2 AND status = 'completed'
                `,
                [userId, courseId]
            );

            const completedContent = parseInt(completedResult.rows[0]?.completed_content || 0);

            // Calculate overall percentage
            const overallPercentage =
                totalContent > 0 ? Math.round((completedContent / totalContent) * 100) : 0;

            // Get time spent
            const timeResult = await db.query(
                `
                SELECT COALESCE(SUM(time_spent_minutes), 0) AS total_time_minutes
                FROM public.course_progress
                WHERE user_id = $1 AND course_id = $2
                `,
                [userId, courseId]
            );

            const totalTimeMinutes = parseInt(timeResult.rows[0]?.total_time_minutes || 0);

            return {
                courseId,
                userId,
                totalContent,
                completedContent,
                overallPercentage,
                totalTimeMinutes,
            };
        } catch (error) {
            console.error(
                `[CourseManagement] Error fetching course progress:`,
                error.message
            );
            throw error;
        }
    }

    /**
     * Check if user has permission to create a module
     * @param {String} userRole - User's role (admin, user, mentor)
     * @param {String} moduleRolePermission - Required role for module creation
     * @returns {Boolean} Has permission
     */
    hasModuleCreationPermission(userRole, moduleRolePermission) {
        const roleHierarchy = { admin: 3, mentor: 2, user: 1 };
        return roleHierarchy[userRole] >= roleHierarchy[moduleRolePermission];
    }
}

export default CourseManagementService;
