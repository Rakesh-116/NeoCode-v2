/**
 * ============================================================================
 * Smart Review Controller
 * ============================================================================
 */

import { pool } from "../database/connect.db.js";
import voiceProviderRegistry from "../ai/voice-interview/providers/ProviderRegistry.js";
import { v4 as uuidv4 } from "uuid";
import { createProblemWithTestcases } from "../services/problemAdmin.service.js";
import {
    ensureSmartReviewSchema,
    getDueCards,
    updateCardsForConcepts,
    getSmartReviewStats as loadSmartReviewStats,
} from "../services/spacedRepetition.service.js";

const difficultyFromScore = (score) => {
    const numeric = Number.isFinite(score) ? score : 50;
    if (numeric >= 90) return "hard";
    if (numeric >= 75) return "medium";
    return "easy";
};

const isCodingQuestion = (generatedQuestion) => {
    const type = (generatedQuestion?.type || "").toLowerCase();
    if (type === "coding") return true;
    if (generatedQuestion?.problemSpec) return true;
    const text = generatedQuestion?.question || "";
    const lower = text.toLowerCase();
    return ["write", "implement", "code", "function", "algorithm", "input", "output"].some((hint) =>
        lower.includes(hint),
    );
};

const buildProblemSpec = (generatedQuestion, index) => {
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

    const title =
        spec.title || `Interview Coding Q${index}`;

    return {
        title,
        description: spec.description || generatedQuestion?.question || title,
        input_format: spec.input_format || "N/A",
        output_format: spec.output_format || "N/A",
        constraints: spec.constraints || "N/A",
        sample_testcase: sample,
        hidden_testcases: hidden,
        explaination: spec.explaination || "Self Explainary!",
        category: Array.isArray(spec.category) && spec.category.length > 0 ? spec.category : ["Array"],
        prohibited_keys: spec.prohibited_keys || null,
    };
};

const parseQuestionPayload = (rawText) => {
    if (!rawText || typeof rawText !== "string") return null;
    const trimmed = rawText.trim();
    if (!trimmed.startsWith("{") || !trimmed.includes('"question"')) return null;

    let candidate = trimmed;
    const firstBrace = candidate.indexOf("{");
    const lastBrace = candidate.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        candidate = candidate.slice(firstBrace, lastBrace + 1);
    }
    candidate = candidate.replace(/[â€œâ€]/g, '"').replace(/[â€˜â€™]/g, "'");

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

    try {
        return JSON.parse(out);
    } catch (error) {
        return null;
    }
};

export const getDueConcepts = async (req, res) => {
    try {
        const userId = req.userId;
        const dueCards = await getDueCards(userId, 10);

        res.status(200).json({
            success: true,
            due: dueCards,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch due concepts",
            error: error.message,
        });
    }
};

export const startSmartReview = async (req, res) => {
    const client = await pool.connect();
    try {
        const userId = req.userId;
        await ensureSmartReviewSchema();
        const dueCards = await getDueCards(userId, 10);

        if (dueCards.length === 0) {
            return res.status(200).json({
                success: true,
                due: [],
                session: null,
                message: "No concepts due for review",
            });
        }

        const sttProvider = await voiceProviderRegistry.getDefault("stt");
        const ttsProvider = await voiceProviderRegistry.getDefault("tts");
        const llmProvider = await voiceProviderRegistry.getDefault("llm_interview");

        if (!sttProvider || !ttsProvider || !llmProvider) {
            throw new Error("Required providers not available. Check provider registry.");
        }

        const sessionId = uuidv4();
        const targetQuestions = dueCards.length;

        const result = await client.query(
            `
            INSERT INTO interview_sessions (
                id, user_id, session_mode, topic, difficulty, target_questions,
                stt_provider, tts_provider, llm_provider,
                status, started_at
            )
            VALUES ($1, $2, 'smart_review', $3, $4, $5, $6, $7, $8, 'active', NOW())
            RETURNING *
        `,
            [
                sessionId,
                userId,
                "smart_review",
                "medium",
                targetQuestions,
                sttProvider.name,
                ttsProvider.name,
                llmProvider.name,
            ],
        );

        const session = result.rows[0];
        const previousQuestions = [];

        for (let i = 0; i < dueCards.length; i += 1) {
            const card = dueCards[i];
            const conceptTag = card.concept_tag;
            const difficulty = difficultyFromScore(card.last_score);

            const questionContext = {
                topic: conceptTag,
                difficulty,
                previousQuestions,
                previousAnswers: [],
                smartReview: {
                    lastScore: card.last_score,
                    missedSubconcepts: [],
                },
            };

            const generatedQuestion = await llmProvider.generateQuestion(questionContext);
            if (!generatedQuestion?.problemSpec && typeof generatedQuestion?.question === "string") {
                const trimmed = generatedQuestion.question.trim();
                if (trimmed.startsWith("{") && trimmed.includes('"problemSpec"')) {
                    const parsed = parseQuestionPayload(trimmed);
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
                    } else {
                        console.warn("[SmartReview] Failed to recover JSON question payload");
                    }
                }
            }
            const isCoding = isCodingQuestion(generatedQuestion);
            const questionType = isCoding ? "coding" : generatedQuestion.type || "technical";
            const conceptTags = Array.isArray(generatedQuestion.conceptTags)
                ? generatedQuestion.conceptTags.filter(Boolean)
                : [];
            const evaluationCriteria = generatedQuestion.evaluationCriteria
                ? String(generatedQuestion.evaluationCriteria)
                : null;
            const questionMetadata = {
                questionFormatVersion: 1,
                topic: generatedQuestion.topic || conceptTag,
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
                    const normalizedDifficulty = (difficulty || "easy").toLowerCase();
                    const score = scoreByDifficulty[normalizedDifficulty] || 10;
                    const spec = buildProblemSpec(generatedQuestion, i + 1);
                    problemId = await createProblemWithTestcases({
                        userId,
                        forceHidden: true,
                        data: {
                            title: spec.title || `Interview Coding Q${i + 1}`,
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
                } catch (error) {
                    console.error("[SmartReview] Failed to create problem:", error.message);
                }
            }

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
                    sessionId,
                    i + 1,
                    generatedQuestion.question,
                    questionType,
                    difficulty,
                    isCoding,
                    problemId,
                    JSON.stringify(conceptTags.length > 0 ? conceptTags : [conceptTag]),
                    JSON.stringify(
                        evaluationCriteria
                            ? { evaluation_criteria: evaluationCriteria }
                            : {},
                    ),
                    JSON.stringify(questionMetadata),
                ],
            );

            previousQuestions.push(generatedQuestion.question);
        }

        await client.query(`UPDATE interview_sessions SET current_question_number = 0 WHERE id = $1`, [sessionId]);

        return res.status(200).json({
            success: true,
            session: {
                sessionId: session.id,
                mode: session.session_mode,
                topic: session.topic,
                difficulty: session.difficulty,
                status: session.status,
                startedAt: session.started_at,
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to start smart review",
            error: error.message,
        });
    } finally {
        client.release();
    }
};

export const completeSmartReview = async (req, res) => {
    try {
        const userId = req.userId;
        const { sessionId, results } = req.body;

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                message: "sessionId is required",
            });
        }

        if (!Array.isArray(results)) {
            return res.status(400).json({
                success: false,
                message: "results must be an array",
            });
        }

        const sessionCheck = await pool.query("SELECT user_id FROM interview_sessions WHERE id = $1", [sessionId]);
        if (sessionCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Session not found",
            });
        }
        if (sessionCheck.rows[0].user_id !== userId) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized access to session",
            });
        }

        const conceptScores = [];
        for (let i = 0; i < results.length; i += 1) {
            const entry = results[i];
            if (!entry || !entry.conceptTag) continue;
            conceptScores.push({
                conceptTag: entry.conceptTag,
                score: entry.score,
            });

            if (Array.isArray(entry.missedSubconcepts)) {
                for (let j = 0; j < entry.missedSubconcepts.length; j += 1) {
                    const miss = entry.missedSubconcepts[j];
                    if (!miss) continue;
                    conceptScores.push({
                        conceptTag: miss,
                        score: Math.min(parseInt(entry.score, 10) || 0, 59),
                    });
                }
            }
        }

        await updateCardsForConcepts(userId, conceptScores);

        return res.status(200).json({
            success: true,
            message: "Smart review results saved",
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to complete smart review",
            error: error.message,
        });
    }
};

export const getSmartReviewStats = async (req, res) => {
    try {
        const userId = req.userId;
        const stats = await loadSmartReviewStats(userId);
        return res.status(200).json({
            success: true,
            stats,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to load smart review stats",
            error: error.message,
        });
    }
};
