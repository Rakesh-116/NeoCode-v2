/**
 * learningDashboard.service.js
 *
 * Unified Learning Dashboard - Shows analytics across ALL courses
 * Aggregates skill progress regardless of which course taught it
 *
 * Philosophy: "Skills are universal, courses are just paths to acquire them"
 */

import pool from "../../database/connect.db.js";
import SkillManagementService from "../services/skillManagement.service.js";
import GoalTrackingService from "../services/goalTracking.service.js";
import ValidationEngineService from "../services/validationEngine.service.js";
import CourseIntegrationService from "../../services/courseIntegration.service.js";

const skillService = new SkillManagementService();
const goalService = new GoalTrackingService();
const validationService = new ValidationEngineService();
const courseService = new CourseIntegrationService();

class LearningDashboardService {
    /**
     * Get complete learning dashboard for user
     * Aggregates across ALL courses to show unified skill progress
     */
    async getDashboard(userId, client = null) {
        const db = client || pool;

        try {
            const dashboard = {
                overview: await this.getOverview(userId, db),
                skills: await this.getSkillsOverview(userId, db),
                goals: await this.getGoalsOverview(userId, db),
                recentActivity: await this.getRecentActivity(userId, db),
                recommendations: await this.getRecommendations(userId, db),
                todaysPlan: await this.getTodaysPlan(userId, db),
                achievements: await this.getAchievements(userId, db),
            };

            return dashboard;
        } catch (error) {
            console.error("[LearningDashboard] Error getting dashboard:", error);
            throw error;
        }
    }

    /**
     * Overview stats - health dashboard at a glance
     */
    async getOverview(userId, client = null) {
        const db = client || pool;

        try {
            // Aggregate stats across ALL courses
            const statsQuery = `
                WITH course_stats AS (
                    SELECT 
                        COUNT(DISTINCT cs.course_id) as courses_enrolled,
                        COUNT(DISTINCT cs.problem_id) as problems_solved,
                        SUM(cs.points_earned) as total_points
                    FROM course_submissions cs
                    WHERE cs.user_id = $1
                ),
                skill_stats AS (
                    SELECT 
                        COUNT(*) as skills_tracked,
                        COUNT(*) FILTER (WHERE level >= 2) as skills_intermediate,
                        COUNT(*) FILTER (WHERE level >= 3) as skills_advanced,
                        AVG(confidence) as avg_confidence
                    FROM user_skills
                    WHERE user_id = $1
                ),
                goal_stats AS (
                    SELECT 
                        COUNT(*) as total_goals,
                        COUNT(*) FILTER (WHERE status = 'COMPLETED') as goals_completed,
                        COUNT(*) FILTER (WHERE status = 'IN_PROGRESS') as goals_active
                    FROM user_goals
                    WHERE user_id = $1
                ),
                validation_stats AS (
                    SELECT 
                        COUNT(*) as validations_submitted,
                        COUNT(*) FILTER (WHERE validated = true) as validations_passed
                    FROM learning_validations
                    WHERE user_id = $1
                )
                SELECT 
                    COALESCE(cs.courses_enrolled, 0) as courses_enrolled,
                    COALESCE(cs.problems_solved, 0) as problems_solved,
                    COALESCE(cs.total_points, 0) as total_points,
                    COALESCE(ss.skills_tracked, 0) as skills_tracked,
                    COALESCE(ss.skills_intermediate, 0) as skills_intermediate,
                    COALESCE(ss.skills_advanced, 0) as skills_advanced,
                    COALESCE(ss.avg_confidence, 0) as avg_confidence,
                    COALESCE(gs.total_goals, 0) as total_goals,
                    COALESCE(gs.goals_completed, 0) as goals_completed,
                    COALESCE(gs.goals_active, 0) as goals_active,
                    COALESCE(vs.validations_submitted, 0) as validations_submitted,
                    COALESCE(vs.validations_passed, 0) as validations_passed
                FROM course_stats cs
                CROSS JOIN skill_stats ss
                CROSS JOIN goal_stats gs
                CROSS JOIN validation_stats vs
            `;

            const result = await db.query(statsQuery, [userId]);

            const stats = result.rows[0];

            return {
                ...stats,
                validation_rate:
                    stats.validations_submitted > 0
                        ? Math.round((stats.validations_passed / stats.validations_submitted) * 100)
                        : 0,
                avg_confidence: Math.round(stats.avg_confidence),
            };
        } catch (error) {
            console.error("[LearningDashboard] Error getting overview:", error);
            return {};
        }
    }

    /**
     * Skills overview - all skills across all courses
     */
    async getSkillsOverview(userId, client = null) {
        const db = client || pool;

        try {
            const skillProfile = await skillService.getUserSkillProfile(userId, db);

            // Get course context for each skill
            const skillsWithContext = await db.query(
                `
                SELECT 
                    us.skill_name,
                    us.level,
                    us.confidence,
                    us.last_updated,
                    array_agg(DISTINCT c.title) FILTER (WHERE c.title IS NOT NULL) as learned_from_courses,
                    COUNT(DISTINCT cs.course_id) as course_count,
                    sc.category,
                    sc.prerequisites
                FROM user_skills us
                LEFT JOIN course_skills csk ON us.skill_name = csk.skill_name
                LEFT JOIN courses c ON csk.course_id = c.id
                LEFT JOIN course_submissions cs ON cs.user_id = us.user_id AND cs.course_id = c.id
                LEFT JOIN skill_catalog sc ON us.skill_name = sc.skill_name
                WHERE us.user_id = $1
                GROUP BY us.skill_name, us.level, us.confidence, us.last_updated, sc.category, sc.prerequisites
                ORDER BY us.level DESC, us.confidence DESC
            `,
                [userId],
            );

            return {
                totalSkills: skillProfile.skills.length,
                skillsByLevel: skillProfile.skillsByLevel,
                skills: skillsWithContext.rows,
                nextLevelCandidates: skillProfile.skills
                    .filter((s) => s.confidence >= 70 && s.level < 5)
                    .slice(0, 3)
                    .map((s) => ({
                        skill: s.skill,
                        currentLevel: s.level,
                        nextLevel: s.level + 1,
                        confidence: s.confidence,
                        readyForAssessment: s.confidence >= 80,
                    })),
            };
        } catch (error) {
            console.error("[LearningDashboard] Error getting skills overview:", error);
            return { totalSkills: 0, skillsByLevel: {}, skills: [] };
        }
    }

    /**
     * Goals overview
     */
    async getGoalsOverview(userId, client = null) {
        const db = client || pool;

        try {
            const goals = await goalService.getUserGoals(userId, db);

            return {
                totalGoals: goals.length,
                activeGoals: goals.filter((g) => g.status === "IN_PROGRESS"),
                completedGoals: goals.filter((g) => g.status === "COMPLETED"),
                upcomingDeadlines: goals
                    .filter((g) => g.status === "IN_PROGRESS" && g.target_date)
                    .sort((a, b) => new Date(a.target_date) - new Date(b.target_date))
                    .slice(0, 3),
            };
        } catch (error) {
            console.error("[LearningDashboard] Error getting goals overview:", error);
            return { totalGoals: 0, activeGoals: [], completedGoals: [] };
        }
    }

    /**
     * Recent activity - last 10 learning events
     */
    async getRecentActivity(userId, client = null) {
        const db = client || pool;

        try {
            const activityQuery = `
                SELECT * FROM (
                    -- Problem submissions
                    SELECT 
                        'problem_solved' as type,
                        cs.solved_at as timestamp,
                        json_build_object(
                            'problemId', p.title,
                            'courseTitle', c.title,
                            'points', cs.points_earned
                        ) as details
                    FROM course_submissions cs
                    JOIN problem p ON cs.problem_id = p.id
                    JOIN courses c ON cs.course_id = c.id
                    WHERE cs.user_id = $1
                    
                    UNION ALL
                    
                    -- Skill assessments
                    SELECT 
                        'skill_assessment' as type,
                        sa.assessed_at as timestamp,
                        json_build_object(
                            'skill', sa.skill_name,
                            'result', sa.result,
                            'level', sa.level_achieved
                        ) as details
                    FROM skill_assessments sa
                    WHERE sa.user_id = $1
                    
                    UNION ALL
                    
                    -- Goals created/completed
                    SELECT 
                        CASE 
                            WHEN ug.status = 'COMPLETED' THEN 'goal_completed'
                            ELSE 'goal_created'
                        END as type,
                        COALESCE(ug.completed_at, ug.created_at) as timestamp,
                        json_build_object(
                            'goalType', ug.goal_type,
                            'title', ug.custom_description
                        ) as details
                    FROM user_goals ug
                    WHERE ug.user_id = $1
                    
                    UNION ALL
                    
                    -- Validations
                    SELECT 
                        'validation' as type,
                        lv.submitted_at as timestamp,
                        json_build_object(
                            'skill', lv.skill_name,
                            'level', lv.skill_level,
                            'validated', lv.validated
                        ) as details
                    FROM learning_validations lv
                    WHERE lv.user_id = $1
                ) combined
                ORDER BY timestamp DESC
                LIMIT 10
            `;

            const result = await db.query(activityQuery, [userId]);

            return result.rows;
        } catch (error) {
            console.error("[LearningDashboard] Error getting recent activity:", error);
            return [];
        }
    }

    /**
     * Smart recommendations based on goals and skill gaps
     */
    async getRecommendations(userId, client = null) {
        const db = client || pool;

        try {
            // Get active goals
            const activeGoals = await db.query(
                `
                SELECT * FROM user_goals 
                WHERE user_id = $1 AND status = 'IN_PROGRESS'
                LIMIT 1
            `,
                [userId],
            );

            if (activeGoals.rows.length === 0) {
                // No active goals - recommend starting a goal
                return {
                    type: "suggest_goal",
                    message: "Set your first career goal to get personalized recommendations!",
                    suggestedGoals: await goalService.suggestCareerPath(userId, db),
                };
            }

            const currentGoal = activeGoals.rows[0];

            // Get skill gaps for current goal
            const skillGaps = await skillService.identifySkillGaps(userId, currentGoal.required_skills, db);

            if (skillGaps.length === 0) {
                return {
                    type: "ready_for_validation",
                    message: "You've learned all required skills! Time to validate your knowledge.",
                    goalId: currentGoal.id,
                    skillsToValidate: currentGoal.required_skills,
                };
            }

            // Recommend courses to fill gaps
            const recommendedCourses = await courseService.recommendCoursesForSkillGaps(userId, skillGaps, db);

            return {
                type: "course_recommendations",
                message: `Work on these ${skillGaps.length} skills to achieve your goal: ${currentGoal.goal_type}`,
                skillGaps,
                recommendedCourses,
                goalId: currentGoal.id,
            };
        } catch (error) {
            console.error("[LearningDashboard] Error getting recommendations:", error);
            return { type: "error", message: "Could not generate recommendations" };
        }
    }

    /**
     * Today's learning plan
     */
    async getTodaysPlan(userId, client = null) {
        const db = client || pool;

        try {
            const today = new Date().toISOString().split("T")[0];

            const tasksQuery = `
                SELECT 
                    dt.*,
                    c.title as course_title
                FROM daily_tasks dt
                LEFT JOIN courses c ON dt.course_id = c.id
                WHERE dt.user_id = $1 
                  AND dt.date = $2
                ORDER BY dt.priority DESC
            `;

            const result = await db.query(tasksQuery, [userId, today]);

            return {
                date: today,
                tasks: result.rows,
                totalTasks: result.rows.length,
                completedTasks: result.rows.filter((t) => t.completed).length,
            };
        } catch (error) {
            console.error("[LearningDashboard] Error getting today's plan:", error);
            return { tasks: [] };
        }
    }

    /**
     * Achievements and milestones
     */
    async getAchievements(userId, client = null) {
        const db = client || pool;

        try {
            const achievements = [];

            // Skill level milestones
            const skillMilestones = await db.query(
                `
                SELECT skill_name, level FROM user_skills
                WHERE user_id = $1 AND level >= 3
                ORDER BY level DESC
                LIMIT 5
            `,
                [userId],
            );

            achievements.push(
                ...skillMilestones.rows.map((s) => ({
                    type: "skill_mastery",
                    title: `${s.skill_name} Level ${s.level}`,
                    icon: "🎯",
                })),
            );

            // Goal completions
            const completedGoals = await db.query(
                `
                SELECT goal_type, completed_at FROM user_goals
                WHERE user_id = $1 AND status = 'COMPLETED'
                ORDER BY completed_at DESC
                LIMIT 3
            `,
                [userId],
            );

            achievements.push(
                ...completedGoals.rows.map((g) => ({
                    type: "goal_completed",
                    title: `Completed: ${g.goal_type}`,
                    date: g.completed_at,
                    icon: "🏆",
                })),
            );

            // Problem solving streaks
            const streakQuery = `
                SELECT COUNT(DISTINCT DATE(solved_at)) as streak_days
                FROM (
                    SELECT solved_at,
                           DATE(solved_at) - ROW_NUMBER() OVER (ORDER BY DATE(solved_at)) * INTERVAL '1 day' as grp
                    FROM course_submissions
                    WHERE user_id = $1
                ) sub
                GROUP BY grp
                ORDER BY COUNT(*) DESC
                LIMIT 1
            `;

            const streakResult = await db.query(streakQuery, [userId]);
            if (streakResult.rows.length > 0 && streakResult.rows[0].streak_days > 3) {
                achievements.push({
                    type: "streak",
                    title: `${streakResult.rows[0].streak_days} Day Streak`,
                    icon: "🔥",
                });
            }

            return achievements;
        } catch (error) {
            console.error("[LearningDashboard] Error getting achievements:", error);
            return [];
        }
    }
}

export default LearningDashboardService;
