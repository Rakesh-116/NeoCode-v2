/**
 * ============================================================================
 * Voice Interview Evaluation Plugin
 * ============================================================================
 * Integrates voice interview system with Learning OS evaluation framework
 *
 * This plugin:
 * - Handles voice interview evaluations
 * - Extracts mistakes from interview performance
 * - Updates user's learning profile based on interview results
 * - Recommends next steps based on weak areas
 * ============================================================================
 */

import IEvaluationPlugin from "../../../learning-core/interfaces/IEvaluationPlugin.js";
import { pool } from "../../../database/connect.db.js";

export default class InterviewEvaluationPlugin extends IEvaluationPlugin {
    constructor() {
        super();
        this.type = "voice_interview";
        this.version = "1.0.0";
    }

    /**
     * Get plugin type
     * @returns {string}
     */
    getType() {
        return this.type;
    }

    /**
     * Get plugin version
     * @returns {string}
     */
    getVersion() {
        return this.version;
    }

    /**
     * Get supported question types
     * @returns {Array<string>}
     */
    getSupportedQuestionTypes() {
        return ["interview", "voice_interview", "ai_interview"];
    }

    /**
     * Check if plugin can handle a question
     * @param {Object} question - Question data
     * @returns {boolean}
     */
    canHandle(question) {
        if (!question) return false;

        return (
            this.getSupportedQuestionTypes().includes(question.question_type) ||
            question.source === "ai_interview" ||
            question.source === "voice_interview"
        );
    }

    /**
     * Evaluate voice interview performance
     * @param {Object} input - Evaluation input
     * @param {string} input.userId - User ID
     * @param {string} input.questionId - Session ID (acts as question ID)
     * @param {Object} input.answer - Not used for interviews
     * @param {Object} input.context - Additional context
     * @returns {Promise<Object>} Evaluation result
     */
    async evaluate(input) {
        try {
            const { userId, questionId: sessionId } = input;

            console.log(`[InterviewEvaluationPlugin] Evaluating session ${sessionId} for user ${userId}`);

            // Get session summary
            const sessionResult = await pool.query(
                `
                SELECT 
                    iss.*,
                    COUNT(it.id) AS total_questions,
                    AVG(it.score)::NUMERIC(5,2) AS avg_score,
                    COUNT(*) FILTER (WHERE it.verdict = 'excellent') AS excellent_count,
                    COUNT(*) FILTER (WHERE it.verdict = 'good') AS good_count,
                    COUNT(*) FILTER (WHERE it.verdict = 'average') AS average_count,
                    COUNT(*) FILTER (WHERE it.verdict = 'poor') AS poor_count,
                    COUNT(*) FILTER (WHERE it.verdict = 'failed') AS failed_count
                FROM interview_sessions iss
                LEFT JOIN interview_turns it ON iss.id = it.session_id
                WHERE iss.id = $1 AND iss.user_id = $2
                GROUP BY iss.id
            `,
                [sessionId, userId],
            );

            if (sessionResult.rows.length === 0) {
                throw new Error("Interview session not found");
            }

            const session = sessionResult.rows[0];

            // Determine verdict based on average score
            let verdict;
            const avgScore = parseFloat(session.avg_score) || 0;

            if (avgScore >= 90) verdict = "EXCELLENT";
            else if (avgScore >= 70) verdict = "ACCEPTED";
            else if (avgScore >= 50) verdict = "PARTIAL";
            else verdict = "FAILED";

            // Get all interview turns for detailed analysis
            const turnsResult = await pool.query(
                `
                SELECT 
                    question_text,
                    user_answer_text,
                    score,
                    verdict,
                    detected_mistakes,
                    question_type,
                    question_difficulty
                FROM interview_turns
                WHERE session_id = $1
                ORDER BY turn_number
            `,
                [sessionId],
            );

            const turns = turnsResult.rows;

            // Calculate time spent (if session is completed)
            const timeSpent = session.duration_seconds || null;

            const result = {
                success: true,
                verdict,
                score: avgScore,
                mistakes: [], // Populated by extractMistakes()
                details: {
                    mode: session.session_mode,
                    topic: session.topic,
                    targetRole: session.target_role,
                    difficulty: session.difficulty,
                    totalQuestions: parseInt(session.total_questions),
                    excellentAnswers: parseInt(session.excellent_count),
                    goodAnswers: parseInt(session.good_count),
                    averageAnswers: parseInt(session.average_count),
                    poorAnswers: parseInt(session.poor_count),
                    failedAnswers: parseInt(session.failed_count),
                    turns: turns.map((t) => ({
                        question: t.question_text.substring(0, 100),
                        score: t.score,
                        verdict: t.verdict,
                    })),
                },
                timeSpent,
                feedback: this._generateFeedback(session, turns),
                metadata: {
                    sessionId,
                    providers: {
                        stt: session.stt_provider,
                        tts: session.tts_provider,
                        llm: session.llm_provider,
                    },
                },
            };

            console.log(`[InterviewEvaluationPlugin] Evaluation complete: ${verdict} (${avgScore}/100)`);

            return result;
        } catch (error) {
            console.error("[InterviewEvaluationPlugin] Evaluation failed:", error.message);
            throw error;
        }
    }

    /**
     * Extract mistakes from interview evaluation
     * @param {Object} result - Evaluation result
     * @param {Object} question - Question data (session in this case)
     * @returns {Promise<Array>} Extracted mistakes
     */
    async extractMistakes(result, question) {
        try {
            const sessionId = result.metadata.sessionId;

            // Get all detected mistakes from interview turns
            const mistakesResult = await pool.query(
                `
                SELECT 
                    it.detected_mistakes,
                    it.question_text,
                    it.question_type,
                    it.question_difficulty,
                    it.score,
                    iss.topic,
                    iss.target_role
                FROM interview_turns it
                JOIN interview_sessions iss ON it.session_id = iss.id
                WHERE it.session_id = $1
            `,
                [sessionId],
            );

            const mistakes = [];

            for (const turn of mistakesResult.rows) {
                const detectedMistakes = JSON.parse(turn.detected_mistakes || "[]");
                const topic = turn.topic || turn.target_role || "General";

                // Map each detected mistake to Learning OS format
                for (const mistakeText of detectedMistakes) {
                    mistakes.push({
                        type: this._categorizeMistake(mistakeText),
                        category: "conceptual", // Interview mistakes are usually conceptual
                        severity: this._calculateSeverity(turn.score),
                        description: mistakeText,
                        context: {
                            question: turn.question_text.substring(0, 100),
                            questionType: turn.question_type,
                            difficulty: turn.question_difficulty,
                            score: turn.score,
                            topic,
                        },
                    });
                }

                // If score is poor but no explicit mistakes, infer general weakness
                if (turn.score < 50 && detectedMistakes.length === 0) {
                    mistakes.push({
                        type: "incomplete_understanding",
                        category: "conceptual",
                        severity: this._calculateSeverity(turn.score),
                        description: `Weak grasp of ${topic} concepts`,
                        context: {
                            question: turn.question_text.substring(0, 100),
                            score: turn.score,
                            topic,
                        },
                    });
                }
            }

            console.log(`[InterviewEvaluationPlugin] Extracted ${mistakes.length} mistakes`);

            return mistakes;
        } catch (error) {
            console.error("[InterviewEvaluationPlugin] Failed to extract mistakes:", error.message);
            return [];
        }
    }

    /**
     * Get recommendations based on interview performance
     * @param {Object} result - Evaluation result
     * @param {Object} userProfile - User's learning profile
     * @returns {Promise<Array>} Recommendations
     */
    async getRecommendations(result, userProfile) {
        try {
            const recommendations = [];
            const details = result.details;

            // Recommend more practice if score is low
            if (result.score < 70) {
                recommendations.push({
                    type: "practice",
                    priority: "high",
                    message: `Practice more ${details.topic || details.targetRole} questions`,
                    action: "solve_problems",
                    metadata: { topic: details.topic },
                });
            }

            // Recommend learning resources for weak areas
            if (details.failedAnswers > 0 || details.poorAnswers > details.goodAnswers) {
                recommendations.push({
                    type: "learn",
                    priority: "high",
                    message: "Review fundamental concepts",
                    action: "watch_tutorials",
                    metadata: { topic: details.topic },
                });
            }

            // Recommend another interview for improvement
            if (result.verdict === "PARTIAL" || result.verdict === "FAILED") {
                recommendations.push({
                    type: "retry",
                    priority: "medium",
                    message: "Retry interview after practicing weak areas",
                    action: "schedule_interview",
                    metadata: { mode: details.mode, topic: details.topic },
                });
            }

            // Recommend harder interviews if performing well
            if (result.score >= 90 && details.difficulty !== "hard") {
                recommendations.push({
                    type: "level_up",
                    priority: "low",
                    message: "Try harder interview difficulty",
                    action: "harder_interview",
                    metadata: { mode: details.mode, difficulty: "hard" },
                });
            }

            return recommendations;
        } catch (error) {
            console.error("[InterviewEvaluationPlugin] Failed to generate recommendations:", error.message);
            return [];
        }
    }

    /**
     * Health check
     * @returns {Promise<boolean>}
     */
    async healthCheck() {
        try {
            // Verify database connectivity
            const result = await pool.query("SELECT 1 FROM interview_sessions LIMIT 1");
            return true;
        } catch (error) {
            console.error("[InterviewEvaluationPlugin] Health check failed:", error.message);
            return false;
        }
    }

    /**
     * Get plugin configuration
     * @returns {Object}
     */
    getConfig() {
        return {
            type: this.type,
            version: this.version,
            supportedQuestionTypes: this.getSupportedQuestionTypes(),
            description: "Evaluates voice interview sessions and integrates with Learning OS",
        };
    }

    // ========================================================================
    // PRIVATE HELPER METHODS
    // ========================================================================

    /**
     * Generate overall feedback
     * @private
     * @param {Object} session - Session data
     * @param {Array} turns - All turns
     * @returns {string} Feedback message
     */
    _generateFeedback(session, turns) {
        const avgScore = parseFloat(session.avg_score) || 0;
        const topic = session.topic || session.target_role;

        if (avgScore >= 90) {
            return `Excellent performance! You have a strong grasp of ${topic}. Consider tackling more challenging topics.`;
        } else if (avgScore >= 70) {
            return `Good job! You demonstrated solid understanding of ${topic}. Review the areas where you scored lower to improve further.`;
        } else if (avgScore >= 50) {
            return `Decent attempt. You need more practice with ${topic}. Focus on understanding core concepts better.`;
        } else {
            return `You struggled with ${topic}. Don't worry - review fundamentals, practice more problems, and try again!`;
        }
    }

    /**
     * Categorize mistake type
     * @private
     * @param {string} mistakeText - Mistake description
     * @returns {string} Mistake type
     */
    _categorizeMistake(mistakeText) {
        const lower = mistakeText.toLowerCase();

        if (lower.includes("time complexity") || lower.includes("efficiency")) {
            return "performance_understanding";
        } else if (lower.includes("edge case") || lower.includes("boundary")) {
            return "edge_case_handling";
        } else if (lower.includes("logic") || lower.includes("algorithm")) {
            return "algorithmic_logic";
        } else if (lower.includes("explain") || lower.includes("description")) {
            return "explanation_clarity";
        } else {
            return "conceptual_gap";
        }
    }

    /**
     * Calculate mistake severity based on score
     * @private
     * @param {number} score - Turn score
     * @returns {number} Severity (1-5)
     */
    _calculateSeverity(score) {
        if (score >= 80) return 1; // Minor
        if (score >= 60) return 2; // Moderate
        if (score >= 40) return 3; // Significant
        if (score >= 20) return 4; // Major
        return 5; // Critical
    }
}
