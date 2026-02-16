/**
 * ============================================================================
 * EVALUATION SERVICE (Core Orchestrator)
 * ============================================================================
 * Main service that orchestrates the entire evaluation flow.
 *
 * This is the BRAIN of the learning system. It:
 * 1. Receives user submissions (code/quiz/pdf/etc.)
 * 2. Routes to appropriate plugin
 * 3. Stores evaluation results
 * 4. Extracts and logs mistakes
 * 5. Updates learning profile
 * 6. Returns feedback to user
 *
 * This service is PLUGIN-AGNOSTIC - it doesn't know about code execution details.
 * ============================================================================
 */

import { pool } from "../../database/connect.db.js";
import { pluginRegistry } from "../interfaces/IEvaluationPlugin.js";
import LearningProfileService from "./learningProfile.service.js";
import MistakeEngineService from "./mistakeEngine.service.js";
import TrainingPlannerService from "./trainingPlanner.service.js";

class EvaluationService {
    constructor() {
        this.profileService = new LearningProfileService();
        this.mistakeService = new MistakeEngineService();
        this.trainingService = new TrainingPlannerService();
    }

    /**
     * Main evaluation method - handles any type of question
     *
     * @param {Object} submissionData
     * @param {string} submissionData.userId - User ID
     * @param {string} submissionData.questionId - Question ID
     * @param {string} submissionData.evaluationType - 'code' | 'quiz' | 'pdf-exam' | etc.
     * @param {Object} submissionData.answer - User's answer (flexible format)
     * @param {Object} submissionData.context - {hintsUsed, timeSpent, userFailureReason, confidenceLevel}
     * @returns {Promise<Object>}
     */
    async evaluate(submissionData) {
        const client = await pool.connect();

        try {
            await client.query("BEGIN");

            const { userId, questionId, evaluationType, answer, context = {} } = submissionData;

            // Step 1: Get question data
            const question = await this._getQuestion(questionId);
            if (!question) {
                throw new Error(`Question not found: ${questionId}`);
            }

            // Step 2: Get appropriate plugin
            if (!pluginRegistry.hasPlugin(evaluationType)) {
                throw new Error(`No plugin registered for type: ${evaluationType}`);
            }

            const plugin = pluginRegistry.getPlugin(evaluationType);

            // Step 3: Validate plugin can handle this question
            if (!plugin.canHandle(question)) {
                throw new Error(`Plugin cannot handle this question type`);
            }

            // Step 4: Execute evaluation using plugin
            console.log(`🔍 Evaluating with plugin: ${evaluationType}`);

            const evaluationResult = await plugin.evaluate({
                userId,
                questionId,
                answer,
                context,
            });

            if (!evaluationResult.success) {
                // Evaluation failed - still log it
                await this._logFailedEvaluation(client, userId, questionId, evaluationResult, context);
                await client.query("COMMIT");
                return {
                    success: false,
                    message: "Evaluation failed",
                    details: evaluationResult,
                };
            }

            // Step 5: Extract mistakes using plugin
            const mistakes = await plugin.extractMistakes(evaluationResult, question);

            // Step 6: Store evaluation result in database
            const evaluationResultId = await this._storeEvaluationResult(
                client,
                userId,
                questionId,
                evaluationType,
                evaluationResult,
                mistakes,
                context,
            );

            // Step 7: Log mistakes (pass client for transactional consistency)
            await this.mistakeService.logMistakes(userId, evaluationResultId, mistakes, question, client);

            // Step 8: Update learning profile
            await this.profileService.updateAfterEvaluation(userId, evaluationResult, question, mistakes);

            // Step 9: Update active training plan if exists
            await this._updateTrainingPlan(userId, questionId, evaluationResult.verdict);

            // Step 10: Get next recommendations
            const recommendations = await this.trainingService.getNextRecommendations(userId, 3);

            // Step 11: Commit transaction
            await client.query("COMMIT");

            // Step 12: Return comprehensive response
            return {
                success: true,
                evaluationResult: {
                    verdict: evaluationResult.verdict,
                    score: evaluationResult.score,
                    details: evaluationResult.details,
                    feedback: evaluationResult.feedback,
                },
                mistakes: mistakes.map((m) => ({
                    type: m.type,
                    category: m.category,
                    severity: m.severity,
                    description: m.description,
                })),
                recommendations: recommendations.slice(0, 3).map((q) => ({
                    id: q.id || q.legacy_problem_id,
                    title: q.title,
                    difficulty: q.difficulty,
                    topic: q.primary_topic || q.category?.[0],
                })),
                learningInsights: {
                    totalSessions: (await this.profileService.getProfile(userId)).total_learning_sessions,
                    streakDays: (await this.profileService.getProfile(userId)).streak_days,
                },
            };
        } catch (error) {
            await client.query("ROLLBACK");
            console.error("Evaluation service error:", error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Check if a string is a valid UUID format
     * @private
     */
    _isValidUUID(str) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return uuidRegex.test(str);
    }

    /**
     * Get question data (tries new table first, falls back to legacy)
     * @private
     */
    async _getQuestion(questionId) {
        try {
            // Only try normalized_questions if questionId is a valid UUID
            if (this._isValidUUID(String(questionId))) {
                try {
                    const query = "SELECT * FROM normalized_questions WHERE id = $1";
                    const result = await pool.query(query, [questionId]);

                    if (result.rowCount > 0) {
                        return result.rows[0];
                    }
                } catch (normalizedError) {
                    // If normalized query fails, fall through to legacy
                    console.log("📝 Normalized questions query failed, trying legacy table...");
                }
            }

            // Fallback to legacy problem table (works with integer IDs)
            const query = `
        SELECT 
          p.*,
          p.id as legacy_problem_id,
          'code' as question_type,
          p.category as topics,
          p.category[1] as primary_topic
        FROM problem p 
        WHERE p.id = $1
      `;
            const result = await pool.query(query, [questionId]);

            return result.rows[0] || null;
        } catch (error) {
            console.error("Error fetching question:", error);
            throw error;
        }
    }

    /**
     * Store evaluation result in database
     * @private
     */
    async _storeEvaluationResult(client, userId, questionId, evaluationType, evaluationResult, mistakes, context) {
        try {
            const query = `
        INSERT INTO evaluation_results (
          user_id,
          evaluation_type,
          plugin_version,
          question_id,
          question_source,
          verdict,
          score,
          evaluation_data,
          detected_mistakes,
          user_failure_reason,
          user_confidence_level,
          time_spent_seconds,
          hints_used,
          attempts_count
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING id
      `;

            const result = await client.query(query, [
                userId,
                evaluationType,
                evaluationResult.metadata?.pluginVersion || "1.0.0",
                questionId,
                "neocode", // TODO: Get from question data
                evaluationResult.verdict,
                evaluationResult.score,
                JSON.stringify(evaluationResult.details),
                JSON.stringify(mistakes),
                context.userFailureReason || null,
                context.confidenceLevel || null,
                context.timeSpent || null,
                context.hintsUsed || 0,
                context.attemptsCount || 1,
            ]);

            return result.rows[0].id;
        } catch (error) {
            console.error("Error storing evaluation result:", error);
            throw error;
        }
    }

    /**
     * Log failed evaluation (still useful for analytics)
     * @private
     */
    async _logFailedEvaluation(client, userId, questionId, evaluationResult, context) {
        try {
            const query = `
        INSERT INTO evaluation_results (
          user_id,
          evaluation_type,
          question_id,
          verdict,
          score,
          evaluation_data,
          detected_mistakes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `;

            await client.query(query, [
                userId,
                "unknown",
                questionId,
                "ERROR",
                0,
                JSON.stringify(evaluationResult),
                "[]",
            ]);
        } catch (error) {
            console.error("Error logging failed evaluation:", error);
            // Don't throw - this is just logging
        }
    }

    /**
     * Update active training plan
     * @private
     */
    async _updateTrainingPlan(userId, questionId, verdict) {
        try {
            const activePlan = await this.trainingService.getActivePlan(userId);

            if (activePlan && verdict === "ACCEPTED") {
                await this.trainingService.markQuestionCompleted(activePlan.id, questionId);
            }
        } catch (error) {
            console.error("Error updating training plan:", error);
            // Don't throw - plan update is not critical
        }
    }

    /**
     * Get user's evaluation history
     * @param {string} userId
     * @param {Object} options
     */
    async getEvaluationHistory(userId, options = {}) {
        try {
            const { limit = 20, evaluationType = null, verdict = null } = options;

            let query = `
        SELECT 
          er.*,
          nq.title as question_title,
          nq.difficulty,
          nq.primary_topic as topic
        FROM evaluation_results er
        LEFT JOIN normalized_questions nq ON er.question_id = nq.id
        WHERE er.user_id = $1
      `;

            const params = [userId];
            let paramCount = 1;

            if (evaluationType) {
                paramCount++;
                query += ` AND er.evaluation_type = $${paramCount}`;
                params.push(evaluationType);
            }

            if (verdict) {
                paramCount++;
                query += ` AND er.verdict = $${paramCount}`;
                params.push(verdict);
            }

            query += ` ORDER BY er.submitted_at DESC LIMIT $${paramCount + 1}`;
            params.push(limit);

            const result = await pool.query(query, params);
            return result.rows;
        } catch (error) {
            console.error("Error fetching evaluation history:", error);
            throw error;
        }
    }

    /**
     * Get evaluation statistics for a user
     * @param {string} userId
     */
    async getEvaluationStats(userId) {
        try {
            const query = `
        SELECT 
          evaluation_type,
          COUNT(*) as total_attempts,
          SUM(CASE WHEN verdict = 'ACCEPTED' THEN 1 ELSE 0 END) as accepted_count,
          AVG(score) as average_score,
          AVG(time_spent_seconds) as avg_time_spent
        FROM evaluation_results
        WHERE user_id = $1
        GROUP BY evaluation_type
      `;

            const result = await pool.query(query, [userId]);
            return result.rows;
        } catch (error) {
            console.error("Error fetching evaluation stats:", error);
            throw error;
        }
    }
}

export default EvaluationService;
