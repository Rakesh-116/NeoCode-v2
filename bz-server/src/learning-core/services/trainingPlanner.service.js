/**
 * ============================================================================
 * TRAINING PLANNER SERVICE
 * ============================================================================
 * Rule-based training recommendation system (NO LLM).
 *
 * This service:
 * 1. Analyzes user's learning profile and mistakes
 * 2. Generates personalized training plans
 * 3. Recommends next questions strategically
 * 4. Balances weak topic practice with skill building
 *
 * CRITICAL: This works WITHOUT AI - pure algorithmic logic.
 * LLM can enhance recommendations later, but base system is deterministic.
 * ============================================================================
 */

import { pool } from "../../database/connect.db.js";
import LearningProfileService from "./learningProfile.service.js";
import MistakeEngineService from "./mistakeEngine.service.js";

class TrainingPlannerService {
    constructor() {
        this.profileService = new LearningProfileService();
        this.mistakeService = new MistakeEngineService();
    }

    /**
     * Generate a training plan for a user
     *
     * @param {string} userId
     * @param {Object} options - {planType, duration, dailyTarget}
     * @returns {Promise<Object>}
     */
    async generatePlan(userId, options = {}) {
        try {
            const { planType = "weak_topic_focus", durationDays = 7, dailyTarget = 3 } = options;

            const profile = await this.profileService.getProfile(userId);
            const weakTopics = await this.profileService.getWeakTopics(userId);
            const recurringMistakes = await this.mistakeService.getRecurringPatterns(userId);

            let planStructure;

            switch (planType) {
                case "weak_topic_focus":
                    planStructure = await this._generateWeakTopicPlan(userId, weakTopics, durationDays, dailyTarget);
                    break;

                case "mistake_resolution":
                    planStructure = await this._generateMistakeResolutionPlan(
                        userId,
                        recurringMistakes,
                        durationDays,
                        dailyTarget,
                    );
                    break;

                case "skill_building":
                    planStructure = await this._generateSkillBuildingPlan(userId, profile, durationDays, dailyTarget);
                    break;

                case "interview_prep":
                    planStructure = await this._generateInterviewPrepPlan(userId, durationDays, dailyTarget);
                    break;

                default:
                    throw new Error(`Unknown plan type: ${planType}`);
            }

            // Save plan to database
            const planQuery = `
        INSERT INTO training_plans (
          user_id, plan_name, plan_type, plan_structure, 
          total_days, generation_method, generation_metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;

            const planName = this._generatePlanName(planType, weakTopics, recurringMistakes);

            const result = await pool.query(planQuery, [
                userId,
                planName,
                planType,
                JSON.stringify(planStructure),
                durationDays,
                "rule_based",
                JSON.stringify({
                    weakTopics: weakTopics.slice(0, 3).map((t) => t.topic),
                    recurringMistakes: recurringMistakes.slice(0, 3).map((m) => m.mistake_type),
                    generatedAt: new Date().toISOString(),
                }),
            ]);

            return result.rows[0];
        } catch (error) {
            console.error("Error generating training plan:", error);
            throw error;
        }
    }

    /**
     * Recommend next questions for immediate practice
     * (Without creating a full plan)
     *
     * @param {string} userId
     * @param {number} count
     * @returns {Promise<Array>}
     */
    async getNextRecommendations(userId, count = 3) {
        try {
            const weakTopics = await this.profileService.getWeakTopics(userId);
            const profile = await this.profileService.getProfile(userId);

            if (weakTopics.length === 0) {
                // No weak topics - recommend diverse practice
                return await this._getDiverseRecommendations(userId, count);
            }

            // Focus on weakest topic
            const weakestTopic = weakTopics[0].topic;
            const topicStats = weakTopics[0];

            // Determine difficulty based on failure rate
            let difficulty;
            if (topicStats.failureRate > 0.8) {
                difficulty = "easy"; // User is struggling - start easy
            } else if (topicStats.failureRate > 0.5) {
                difficulty = "medium"; // Some failures - medium practice
            } else {
                difficulty = "hard"; // Improving - challenge them
            }

            return await this._getQuestionsByTopic(weakestTopic, difficulty, count, userId);
        } catch (error) {
            console.error("Error getting recommendations:", error);
            throw error;
        }
    }

    /**
     * Generate weak topic focused plan
     * @private
     */
    async _generateWeakTopicPlan(userId, weakTopics, durationDays, dailyTarget) {
        const plan = [];

        if (weakTopics.length === 0) {
            // No weak topics - return mixed practice
            return await this._generateSkillBuildingPlan(userId, {}, durationDays, dailyTarget);
        }

        // Take top 3 weakest topics
        const focusTopics = weakTopics.slice(0, 3);

        for (let day = 1; day <= durationDays; day++) {
            // Rotate through weak topics
            const topicIndex = (day - 1) % focusTopics.length;
            const topic = focusTopics[topicIndex];

            // Start with easy, gradually increase difficulty
            const difficultyProgression = this._getDifficultyForDay(day, topic.failureRate);

            const questions = await this._getQuestionsByTopic(topic.topic, difficultyProgression, dailyTarget, userId);

            plan.push({
                day,
                topic: topic.topic,
                difficulty: difficultyProgression,
                questions: questions.map((q) => q.id),
                goal: `Master ${topic.topic} - ${difficultyProgression} level`,
                rationale: `Focusing on ${topic.topic} (${(topic.failureRate * 100).toFixed(0)}% failure rate)`,
            });
        }

        return plan;
    }

    /**
     * Generate mistake resolution plan
     * @private
     */
    async _generateMistakeResolutionPlan(userId, recurringMistakes, durationDays, dailyTarget) {
        const plan = [];

        if (recurringMistakes.length === 0) {
            return await this._generateSkillBuildingPlan(userId, {}, durationDays, dailyTarget);
        }

        for (let day = 1; day <= durationDays; day++) {
            const mistakeIndex = (day - 1) % recurringMistakes.length;
            const mistake = recurringMistakes[mistakeIndex];

            // Get questions related to this mistake type
            const questions = await this._getQuestionsByMistakeType(
                mistake.mistake_type,
                mistake.affected_topics,
                dailyTarget,
                userId,
            );

            plan.push({
                day,
                focusMistake: mistake.mistake_type,
                questions: questions.map((q) => q.id),
                goal: `Overcome ${mistake.name}`,
                rationale: `Addressing recurring mistake (${mistake.occurrence_count} occurrences)`,
            });
        }

        return plan;
    }

    /**
     * Generate skill building plan (balanced practice)
     * @private
     */
    async _generateSkillBuildingPlan(userId, profile, durationDays, dailyTarget) {
        const plan = [];

        const commonTopics = [
            "arrays",
            "strings",
            "hash_tables",
            "trees",
            "graphs",
            "dynamic_programming",
            "sorting",
            "searching",
        ];

        for (let day = 1; day <= durationDays; day++) {
            const topicIndex = (day - 1) % commonTopics.length;
            const topic = commonTopics[topicIndex];

            const difficulty = day <= durationDays / 3 ? "easy" : day <= (2 * durationDays) / 3 ? "medium" : "hard";

            const questions = await this._getQuestionsByTopic(topic, difficulty, dailyTarget, userId);

            plan.push({
                day,
                topic,
                difficulty,
                questions: questions.map((q) => q.id),
                goal: `Build ${topic} skills`,
                rationale: "Balanced skill development",
            });
        }

        return plan;
    }

    /**
     * Generate interview prep plan
     * @private
     */
    async _generateInterviewPrepPlan(userId, durationDays, dailyTarget) {
        const plan = [];

        // Interview-focused topics in order of importance
        const interviewTopics = [
            { topic: "arrays", difficulty: "medium" },
            { topic: "strings", difficulty: "medium" },
            { topic: "hash_tables", difficulty: "medium" },
            { topic: "trees", difficulty: "medium" },
            { topic: "graphs", difficulty: "hard" },
            { topic: "dynamic_programming", difficulty: "hard" },
            { topic: "system_design", difficulty: "hard" },
        ];

        for (let day = 1; day <= durationDays; day++) {
            const topicData = interviewTopics[(day - 1) % interviewTopics.length];

            const questions = await this._getQuestionsByTopic(
                topicData.topic,
                topicData.difficulty,
                dailyTarget,
                userId,
            );

            plan.push({
                day,
                topic: topicData.topic,
                difficulty: topicData.difficulty,
                questions: questions.map((q) => q.id),
                goal: `Interview prep: ${topicData.topic}`,
                rationale: "Common interview question patterns",
            });
        }

        return plan;
    }

    /**
     * Get questions by topic and difficulty
     * @private
     */
    async _getQuestionsByTopic(topic, difficulty, count, userId) {
        try {
            // For now, use legacy problem table directly (normalized_questions is empty)
            // Once we migrate questions to normalized_questions, this will automatically use it
            const query = `
          SELECT p.*, p.id as legacy_problem_id
          FROM problem p
          LEFT JOIN submissions s ON s.problem_id = p.id AND s.user_id = $1 AND s.verdict = 'ACCEPTED'
          WHERE $2 = ANY(p.category)
            AND p.difficulty = $3
            AND (p.hidden IS NULL OR p.hidden = FALSE)
            AND s.id IS NULL
          ORDER BY p.no_of_submissions ASC, RANDOM()
          LIMIT $4
        `;

            const result = await pool.query(query, [userId, topic, difficulty, count]);
            return result.rows;
        } catch (error) {
            console.error("Error fetching questions by topic:", error);
            return [];
        }
    }

    /**
     * Get questions that expose a specific mistake type
     * @private
     */
    async _getQuestionsByMistakeType(mistakeType, topics, count, userId) {
        try {
            // Get questions from topics where this mistake commonly occurs
            if (!topics || topics.length === 0) {
                topics = ["arrays"]; // Default fallback
            }

            const query = `
        SELECT DISTINCT p.*
        FROM problem p
        LEFT JOIN submissions s ON s.problem_id = p.id AND s.user_id = $2 AND s.verdict = 'ACCEPTED'
        WHERE p.category && $1
          AND (p.hidden IS NULL OR p.hidden = FALSE)
          AND s.id IS NULL
        ORDER BY RANDOM()
        LIMIT $3
      `;

            const result = await pool.query(query, [topics, userId, count]);
            return result.rows;
        } catch (error) {
            console.error("Error fetching questions by mistake type:", error);
            return [];
        }
    }

    /**
     * Get diverse recommendations
     * @private
     */
    async _getDiverseRecommendations(userId, count) {
        try {
            const query = `
        SELECT p.*
        FROM problem p
        LEFT JOIN submissions s ON s.problem_id = p.id AND s.user_id = $1 AND s.verdict = 'ACCEPTED'
        WHERE (p.hidden IS NULL OR p.hidden = FALSE)
          AND s.id IS NULL
        ORDER BY RANDOM()
        LIMIT $2
      `;

            const result = await pool.query(query, [userId, count]);
            return result.rows;
        } catch (error) {
            console.error("Error fetching diverse recommendations:", error);
            return [];
        }
    }

    /**
     * Determine difficulty based on day and performance
     * @private
     */
    _getDifficultyForDay(day, failureRate) {
        if (failureRate > 0.7) {
            // High failure rate - stay on easy
            return day <= 5 ? "easy" : "medium";
        } else if (failureRate > 0.4) {
            // Moderate failure - gradual progression
            return day <= 3 ? "easy" : day <= 5 ? "medium" : "hard";
        } else {
            // Improving - can challenge early
            return day <= 2 ? "medium" : "hard";
        }
    }

    /**
     * Generate a descriptive plan name
     * @private
     */
    _generatePlanName(planType, weakTopics, recurringMistakes) {
        switch (planType) {
            case "weak_topic_focus":
                const topTopics = weakTopics
                    .slice(0, 2)
                    .map((t) => t.topic)
                    .join(", ");
                return `Strengthen ${topTopics}`;

            case "mistake_resolution":
                return `Fix Recurring Mistakes`;

            case "skill_building":
                return `Balanced Skill Development`;

            case "interview_prep":
                return `Interview Preparation Plan`;

            default:
                return `Custom Training Plan`;
        }
    }

    /**
     * Get active plan for user
     * @param {string} userId
     */
    async getActivePlan(userId) {
        try {
            const query = `
        SELECT * FROM training_plans
        WHERE user_id = $1 AND status = 'active'
        ORDER BY started_at DESC
        LIMIT 1
      `;

            const result = await pool.query(query, [userId]);
            return result.rows[0] || null;
        } catch (error) {
            console.error("Error fetching active plan:", error);
            throw error;
        }
    }

    /**
     * Mark question as completed in plan
     * @param {string} planId
     * @param {string} questionId
     */
    async markQuestionCompleted(planId, questionId) {
        try {
            // Convert questionId to string if it's a number (legacy problem IDs)
            const questionIdStr = String(questionId);

            const query = `
        UPDATE training_plans
        SET 
          completed_questions = array_append(completed_questions, $1::TEXT),
          last_activity_at = NOW()
        WHERE id = $2
        RETURNING *
      `;

            const result = await pool.query(query, [questionIdStr, planId]);
            return result.rows[0];
        } catch (error) {
            console.error("Error marking question completed:", error);
            // Don't throw - this is non-critical (user doesn't have a training plan yet)
            return null;
        }
    }
}

export default TrainingPlannerService;
