/**
 * ValidationEngineService.js
 *
 * Enforces validation rules for skill progression - NO FAKE PROGRESS.
 * Users must prove they've learned through multi-modal validation.
 *
 * Responsibilities:
 * - Validate learning through multiple methods (quiz + code + explain + project)
 * - Enforce completion criteria
 * - Gate skill level progression
 * - Track validation history
 * - Provide detailed feedback on failures
 *
 * Philosophy: Progress must be earned, not clicked.
 */

import pool from "../../database/connect.db.js";
import SkillManagementService from "./skillManagement.service.js";

const skillService = new SkillManagementService();

class ValidationEngineService {
    /**
     * Validation type weights for skill progression
     */
    static VALIDATION_WEIGHTS = {
        quiz: 30,
        code: 40,
        explain: 20,
        project: 10,
        peer_review: 10,
    };

    /**
     * Minimum passing score for each validation type
     */
    static PASSING_THRESHOLDS = {
        quiz: 70,
        code: 100, // Must be ACCEPTED
        explain: 70,
        project: 75,
        peer_review: 70,
    };

    /**
     * Submit a validation attempt
     */
    async submitValidation(userId, validationData, client = null) {
        const db = client || pool;

        try {
            const {
                skill_name,
                validation_type,
                reference_id,
                score,
                time_spent_seconds,
                feedback,
                metadata = {},
            } = validationData;

            const passing_score = ValidationEngineService.PASSING_THRESHOLDS[validation_type] || 70;
            const passed = score >= passing_score;

            // Get attempt number
            const attemptResult = await db.query(
                `
                SELECT COALESCE(MAX(attempt_number), 0) + 1 as next_attempt
                FROM learning_validations
                WHERE user_id = $1 AND skill_name = $2 AND validation_type = $3 AND reference_id = $4
            `,
                [userId, skill_name, validation_type, reference_id],
            );

            const attempt_number = attemptResult.rows[0].next_attempt;

            // Insert validation record
            const result = await db.query(
                `
                INSERT INTO learning_validations
                (user_id, skill_name, validation_type, reference_id, score, passing_score, passed, 
                 attempt_number, time_spent_seconds, feedback, metadata)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                RETURNING *
            `,
                [
                    userId,
                    skill_name,
                    validation_type,
                    reference_id,
                    score,
                    passing_score,
                    passed,
                    attempt_number,
                    time_spent_seconds,
                    feedback || "",
                    JSON.stringify(metadata),
                ],
            );

            const validation = result.rows[0];

            // If validation passed, check if skill should level up
            if (passed) {
                await this.checkSkillLevelUp(userId, skill_name, db);
            }

            return {
                validation,
                passed,
                feedback: this.generateFeedback(validation_type, score, passed),
            };
        } catch (error) {
            console.error("[ValidationEngineService] Error submitting validation:", error);
            throw error;
        }
    }

    /**
     * Check if user can level up a skill based on validations
     */
    async checkSkillLevelUp(userId, skillName, client = null) {
        const db = client || pool;

        try {
            // Get current skill level
            const currentSkill = await skillService.getUserSkill(userId, skillName, db);
            const currentLevel = currentSkill.level;

            // Get recent validations for this skill
            const validations = await db.query(
                `
                SELECT validation_type, MAX(validated_at) as latest, 
                       BOOL_OR(passed) as any_passed
                FROM learning_validations
                WHERE user_id = $1 
                AND skill_name = $2
                AND validated_at > NOW() - INTERVAL '30 days'
                GROUP BY validation_type
            `,
                [userId, skillName],
            );

            const validationMap = new Map(validations.rows.map((v) => [v.validation_type, v.any_passed]));

            // Check if user has passed required validations for next level
            const canLevelUp = this.canProgress(currentLevel, validationMap);

            if (canLevelUp) {
                // Level up the skill
                const newLevel = Math.min(currentLevel + 1, 5);

                await skillService.updateUserSkill(
                    userId,
                    skillName,
                    {
                        level: newLevel,
                        confidence: Math.min(currentSkill.confidence + 10, 100),
                        source: "validation_passed",
                        metadata: {
                            leveledUpAt: new Date().toISOString(),
                            previousLevel: currentLevel,
                            validationsPassed: Array.from(validationMap.entries())
                                .filter(([_, passed]) => passed)
                                .map(([type, _]) => type),
                        },
                    },
                    db,
                );

                return { leveledUp: true, newLevel };
            }

            return { leveledUp: false, currentLevel };
        } catch (error) {
            console.error("[ValidationEngineService] Error checking skill level up:", error);
            throw error;
        }
    }

    /**
     * Determine if user can progress to next level
     */
    canProgress(currentLevel, validationMap) {
        // Level 0 → 1: Just need quiz OR code
        if (currentLevel === 0) {
            return validationMap.get("quiz") || validationMap.get("code");
        }

        // Level 1 → 2: Need quiz AND code
        if (currentLevel === 1) {
            return validationMap.get("quiz") && validationMap.get("code");
        }

        // Level 2 → 3: Need quiz AND code AND (explain OR project)
        if (currentLevel === 2) {
            return (
                validationMap.get("quiz") &&
                validationMap.get("code") &&
                (validationMap.get("explain") || validationMap.get("project"))
            );
        }

        // Level 3 → 4: Need all basic + project
        if (currentLevel === 3) {
            return (
                validationMap.get("quiz") &&
                validationMap.get("code") &&
                validationMap.get("explain") &&
                validationMap.get("project")
            );
        }

        // Level 4 → 5: Need everything including peer review
        if (currentLevel === 4) {
            return (
                validationMap.get("quiz") &&
                validationMap.get("code") &&
                validationMap.get("explain") &&
                validationMap.get("project") &&
                validationMap.get("peer_review")
            );
        }

        return false;
    }

    /**
     * Get validation requirements for next level
     */
    async getRequirementsForNextLevel(userId, skillName, client = null) {
        const db = client || pool;

        try {
            const currentSkill = await skillService.getUserSkill(userId, skillName, db);
            const currentLevel = currentSkill.level;

            if (currentLevel >= 5) {
                return {
                    currentLevel,
                    nextLevel: null,
                    requirements: [],
                    message: "You have mastered this skill!",
                };
            }

            // Get completed validations
            const validations = await db.query(
                `
                SELECT DISTINCT validation_type
                FROM learning_validations
                WHERE user_id = $1 
                AND skill_name = $2
                AND passed = true
                AND validated_at > NOW() - INTERVAL '30 days'
            `,
                [userId, skillName],
            );

            const completed = new Set(validations.rows.map((v) => v.validation_type));

            // Determine what's needed for next level
            const requirements = this.getRequirementsForLevel(currentLevel + 1);
            const missing = requirements.filter((req) => !completed.has(req));

            return {
                currentLevel,
                nextLevel: currentLevel + 1,
                requirements: requirements.map((req) => ({
                    type: req,
                    required: true,
                    completed: completed.has(req),
                    weight: ValidationEngineService.VALIDATION_WEIGHTS[req],
                    passingScore: ValidationEngineService.PASSING_THRESHOLDS[req],
                })),
                missing,
                canLevelUp: missing.length === 0,
            };
        } catch (error) {
            console.error("[ValidationEngineService] Error getting requirements:", error);
            throw error;
        }
    }

    /**
     * Get validation requirements for a specific level
     */
    getRequirementsForLevel(level) {
        switch (level) {
            case 1:
                return ["quiz"]; // or 'code'
            case 2:
                return ["quiz", "code"];
            case 3:
                return ["quiz", "code", "explain"]; // or 'project'
            case 4:
                return ["quiz", "code", "explain", "project"];
            case 5:
                return ["quiz", "code", "explain", "project", "peer_review"];
            default:
                return [];
        }
    }

    /**
     * Generate feedback based on validation result
     */
    generateFeedback(validationType, score, passed) {
        if (passed) {
            return `Great job! You scored ${score}% on the ${validationType} validation. Keep it up!`;
        }

        const threshold = ValidationEngineService.PASSING_THRESHOLDS[validationType];
        const gap = threshold - score;

        let feedback = `You scored ${score}%, but need ${threshold}% to pass the ${validationType} validation. `;

        if (gap > 30) {
            feedback += "Don't worry - review the material and try again. You've got this!";
        } else if (gap > 10) {
            feedback += "You're close! Review the weak areas and retry.";
        } else {
            feedback += "Almost there! Just a bit more practice needed.";
        }

        return feedback;
    }

    /**
     * Get validation history for a skill
     */
    async getValidationHistory(userId, skillName, limit = 10, client = null) {
        const db = client || pool;

        try {
            const result = await db.query(
                `
                SELECT * FROM learning_validations
                WHERE user_id = $1 AND skill_name = $2
                ORDER BY validated_at DESC
                LIMIT $3
            `,
                [userId, skillName, limit],
            );

            return result.rows;
        } catch (error) {
            console.error("[ValidationEngineService] Error getting validation history:", error);
            return [];
        }
    }

    /**
     * Get overall validation statistics
     */
    async getValidationStatistics(userId, client = null) {
        const db = client || pool;

        try {
            const stats = await db.query(
                `
                SELECT 
                    COUNT(*) as total_validations,
                    COUNT(*) FILTER (WHERE passed = true) as passed_validations,
                    COUNT(*) FILTER (WHERE passed = false) as failed_validations,
                    ROUND(AVG(score), 2) as average_score,
                    COUNT(DISTINCT skill_name) as skills_validated,
                    validation_type,
                    COUNT(*) as count_by_type,
                    ROUND(AVG(score) FILTER (WHERE validation_type = validation_type), 2) as avg_score_by_type
                FROM learning_validations
                WHERE user_id = $1
                GROUP BY validation_type
            `,
                [userId],
            );

            const overall = await db.query(
                `
                SELECT 
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE passed = true) as passed,
                    ROUND((COUNT(*) FILTER (WHERE passed = true)::numeric / COUNT(*)) * 100, 2) as pass_rate
                FROM learning_validations
                WHERE user_id = $1
            `,
                [userId],
            );

            return {
                overall: overall.rows[0],
                byType: stats.rows,
            };
        } catch (error) {
            console.error("[ValidationEngineService] Error getting validation statistics:", error);
            throw error;
        }
    }

    /**
     * Check if task/question has been validated
     */
    async isTaskValidated(userId, skillName, referenceId, client = null) {
        const db = client || pool;

        try {
            const result = await db.query(
                `
                SELECT * FROM learning_validations
                WHERE user_id = $1 
                AND skill_name = $2 
                AND reference_id = $3
                AND passed = true
                ORDER BY validated_at DESC
                LIMIT 1
            `,
                [userId, skillName, referenceId],
            );

            return {
                validated: result.rows.length > 0,
                validation: result.rows[0] || null,
            };
        } catch (error) {
            console.error("[ValidationEngineService] Error checking task validation:", error);
            return { validated: false, validation: null };
        }
    }

    /**
     * Bulk validate multiple tasks (for daily task completion)
     */
    async bulkValidate(userId, validations, client = null) {
        const db = client || pool;

        try {
            const results = [];

            for (const validationData of validations) {
                const result = await this.submitValidation(userId, validationData, db);
                results.push(result);
            }

            // Calculate overall completion
            const allPassed = results.every((r) => r.passed);
            const passRate = (results.filter((r) => r.passed).length / results.length) * 100;

            return {
                results,
                allPassed,
                passRate,
                feedback: allPassed
                    ? "All validations passed! Great work!"
                    : `You passed ${passRate.toFixed(0)}% of validations. Keep going!`,
            };
        } catch (error) {
            console.error("[ValidationEngineService] Error in bulk validation:", error);
            throw error;
        }
    }

    /**
     * Get validation leaderboard (top performers)
     */
    async getValidationLeaderboard(skillName = null, limit = 10, client = null) {
        const db = client || pool;

        try {
            let query = `
                SELECT 
                    u.id,
                    u.username,
                    COUNT(*) FILTER (WHERE lv.passed = true) as validations_passed,
                    COUNT(DISTINCT lv.skill_name) as skills_validated,
                    ROUND(AVG(lv.score), 2) as average_score
                FROM users u
                JOIN learning_validations lv ON u.id = lv.user_id
            `;

            const params = [];
            if (skillName) {
                query += ` WHERE lv.skill_name = $1`;
                params.push(skillName);
            }

            query += `
                GROUP BY u.id, u.username
                ORDER BY validations_passed DESC, average_score DESC
                LIMIT $${params.length + 1}
            `;
            params.push(limit);

            const result = await db.query(query, params);
            return result.rows;
        } catch (error) {
            console.error("[ValidationEngineService] Error getting validation leaderboard:", error);
            return [];
        }
    }
}

export default ValidationEngineService;
