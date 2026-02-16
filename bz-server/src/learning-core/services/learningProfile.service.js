/**
 * ============================================================================
 * LEARNING PROFILE SERVICE
 * ============================================================================
 * Core deterministic memory agent - tracks what user knows WITHOUT LLM.
 *
 * This service:
 * 1. Updates weak/strong topics based on submission results
 * 2. Detects mistake patterns
 * 3. Tracks learning style from behavior
 * 4. Provides data for training recommendations
 *
 * CRITICAL: This is pure logic - no LLM calls. LLM enhances this later.
 * ============================================================================
 */

import { pool } from "../../database/connect.db.js";

class LearningProfileService {
    /**
     * Get or create learning profile for user
     * @param {string} userId
     * @returns {Promise<Object>}
     */
    async getProfile(userId) {
        try {
            const query = "SELECT * FROM learning_profiles WHERE user_id = $1";
            const result = await pool.query(query, [userId]);

            if (result.rowCount === 0) {
                // Create new profile
                return await this.createProfile(userId);
            }

            return result.rows[0];
        } catch (error) {
            console.error("Error fetching learning profile:", error);
            throw error;
        }
    }

    /**
     * Create new learning profile
     * @param {string} userId
     * @returns {Promise<Object>}
     */
    async createProfile(userId) {
        try {
            const query = `
        INSERT INTO learning_profiles (user_id) 
        VALUES ($1) 
        ON CONFLICT (user_id) DO NOTHING
        RETURNING *
      `;
            const result = await pool.query(query, [userId]);
            return result.rows[0] || (await this.getProfile(userId));
        } catch (error) {
            console.error("Error creating learning profile:", error);
            throw error;
        }
    }

    /**
     * Update profile after an evaluation
     * CORE ALGORITHM: Determines weak/strong topics from performance
     *
     * @param {string} userId
     * @param {Object} evaluationResult
     * @param {Object} question
     * @param {Array} mistakes
     */
    async updateAfterEvaluation(userId, evaluationResult, question, mistakes) {
        try {
            const profile = await this.getProfile(userId);

            // Extract topic from question
            const topic = question.primary_topic || question.topics?.[0] || "general";
            const difficulty = question.difficulty || "medium";
            const wasSuccess = evaluationResult.verdict === "ACCEPTED";

            // Update weak/strong topics
            const weakTopics = profile.weak_topics || {};
            const strongTopics = profile.strong_topics || {};

            const topicKey = topic;
            const currentStats = weakTopics[topicKey] ||
                strongTopics[topicKey] || {
                    attempts: 0,
                    success: 0,
                    failures: 0,
                    last_attempt: null,
                    difficulties: {},
                };

            // Update stats
            currentStats.attempts += 1;
            currentStats.last_attempt = new Date().toISOString();

            if (wasSuccess) {
                currentStats.success += 1;
            } else {
                currentStats.failures += 1;
                currentStats.last_failed = new Date().toISOString();
            }

            // Track by difficulty
            currentStats.difficulties[difficulty] = (currentStats.difficulties[difficulty] || 0) + 1;

            // Calculate success rate
            const successRate = currentStats.success / currentStats.attempts;

            // Classify as weak or strong
            // Weak: < 50% success rate with at least 2 attempts
            // Strong: >= 50% success rate with at least 2 attempts
            // (Topics with 50%+ success rate should be strengths, not weaknesses)
            if (successRate < 0.5 && currentStats.attempts >= 2) {
                weakTopics[topicKey] = currentStats;
                delete strongTopics[topicKey];
            } else if (successRate >= 0.5 && currentStats.attempts >= 2) {
                strongTopics[topicKey] = currentStats;
                delete weakTopics[topicKey];
            } else {
                // Less than 2 attempts - not enough data to classify
                // Keep in weakTopics until we have more attempts
                if (!strongTopics[topicKey]) {
                    weakTopics[topicKey] = currentStats;
                }
            }

            // Update mistake patterns
            const mistakePatterns = profile.mistake_patterns || {};
            mistakes.forEach((mistake) => {
                mistakePatterns[mistake.type] = (mistakePatterns[mistake.type] || 0) + 1;
            });

            // Update learning style based on behavior
            const learningStyle = profile.learning_style || {};
            if (evaluationResult.metadata?.hintsUsed) {
                learningStyle.hints_used_count =
                    (learningStyle.hints_used_count || 0) + evaluationResult.metadata.hintsUsed;
                learningStyle.prefers_hints =
                    learningStyle.hints_used_count > (profile.total_learning_sessions || 1) * 0.5;
            }
            if (evaluationResult.timeSpent) {
                learningStyle.total_time_spent = (learningStyle.total_time_spent || 0) + evaluationResult.timeSpent;
                learningStyle.average_solve_time_minutes =
                    learningStyle.total_time_spent / 60 / (profile.total_learning_sessions || 1);
            }

            // Increment streak if active today
            const lastActive = profile.last_active_date;
            const today = new Date().toISOString().split("T")[0];
            const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

            let streakDays = profile.streak_days || 0;
            if (lastActive === yesterday) {
                streakDays += 1;
            } else if (lastActive !== today) {
                streakDays = 1;
            }

            // Update database
            const updateQuery = `
        UPDATE learning_profiles 
        SET 
          weak_topics = $1,
          strong_topics = $2,
          mistake_patterns = $3,
          learning_style = $4,
          total_learning_sessions = total_learning_sessions + 1,
          streak_days = $5,
          last_active_date = $6,
          updated_at = NOW()
        WHERE user_id = $7
        RETURNING *
      `;

            const result = await pool.query(updateQuery, [
                JSON.stringify(weakTopics),
                JSON.stringify(strongTopics),
                JSON.stringify(mistakePatterns),
                JSON.stringify(learningStyle),
                streakDays,
                today,
                userId,
            ]);

            return result.rows[0];
        } catch (error) {
            console.error("Error updating learning profile:", error);
            throw error;
        }
    }

    /**
     * Get weak topics for a user
     * @param {string} userId
     * @returns {Promise<Array>}
     */
    async getWeakTopics(userId) {
        const profile = await this.getProfile(userId);
        const weakTopics = profile.weak_topics || {};

        return Object.entries(weakTopics)
            .map(([topic, stats]) => ({
                topic,
                ...stats,
                failureRate: stats.failures / stats.attempts,
            }))
            .sort((a, b) => b.failureRate - a.failureRate);
    }

    /**
     * Get strong topics for a user
     * @param {string} userId
     * @returns {Promise<Array>}
     */
    async getStrongTopics(userId) {
        const profile = await this.getProfile(userId);
        const strongTopics = profile.strong_topics || {};

        return Object.entries(strongTopics)
            .map(([topic, stats]) => ({
                topic,
                ...stats,
                successRate: stats.success / stats.attempts,
            }))
            .sort((a, b) => b.successRate - a.successRate);
    }

    /**
     * Get most common mistake types for a user
     * @param {string} userId
     * @returns {Promise<Array>}
     */
    async getCommonMistakes(userId) {
        const profile = await this.getProfile(userId);
        const mistakePatterns = profile.mistake_patterns || {};

        return Object.entries(mistakePatterns)
            .map(([type, count]) => ({ type, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10); // Top 10 mistakes
    }

    /**
     * Get learning summary for a user
     * @param {string} userId
     * @returns {Promise<Object>}
     */
    async getLearningummary(userId) {
        const profile = await this.getProfile(userId);
        const weakTopics = await this.getWeakTopics(userId);
        const strongTopics = await this.getStrongTopics(userId);
        const commonMistakes = await this.getCommonMistakes(userId);

        return {
            profile: {
                totalSessions: profile.total_learning_sessions,
                streakDays: profile.streak_days,
                lastActive: profile.last_active_date,
                learningStyle: profile.learning_style,
            },
            weakTopics: weakTopics.slice(0, 5), // Top 5 weak topics
            strongTopics: strongTopics.slice(0, 5), // Top 5 strong topics
            commonMistakes: commonMistakes.slice(0, 5), // Top 5 mistakes
        };
    }

    /**
     * Reset or adjust a specific topic (if user improved)
     * @param {string} userId
     * @param {string} topic
     */
    async resetTopic(userId, topic) {
        const profile = await this.getProfile(userId);
        const weakTopics = profile.weak_topics || {};
        const strongTopics = profile.strong_topics || {};

        delete weakTopics[topic];
        delete strongTopics[topic];

        const updateQuery = `
      UPDATE learning_profiles 
      SET weak_topics = $1, strong_topics = $2, updated_at = NOW()
      WHERE user_id = $3
    `;

        await pool.query(updateQuery, [JSON.stringify(weakTopics), JSON.stringify(strongTopics), userId]);
    }
}

export default LearningProfileService;
