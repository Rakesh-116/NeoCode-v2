/**
 * ============================================================================
 * MISTAKE ENGINE SERVICE
 * ============================================================================
 * Handles mistake detection, logging, and pattern analysis.
 *
 * This service:
 * 1. Logs user mistakes to database
 * 2. Identifies recurring mistake patterns
 * 3. Provides mistake-specific feedback
 * 4. Tracks mistake resolution
 * 5. Generates AI-powered coaching (Phase 2)
 *
 * Works with mistake_catalog and user_mistakes_log tables.
 * ============================================================================
 */

import { pool } from "../../database/connect.db.js";
import llmGateway from "../../ai/index.js";
import config from "../../config/index.js";

class MistakeEngineService {
    /**
     * Log mistakes from an evaluation
     * @param {string} userId
     * @param {string} evaluationResultId
     * @param {Array} mistakes
     * @param {Object} question
     * @param {Object} client - Optional database client for transactional operations
     */
    async logMistakes(userId, evaluationResultId, mistakes, question, client = null) {
        try {
            if (!mistakes || mistakes.length === 0) {
                return [];
            }

            const loggedMistakes = [];

            for (const mistake of mistakes) {
                // Validate mistake object
                if (!mistake || !mistake.type) {
                    console.warn("Invalid mistake object:", mistake);
                    continue;
                }

                // Check if mistake type exists in catalog
                const catalogQuery = `
          SELECT * FROM mistake_catalog WHERE mistake_type = $1
        `;
                const catalogResult = await pool.query(catalogQuery, [mistake.type]);

                let mistakeCatalogEntry = catalogResult.rows[0];

                // If mistake type doesn't exist, create it
                if (!mistakeCatalogEntry) {
                    const mistakeName = String(mistake.type)
                        .replace(/_/g, " ")
                        .replace(/\b\w/g, (l) => l.toUpperCase());
                    mistakeCatalogEntry = await this.addToCatalog({
                        mistake_type: mistake.type,
                        category: mistake.category || "general",
                        name: mistakeName,
                        description: mistake.description || `${mistakeName} error`,
                        severity: mistake.severity || 3,
                    });
                }

                // Log user mistake
                const logQuery = `
          INSERT INTO user_mistakes_log (
            user_id, 
            evaluation_result_id, 
            mistake_type, 
            question_id, 
            topic, 
            difficulty, 
            severity,
            occurrence_count
          )
          VALUES ($1, $2, $3, $4::TEXT, $5, $6, $7, $8)
          RETURNING *
        `;

                const questionId = question?.id || question?.legacy_problem_id || question?.problem_id || null;
                const dbClient = client || pool;
                const logResult = await dbClient.query(logQuery, [
                    userId,
                    evaluationResultId,
                    mistake.type,
                    questionId,
                    question?.primary_topic || question?.topics?.[0] || null,
                    question?.difficulty || null,
                    mistakeCatalogEntry.severity,
                    mistake.context?.count || 1,
                ]);

                loggedMistakes.push(logResult.rows[0]);

                // Update occurrence count in catalog
                await pool.query(
                    "UPDATE mistake_catalog SET occurrence_count = occurrence_count + 1 WHERE mistake_type = $1",
                    [mistake.type],
                );
            }

            return loggedMistakes;
        } catch (error) {
            console.error("Error logging mistakes:", error);
            throw error;
        }
    }

    /**
     * Add a new mistake type to the catalog
     * @param {Object} mistakeData
     */
    async addToCatalog(mistakeData) {
        try {
            const query = `
        INSERT INTO mistake_catalog (
          mistake_type, category, name, description, severity, detection_rules
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (mistake_type) DO UPDATE
        SET 
          description = EXCLUDED.description,
          severity = EXCLUDED.severity,
          updated_at = NOW()
        RETURNING *
      `;

            const result = await pool.query(query, [
                mistakeData.mistake_type,
                mistakeData.category,
                mistakeData.name,
                mistakeData.description,
                mistakeData.severity || 3,
                JSON.stringify(mistakeData.detection_rules || {}),
            ]);

            return result.rows[0];
        } catch (error) {
            console.error("Error adding to mistake catalog:", error);
            throw error;
        }
    }

    /**
     * Get user's mistake history
     * @param {string} userId
     * @param {Object} options - {limit, mistakeType, resolved}
     */
    async getUserMistakes(userId, options = {}) {
        try {
            const { limit = 50, mistakeType = null, resolved = null } = options;

            let query = `
        SELECT 
          uml.*,
          mc.name,
          mc.category,
          mc.description,
          mc.severity,
          mc.explanation,
          mc.fix_strategy
        FROM user_mistakes_log uml
        JOIN mistake_catalog mc ON uml.mistake_type = mc.mistake_type
        WHERE uml.user_id = $1
      `;

            const params = [userId];
            let paramCount = 1;

            if (mistakeType) {
                paramCount++;
                query += ` AND uml.mistake_type = $${paramCount}`;
                params.push(mistakeType);
            }

            if (resolved !== null) {
                paramCount++;
                query += ` AND uml.resolved = $${paramCount}`;
                params.push(resolved);
            }

            query += ` ORDER BY uml.detected_at DESC LIMIT $${paramCount + 1}`;
            params.push(limit);

            const result = await pool.query(query, params);
            return result.rows;
        } catch (error) {
            console.error("Error fetching user mistakes:", error);
            throw error;
        }
    }

    /**
     * Identify recurring mistake patterns
     * Returns mistakes that happen repeatedly
     *
     * @param {string} userId
     * @returns {Promise<Array>}
     */
    async getRecurringPatterns(userId) {
        try {
            const query = `
        SELECT 
          uml.mistake_type,
          mc.name,
          mc.category,
          mc.severity,
          COUNT(*) as occurrence_count,
          MAX(uml.detected_at) as last_occurred,
          ARRAY_AGG(DISTINCT uml.topic) FILTER (WHERE uml.topic IS NOT NULL) as affected_topics
        FROM user_mistakes_log uml
        JOIN mistake_catalog mc ON uml.mistake_type = mc.mistake_type
        WHERE uml.user_id = $1 
          AND uml.resolved = FALSE
          AND uml.detected_at > NOW() - INTERVAL '30 days'
        GROUP BY uml.mistake_type, mc.name, mc.category, mc.severity
        HAVING COUNT(*) >= 3
        ORDER BY COUNT(*) DESC, mc.severity DESC
        LIMIT 10
      `;

            const result = await pool.query(query, [userId]);
            return result.rows;
        } catch (error) {
            console.error("Error finding recurring patterns:", error);
            throw error;
        }
    }

    /**
     * Mark a mistake as resolved (user improved)
     * @param {string} mistakeLogId
     * @param {string} notes
     */
    async resolveMistake(mistakeLogId, notes = null) {
        try {
            const query = `
        UPDATE user_mistakes_log
        SET resolved = TRUE, resolved_at = NOW(), notes = $1
        WHERE id = $2
        RETURNING *
      `;

            const result = await pool.query(query, [notes, mistakeLogId]);
            return result.rows[0];
        } catch (error) {
            console.error("Error resolving mistake:", error);
            throw error;
        }
    }

    /**
     * Get mistake feedback/explanation from catalog
     * @param {string} mistakeType
     */
    async getMistakeFeedback(mistakeType) {
        try {
            const query = `
        SELECT 
          name,
          description,
          explanation,
          fix_strategy,
          example_correct_code,
          related_concepts
        FROM mistake_catalog
        WHERE mistake_type = $1
      `;

            const result = await pool.query(query, [mistakeType]);
            return result.rows[0] || null;
        } catch (error) {
            console.error("Error fetching mistake feedback:", error);
            throw error;
        }
    }

    /**
     * Get mistake statistics for a user
     * @param {string} userId
     */
    async getMistakeStats(userId) {
        try {
            const query = `
        SELECT 
          mc.category,
          COUNT(*) as total_mistakes,
          COUNT(DISTINCT uml.mistake_type) as unique_mistake_types,
          SUM(CASE WHEN uml.resolved THEN 1 ELSE 0 END) as resolved_count,
          AVG(mc.severity) as avg_severity
        FROM user_mistakes_log uml
        JOIN mistake_catalog mc ON uml.mistake_type = mc.mistake_type
        WHERE uml.user_id = $1
        GROUP BY mc.category
        ORDER BY total_mistakes DESC
      `;

            const result = await pool.query(query, [userId]);
            return result.rows;
        } catch (error) {
            console.error("Error fetching mistake stats:", error);
            throw error;
        }
    }

    /**
     * Check if user has improved on a specific mistake type
     * Compares recent performance vs historical
     *
     * @param {string} userId
     * @param {string} mistakeType
     * @returns {Promise<Object>}
     */
    async hasImproved(userId, mistakeType) {
        try {
            // Get recent occurrences (last 2 weeks)
            const recentQuery = `
        SELECT COUNT(*) as recent_count
        FROM user_mistakes_log
        WHERE user_id = $1 
          AND mistake_type = $2 
          AND detected_at > NOW() - INTERVAL '14 days'
      `;

            // Get historical occurrences (2-8 weeks ago)
            const historicalQuery = `
        SELECT COUNT(*) as historical_count
        FROM user_mistakes_log
        WHERE user_id = $1 
          AND mistake_type = $2 
          AND detected_at BETWEEN NOW() - INTERVAL '56 days' AND NOW() - INTERVAL '14 days'
      `;

            const [recentResult, historicalResult] = await Promise.all([
                pool.query(recentQuery, [userId, mistakeType]),
                pool.query(historicalQuery, [userId, mistakeType]),
            ]);

            const recentCount = parseInt(recentResult.rows[0].recent_count);
            const historicalCount = parseInt(historicalResult.rows[0].historical_count);

            // Improved if recent occurrences are less than historical
            const hasImproved = recentCount < historicalCount || (historicalCount > 0 && recentCount === 0);

            return {
                mistakeType,
                hasImproved,
                recentCount,
                historicalCount,
                improvementPercentage:
                    historicalCount > 0 ? (((historicalCount - recentCount) / historicalCount) * 100).toFixed(1) : 0,
            };
        } catch (error) {
            console.error("Error checking improvement:", error);
            throw error;
        }
    }

    /**
     * ========================================================================
     * AI-POWERED COACHING METHODS (Phase 2)
     * ========================================================================
     */

    /**
     * Generate AI coaching based on user's mistake patterns
     * @param {string} userId
     * @param {Object} options - Optional filters
     * @returns {Promise<Object>} AI coaching response
     */
    async getAICoaching(userId, options = {}) {
        // Check if AI coach is enabled
        if (!config.AI.ENABLE_AI_COACH) {
            return {
                success: false,
                message: "AI Coach is currently disabled. Enable it in config.",
            };
        }

        try {
            // Gather learning context
            const context = await this.buildCoachingContext(userId, options);

            // Skip if no data
            if (!context.weakTopics || context.weakTopics.length === 0) {
                return {
                    success: true,
                    message: "Great job! No significant weak areas detected yet. Keep practicing!",
                    context,
                };
            }

            // Generate AI response
            const aiResponse = await llmGateway.generate({
                purpose: "coach",
                context,
                provider: options.provider, // Allow provider override
            });

            // Log AI interaction (optional - for analytics)
            await this.logAIInteraction(userId, "coach", context, aiResponse);

            return {
                success: true,
                coaching: aiResponse,
                context, // Include context for transparency
            };
        } catch (error) {
            console.error("MistakeEngine AI coaching error:", error.message);

            // Return graceful fallback
            return {
                success: false,
                message: "AI Coach is temporarily unavailable. Check your Learning Profile for detailed analytics.",
                error: error.message,
            };
        }
    }

    /**
     * Build context for AI coaching
     * @param {string} userId
     * @param {Object} options
     * @returns {Promise<Object>}
     */
    async buildCoachingContext(userId, options = {}) {
        try {
            // Get weak topics (from Learning Profile Service)
            const weakTopicsQuery = `
        SELECT 
          topic,
          total_attempts,
          correct_count,
          ROUND((correct_count::DECIMAL / NULLIF(total_attempts, 0)) * 100, 2) as accuracy,
          ROUND(AVG(time_taken), 2) as avg_time
        FROM topic_performance
        WHERE user_id = $1
          AND total_attempts >= 3
          AND (correct_count::DECIMAL / NULLIF(total_attempts, 0)) < 0.6
        ORDER BY total_attempts DESC, accuracy ASC
        LIMIT 5
      `;
            const weakTopicsResult = await pool.query(weakTopicsQuery, [userId]);

            // Get recent mistakes (last 10)
            const mistakesQuery = `
        SELECT 
          uml.mistake_type,
          uml.topic,
          uml.severity,
          uml.detected_at,
          mc.name as mistake_name,
          mc.description
        FROM user_mistakes_log uml
        JOIN mistake_catalog mc ON uml.mistake_type = mc.mistake_type
        WHERE uml.user_id = $1
        ORDER BY uml.detected_at DESC
        LIMIT 10
      `;
            const mistakesResult = await pool.query(mistakesQuery, [userId]);

            // Get recent submissions (last 5)
            const submissionsQuery = `
        SELECT 
          status,
          score,
          time_taken,
          submitted_at
        FROM evaluation_results
        WHERE user_id = $1
        ORDER BY submitted_at DESC
        LIMIT 5
      `;
            const submissionsResult = await pool.query(submissionsQuery, [userId]);

            // Get overall performance stats
            const statsQuery = `
        SELECT 
          COUNT(*) as total_submissions,
          COUNT(*) FILTER (WHERE status = 'accepted') as accepted_count,
          ROUND(AVG(score), 2) as avg_score
        FROM evaluation_results
        WHERE user_id = $1
      `;
            const statsResult = await pool.query(statsQuery, [userId]);

            return {
                weakTopics: weakTopicsResult.rows,
                mistakes: mistakesResult.rows,
                recentSubmissions: submissionsResult.rows,
                learningProfile: statsResult.rows[0],
            };
        } catch (error) {
            console.error("Error building coaching context:", error);
            throw error;
        }
    }

    /**
     * Log AI interaction for analytics
     * @param {string} userId
     * @param {string} purpose
     * @param {Object} context
     * @param {string} response
     */
    async logAIInteraction(userId, purpose, context, response) {
        try {
            // TODO: Create ai_interactions table if analytics needed
            // For now, just log to console
            console.log(`📊 AI Interaction: User ${userId} used ${purpose}`);
        } catch (error) {
            // Non-critical - don't throw
            console.warn("Failed to log AI interaction:", error.message);
        }
    }
}

export default MistakeEngineService;
