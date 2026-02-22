/**
 * GoalTrackingService.js
 *
 * Manages user career goals, learning objectives, and goal progress tracking.
 * This service connects user aspirations with actionable learning paths.
 *
 * Responsibilities:
 * - Create and manage user goals
 * - Track goal progress
 * - Calculate completion percentages
 * - Identify goal prerequisites
 * - Suggest relevant courses for goals
 * - Handle goal milestones
 */

import pool from "../../database/connect.db.js";
import SkillManagementService from "./skillManagement.service.js";

const skillService = new SkillManagementService();

class GoalTrackingService {
    /**
     * Create a new user goal
     */
    async createGoal(userId, goalData, client = null) {
        const db = client || pool;

        try {
            const { goal_type = "career", title, description, target_role, deadline, priority = 1 } = goalData;

            // Get required skills from career roadmap template if target_role is provided
            let requiredSkills = goalData.required_skills || [];

            if (target_role && (!requiredSkills || requiredSkills.length === 0)) {
                const template = await this.getCareerRoadmapTemplate(target_role, db);
                if (template) {
                    requiredSkills = template.required_skills;
                }
            }

            const result = await db.query(
                `
                INSERT INTO user_goals 
                (user_id, goal_type, title, description, target_role, required_skills, deadline, priority, status, progress)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', 0)
                RETURNING *
            `,
                [
                    userId,
                    goal_type,
                    title,
                    description || "",
                    target_role,
                    JSON.stringify(requiredSkills),
                    deadline,
                    priority,
                ],
            );

            const goal = result.rows[0];

            // Trigger auto-creation of required skills (via database trigger)
            // Calculate initial progress
            await this.updateGoalProgress(goal.id, db);

            return goal;
        } catch (error) {
            console.error("[GoalTrackingService] Error creating goal:", error);
            throw error;
        }
    }

    /**
     * Get user goals
     */
    async getUserGoals(userId, status = null, client = null) {
        const db = client || pool;

        try {
            let query = `
                SELECT * FROM v_user_goal_progress
                WHERE user_id = $1
            `;
            const params = [userId];

            if (status) {
                query += ` AND status = $2`;
                params.push(status);
            }

            query += ` ORDER BY priority ASC, created_at DESC`;

            const result = await db.query(query, params);
            return result.rows;
        } catch (error) {
            console.error("[GoalTrackingService] Error getting user goals:", error);
            throw error;
        }
    }

    /**
     * Get goal by ID
     */
    async getGoal(goalId, client = null) {
        const db = client || pool;

        try {
            const result = await db.query(
                `
                SELECT * FROM user_goals WHERE id = $1
            `,
                [goalId],
            );

            if (result.rows.length === 0) {
                throw new Error("Goal not found");
            }

            return result.rows[0];
        } catch (error) {
            console.error("[GoalTrackingService] Error getting goal:", error);
            throw error;
        }
    }

    /**
     * Update goal progress based on current skills
     */
    async updateGoalProgress(goalId, client = null) {
        const db = client || pool;

        try {
            const goal = await this.getGoal(goalId, db);
            const requiredSkills = goal.required_skills;

            if (!requiredSkills || requiredSkills.length === 0) {
                return goal;
            }

            // Get skill gaps
            const gaps = await skillService.identifySkillGaps(goal.user_id, goalId, db);

            // Calculate progress
            const totalSkills = requiredSkills.length;
            const achievedSkills = totalSkills - gaps.length;
            const progress = Math.round((achievedSkills / totalSkills) * 100);

            // Determine status
            let status = goal.status;
            if (progress === 100 && status === "active") {
                status = "completed";
            }

            // Update goal
            const result = await db.query(
                `
                UPDATE user_goals
                SET progress = $1, status = $2, updated_at = NOW()
                WHERE id = $3
                RETURNING *
            `,
                [progress, status, goalId],
            );

            return result.rows[0];
        } catch (error) {
            console.error("[GoalTrackingService] Error updating goal progress:", error);
            throw error;
        }
    }

    /**
     * Get detailed goal breakdown with skill gaps
     */
    async getGoalBreakdown(goalId, client = null) {
        const db = client || pool;

        try {
            const goal = await this.getGoal(goalId, db);
            const gaps = await skillService.identifySkillGaps(goal.user_id, goalId, db);

            // Get completed skills
            const requiredSkills = goal.required_skills;
            const completedSkills = [];

            for (const requirement of requiredSkills) {
                const { skill, minLevel } = requirement;
                const userSkill = await skillService.getUserSkill(goal.user_id, skill, db);

                if (userSkill.level >= minLevel) {
                    completedSkills.push({
                        skill,
                        currentLevel: userSkill.level,
                        requiredLevel: minLevel,
                        achieved: true,
                    });
                }
            }

            // Get recommended courses for gaps
            const recommendedCourses = await this.getRecommendedCoursesForGoal(goalId, db);

            return {
                goal,
                completedSkills,
                skillGaps: gaps,
                recommendedCourses,
                totalSkills: requiredSkills.length,
                completedCount: completedSkills.length,
                gapCount: gaps.length,
                progress: goal.progress,
            };
        } catch (error) {
            console.error("[GoalTrackingService] Error getting goal breakdown:", error);
            throw error;
        }
    }

    /**
     * Get recommended courses for a goal based on skill gaps
     */
    async getRecommendedCoursesForGoal(goalId, client = null) {
        const db = client || pool;

        try {
            const goal = await this.getGoal(goalId, db);
            const gaps = await skillService.identifySkillGaps(goal.user_id, goalId, db);

            if (gaps.length === 0) {
                return [];
            }

            // Get top 3 priority gaps
            const topGaps = gaps.slice(0, 3);
            const skillNames = topGaps.map((g) => g.skill);

            // Find courses that teach these skills
            const result = await db.query(
                `
                SELECT DISTINCT
                    c.id,
                    c.title,
                    c.description,
                    c.category,
                    c.difficulty,
                    array_agg(DISTINCT cs.skill_name) as skills_taught,
                    COUNT(DISTINCT cs.skill_name) FILTER (WHERE cs.skill_name = ANY($1)) as relevant_skills_count
                FROM courses c
                JOIN course_skills cs ON c.id = cs.course_id
                WHERE cs.skill_name = ANY($1)
                GROUP BY c.id, c.title, c.description, c.category, c.difficulty
                ORDER BY relevant_skills_count DESC, c.id
                LIMIT 5
            `,
                [skillNames],
            );

            return result.rows.map((course) => ({
                ...course,
                relevanceReason: `Teaches ${course.relevant_skills_count} skill(s) you need`,
            }));
        } catch (error) {
            console.error("[GoalTrackingService] Error get recommended courses:", error);
            return [];
        }
    }

    /**
     * Update goal status
     */
    async updateGoalStatus(goalId, status, client = null) {
        const db = client || pool;

        try {
            const result = await db.query(
                `
                UPDATE user_goals
                SET status = $1, updated_at = NOW()
                WHERE id = $2
                RETURNING *
            `,
                [status, goalId],
            );

            return result.rows[0];
        } catch (error) {
            console.error("[GoalTrackingService] Error updating goal status:", error);
            throw error;
        }
    }

    /**
     * Delete a goal
     */
    async deleteGoal(goalId, client = null) {
        const db = client || pool;

        try {
            await db.query(`DELETE FROM user_goals WHERE id = $1`, [goalId]);
            return true;
        } catch (error) {
            console.error("[GoalTrackingService] Error deleting goal:", error);
            throw error;
        }
    }

    /**
     * Get career roadmap template
     */
    async getCareerRoadmapTemplate(roleName, client = null) {
        const db = client || pool;

        try {
            const result = await db.query(
                `
                SELECT * FROM career_roadmap_templates
                WHERE role_name = $1 AND is_active = true
            `,
                [roleName],
            );

            return result.rows[0];
        } catch (error) {
            console.error("[GoalTrackingService] Error getting career roadmap template:", error);
            return null;
        }
    }

    /**
     * Get all available career paths
     */
    async getAvailableCareerPaths(client = null) {
        const db = client || pool;

        try {
            const result = await db.query(`
                SELECT * FROM career_roadmap_templates
                WHERE is_active = true
                ORDER BY difficulty_level ASC, display_name ASC
            `);

            return result.rows;
        } catch (error) {
            console.error("[GoalTrackingService] Error getting career paths:", error);
            return [];
        }
    }

    /**
     * Suggest career path based on current skills
     */
    async suggestCareerPath(userId, client = null) {
        const db = client || pool;

        try {
            // Get user skills
            const userSkills = await skillService.getUserSkillProfile(userId, db);
            const skillMap = new Map(userSkills.map((s) => [s.skill_name, s.level]));

            // Get all career paths
            const careerPaths = await this.getAvailableCareerPaths(db);

            // Score each path based on skill overlap
            const scoredPaths = careerPaths.map((path) => {
                const requiredSkills = path.required_skills;
                let score = 0;
                let matchedSkills = 0;

                for (const requirement of requiredSkills) {
                    const { skill, minLevel } = requirement;
                    const userLevel = skillMap.get(skill) || 0;

                    if (userLevel >= minLevel) {
                        score += 10; // Full match
                        matchedSkills++;
                    } else if (userLevel > 0) {
                        score += userLevel; // Partial match
                    }
                }

                return {
                    ...path,
                    matchScore: score,
                    matchedSkills,
                    totalSkills: requiredSkills.length,
                    matchPercentage: Math.round((matchedSkills / requiredSkills.length) * 100),
                };
            });

            // Sort by match score
            scoredPaths.sort((a, b) => b.matchScore - a.matchScore);

            return scoredPaths;
        } catch (error) {
            console.error("[GoalTrackingService] Error suggesting career path:", error);
            return [];
        }
    }

    /**
     * Get goal statistics for user
     */
    async getGoalStatistics(userId, client = null) {
        const db = client || pool;

        try {
            const stats = await db.query(
                `
                SELECT 
                    COUNT(*) as total_goals,
                    COUNT(*) FILTER (WHERE status = 'active') as active_goals,
                    COUNT(*) FILTER (WHERE status = 'completed') as completed_goals,
                    COUNT(*) FILTER (WHERE status = 'paused') as paused_goals,
                    ROUND(AVG(progress), 2) as average_progress,
                    COUNT(*) FILTER (WHERE deadline < NOW() AND status = 'active') as overdue_goals
                FROM user_goals
                WHERE user_id = $1
            `,
                [userId],
            );

            return stats.rows[0];
        } catch (error) {
            console.error("[GoalTrackingService] Error getting goal statistics:", error);
            throw error;
        }
    }

    /**
     * Check and update deadline alerts
     */
    async checkDeadlineAlerts(userId, client = null) {
        const db = client || pool;

        try {
            // Get goals approaching deadline (within 7 days)
            const result = await db.query(
                `
                SELECT * FROM user_goals
                WHERE user_id = $1 
                AND status = 'active'
                AND deadline IS NOT NULL
                AND deadline <= NOW() + INTERVAL '7 days'
                AND deadline >= NOW()
                ORDER BY deadline ASC
            `,
                [userId],
            );

            return result.rows.map((goal) => ({
                ...goal,
                daysRemaining: Math.ceil((new Date(goal.deadline) - new Date()) / (1000 * 60 * 60 * 24)),
                urgency: this.calculateUrgency(goal),
            }));
        } catch (error) {
            console.error("[GoalTrackingService] Error checking deadline alerts:", error);
            return [];
        }
    }

    /**
     * Calculate goal urgency
     */
    calculateUrgency(goal) {
        if (!goal.deadline) return "low";

        const daysRemaining = Math.ceil((new Date(goal.deadline) - new Date()) / (1000 * 60 * 60 * 24));
        const progress = goal.progress || 0;

        if (daysRemaining < 0) return "overdue";
        if (daysRemaining <= 3 && progress < 80) return "critical";
        if (daysRemaining <= 7 && progress < 50) return "high";
        if (daysRemaining <= 14 && progress < 30) return "medium";

        return "low";
    }
}

export default GoalTrackingService;
