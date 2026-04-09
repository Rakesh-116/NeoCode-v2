/**
 * ============================================================================
 * Interview Orchestrator Service
 * ============================================================================
 * Core service that orchestrates voice interviews
 *
 * Responsibilities:
 * - Manage interview sessions (start, pause, end)
 * - Coordinate STT ? LLM ? TTS pipeline
 * - Handle question generation and evaluation
 * - Store interview data and transcripts
 * - Integrate with Learning OS evaluation system
 * ============================================================================
 */

import { pool } from "../../../database/connect.db.js";
import voiceProviderRegistry from "../providers/ProviderRegistry.js";
import { v4 as uuidv4 } from "uuid";
import { ensureWavFormat } from "../../../utils/audioUtils.js";
import { createProblemWithTestcases } from "../../../services/problemAdmin.service.js";

class InterviewOrchestrator {
    constructor() {
        this.activeSessions = new Map(); // In-memory session cache
    }

    async _ensureRetakeSchema(client) {
        await client.query(`
            ALTER TABLE public.interview_sessions
            ADD COLUMN IF NOT EXISTS retake_of_session_id UUID
        `);

        await client.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_constraint
                    WHERE conname = 'interview_sessions_retake_of_fkey'
                      AND conrelid = 'public.interview_sessions'::regclass
                ) THEN
                    ALTER TABLE public.interview_sessions
                    ADD CONSTRAINT interview_sessions_retake_of_fkey
                    FOREIGN KEY (retake_of_session_id)
                    REFERENCES public.interview_sessions(id)
                    ON DELETE SET NULL;
                END IF;
            END $$;
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_interview_sessions_retake_of
            ON public.interview_sessions (retake_of_session_id)
        `);
    }

    _parseQuestionPayload(rawText) {
        if (!rawText || typeof rawText !== "string") {
            return { parsed: null, questionText: rawText };
        }

        const trimmed = rawText.trim();
        if (!trimmed.startsWith("{") || !trimmed.includes('"question"')) {
            return { parsed: null, questionText: rawText };
        }

        const tryParseJson = (text) => {
            let candidate = String(text || "").trim();
            const firstBrace = candidate.indexOf("{");
            const lastBrace = candidate.lastIndexOf("}");
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                candidate = candidate.slice(firstBrace, lastBrace + 1);
            }
            candidate = candidate.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");

            let out = "";
            let inString = false;
            let escaped = false;
            for (let i = 0; i < candidate.length; i += 1) {
                const ch = candidate[i];
                if (escaped) {
                    out += ch;
                    escaped = false;
                    continue;
                }
                if (ch === "\\") {
                    out += ch;
                    escaped = true;
                    continue;
                }
                if (ch === '"') {
                    out += ch;
                    inString = !inString;
                    continue;
                }
                if (!inString && (ch === "{" || ch === ",")) {
                    out += ch;
                    let j = i + 1;
                    while (j < candidate.length && /\s/.test(candidate[j])) {
                        out += candidate[j];
                        j += 1;
                    }
                    if (candidate[j] === '"') {
                        i = j - 1;
                        continue;
                    }
                    const keyStart = j;
                    while (j < candidate.length && /[A-Za-z0-9_]/.test(candidate[j])) {
                        j += 1;
                    }
                    const key = candidate.slice(keyStart, j);
                    if (key.length > 0) {
                        let k = j;
                        while (k < candidate.length && /\s/.test(candidate[k])) {
                            k += 1;
                        }
                        if (candidate[k] === ":") {
                            out += `"${key}"`;
                            i = j - 1;
                            continue;
                        }
                    }
                }
                out += ch;
            }

            out = out.replace(/,\s*([}\]])/g, "$1").trim();
            return JSON.parse(out);
        };

        try {
            const parsed = tryParseJson(trimmed);
            const questionText = typeof parsed?.question === "string" ? parsed.question : rawText;
            return { parsed, questionText };
        } catch (error) {
            return { parsed: null, questionText: rawText };
        }
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

            console.log(
                `[InterviewOrchestrator] Using providers -> STT: ${sttProvider.name}, TTS: ${ttsProvider.name}, Interview LLM: ${llmProvider.name}`,
            );

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

            console.log(`[InterviewOrchestrator] ? Session ${sessionId} started`);
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
            let generatedQuestionCount = 0;

            for (let i = 1; i <= validatedTargetQuestions; i++) {
                try {
                    console.log(`[InterviewOrchestrator] Generating question ${i}/${validatedTargetQuestions}...`);

                    const generatedQuestion = await llmProvider.generateQuestion(context);
                    if (!generatedQuestion?.problemSpec && typeof generatedQuestion?.question === "string") {
                        const trimmed = generatedQuestion.question.trim();
                        if (trimmed.startsWith("{") && trimmed.includes("\"problemSpec\"")) {
                            const repaired = this._parseQuestionPayload(trimmed);
                            const parsed = repaired.parsed || null;
                            if (parsed) {
                                if (parsed.question) generatedQuestion.question = parsed.question;
                                if (parsed.problemSpec) generatedQuestion.problemSpec = parsed.problemSpec;
                                if (parsed.type) generatedQuestion.type = parsed.type;
                                if (parsed.difficulty) generatedQuestion.difficulty = parsed.difficulty;
                                if (parsed.expectedKeywords) generatedQuestion.expectedKeywords = parsed.expectedKeywords;
                                if (parsed.follow_ups || parsed.followUps) {
                                    generatedQuestion.followUps = parsed.follow_ups || parsed.followUps;
                                }
                                if (parsed.evaluation_criteria || parsed.evaluationCriteria) {
                                    generatedQuestion.evaluationCriteria =
                                        parsed.evaluation_criteria || parsed.evaluationCriteria;
                                }
                                if (parsed.concept_tags || parsed.conceptTags) {
                                    generatedQuestion.conceptTags = parsed.concept_tags || parsed.conceptTags;
                                }
                                if (parsed.topic) generatedQuestion.topic = parsed.topic;
                            }
                        }
                    }
                    if (!generatedQuestion?.problemSpec && typeof generatedQuestion?.question === "string") {
                        const trimmed = generatedQuestion.question.trim();
                        if (trimmed.startsWith("{") && trimmed.includes('"problemSpec"')) {
                            try {
                                const parsed = JSON.parse(trimmed);
                                if (parsed && parsed.question) {
                                    generatedQuestion.question = parsed.question;
                                }
                                if (parsed && parsed.problemSpec) {
                                    generatedQuestion.problemSpec = parsed.problemSpec;
                                }
                                if (parsed && parsed.type) {
                                    generatedQuestion.type = parsed.type;
                                }
                                if (parsed && parsed.difficulty) {
                                    generatedQuestion.difficulty = parsed.difficulty;
                                }
                                if (parsed && parsed.expectedKeywords) {
                                    generatedQuestion.expectedKeywords = parsed.expectedKeywords;
                                }
                                if (parsed && (parsed.follow_ups || parsed.followUps)) {
                                    generatedQuestion.followUps =
                                        parsed.follow_ups || parsed.followUps || generatedQuestion.followUps;
                                }
                                if (parsed && (parsed.evaluation_criteria || parsed.evaluationCriteria)) {
                                    generatedQuestion.evaluationCriteria =
                                        parsed.evaluation_criteria || parsed.evaluationCriteria;
                                }
                                if (parsed && (parsed.concept_tags || parsed.conceptTags)) {
                                    generatedQuestion.conceptTags =
                                        parsed.concept_tags || parsed.conceptTags;
                                }
                                if (parsed && parsed.topic) {
                                    generatedQuestion.topic = parsed.topic;
                                }
                            } catch (error) {
                                console.warn(
                                    "[InterviewOrchestrator] Failed to recover JSON question payload:",
                                    error.message,
                                );
                            }
                        }
                    }
                    const isCoding = this._isCodingQuestion(generatedQuestion);
                    const questionType = isCoding ? "coding" : generatedQuestion.type || "general";
                    const normalizedDifficulty = (generatedQuestion.difficulty || difficulty || "medium").toLowerCase();
                    const conceptTags = Array.isArray(generatedQuestion.conceptTags)
                        ? generatedQuestion.conceptTags.filter(Boolean)
                        : [];
                    const evaluationCriteria = generatedQuestion.evaluationCriteria
                        ? String(generatedQuestion.evaluationCriteria)
                        : null;
                    const questionMetadata = {
                        questionFormatVersion: 1,
                        topic: generatedQuestion.topic || topic || targetRole || null,
                        followUps: Array.isArray(generatedQuestion.followUps) ? generatedQuestion.followUps : [],
                        evaluationCriteria,
                        expectedKeywords: Array.isArray(generatedQuestion.expectedKeywords)
                            ? generatedQuestion.expectedKeywords
                            : [],
                        conceptTags,
                    };

                    let problemId = null;
                    if (isCoding) {
                        try {
                            const scoreByDifficulty = {
                                cakewalk: 10,
                                easy: 15,
                                easymedium: 20,
                                medium: 25,
                                mediumhard: 30,
                                hard: 35,
                            };
                            const score = scoreByDifficulty[normalizedDifficulty] || 10;
                            const spec = this._buildProblemSpec(generatedQuestion, i);
                            problemId = await createProblemWithTestcases({
                                userId,
                                forceHidden: true,
                                data: {
                                    title: spec.title || `Interview Coding Q${i}`,
                                    description: spec.description || generatedQuestion.question,
                                    input_format: spec.input_format || "N/A",
                                    output_format: spec.output_format || "N/A",
                                    constraints: spec.constraints || null,
                                    prohibited_keys: spec.prohibited_keys || null,
                                    sample_testcase: spec.sample_testcase || { input: "", output: "" },
                                    explaination: spec.explaination || "Self Explainary!",
                                    difficulty: normalizedDifficulty,
                                    score,
                                    hidden_testcases: Array.isArray(spec.hidden_testcases) ? spec.hidden_testcases : [],
                                    category: Array.isArray(spec.category) ? spec.category : [],
                                    solution: "No Solution",
                                    solutionLanguage: null,
                                    hidden: true,
                                },
                            });
                        } catch (problemError) {
                            console.error(
                                `[InterviewOrchestrator] Failed to create problem for coding question ${i}:`,
                                problemError.message,
                            );
                            problemId = null;
                        }
                    }

                    // Store question in database
                    await client.query(
                        `INSERT INTO interview_turns (
                            session_id, turn_number, question_text,
                            question_type, question_difficulty, requires_code_editor, problem_id,
                            concept_tags, validation_criteria, llm_metadata, question_generated_at
                        )
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb, NOW())`,
                        [
                            sessionId,
                            i,
                            generatedQuestion.question,
                            questionType,
                            normalizedDifficulty,
                            isCoding,
                            problemId,
                            JSON.stringify(conceptTags),
                            JSON.stringify(
                                evaluationCriteria
                                    ? { evaluation_criteria: evaluationCriteria }
                                    : {},
                            ),
                            JSON.stringify(questionMetadata),
                        ],
                    );

                    // Add to context for next question (avoid duplicates)
                    context.previousQuestions.push(generatedQuestion.question);
                    generatedQuestionCount += 1;

                    console.log(`[InterviewOrchestrator] ? Question ${i}/${validatedTargetQuestions} generated`);
                } catch (error) {
                    console.error(`[InterviewOrchestrator] ? Failed to generate question ${i}:`, error.message);
                    // Continue generating other questions even if one fails
                }
            }

            if (generatedQuestionCount === 0) {
                await client.query("DELETE FROM interview_sessions WHERE id = $1", [sessionId]);
                this.activeSessions.delete(sessionId);
                const err = new Error(
                    "Failed to generate interview questions. Please ensure the interview LLM provider is available and try again.",
                );
                err.statusCode = 503;
                throw err;
            }

            // Align the persisted session state with the actual number of generated turns.
            await client.query(
                `UPDATE interview_sessions
                 SET current_question_number = 0, target_questions = $2
                 WHERE id = $1`,
                [sessionId, generatedQuestionCount],
            );

            const cachedSession = this.activeSessions.get(sessionId);
            if (cachedSession) {
                cachedSession.current_question_number = 0;
                cachedSession.target_questions = generatedQuestionCount;
            }

            console.log(
                `[InterviewOrchestrator] ? Generated ${generatedQuestionCount}/${validatedTargetQuestions} questions successfully`,
            );

            return {
                sessionId: session.id,
                mode: session.session_mode,
                topic: session.topic,
                targetRole: session.target_role,
                difficulty: session.difficulty,
                targetQuestions: generatedQuestionCount,
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
                SELECT id, turn_number, question_text, question_type, question_difficulty, requires_code_editor, problem_id,
                       concept_tags, validation_criteria, llm_metadata
                FROM interview_turns
                WHERE session_id = $1 AND user_answer_text IS NULL
                ORDER BY turn_number ASC
                LIMIT 1
            `,
                [sessionId],
            );

            if (turnResult.rows.length === 0) {
                const progressResult = await client.query(
                    `
                    SELECT
                        COUNT(*)::int AS total_turns,
                        COUNT(*) FILTER (WHERE user_answer_text IS NOT NULL)::int AS answered_turns
                    FROM interview_turns
                    WHERE session_id = $1
                `,
                    [sessionId],
                );

                const totalTurns = progressResult.rows[0]?.total_turns || 0;
                const answeredTurns = progressResult.rows[0]?.answered_turns || 0;

                if (totalTurns === 0) {
                    const err = new Error(
                        "No interview questions are available for this session. Please restart the interview after the LLM provider is available.",
                    );
                    err.statusCode = 503;
                    throw err;
                }

                const err = new Error(
                    `Interview complete! You've answered all ${answeredTurns || totalTurns} questions. Please end the interview.`,
                );
                err.statusCode = 409;
                throw err;
            }

            const turn = turnResult.rows[0];
            const parsedPayload = this._parseQuestionPayload(turn.question_text);
            const problem = await this._fetchProblemById(client, turn.problem_id);
            const parsedSpec = parsedPayload.parsed?.problemSpec || null;
            const parsedMeta = parsedPayload.parsed
                ? {
                      topic: parsedPayload.parsed.topic || null,
                      followUps:
                          parsedPayload.parsed.follow_ups ||
                          parsedPayload.parsed.followUps ||
                          [],
                      conceptTags:
                          parsedPayload.parsed.concept_tags ||
                          parsedPayload.parsed.conceptTags ||
                          [],
                      expectedKeywords: parsedPayload.parsed.expectedKeywords || [],
                      evaluationCriteria:
                          parsedPayload.parsed.evaluation_criteria ||
                          parsedPayload.parsed.evaluationCriteria ||
                          null,
                      questionFormatVersion: 1,
                  }
                : null;
            const questionText = parsedPayload.questionText || turn.question_text;

            console.log(`[InterviewOrchestrator] ? Returning question ${turn.turn_number}`);

            // Synthesize the question to audio (use description for coding questions)
            const ttsText =
                parsedSpec && turn.question_type === "coding"
                    ? parsedSpec.description || questionText
                    : questionText;
            const ttsResult = await tts.synthesize(ttsText);

            // Ensure audio has WAV header (fix for Piper raw PCM output)
            const wavAudio = ensureWavFormat(ttsResult.audio, {
                sampleRate: 22050,
                channels: 1,
                bitsPerSample: 16,
            });

            const mergedMeta = this._mergeQuestionMeta(turn.llm_metadata, parsedMeta);

            return {
                turnId: turn.id,
                turnNumber: turn.turn_number,
                question: questionText,
                questionType: turn.question_type,
                requiresCodeEditor: turn.requires_code_editor,
                problemId: turn.problem_id,
                problem: parsedSpec ? this._buildProblemFromSpec(parsedSpec, problem) : problem,
                questionMeta: mergedMeta,
                conceptTags: (turn.concept_tags && turn.concept_tags.length > 0)
                    ? turn.concept_tags
                    : (mergedMeta?.conceptTags || []),
                validationCriteria: turn.validation_criteria && Object.keys(turn.validation_criteria).length > 0
                    ? turn.validation_criteria
                    : (mergedMeta?.evaluationCriteria ? { evaluation_criteria: mergedMeta.evaluationCriteria } : {}),
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
                    "SELECT question_text, question_difficulty, requires_code_editor, question_type, validation_criteria, llm_metadata FROM interview_turns WHERE id = $1",
                    [turnId],
                );

                if (turnResult.rows.length === 0) {
                    throw new Error("Turn not found");
                }

                const {
                    question_text,
                    question_difficulty,
                    requires_code_editor,
                    question_type,
                    validation_criteria,
                    llm_metadata,
                } = turnResult.rows[0];
                const isCodingTurn =
                    Boolean(requires_code_editor) || String(question_type || "").toLowerCase() === "coding";
                const evaluationCriteria =
                    (validation_criteria && validation_criteria.evaluation_criteria) ||
                    (llm_metadata && llm_metadata.evaluationCriteria) ||
                    null;

                let latestCodeSubmission = null;
                if (isCodingTurn) {
                    latestCodeSubmission = await this._getLatestCodeSubmission(client, turnId, session.user_id);
                    if (!latestCodeSubmission) {
                        const err = new Error("Please submit your code before submitting the voice answer.");
                        err.statusCode = 400;
                        throw err;
                    }
                }

                // Step 3: Evaluate answer using LLM
                const evaluation = await llm.evaluateAnswer({
                    question: question_text,
                    answer: answerText,
                    topic: session.topic || session.target_role,
                    difficulty: question_difficulty,
                    evaluationCriteria,
                });

                if (isCodingTurn && latestCodeSubmission) {
                    const codeScore = this._scoreFromVerdict(latestCodeSubmission.verdict);
                    const combinedScore = this._combineScores(evaluation.score, codeScore);
                    const combinedVerdict = this._verdictFromScore(combinedScore);
                    const codeVerdict = latestCodeSubmission.verdict || "UNKNOWN";
                    const codeFeedback = this._feedbackFromVerdict(codeVerdict);

                    evaluation.score = combinedScore;
                    evaluation.verdict = combinedVerdict;
                    evaluation.codeVerdict = codeVerdict;
                    evaluation.codeScore = codeScore;
                    evaluation.feedback = `Code verdict: ${codeVerdict}. ${codeFeedback} ${evaluation.feedback}`;
                }

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

                console.log(`[InterviewOrchestrator] ? Answer processed and evaluated`);

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
                    codeVerdict: evaluation.codeVerdict || null,
                    codeScore: evaluation.codeScore ?? null,
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

            console.log(`[InterviewOrchestrator] ? Session ${sessionId} ended`);

            return summary;
        } catch (error) {
            console.error("[InterviewOrchestrator] Failed to end session:", error.message);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Create a retake session by cloning an existing session's setup and turns.
     * @param {string} sessionId - Original session ID
     * @param {string} userId - Current user ID
     * @returns {Promise<Object>} New session payload
     */
    async retakeSession(sessionId, userId) {
        const client = await pool.connect();

        try {
            await client.query("BEGIN");
            await this._ensureRetakeSchema(client);

            const sourceResult = await client.query(
                `
                SELECT *
                FROM interview_sessions
                WHERE id = $1 AND user_id = $2
            `,
                [sessionId, userId],
            );

            if (sourceResult.rows.length === 0) {
                const err = new Error("Interview session not found");
                err.statusCode = 404;
                throw err;
            }

            const sourceSession = sourceResult.rows[0];

            if (sourceSession.session_mode === "smart_review") {
                const err = new Error("Smart review sessions cannot be retaken from the interview summary.");
                err.statusCode = 400;
                throw err;
            }

            const turnsResult = await client.query(
                `
                SELECT
                    turn_number,
                    question_text,
                    question_type,
                    question_difficulty,
                    requires_code_editor,
                    problem_id,
                    concept_tags,
                    validation_criteria,
                    llm_metadata
                FROM interview_turns
                WHERE session_id = $1
                ORDER BY turn_number ASC
            `,
                [sessionId],
            );

            if (turnsResult.rows.length === 0) {
                const err = new Error("This interview has no questions to retake.");
                err.statusCode = 400;
                throw err;
            }

            const newSessionId = uuidv4();
            const targetQuestions = turnsResult.rows.length;
            const sessionMetadata = {
                ...(sourceSession.session_metadata || {}),
                retakeOfSessionId: sourceSession.id,
                retakeCreatedAt: new Date().toISOString(),
            };

            const insertSessionResult = await client.query(
                `
                INSERT INTO interview_sessions (
                    id, user_id, session_mode, topic, difficulty, target_questions,
                    target_role, job_description, resume_text,
                    stt_provider, tts_provider, llm_provider,
                    status, started_at, current_question_number, total_questions, overall_score,
                    session_metadata, retake_of_session_id
                )
                VALUES (
                    $1, $2, $3, $4, $5, $6,
                    $7, $8, $9,
                    $10, $11, $12,
                    'active', NOW(), 0, 0, 0,
                    $13::jsonb, $14
                )
                RETURNING *
            `,
                [
                    newSessionId,
                    userId,
                    sourceSession.session_mode,
                    sourceSession.topic,
                    sourceSession.difficulty,
                    targetQuestions,
                    sourceSession.target_role,
                    sourceSession.job_description,
                    sourceSession.resume_text,
                    sourceSession.stt_provider,
                    sourceSession.tts_provider,
                    sourceSession.llm_provider,
                    JSON.stringify(sessionMetadata),
                    sourceSession.id,
                ],
            );

            for (const turn of turnsResult.rows) {
                await client.query(
                    `
                    INSERT INTO interview_turns (
                        session_id, turn_number, question_text,
                        question_type, question_difficulty, requires_code_editor, problem_id,
                        concept_tags, validation_criteria, llm_metadata, question_generated_at
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb, NOW())
                `,
                    [
                        newSessionId,
                        turn.turn_number,
                        turn.question_text,
                        turn.question_type,
                        turn.question_difficulty,
                        turn.requires_code_editor,
                        turn.problem_id,
                        JSON.stringify(turn.concept_tags || []),
                        JSON.stringify(turn.validation_criteria || {}),
                        JSON.stringify(turn.llm_metadata || {}),
                    ],
                );
            }

            await client.query("COMMIT");

            const sttProvider = await voiceProviderRegistry.get("stt", sourceSession.stt_provider);
            const ttsProvider = await voiceProviderRegistry.get("tts", sourceSession.tts_provider);
            const llmProvider = await voiceProviderRegistry.get("llm_interview", sourceSession.llm_provider);

            this.activeSessions.set(newSessionId, {
                ...insertSessionResult.rows[0],
                providers: { stt: sttProvider, tts: ttsProvider, llm: llmProvider },
                questionHistory: [],
            });

            return {
                sessionId: newSessionId,
                mode: sourceSession.session_mode,
                topic: sourceSession.topic,
                targetRole: sourceSession.target_role,
                difficulty: sourceSession.difficulty,
                targetQuestions,
                status: "active",
                startedAt: insertSessionResult.rows[0].started_at,
                retakeOfSessionId: sourceSession.id,
            };
        } catch (error) {
            await client.query("ROLLBACK");
            console.error("[InterviewOrchestrator] Failed to retake session:", error.message);
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

        console.log(
            `[InterviewOrchestrator] Loaded session ${sessionId} providers -> STT: ${stt?.name || session.stt_provider}, TTS: ${tts?.name || session.tts_provider}, Interview LLM: ${llm?.name || session.llm_provider}`,
        );

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
                    requires_code_editor,
                    problem_id,
                    question_difficulty,
                    concept_tags,
                    validation_criteria,
                    llm_metadata,
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
                ...this._normalizeQuestionRow(row),
                turnId: row.turn_id,
                turnNumber: row.turn_number,
                questionType: row.question_type,
                requiresCodeEditor: row.requires_code_editor,
                problemId: row.problem_id,
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
    async getQuestionByTurn(sessionId, turnNumber, options = {}) {
        const client = await pool.connect();
        try {
            const session = await this._getSession(sessionId);
            const { tts } = session.providers;
            const includeAudio = options.includeAudio !== false;

            const result = await client.query(
                `
                SELECT 
                    id, turn_number, question_text, question_type,
                    requires_code_editor, problem_id, question_difficulty, user_answer_text, score, verdict, feedback,
                    concept_tags, validation_criteria, llm_metadata
                FROM interview_turns
                WHERE session_id = $1 AND turn_number = $2
            `,
                [sessionId, turnNumber],
            );

            if (result.rows.length === 0) {
                throw new Error(`Question ${turnNumber} not found`);
            }

            const turn = result.rows[0];
            const parsedPayload = this._parseQuestionPayload(turn.question_text);
            const questionText = parsedPayload.questionText || turn.question_text;
            const problem = await this._fetchProblemById(client, turn.problem_id);
            const parsedSpec = parsedPayload.parsed?.problemSpec || null;
            const parsedMeta = parsedPayload.parsed
                ? {
                      topic: parsedPayload.parsed.topic || null,
                      followUps:
                          parsedPayload.parsed.follow_ups ||
                          parsedPayload.parsed.followUps ||
                          [],
                      conceptTags:
                          parsedPayload.parsed.concept_tags ||
                          parsedPayload.parsed.conceptTags ||
                          [],
                      expectedKeywords: parsedPayload.parsed.expectedKeywords || [],
                      evaluationCriteria:
                          parsedPayload.parsed.evaluation_criteria ||
                          parsedPayload.parsed.evaluationCriteria ||
                          null,
                      questionFormatVersion: 1,
                  }
                : null;

            if (parsedSpec && problem) {
                const shouldPatchProblem =
                    String(problem.title || "").trim().startsWith("{") ||
                    String(problem.description || "").trim().startsWith("{") ||
                    String(problem.input_format || "").trim().toUpperCase() === "N/A" ||
                    String(problem.output_format || "").trim().toUpperCase() === "N/A";
                if (shouldPatchProblem) {
                    const patched = this._buildProblemFromSpec(parsedSpec, problem);
                    await client.query(
                        `
                        UPDATE problem
                        SET title = $1,
                            description = $2,
                            input_format = $3,
                            output_format = $4,
                            constraints = $5,
                            sample_testcase = $6,
                            explaination = $7,
                            category = $8,
                            prohibited_keys = $9,
                            updated_at = NOW()
                        WHERE id = $10
                    `,
                        [
                            patched.title,
                            patched.description,
                            patched.input_format,
                            patched.output_format,
                            patched.constraints,
                            patched.sample_testcase,
                            patched.explaination,
                            patched.category,
                            patched.prohibited_keys,
                            problem.id,
                        ],
                    );
                }
            }

            let wavAudio = null;
            let audioDuration = null;
            if (includeAudio) {
                const ttsText =
                    parsedSpec && turn.question_type === "coding"
                        ? parsedSpec.description || questionText
                        : questionText;
                const ttsResult = await tts.synthesize(ttsText);
                wavAudio = ensureWavFormat(ttsResult.audio, {
                    sampleRate: 22050,
                    channels: 1,
                    bitsPerSample: 16,
                });
                audioDuration = ttsResult.duration;
            }

            const mergedMeta = this._mergeQuestionMeta(turn.llm_metadata, parsedMeta);

            return {
                turnId: turn.id,
                turnNumber: turn.turn_number,
                question: questionText,
                questionType: turn.question_type,
                requiresCodeEditor: turn.requires_code_editor,
                problemId: turn.problem_id,
                problem: parsedSpec ? this._buildProblemFromSpec(parsedSpec, problem) : problem,
                difficulty: turn.question_difficulty,
                questionMeta: mergedMeta,
                conceptTags: (turn.concept_tags && turn.concept_tags.length > 0)
                    ? turn.concept_tags
                    : (mergedMeta?.conceptTags || []),
                validationCriteria: turn.validation_criteria && Object.keys(turn.validation_criteria).length > 0
                    ? turn.validation_criteria
                    : (mergedMeta?.evaluationCriteria ? { evaluation_criteria: mergedMeta.evaluationCriteria } : {}),
                audio: wavAudio ? wavAudio.toString("base64") : null,
                audioDuration,
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

            console.log(`[InterviewOrchestrator] ? Successfully deleted session ${sessionId}`);

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
            console.error(`[InterviewOrchestrator] ? Error deleting session:`, error);
            throw error;
        } finally {
            client.release();
        }
    }

    _isCodingQuestion(generatedQuestion) {
        const type = (generatedQuestion?.type || "").toLowerCase();
        if (type === "coding") return true;
        if (generatedQuestion?.problemSpec) return true;
        const text = generatedQuestion?.question || "";
        return this._looksLikeCodingQuestion(text);
    }

    _looksLikeCodingQuestion(text) {
        if (!text) return false;
        const lower = text.toLowerCase();
        const codingHints = [
            "write",
            "implement",
            "code",
            "function",
            "algorithm",
            "complexity",
            "o(",
            "array",
            "string",
            "matrix",
            "graph",
            "tree",
            "linked list",
            "queue",
            "stack",
            "hash",
            "dynamic programming",
            "dp",
            "binary search",
            "sort",
            "search",
            "subarray",
            "substring",
            "input",
            "output",
            "constraints",
            "mod",
            "modulo",
            "grid",
        ];

        return codingHints.some((hint) => lower.includes(hint));
    }

    _buildProblemSpec(generatedQuestion, index) {
        const fallbackTitle = this._buildFallbackTitle(generatedQuestion?.question, index);
        const spec = generatedQuestion?.problemSpec || {};

        const normalizeValue = (value) => {
            if (value === null || value === undefined) return "";
            if (typeof value === "string") return value;
            try {
                return JSON.stringify(value);
            } catch (error) {
                return String(value);
            }
        };

        const normalizeTestcase = (testcase) => {
            if (!testcase || typeof testcase !== "object") {
                return { input: "", output: "" };
            }
            return {
                input: normalizeValue(testcase.input),
                output: normalizeValue(testcase.output),
            };
        };

        const sample = normalizeTestcase(spec.sample_testcase);

        let hidden = Array.isArray(spec.hidden_testcases) ? spec.hidden_testcases.filter(Boolean) : [];
        hidden = hidden.map((testcase) => normalizeTestcase(testcase));
        if (hidden.length === 0) {
            hidden = [sample, sample];
        } else if (hidden.length === 1) {
            hidden = [hidden[0], sample];
        }

        return {
            title: spec.title || fallbackTitle,
            description: spec.description || generatedQuestion?.question || fallbackTitle,
            input_format: spec.input_format || "N/A",
            output_format: spec.output_format || "N/A",
            constraints: spec.constraints || "N/A",
            sample_testcase: sample,
            hidden_testcases: hidden,
            explaination: spec.explaination || "Self Explainary!",
            category: Array.isArray(spec.category) && spec.category.length > 0 ? spec.category : ["Array"],
            prohibited_keys: spec.prohibited_keys || null,
        };
    }

    _buildProblemFromSpec(spec, fallbackProblem) {
        const normalizeValue = (value) => {
            if (value === null || value === undefined) return "";
            if (typeof value === "string") return value;
            try {
                return JSON.stringify(value);
            } catch (error) {
                return String(value);
            }
        };

        const sample =
            spec?.sample_testcase && typeof spec.sample_testcase === "object"
                ? {
                      input: normalizeValue(spec.sample_testcase.input),
                      output: normalizeValue(spec.sample_testcase.output),
                  }
                : { input: "", output: "" };

        return {
            ...(fallbackProblem || {}),
            title: spec.title || fallbackProblem?.title || "Interview Coding Question",
            description: spec.description || fallbackProblem?.description || "",
            input_format: spec.input_format || fallbackProblem?.input_format || "N/A",
            output_format: spec.output_format || fallbackProblem?.output_format || "N/A",
            constraints: spec.constraints || fallbackProblem?.constraints || "N/A",
            sample_testcase: sample,
            explaination: spec.explaination || fallbackProblem?.explaination || "Self Explainary!",
            category: Array.isArray(spec.category) ? spec.category : fallbackProblem?.category || [],
            prohibited_keys: spec.prohibited_keys || fallbackProblem?.prohibited_keys || null,
        };
    }

    _mergeQuestionMeta(dbMeta, parsedMeta) {
        if (!parsedMeta) return dbMeta || null;
        if (!dbMeta || Object.keys(dbMeta).length === 0) return parsedMeta;

        return {
            ...parsedMeta,
            ...dbMeta,
            topic: dbMeta.topic || parsedMeta.topic || null,
            evaluationCriteria: dbMeta.evaluationCriteria || parsedMeta.evaluationCriteria || null,
            followUps:
                Array.isArray(dbMeta.followUps) && dbMeta.followUps.length > 0
                    ? dbMeta.followUps
                    : parsedMeta.followUps || [],
            conceptTags:
                Array.isArray(dbMeta.conceptTags) && dbMeta.conceptTags.length > 0
                    ? dbMeta.conceptTags
                    : parsedMeta.conceptTags || [],
            expectedKeywords:
                Array.isArray(dbMeta.expectedKeywords) && dbMeta.expectedKeywords.length > 0
                    ? dbMeta.expectedKeywords
                    : parsedMeta.expectedKeywords || [],
            questionFormatVersion: dbMeta.questionFormatVersion || parsedMeta.questionFormatVersion || 1,
        };
    }

    _normalizeQuestionRow(row) {
        const parsedPayload = this._parseQuestionPayload(row.question_text);
        const parsedMeta = parsedPayload.parsed
            ? {
                  topic: parsedPayload.parsed.topic || null,
                  followUps:
                      parsedPayload.parsed.follow_ups ||
                      parsedPayload.parsed.followUps ||
                      [],
                  conceptTags:
                      parsedPayload.parsed.concept_tags ||
                      parsedPayload.parsed.conceptTags ||
                      [],
                  expectedKeywords: parsedPayload.parsed.expectedKeywords || [],
                  evaluationCriteria:
                      parsedPayload.parsed.evaluation_criteria ||
                      parsedPayload.parsed.evaluationCriteria ||
                      null,
                  questionFormatVersion: 1,
              }
            : null;
        const mergedMeta = this._mergeQuestionMeta(row.llm_metadata, parsedMeta);

        return {
            question: parsedPayload.questionText || row.question_text,
            questionMeta: mergedMeta,
            conceptTags: (row.concept_tags && row.concept_tags.length > 0)
                ? row.concept_tags
                : (mergedMeta?.conceptTags || []),
            validationCriteria: row.validation_criteria && Object.keys(row.validation_criteria).length > 0
                ? row.validation_criteria
                : (mergedMeta?.evaluationCriteria ? { evaluation_criteria: mergedMeta.evaluationCriteria } : {}),
        };
    }

    _buildFallbackTitle(questionText, index) {
        if (!questionText) return `Interview Coding Q${index}`;
        const trimmed = questionText.replace(/\s+/g, " ").trim();
        const words = trimmed.split(" ").slice(0, 6).join(" ");
        return words.length > 0 ? words : `Interview Coding Q${index}`;
    }

    async _fetchProblemById(client, problemId) {
        if (!problemId) return null;
        try {
            const result = await client.query("SELECT * FROM Problem WHERE id = $1", [problemId]);
            return result.rows[0] || null;
        } catch (error) {
            console.warn("[InterviewOrchestrator] Failed to fetch problem for interview:", error.message);
            return null;
        }
    }

    async _getLatestCodeSubmission(client, turnId, userId) {
        const result = await client.query(
            `
            SELECT id, verdict, created_at
            FROM interview_code_submissions
            WHERE turn_id = $1 AND user_id = $2
            ORDER BY created_at DESC
            LIMIT 1
        `,
            [turnId, userId],
        );

        return result.rows[0] || null;
    }

    _scoreFromVerdict(verdict) {
        const normalized = String(verdict || "").toUpperCase();
        if (normalized === "ACCEPTED") return 100;
        if (normalized === "WRONG ANSWER") return 40;
        if (normalized === "TLE") return 20;
        if (normalized === "RTE") return 20;
        if (normalized === "COMPILE ERROR") return 10;
        return 50;
    }

    _combineScores(speechScore, codeScore) {
        const speech = Number.isFinite(speechScore) ? speechScore : 50;
        const code = Number.isFinite(codeScore) ? codeScore : 50;
        return Math.round(speech * 0.6 + code * 0.4);
    }

    _verdictFromScore(score) {
        if (score >= 90) return "excellent";
        if (score >= 70) return "good";
        if (score >= 50) return "average";
        if (score >= 30) return "poor";
        return "failed";
    }

    _feedbackFromVerdict(verdict) {
        const normalized = String(verdict || "").toUpperCase();
        if (normalized === "ACCEPTED") return "Your solution passed the tests.";
        if (normalized === "WRONG ANSWER") return "The output did not match expected results.";
        if (normalized === "TLE") return "The solution exceeded time limits.";
        if (normalized === "RTE") return "The code crashed during execution.";
        if (normalized === "COMPILE ERROR") return "The code did not compile successfully.";
        return "The code submission could not be fully judged.";
    }
}

// Export singleton instance
const interviewOrchestrator = new InterviewOrchestrator();
export default interviewOrchestrator;

