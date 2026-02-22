/**
 * SkillManagementService.js
 *
 * Manages user skill profiles, assessments, and skill level calculations.
 * This is the foundation of the AI Mentor System - it tracks what users know.
 *
 * Responsibilities:
 * - Track user skill levels (0-5 scale)
 * - Calculate skill confidence scores
 * - Run skill assessments
 * - Update skills based on course progress
 * - Aggregate skills across courses
 * - Identify skill gaps for goals
 */

import pool from "../../database/connect.db.js";

class SkillManagementService {
    /**
     * Get user's complete skill profile
     */
    async getUserSkillProfile(userId, client = null) {
        const db = client || pool;

        try {
            const result = await db.query(
                `
                SELECT 
                    us.*,
                    sc.display_name,
                    sc.category,
                    sc.prerequisites,
                    CASE 
                        WHEN us.level >= 4 THEN 'expert'
                        WHEN us.level >= 3 THEN 'advanced'
                        WHEN us.level >= 2 THEN 'intermediate'
                        WHEN us.level >= 1 THEN 'beginner'
                        ELSE 'none'
                    END as proficiency_label
                FROM user_skills us
                LEFT JOIN skill_catalog sc ON us.skill_name = sc.skill_name
                WHERE us.user_id = $1
                ORDER BY us.level DESC, us.confidence DESC
            `,
                [userId],
            );

            return result.rows;
        } catch (error) {
            console.error("[SkillManagementService] Error getting user skill profile:", error);
            throw error;
        }
    }

    /**
     * Get or initialize a specific skill for a user
     */
    async getUserSkill(userId, skillName, client = null) {
        const db = client || pool;

        try {
            let result = await db.query(
                `
                SELECT * FROM user_skills 
                WHERE user_id = $1 AND skill_name = $2
            `,
                [userId, skillName],
            );

            if (result.rows.length === 0) {
                // Initialize skill at level 0
                result = await db.query(
                    `
                    INSERT INTO user_skills (user_id, skill_name, level, confidence, source)
                    VALUES ($1, $2, 0, 50, 'system_init')
                    RETURNING *
                `,
                    [userId, skillName],
                );
            }

            return result.rows[0];
        } catch (error) {
            console.error("[SkillManagementService] Error getting user skill:", error);
            throw error;
        }
    }

    /**
     * Update user skill level and confidence
     */
    async updateUserSkill(userId, skillName, updates, client = null) {
        const db = client || pool;

        try {
            const { level, confidence, source, metadata } = updates;

            const result = await db.query(
                `
                INSERT INTO user_skills (user_id, skill_name, level, confidence, source, metadata, last_assessed_at, assessment_count)
                VALUES ($1, $2, $3, $4, $5, $6, NOW(), 1)
                ON CONFLICT (user_id, skill_name) 
                DO UPDATE SET
                    level = CASE 
                        WHEN EXCLUDED.level IS NOT NULL THEN EXCLUDED.level 
                        ELSE user_skills.level 
                    END,
                    confidence = CASE 
                        WHEN EXCLUDED.confidence IS NOT NULL THEN EXCLUDED.confidence 
                        ELSE user_skills.confidence 
                    END,
                    source = EXCLUDED.source,
                    metadata = user_skills.metadata || EXCLUDED.metadata,
                    last_assessed_at = NOW(),
                    assessment_count = user_skills.assessment_count + 1,
                    updated_at = NOW()
                RETURNING *
            `,
                [userId, skillName, level, confidence, source, metadata || {}],
            );

            return result.rows[0];
        } catch (error) {
            console.error("[SkillManagementService] Error updating user skill:", error);
            throw error;
        }
    }

    /**
     * Calculate skill level based on assessment score
     * Score 0-100 → Level 0-5
     */
    calculateSkillLevel(score) {
        if (score < 20) return 0; // None
        if (score < 40) return 1; // Beginner
        if (score < 60) return 2; // Intermediate
        if (score < 80) return 3; // Advanced
        if (score < 95) return 4; // Expert
        return 5; // Master
    }

    /**
     * Get skill assessment by ID
     */
    async getSkillAssessment(assessmentId, client = null) {
        const db = client || pool;

        try {
            const result = await db.query(
                `
                SELECT * FROM skill_assessments
                WHERE id = $1 AND is_active = true
            `,
                [assessmentId],
            );

            return result.rows[0];
        } catch (error) {
            console.error("[SkillManagementService] Error getting skill assessment:", error);
            throw error;
        }
    }

    /**
     * Get assessments for a specific skill
     */
    async getSkillAssessments(skillName, difficultyLevel = null, client = null) {
        const db = client || pool;

        try {
            let query = `
                SELECT * FROM skill_assessments
                WHERE skill_name = $1 AND is_active = true
            `;
            const params = [skillName];

            if (difficultyLevel) {
                query += ` AND difficulty_level = $2`;
                params.push(difficultyLevel);
            }

            query += ` ORDER BY difficulty_level ASC`;

            const result = await db.query(query, params);
            return result.rows;
        } catch (error) {
            console.error("[SkillManagementService] Error getting skill assessments:", error);
            throw error;
        }
    }

    /**
     * Submit and grade a skill assessment
     */
    async submitAssessment(userId, assessmentId, answers, client = null) {
        const db = client || pool;

        try {
            // Get assessment
            const assessment = await this.getSkillAssessment(assessmentId, db);
            if (!assessment) {
                throw new Error("Assessment not found");
            }

            // Grade assessment
            const questions = assessment.questions;
            let correctCount = 0;
            const detailedAnalysis = [];

            for (let i = 0; i < questions.length; i++) {
                const question = questions[i];
                const userAnswer = answers[i];
                const isCorrect = this.checkAnswer(question, userAnswer);

                if (isCorrect) correctCount++;

                detailedAnalysis.push({
                    questionIndex: i,
                    isCorrect,
                    userAnswer,
                    correctAnswer: question.correctAnswer,
                    topic: question.topic,
                });
            }

            const score = Math.round((correctCount / questions.length) * 100);
            const passed = score >= assessment.passing_score;
            const recommendedLevel = this.calculateSkillLevel(score);

            // Save result
            const resultRecord = await db.query(
                `
                INSERT INTO skill_assessment_results 
                (user_id, assessment_id, skill_name, score, passed, answers, analysis, recommended_level)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *
            `,
                [
                    userId,
                    assessmentId,
                    assessment.skill_name,
                    score,
                    passed,
                    JSON.stringify(answers),
                    JSON.stringify(detailedAnalysis),
                    recommendedLevel,
                ],
            );

            // Update user skill based on assessment
            await this.updateUserSkill(
                userId,
                assessment.skill_name,
                {
                    level: recommendedLevel,
                    confidence: score,
                    source: "assessment",
                    metadata: {
                        assessmentId,
                        score,
                        assessedAt: new Date().toISOString(),
                    },
                },
                db,
            );

            return {
                result: resultRecord.rows[0],
                score,
                passed,
                recommendedLevel,
                analysis: detailedAnalysis,
            };
        } catch (error) {
            console.error("[SkillManagementService] Error submitting assessment:", error);
            throw error;
        }
    }

    /**
     * Check if answer is correct (supports MCQ, multi-select, true/false)
     */
    checkAnswer(question, userAnswer) {
        if (question.type === "multiple_choice") {
            return userAnswer === question.correctAnswer;
        } else if (question.type === "multi_select") {
            const correct = new Set(question.correctAnswer);
            const user = new Set(userAnswer);
            return correct.size === user.size && [...correct].every((x) => user.has(x));
        } else if (question.type === "true_false") {
            return userAnswer === question.correctAnswer;
        }
        return false;
    }

    /**
     * Update user skills based on course progress
     */
    async updateSkillsFromCourse(userId, courseId, progressPercentage, client = null) {
        const db = client || pool;

        try {
            // Get skills taught by this course
            const courseSkills = await db.query(
                `
                SELECT skill_name, target_level, skill_weight
                FROM course_skills
                WHERE course_id = $1
                ORDER BY skill_weight DESC
            `,
                [courseId],
            );

            if (courseSkills.rows.length === 0) {
                console.warn(`[SkillManagementService] No skills mapped for course ${courseId}`);
                return [];
            }

            // Update each skill proportional to progress
            const updates = [];
            for (const courseSkill of courseSkills.rows) {
                const { skill_name, target_level, skill_weight } = courseSkill;

                // Calculate earned level (proportional to progress)
                const earnedLevel = Math.floor((progressPercentage / 100) * target_level);

                // Calculate confidence boost (weighted by skill importance)
                const confidenceBoost = Math.floor((progressPercentage / 100) * skill_weight * 5);

                // Get current skill level
                const currentSkill = await this.getUserSkill(userId, skill_name, db);

                // Only update if earned level is higher than current
                if (earnedLevel > currentSkill.level) {
                    const updated = await this.updateUserSkill(
                        userId,
                        skill_name,
                        {
                            level: earnedLevel,
                            confidence: Math.min(currentSkill.confidence + confidenceBoost, 100),
                            source: "course_completion",
                            metadata: {
                                courseId,
                                progressPercentage,
                                updatedAt: new Date().toISOString(),
                            },
                        },
                        db,
                    );
                    updates.push(updated);
                }
            }

            return updates;
        } catch (error) {
            console.error("[SkillManagementService] Error updating skills from course:", error);
            throw error;
        }
    }

    /**
     * Identify skill gaps for a goal
     */
    async identifySkillGaps(userId, goalId, client = null) {
        const db = client || pool;

        try {
            // Get goal and required skills
            const goalResult = await db.query(
                `
                SELECT required_skills FROM user_goals WHERE id = $1
            `,
                [goalId],
            );

            if (goalResult.rows.length === 0) {
                throw new Error("Goal not found");
            }

            const requiredSkills = goalResult.rows[0].required_skills;
            const gaps = [];

            // Check each required skill
            for (const requirement of requiredSkills) {
                const { skill, minLevel } = requirement;
                const userSkill = await this.getUserSkill(userId, skill, db);

                if (userSkill.level < minLevel) {
                    gaps.push({
                        skill,
                        currentLevel: userSkill.level,
                        requiredLevel: minLevel,
                        gap: minLevel - userSkill.level,
                        confidence: userSkill.confidence,
                        priority: requirement.priority || 1,
                    });
                }
            }

            // Sort by priority and gap size
            gaps.sort((a, b) => {
                if (a.priority !== b.priority) return a.priority - b.priority;
                return b.gap - a.gap;
            });

            return gaps;
        } catch (error) {
            console.error("[SkillManagementService] Error identifying skill gaps:", error);
            throw error;
        }
    }

    /**
     * Get skill statistics for dashboard
     */
    async getSkillStatistics(userId, client = null) {
        const db = client || pool;

        try {
            const stats = await db.query(
                `
                SELECT 
                    COUNT(*) as total_skills,
                    COUNT(*) FILTER (WHERE level >= 3) as advanced_skills,
                    COUNT(*) FILTER (WHERE level >= 1 AND level < 3) as intermediate_skills,
                    COUNT(*) FILTER (WHERE level = 0) as beginner_skills,
                    ROUND(AVG(level), 2) as average_level,
                    ROUND(AVG(confidence), 2) as average_confidence,
                    COUNT(*) FILTER (WHERE last_assessed_at > NOW() - INTERVAL '30 days') as recently_assessed
                FROM user_skills
                WHERE user_id = $1
            `,
                [userId],
            );

            // Get skills by category
            const byCategory = await db.query(
                `
                SELECT 
                    sc.category,
                    COUNT(*) as count,
                    ROUND(AVG(us.level), 2) as avg_level
                FROM user_skills us
                JOIN skill_catalog sc ON us.skill_name = sc.skill_name
                WHERE us.user_id = $1
                GROUP BY sc.category
            `,
                [userId],
            );

            return {
                overall: stats.rows[0],
                byCategory: byCategory.rows,
            };
        } catch (error) {
            console.error("[SkillManagementService] Error getting skill statistics:", error);
            throw error;
        }
    }

    /**
     * Get skill learning resources
     */
    async getSkillResources(skillName, client = null) {
        const db = client || pool;

        try {
            const result = await db.query(
                `
                SELECT learning_resources 
                FROM skill_catalog
                WHERE skill_name = $1
            `,
                [skillName],
            );

            if (result.rows.length === 0) return [];

            return result.rows[0].learning_resources || [];
        } catch (error) {
            console.error("[SkillManagementService] Error getting skill resources:", error);
            return [];
        }
    }
}

export default SkillManagementService;
