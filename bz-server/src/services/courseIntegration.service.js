/**
 * courseIntegration.service.js
 *
 * Bridges courses with the AI Mentor System.
 * Automatically updates user skills when they progress in courses.
 *
 * Integration Points:
 * - Course enrollment → Initialize required skills
 * - Problem solved → Update skill levels
 * - Course progress → Proportional skill updates
 * - Course completion → Validate skill achievement
 */

import pool from "../database/connect.db.js";
import SkillManagementService from "../learning-core/services/skillManagement.service.js";
import ValidationEngineService from "../learning-core/services/validationEngine.service.js";

const skillService = new SkillManagementService();
const validationService = new ValidationEngineService();

class CourseIntegrationService {
    /**
     * Hook: Called when user enrolls in a course
     * Initialize skills that the course teaches
     */
    async onCourseEnrollment(userId, courseId, client = null) {
        const db = client || pool;

        try {
            // Get skills taught by this course
            const courseSkills = await db.query(
                `
                SELECT skill_name, target_level FROM course_skills
                WHERE course_id = $1
            `,
                [courseId],
            );

            if (courseSkills.rows.length === 0) {
                console.warn(`[CourseIntegration] No skills mapped for course ${courseId}`);
                return;
            }

            // Initialize each skill if not already tracked
            for (const { skill_name, target_level } of courseSkills.rows) {
                await skillService.getUserSkill(userId, skill_name, db);

                console.log(`[CourseIntegration] Initialized skill ${skill_name} for user ${userId}`);
            }

            return {
                skillsInitialized: courseSkills.rows.length,
                skills: courseSkills.rows.map((s) => s.skill_name),
            };
        } catch (error) {
            console.error("[CourseIntegration] Error on course enrollment:", error);
            throw error;
        }
    }

    /**
     * Hook: Called when user solves a problem in a course
     * Update relevant skills immediately
     */
    async onProblemSolved(userId, problemId, courseId = null, verdict = "ACCEPTED", client = null) {
        const db = client || pool;

        try {
            if (verdict !== "ACCEPTED") {
                // Only update skills on successful completion
                return;
            }

            // Get problem's skill/category
            const problemResult = await db.query(
                `
                SELECT category FROM problem WHERE id = $1
            `,
                [problemId],
            );

            if (problemResult.rows.length === 0) {
                return;
            }

            const skillName = problemResult.rows[0].category;

            // Update skill - small confidence boost per problem
            const currentSkill = await skillService.getUserSkill(userId, skillName, db);

            const newConfidence = Math.min(currentSkill.confidence + 5, 100);

            await skillService.updateUserSkill(
                userId,
                skillName,
                {
                    confidence: newConfidence,
                    source: "problem_solved",
                    metadata: {
                        problemId,
                        courseId,
                        solvedAt: new Date().toISOString(),
                    },
                },
                db,
            );

            console.log(`[CourseIntegration] Updated skill ${skillName} for user ${userId} (problem solved)`);

            return {
                skillUpdated: skillName,
                newConfidence,
            };
        } catch (error) {
            console.error("[CourseIntegration] Error on problem solved:", error);
            // Don't throw - this is a side effect, shouldn't break main flow
        }
    }

    /**
     * Hook: Called when course progress changes
     * Update all course skills proportionally
     */
    async onCourseProgressUpdate(userId, courseId, progressPercentage, client = null) {
        const db = client || pool;

        try {
            const updates = await skillService.updateSkillsFromCourse(userId, courseId, progressPercentage, db);

            console.log(`[CourseIntegration] Updated ${updates.length} skills for user ${userId} from course progress`);

            return updates;
        } catch (error) {
            console.error("[CourseIntegration] Error on course progress update:", error);
            throw error;
        }
    }

    /**
     * Hook: Called when course is completed
     * Validate that user actually achieved the target skill levels
     */
    async onCourseCompletion(userId, courseId, client = null) {
        const db = client || pool;

        try {
            // Get course skills and target levels
            const courseSkills = await db.query(
                `
                SELECT skill_name, target_level 
                FROM course_skills
                WHERE course_id = $1
            `,
                [courseId],
            );

            const validationResults = [];

            for (const { skill_name, target_level } of courseSkills.rows) {
                const userSkill = await skillService.getUserSkill(userId, skill_name, db);

                const achieved = userSkill.level >= target_level;

                validationResults.push({
                    skill: skill_name,
                    targetLevel: target_level,
                    currentLevel: userSkill.level,
                    achieved,
                });

                // If not achieved, suggest taking assessment
                if (!achieved) {
                    console.warn(
                        `[CourseIntegration] User ${userId} completed course but didn't achieve ${skill_name} Level ${target_level}`,
                    );
                }
            }

            return {
                allSkillsAchieved: validationResults.every((r) => r.achieved),
                validationResults,
            };
        } catch (error) {
            console.error("[CourseIntegration] Error on course completion:", error);
            throw error;
        }
    }

    /**
     * Map course to skills (Admin function)
     */
    async mapCourseToSkills(courseId, skillMappings, client = null) {
        const db = client || pool;

        try {
            // skillMappings = [{skill_name, skill_weight, target_level, description}, ...]

            // Clear existing mappings
            await db.query(`DELETE FROM course_skills WHERE course_id = $1`, [courseId]);

            // Insert new mappings
            for (const mapping of skillMappings) {
                await db.query(
                    `
                    INSERT INTO course_skills 
                    (course_id, skill_name, skill_weight, target_level, description)
                    VALUES ($1, $2, $3, $4, $5)
                `,
                    [
                        courseId,
                        mapping.skill_name,
                        mapping.skill_weight || 1,
                        mapping.target_level || 2,
                        mapping.description || "",
                    ],
                );
            }

            console.log(`[CourseIntegration] Mapped ${skillMappings.length} skills to course ${courseId}`);

            return {
                courseId,
                skillsMapped: skillMappings.length,
            };
        } catch (error) {
            console.error("[CourseIntegration] Error mapping course to skills:", error);
            throw error;
        }
    }

    /**
     * Get course skill mappings
     */
    async getCourseSkillMappings(courseId, client = null) {
        const db = client || pool;

        try {
            const result = await db.query(
                `
                SELECT 
                    cs.*,
                    sc.display_name,
                    sc.category,
                    sc.description as skill_description
                FROM course_skills cs
                LEFT JOIN skill_catalog sc ON cs.skill_name = sc.skill_name
                WHERE cs.course_id = $1
                ORDER BY cs.skill_weight DESC
            `,
                [courseId],
            );

            return result.rows;
        } catch (error) {
            console.error("[CourseIntegration] Error getting course skill mappings:", error);
            return [];
        }
    }

    /**
     * Recommend courses based on user's skill gaps
     */
    async recommendCoursesForSkillGaps(userId, skillGaps, client = null) {
        const db = client || pool;

        try {
            if (!skillGaps || skillGaps.length === 0) {
                return [];
            }

            const skillNames = skillGaps.map((g) => g.skill);

            const result = await db.query(
                `
                SELECT DISTINCT
                    c.id,
                    c.title,
                    c.description,
                    c.category,
                    c.difficulty,
                    array_agg(DISTINCT cs.skill_name) as skills_taught,
                    COUNT(DISTINCT cs.skill_name) FILTER (WHERE cs.skill_name = ANY($1)) as relevant_skills_count,
                    AVG(cs.target_level) FILTER (WHERE cs.skill_name = ANY($1)) as avg_target_level
                FROM courses c
                JOIN course_skills cs ON c.id = cs.course_id
                WHERE cs.skill_name = ANY($1)
                GROUP BY c.id, c.title, c.description, c.category, c.difficulty
                HAVING COUNT(DISTINCT cs.skill_name) FILTER (WHERE cs.skill_name = ANY($1)) > 0
                ORDER BY relevant_skills_count DESC, avg_target_level ASC
                LIMIT 5
            `,
                [skillNames],
            );

            return result.rows.map((course) => ({
                ...course,
                relevanceReason: `Teaches ${course.relevant_skills_count} skill(s) you need`,
                matchedSkills: skillGaps.filter((g) => course.skills_taught.includes(g.skill)),
            }));
        } catch (error) {
            console.error("[CourseIntegration] Error recommending courses:", error);
            return [];
        }
    }

    /**
     * Get user's skill progress across all courses
     */
    async getUserSkillProgressAcrossCourses(userId, client = null) {
        const db = client || pool;

        try {
            const result = await db.query(
                `
                SELECT 
                    us.skill_name,
                    us.level,
                    us.confidence,
                    array_agg(DISTINCT c.title) as learned_from_courses,
                    COUNT(DISTINCT ucp.course_id) as active_courses_for_skill
                FROM user_skills us
                LEFT JOIN course_skills cs ON us.skill_name = cs.skill_name
                LEFT JOIN courses c ON cs.course_id = c.id
                LEFT JOIN user_course_progress ucp ON ucp.course_id = c.id AND ucp.user_id = us.user_id
                WHERE us.user_id = $1
                GROUP BY us.skill_name, us.level, us.confidence
                ORDER BY us.level DESC, us.confidence DESC
            `,
                [userId],
            );

            return result.rows;
        } catch (error) {
            console.error("[CourseIntegration] Error getting user skill progress:", error);
            return [];
        }
    }
}

export default CourseIntegrationService;
