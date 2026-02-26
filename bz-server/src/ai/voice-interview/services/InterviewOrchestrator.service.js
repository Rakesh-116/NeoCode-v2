/**
 * ============================================================================
 * Interview Orchestrator Service
 * ============================================================================
 * Core service that orchestrates voice interviews
 *
 * Responsibilities:
 * - Manage interview sessions (start, pause, end)
 * - Coordinate STT → LLM → TTS pipeline
 * - Handle question generation and evaluation
 * - Store interview data and transcripts
 * - Integrate with Learning OS evaluation system
 * ============================================================================
 */

import { pool } from "../../../database/connect.db.js";
import voiceProviderRegistry from "../providers/ProviderRegistry.js";
import { v4 as uuidv4 } from "uuid";
import { ensureWavFormat } from "../../../utils/audioUtils.js";

class InterviewOrchestrator {
    constructor() {
        this.activeSessions = new Map(); // In-memory session cache
    }

    /**
     * Start a new interview session
     * @param {Object} params - Session parameters
     * @param {string} params.userId - User ID
     * @param {string} params.mode - 'topic' or 'role'
     * @param {string} [params.topic] - Topic for topic-based interview
     * @param {string} [params.difficulty] - Interview difficulty
     * @param {number} [params.targetQuestions] - Number of questions user wants (3-10)
     * @param {string} [params.targetRole] - Role for role-based interview
     * @param {string} [params.jobDescription] - Job description
     * @param {string} [params.resumeText] - User's resume
     * @returns {Promise<Object>} Session data
     */
    async startSession(params) {
        const client = await pool.connect();

        try {
            const {
                userId,
                mode,
                topic,
                difficulty = "medium",
                targetQuestions = 5,
                targetRole,
                jobDescription,
                resumeText,
            } = params;

            console.log(`[InterviewOrchestrator] startSession received difficulty: ${difficulty}`);

            // Validate mode
            if (!["topic", "role"].includes(mode)) {
                throw new Error('Invalid mode. Must be "topic" or "role"');
            }

            // Validate parameters based on mode
            if (mode === "topic" && !topic) {
                throw new Error("Topic is required for topic-based interviews");
            }

            if (mode === "role" && !targetRole) {
                throw new Error("Target role is required for role-based interviews");
            }

            // Validate target questions range
            const validatedTargetQuestions = Math.max(1, Math.min(20, parseInt(targetQuestions) || 5));

            console.log(
                `[InterviewOrchestrator] Starting ${mode} interview for user ${userId} with ${validatedTargetQuestions} questions`,
            );

            // Get active providers
            const sttProvider = await voiceProviderRegistry.getDefault("stt");
            const ttsProvider = await voiceProviderRegistry.getDefault("tts");
            const llmProvider = await voiceProviderRegistry.getDefault("llm_interview");

            if (!sttProvider || !ttsProvider || !llmProvider) {
                throw new Error("Required providers not available. Check provider registry.");
            }

            // Create session in database
            const sessionId = uuidv4();
            const result = await client.query(
                `
                INSERT INTO interview_sessions (
                    id, user_id, session_mode, topic, difficulty, target_questions,
                    target_role, job_description, resume_text,
                    stt_provider, tts_provider, llm_provider,
                    status, started_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'active', NOW())
                RETURNING *
            `,
                [
                    sessionId,
                    userId,
                    mode,
                    topic || null,
                    difficulty,
                    validatedTargetQuestions,
                    targetRole || null,
                    jobDescription || null,
                    resumeText || null,
                    sttProvider.name,
                    ttsProvider.name,
                    llmProvider.name,
                ],
            );

            const session = result.rows[0];

            // Cache session in memory
            this.activeSessions.set(sessionId, {
                ...session,
                providers: { stt: sttProvider, tts: ttsProvider, llm: llmProvider },
                questionHistory: [],
            });

            console.log(`[InterviewOrchestrator] ✅ Session ${sessionId} started`);
            console.log(`[InterviewOrchestrator] Pre-generating ${validatedTargetQuestions} questions...`);

            // Pre-generate all questions upfront to avoid polling/race conditions
            const context = {
                topic: topic || targetRole,
                role: targetRole,
                jd: jobDescription,
                resume: resumeText,
                difficulty: difficulty,
                previousQuestions: [],
                previousAnswers: [],
            };

            for (let i = 1; i <= validatedTargetQuestions; i++) {
                try {
                    console.log(`[InterviewOrchestrator] Generating question ${i}/${validatedTargetQuestions}...`);

                    const generatedQuestion = await llmProvider.generateQuestion(context);

                    // Store question in database
                    await client.query(
                        `INSERT INTO interview_turns (
                            session_id, turn_number, question_text,
                            question_type, question_difficulty, question_generated_at
                        )
                        VALUES ($1, $2, $3, $4, $5, NOW())`,
                        [sessionId, i, generatedQuestion.question, generatedQuestion.type || "general", difficulty],
                    );

                    // Add to context for next question (avoid duplicates)
                    context.previousQuestions.push(generatedQuestion.question);

                    console.log(`[InterviewOrchestrator] ✅ Question ${i}/${validatedTargetQuestions} generated`);
                } catch (error) {
                    console.error(`[InterviewOrchestrator] ❌ Failed to generate question ${i}:`, error.message);
                    // Continue generating other questions even if one fails
                }
            }

            // Update session's current_question_number to 0 (no question answered yet)
            await client.query(`UPDATE interview_sessions SET current_question_number = 0 WHERE id = $1`, [sessionId]);

            console.log(`[InterviewOrchestrator] ✅ All ${validatedTargetQuestions} questions pre-generated`);

            return {
                sessionId: session.id,
                mode: session.session_mode,
                topic: session.topic,
                targetRole: session.target_role,
                difficulty: session.difficulty,
                status: session.status,
                startedAt: session.started_at,
            };
        } catch (error) {
            console.error("[InterviewOrchestrator] Failed to start session:", error.message);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Ask next question in interview
     * Questions are pre-generated during session start
     * @param {string} sessionId - Session ID
     * @returns {Promise<Object>} Question data with audio
     */
    async askNextQuestion(sessionId) {
        const client = await pool.connect();

        try {
            const session = await this._getSession(sessionId);

            console.log(`[InterviewOrchestrator] Fetching next question for session ${sessionId}`);

            const { tts } = session.providers;

            // Find the next unanswered question
            const turnResult = await client.query(
                `
                SELECT id, turn_number, question_text, question_type, question_difficulty
                FROM interview_turns
                WHERE session_id = $1 AND user_answer_text IS NULL
                ORDER BY turn_number ASC
                LIMIT 1
            `,
                [sessionId],
            );

            if (turnResult.rows.length === 0) {
                // No more unanswered questions
                const targetQuestionCount = session.target_questions || 5;
                throw new Error(
                    `Interview complete! You've answered all ${targetQuestionCount} questions. Please end the interview.`,
                );
            }

            const turn = turnResult.rows[0];

            console.log(`[InterviewOrchestrator] ✅ Returning question ${turn.turn_number}`);

            // Synthesize the question to audio
            const ttsResult = await tts.synthesize(turn.question_text);

            // Ensure audio has WAV header (fix for Piper raw PCM output)
            const wavAudio = ensureWavFormat(ttsResult.audio, {
                sampleRate: 22050,
                channels: 1,
                bitsPerSample: 16,
            });

            return {
                turnId: turn.id,
                turnNumber: turn.turn_number,
                question: turn.question_text,
                questionType: turn.question_type,
                audio: wavAudio.toString("base64"), // Base64 encoded WAV audio
                audioDuration: ttsResult.duration,
                expectedKeywords: null,
            };
        } catch (error) {
            console.error("[InterviewOrchestrator] Failed to fetch question:", error.message);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Process user's audio answer
     * @param {string} sessionId - Session ID
     * @param {string} turnId - Turn ID
     * @param {Buffer} audioBuffer - User's audio response
     * @returns {Promise<Object>} Evaluation result
     */
    async processAnswer(sessionId, turnId, audioBuffer) {
        try {
            const session = await this._getSession(sessionId);

            console.log(`[InterviewOrchestrator] Processing answer for session ${sessionId}, turn ${turnId}`);

            const { stt, llm, tts } = session.providers;

            // Step 1: Transcribe audio to text
            const transcription = await stt.transcribe(audioBuffer);
            const answerText = transcription.text;

            console.log(`[InterviewOrchestrator] Transcribed: "${answerText.substring(0, 100)}..."`);

            // Step 2: Get question from turn
            const client = await pool.connect();

            try {
                const turnResult = await client.query(
                    "SELECT question_text, question_difficulty FROM interview_turns WHERE id = $1",
                    [turnId],
                );

                if (turnResult.rows.length === 0) {
                    throw new Error("Turn not found");
                }

                const { question_text, question_difficulty } = turnResult.rows[0];

                // Step 3: Evaluate answer using LLM
                const evaluation = await llm.evaluateAnswer({
                    question: question_text,
                    answer: answerText,
                    topic: session.topic || session.target_role,
                    difficulty: question_difficulty,
                });

                console.log(`[InterviewOrchestrator] Evaluation: ${evaluation.verdict} (${evaluation.score}/100)`);

                // Step 4: Generate audio feedback
                const feedbackAudio = await tts.synthesize(evaluation.feedback);

                // Step 5: Update turn with answer and evaluation
                await client.query(
                    `
                    UPDATE interview_turns
                    SET user_answer_text = $1, score = $2, verdict = $3,
                        feedback = $4, detected_mistakes = $5,
                        transcription_confidence = $6,
                        updated_at = NOW()
                    WHERE id = $7
                `,
                    [
                        answerText,
                        evaluation.score,
                        evaluation.verdict,
                        evaluation.feedback,
                        JSON.stringify(evaluation.detectedMistakes),
                        transcription.confidence,
                        turnId,
                    ],
                );

                // Step 6: Store transcript
                await client.query(
                    `
                    INSERT INTO audio_transcripts (
                        session_id, turn_id, audio_type, raw_transcript,
                        confidence_score, provider_name
                    )
                    VALUES ($1, $2, 'answer', $3, $4, $5)
                `,
                    [sessionId, turnId, answerText, transcription.confidence, stt.name],
                );

                // Step 7: Update session score
                await this._updateSessionScore(sessionId);

                // Update cached session
                session.questionHistory.push({
                    question_text,
                    user_answer_text: answerText,
                    score: evaluation.score,
                    verdict: evaluation.verdict,
                });

                console.log(`[InterviewOrchestrator] ✅ Answer processed and evaluated`);

                // Ensure feedback audio has WAV header
                const wavFeedbackAudio = ensureWavFormat(feedbackAudio.audio, {
                    sampleRate: 22050,
                    channels: 1,
                    bitsPerSample: 16,
                });

                return {
                    turnId,
                    transcription: answerText,
                    transcriptionConfidence: transcription.confidence,
                    score: evaluation.score,
                    verdict: evaluation.verdict,
                    feedback: evaluation.feedback,
                    feedbackAudio: wavFeedbackAudio.toString("base64"),
                    detectedMistakes: evaluation.detectedMistakes,
                    strengths: evaluation.strengths,
                    improvements: evaluation.improvements,
                    followUpSuggested: evaluation.followUpSuggested,
                };
            } finally {
                client.release();
            }
        } catch (error) {
            console.error("[InterviewOrchestrator] Failed to process answer:", error.message);
            throw error;
        }
    }

    /**
     * End interview session
     * @param {string} sessionId - Session ID
     * @returns {Promise<Object>} Final session summary
     */
    async endSession(sessionId) {
        const client = await pool.connect();

        try {
            console.log(`[InterviewOrchestrator] Ending session ${sessionId}`);

            // Calculate session duration
            const sessionResult = await client.query("SELECT started_at FROM interview_sessions WHERE id = $1", [
                sessionId,
            ]);

            if (sessionResult.rows.length === 0) {
                throw new Error("Session not found");
            }

            const startedAt = new Date(sessionResult.rows[0].started_at);
            const endedAt = new Date();
            const durationSeconds = Math.floor((endedAt - startedAt) / 1000);

            // Update session status
            await client.query(
                `
                UPDATE interview_sessions
                SET status = 'completed', ended_at = $1, duration_seconds = $2, updated_at = NOW()
                WHERE id = $3
            `,
                [endedAt, durationSeconds, sessionId],
            );

            // Get session summary
            const summary = await this._getSessionSummary(sessionId);

            // Remove from active sessions
            this.activeSessions.delete(sessionId);

            // Create evaluation result in Learning OS
            await this._createEvaluationResult(sessionId, summary);

            console.log(`[InterviewOrchestrator] ✅ Session ${sessionId} ended`);

            return summary;
        } catch (error) {
            console.error("[InterviewOrchestrator] Failed to end session:", error.message);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Get session from cache or database
     * @private
     * @param {string} sessionId - Session ID
     * @returns {Promise<Object>} Session data
     */
    async _getSession(sessionId) {
        // Check cache first
        if (this.activeSessions.has(sessionId)) {
            return this.activeSessions.get(sessionId);
        }

        // Load from database
        const result = await pool.query("SELECT * FROM interview_sessions WHERE id = $1", [sessionId]);

        if (result.rows.length === 0) {
            throw new Error("Session not found");
        }

        const session = result.rows[0];

        // Get providers
        const stt = await voiceProviderRegistry.get("stt", session.stt_provider);
        const tts = await voiceProviderRegistry.get("tts", session.tts_provider);
        const llm = await voiceProviderRegistry.get("llm_interview", session.llm_provider);

        // Load question history
        const historyResult = await pool.query(
            "SELECT question_text, user_answer_text, score, verdict FROM interview_turns WHERE session_id = $1 ORDER BY turn_number",
            [sessionId],
        );

        const enhancedSession = {
            ...session,
            providers: { stt, tts, llm },
            questionHistory: historyResult.rows,
        };

        // Cache it
        this.activeSessions.set(sessionId, enhancedSession);

        return enhancedSession;
    }

    /**
     * Update session overall score
     * @private
     * @param {string} sessionId - Session ID
     * @returns {Promise<void>}
     */
    async _updateSessionScore(sessionId) {
        await pool.query(
            `
            UPDATE interview_sessions
            SET overall_score = (
                SELECT AVG(score)::NUMERIC(5,2)
                FROM interview_turns
                WHERE session_id = $1 AND score IS NOT NULL
            )
            WHERE id = $1
        `,
            [sessionId],
        );
    }

    /**
     * Get session summary
     * @private
     * @param {string} sessionId - Session ID
     * @returns {Promise<Object>} Session summary
     */
    async _getSessionSummary(sessionId) {
        const result = await pool.query(
            `
            SELECT 
                iss.*,
                COUNT(it.id) AS total_turns,
                AVG(it.score)::NUMERIC(5,2) AS average_score,
                COUNT(*) FILTER (WHERE it.verdict = 'excellent') AS excellent_count,
                COUNT(*) FILTER (WHERE it.verdict = 'good') AS good_count,
                COUNT(*) FILTER (WHERE it.verdict = 'average') AS average_count,
                COUNT(*) FILTER (WHERE it.verdict = 'poor') AS poor_count,
                COUNT(*) FILTER (WHERE it.verdict = 'failed') AS failed_count
            FROM interview_sessions iss
            LEFT JOIN interview_turns it ON iss.id = it.session_id
            WHERE iss.id = $1
            GROUP BY iss.id
        `,
            [sessionId],
        );

        return result.rows[0];
    }

    /**
     * Create evaluation result in Learning OS
     * @private
     * @param {string} sessionId - Session ID
     * @param {Object} summary - Session summary
     * @returns {Promise<void>}
     */
    async _createEvaluationResult(sessionId, summary) {
        try {
            await pool.query(
                `
                INSERT INTO evaluation_results (
                    user_id, evaluation_type, question_id, question_source,
                    verdict, score, evaluation_data
                )
                VALUES ($1, 'voice_interview', $2, 'ai_interview', $3, $4, $5)
            `,
                [
                    summary.user_id,
                    sessionId,
                    summary.overall_score >= 70 ? "PASS" : "FAIL",
                    summary.overall_score,
                    JSON.stringify({
                        mode: summary.session_mode,
                        topic: summary.topic,
                        role: summary.target_role,
                        totalQuestions: summary.total_turns,
                        excellentAnswers: summary.excellent_count,
                        goodAnswers: summary.good_count,
                        duration: summary.duration_seconds,
                    }),
                ],
            );

            console.log("[InterviewOrchestrator] Evaluation result created in Learning OS");
        } catch (error) {
            console.warn("[InterviewOrchestrator] Failed to create evaluation result:", error.message);
            // Non-fatal
        }
    }

    /**
     * Get all questions for a session
     * @param {string} sessionId - Session ID
     * @returns {Promise<Array>} Array of questions with their status
     */
    async getSessionQuestions(sessionId) {
        const client = await pool.connect();
        try {
            const result = await client.query(
                `
                SELECT 
                    id as turn_id,
                    turn_number,
                    question_text,
                    question_type,
                    question_difficulty,
                    user_answer_text,
                    score,
                    verdict,
                    question_generated_at,
                    updated_at
                FROM interview_turns
                WHERE session_id = $1
                ORDER BY turn_number ASC
            `,
                [sessionId],
            );

            return result.rows.map((row) => ({
                turnId: row.turn_id,
                turnNumber: row.turn_number,
                question: row.question_text,
                questionType: row.question_type,
                difficulty: row.question_difficulty,
                isAnswered: row.user_answer_text !== null,
                score: row.score,
                verdict: row.verdict,
                generatedAt: row.question_generated_at,
                answeredAt: row.updated_at,
            }));
        } finally {
            client.release();
        }
    }

    /**
     * Get a specific question by turn number
     * @param {string} sessionId - Session ID
     * @param {number} turnNumber - Turn number
     * @returns {Promise<Object>} Question with audio
     */
    async getQuestionByTurn(sessionId, turnNumber) {
        const client = await pool.connect();
        try {
            const session = await this._getSession(sessionId);
            const { tts } = session.providers;

            const result = await client.query(
                `
                SELECT 
                    id, turn_number, question_text, question_type,
                    question_difficulty, user_answer_text, score, verdict, feedback
                FROM interview_turns
                WHERE session_id = $1 AND turn_number = $2
            `,
                [sessionId, turnNumber],
            );

            if (result.rows.length === 0) {
                throw new Error(`Question ${turnNumber} not found`);
            }

            const turn = result.rows[0];

            // Synthesize question audio
            const ttsResult = await tts.synthesize(turn.question_text);
            const wavAudio = ensureWavFormat(ttsResult.audio, {
                sampleRate: 22050,
                channels: 1,
                bitsPerSample: 16,
            });

            return {
                turnId: turn.id,
                turnNumber: turn.turn_number,
                question: turn.question_text,
                questionType: turn.question_type,
                difficulty: turn.question_difficulty,
                audio: wavAudio.toString("base64"),
                audioDuration: ttsResult.duration,
                isAnswered: turn.user_answer_text !== null,
                score: turn.score,
                verdict: turn.verdict,
                feedback: turn.feedback,
                transcription: turn.user_answer_text,
            };
        } finally {
            client.release();
        }
    }

    /**
     * Delete interview session and all associated data
     * Admin only - removes session and all Q&A turns
     * @param {string} sessionId - Session ID to delete
     * @returns {Promise<Object>} Deletion result
     */
    async deleteSession(sessionId) {
        const client = await pool.connect();

        try {
            await client.query("BEGIN");

            console.log(`[InterviewOrchestrator] Deleting interview session: ${sessionId}`);

            // Delete all interview turns first (due to foreign key constraint)
            const deleteTurnsResult = await client.query(`DELETE FROM interview_turns WHERE session_id = $1`, [
                sessionId,
            ]);

            const turnsDeleted = deleteTurnsResult.rowCount;
            console.log(`[InterviewOrchestrator] Deleted ${turnsDeleted} interview turns`);

            // Delete the session
            const deleteSessionResult = await client.query(`DELETE FROM interview_sessions WHERE id = $1 RETURNING *`, [
                sessionId,
            ]);

            if (deleteSessionResult.rowCount === 0) {
                await client.query("ROLLBACK");
                throw new Error(`Session ${sessionId} not found`);
            }

            const deletedSession = deleteSessionResult.rows[0];

            await client.query("COMMIT");

            console.log(`[InterviewOrchestrator] ✅ Successfully deleted session ${sessionId}`);

            // Remove from in-memory cache if exists
            this.activeSessions.delete(sessionId);

            return {
                success: true,
                message: "Interview session deleted successfully",
                sessionId: sessionId,
                turnsDeleted: turnsDeleted,
                sessionData: {
                    mode: deletedSession.session_mode,
                    topic: deletedSession.topic,
                    difficulty: deletedSession.difficulty,
                    startedAt: deletedSession.started_at,
                    endedAt: deletedSession.ended_at,
                },
            };
        } catch (error) {
            await client.query("ROLLBACK");
            console.error(`[InterviewOrchestrator] ❌ Error deleting session:`, error);
            throw error;
        } finally {
            client.release();
        }
    }
}

// Export singleton instance
const interviewOrchestrator = new InterviewOrchestrator();
export default interviewOrchestrator;
