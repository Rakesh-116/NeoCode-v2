/**
 * EnhancedRoadmapEngine.service.js
 *
 * Generates personalized, structured learning roadmaps based on:
 * - User goals (career path)
 * - Current skill levels
 * - Skill gaps
 * - Learning style
 * - Mistake patterns
 *
 * This service creates dependency-ordered, validated learning plans.
 * Previously TrainingPlannerService - now enhanced for goal-driven roadmaps.
 */

import pool from "../../database/connect.db.js";
import SkillManagementService from "./skillManagement.service.js";
import GoalTrackingService from "./goalTracking.service.js";
import ValidationEngineService from "./validationEngine.service.js";

const skillService = new SkillManagementService();
const goalService = new GoalTrackingService();
const validationService = new ValidationEngineService();

class EnhancedRoadmapEngine {
    /**
     * Generate a complete roadmap for a goal
     */
    async generateRoadmapForGoal(userId, goalId, options = {}, client = null) {
        const db = client || pool;

        try {
            const {
                weeks = 12,
                intensity = "medium", // light | medium | intense
                startDate = new Date(),
            } = options;

            // Get goal and skill gaps
            const goalBreakdown = await goalService.getGoalBreakdown(goalId, db);
            const { goal, skillGaps } = goalBreakdown;

            if (skillGaps.length === 0) {
                throw new Error("No skill gaps found - goal may already be achieved");
            }

            // Get career template for prerequisite order
            const template = await goalService.getCareerRoadmapTemplate(goal.target_role, db);

            if (!template) {
                throw new Error("Career roadmap template not found");
            }

            // Order skills by prerequisites
            const orderedSkills = this.orderSkillsByPrerequisites(skillGaps, template.prerequisite_order);

            // Calculate time allocation per skill
            const timeAllocation = this.allocateTimeToSkills(orderedSkills, weeks, intensity);

            // Generate daily tasks for each skill
            const plan = await this.createDailyPlan(userId, orderedSkills, timeAllocation, startDate, db);

            // Save training plan
            const savedPlan = await this.saveTrainingPlan(userId, goal.id, plan, weeks, db);

            return {
                ...savedPlan,
                plan,
                estimatedCompletion: this.calculateEstimatedCompletion(startDate, weeks),
            };
        } catch (error) {
            console.error("[EnhancedRoadmapEngine] Error generating roadmap:", error);
            throw error;
        }
    }

    /**
     * Order skills based on prerequisite dependencies
     */
    orderSkillsByPrerequisites(skillGaps, prerequisiteOrder) {
        // Create a map of skill to order index
        const orderMap = new Map(prerequisiteOrder.map((skill, index) => [skill, index]));

        // Sort gaps by prerequisite order, then by priority
        return skillGaps.sort((a, b) => {
            const orderA = orderMap.get(a.skill) || 999;
            const orderB = orderMap.get(b.skill) || 999;

            if (orderA !== orderB) {
                return orderA - orderB;
            }

            // If same order, sort by priority
            return a.priority - b.priority;
        });
    }

    /**
     * Allocate time (days) to each skill based on gap size and intensity
     */
    allocateTimeToSkills(skillGaps, totalWeeks, intensity) {
        const totalDays = totalWeeks * 7;
        const daysPerWeek = {
            light: 4, // 4 days/week
            medium: 5, // 5 days/week
            intense: 6, // 6 days/week
        };

        const activeDays = totalWeeks * (daysPerWeek[intensity] || 5);

        // Calculate total gap points
        const totalGapPoints = skillGaps.reduce((sum, gap) => sum + gap.gap, 0);

        // Allocate days proportionally
        return skillGaps.map((gap) => ({
            skill: gap.skill,
            gap: gap.gap,
            days: Math.ceil((gap.gap / totalGapPoints) * activeDays),
            priority: gap.priority,
        }));
    }

    /**
     * Create detailed daily plan with tasks
     */
    async createDailyPlan(userId, orderedSkills, timeAllocation, startDate, client = null) {
        const db = client || pool;

        const dailyPlan = [];
        let currentDate = new Date(startDate);
        let dayCounter = 1;

        for (const allocation of timeAllocation) {
            const { skill, days, gap } = allocation;

            // Get learning resources for this skill
            const resources = await skillService.getSkillResources(skill, db);

            // Get recommended problems for this skill
            const problems = await this.getProblemsForSkill(skill, gap, days, db);

            // Generate daily tasks for this skill
            for (let day = 0; day < days; day++) {
                const tasks = [];

                // Day 1-2: Learning phase
                if (day < 2) {
                    tasks.push({
                        type: "watch",
                        title: `Learn ${skill} basics`,
                        description: resources[0]?.title || `Introduction to ${skill}`,
                        resource_url: resources[0]?.url || null,
                        estimated_duration_minutes: 30,
                        order: 1,
                    });
                }

                // Every day: Practice
                const problemsForDay = problems.slice(day * 2, (day + 1) * 2);
                problemsForDay.forEach((problem, idx) => {
                    tasks.push({
                        type: "solve",
                        title: `Solve: ${problem.title}`,
                        reference_id: problem.id,
                        estimated_duration_minutes: 45,
                        difficulty_level: this.mapDifficulty(problem.difficulty),
                        order: 2 + idx,
                    });
                });

                // Every 3rd day: Quiz validation
                if ((day + 1) % 3 === 0 || day === days - 1) {
                    tasks.push({
                        type: "quiz",
                        title: `${skill} Quiz`,
                        description: "Test your understanding",
                        validation_required: true,
                        estimated_duration_minutes: 20,
                        order: 10,
                    });
                }

                dailyPlan.push({
                    day: dayCounter++,
                    date: new Date(currentDate),
                    skill_focus: skill,
                    tasks,
                    estimatedTime: tasks.reduce((sum, t) => sum + (t.estimated_duration_minutes || 0), 0),
                });

                currentDate.setDate(currentDate.getDate() + 1);
            }
        }

        return dailyPlan;
    }

    /**
     * Get problems for a skill
     */
    async getProblemsForSkill(skillName, gapSize, days, client = null) {
        const db = client || pool;

        try {
            // Get problems from normalized_questions or legacy problem table
            const result = await db.query(
                `
                SELECT 
                    id,
                    COALESCE(
                        question_data->>'title',
                        (SELECT title FROM problem WHERE id::text = nq.id LIMIT 1)
                    ) as title,
                    COALESCE(
                        question_data->>'difficulty',
                        (SELECT difficulty FROM problem WHERE id::text = nq.id LIMIT 1)
                    ) as difficulty
                FROM normalized_questions nq
                WHERE primary_topic = $1 OR $1 = ANY(topics)
                AND question_type = 'code'
                ORDER BY RANDOM()
                LIMIT $2
            `,
                [skillName, days * 2],
            ); // 2 problems per day

            if (result.rows.length > 0) {
                return result.rows;
            }

            // Fallback to legacy problem table
            const legacyResult = await db.query(
                `
                SELECT id, title, difficulty
                FROM problem
                WHERE category = $1
                ORDER BY RANDOM()
                LIMIT $2
            `,
                [skillName, days * 2],
            );

            return legacyResult.rows;
        } catch (error) {
            console.error("[EnhancedRoadmapEngine] Error getting problems:", error);
            return [];
        }
    }

    /**
     * Save training plan to database
     */
    async saveTrainingPlan(userId, goalId, dailyPlan, weeks, client = null) {
        const db = client || pool;

        try {
            // Create training plan
            const planResult = await db.query(
                `
                INSERT INTO training_plans 
                (user_id, goal_id, plan_type, plan_structure, status, is_active, version)
                VALUES ($1, $2, 'goal_based', $3, 'active', true, 1)
                RETURNING *
            `,
                [userId, goalId, JSON.stringify(dailyPlan)],
            );

            const plan = planResult.rows[0];

            // Create daily tasks
            for (const dayPlan of dailyPlan) {
                for (const task of dayPlan.tasks) {
                    await db.query(
                        `
                        INSERT INTO daily_tasks
                        (user_id, plan_id, task_date, task_order, task_type, title, description, 
                         resource_url, reference_id, estimated_duration_minutes, skill_focus, 
                         difficulty_level, validation_required, metadata)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                    `,
                        [
                            userId,
                            plan.id,
                            dayPlan.date,
                            task.order,
                            task.type,
                            task.title,
                            task.description || "",
                            task.resource_url,
                            task.reference_id,
                            task.estimated_duration_minutes,
                            dayPlan.skill_focus,
                            task.difficulty_level,
                            task.validation_required || false,
                            JSON.stringify({ day: dayPlan.day }),
                        ],
                    );
                }
            }

            return plan;
        } catch (error) {
            console.error("[EnhancedRoadmapEngine] Error saving training plan:", error);
            throw error;
        }
    }

    /**
     * Get user's active roadmap
     */
    async getActiveRoadmap(userId, client = null) {
        const db = client || pool;

        try {
            const result = await db.query(
                `
                SELECT * FROM training_plans
                WHERE user_id = $1 AND is_active = true AND status = 'active'
                ORDER BY created_at DESC
                LIMIT 1
            `,
                [userId],
            );

            if (result.rows.length === 0) {
                return null;
            }

            const plan = result.rows[0];

            // Get daily tasks
            const tasksResult = await db.query(
                `
                SELECT * FROM daily_tasks
                WHERE plan_id = $1
                ORDER BY task_date ASC, task_order ASC
            `,
                [plan.id],
            );

            return {
                ...plan,
                tasks: tasksResult.rows,
                progress: await this.calculatePlanProgress(plan.id, db),
            };
        } catch (error) {
            console.error("[EnhancedRoadmapEngine] Error getting active roadmap:", error);
            return null;
        }
    }

    /**
     * Get today's tasks
     */
    async getTodaysTasks(userId, client = null) {
        const db = client || pool;

        try {
            const today = new Date().toISOString().split("T")[0];

            const result = await db.query(
                `
                SELECT * FROM daily_tasks
                WHERE user_id = $1 
                AND task_date::date = $2::date
                AND status IN ('pending', 'in_progress')
                ORDER BY task_order ASC
            `,
                [userId, today],
            );

            return result.rows;
        } catch (error) {
            console.error("[EnhancedRoadmapEngine] Error getting today tasks:", error);
            return [];
        }
    }

    /**
     * Mark task as completed
     */
    async completeTask(taskId, userId, validationId = null, client = null) {
        const db = client || pool;

        try {
            const result = await db.query(
                `
                UPDATE daily_tasks
                SET status = 'completed', 
                    completed_at = NOW(),
                    validation_id = COALESCE($1, validation_id)
                WHERE id = $2 AND user_id = $3
                RETURNING *
            `,
                [validationId, taskId, userId],
            );

            if (result.rows.length === 0) {
                throw new Error("Task not found or unauthorized");
            }

            return result.rows[0];
        } catch (error) {
            console.error("[EnhancedRoadmapEngine] Error completing task:", error);
            throw error;
        }
    }

    /**
     * Calculate plan progress
     */
    async calculatePlanProgress(planId, client = null) {
        const db = client || pool;

        try {
            const result = await db.query(
                `
                SELECT 
                    COUNT(*) as total_tasks,
                    COUNT(*) FILTER (WHERE status = 'completed') as completed_tasks,
                    ROUND((COUNT(*) FILTER (WHERE status = 'completed')::numeric / COUNT(*)) * 100, 2) as progress_percentage
                FROM daily_tasks
                WHERE plan_id = $1
            `,
                [planId],
            );

            return result.rows[0];
        } catch (error) {
            console.error("[EnhancedRoadmapEngine] Error calculating plan progress:", error);
            return { total_tasks: 0, completed_tasks: 0, progress_percentage: 0 };
        }
    }

    /**
     * Map difficulty string to number
     */
    mapDifficulty(difficulty) {
        const map = {
            easy: 1,
            medium: 2,
            hard: 3,
            expert: 4,
            master: 5,
        };
        return map[difficulty?.toLowerCase()] || 2;
    }

    /**
     * Calculate estimated completion date
     */
    calculateEstimatedCompletion(startDate, weeks) {
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + weeks * 7);
        return endDate;
    }

    /**
     * Adapt roadmap based on performance (AI-like adjustment)
     */
    async adaptRoadmap(userId, planId, client = null) {
        const db = client || pool;

        try {
            // Get completed tasks and their validation results
            const taskResults = await db.query(
                `
                SELECT 
                    dt.skill_focus,
                    COUNT(*) as tasks_completed,
                    COUNT(*) FILTER (WHERE lv.passed = true) as tasks_passed,
                    AVG(lv.score) as avg_score
                FROM daily_tasks dt
                LEFT JOIN learning_validations lv ON dt.validation_id = lv.id
                WHERE dt.user_id = $1 AND dt.plan_id = $2 AND dt.status = 'completed'
                GROUP BY dt.skill_focus
            `,
                [userId, planId],
            );

            // Identify struggling skills (< 60% pass rate or < 70 avg score)
            const strugglingSkills = taskResults.rows.filter(
                (r) => r.tasks_passed / r.tasks_completed < 0.6 || r.avg_score < 70,
            );

            if (strugglingSkills.length === 0) {
                return { adapted: false, message: "No adaptation needed - good progress!" };
            }

            // For each struggling skill, add easier tasks
            let tasksAdded = 0;
            for (const skillData of strugglingSkills) {
                // Get easier problems
                const easierProblems = await this.getProblemsForSkill(skillData.skill_focus, 1, 2, db);

                // Insert tasks after current date
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);

                for (const problem of easierProblems.slice(0, 2)) {
                    await db.query(
                        `
                        INSERT INTO daily_tasks
                        (user_id, plan_id, task_date, task_type, title, reference_id, 
                         skill_focus, difficulty_level, metadata)
                        VALUES ($1, $2, $3, 'solve', $4, $5, $6, 1, $7)
                    `,
                        [
                            userId,
                            planId,
                            tomorrow,
                            `Review: ${problem.title}`,
                            problem.id,
                            skillData.skill_focus,
                            JSON.stringify({ adaptive: true, reason: "struggling" }),
                        ],
                    );
                    tasksAdded++;
                }
            }

            return {
                adapted: true,
                tasksAdded,
                strugglingSkills: strugglingSkills.map((s) => s.skill_focus),
                message: `Added ${tasksAdded} review tasks for struggling skills`,
            };
        } catch (error) {
            console.error("[EnhancedRoadmapEngine] Error adapting roadmap:", error);
            throw error;
        }
    }
}

export default EnhancedRoadmapEngine;
