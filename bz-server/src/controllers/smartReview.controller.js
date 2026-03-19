/**
 * ============================================================================
 * Smart Review Controller
 * ============================================================================
 */

import { pool } from "../database/connect.db.js";
import voiceProviderRegistry from "../ai/voice-interview/providers/ProviderRegistry.js";
import { v4 as uuidv4 } from "uuid";
import { createProblemWithTestcases } from "../services/problemAdmin.service.js";
import { getDueCards, updateCardsForConcepts, getSmartReviewStats as loadSmartReviewStats } from "../services/spacedRepetition.service.js";

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
    const sample =
        spec.sample_testcase && typeof spec.sample_testcase === "object"
            ? spec.sample_testcase
            : { input: "", output: "" };

    let hidden = Array.isArray(spec.hidden_testcases) ? spec.hidden_testcases.filter(Boolean) : [];
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
            const isCoding = isCodingQuestion(generatedQuestion);
            const questionType = isCoding ? "coding" : generatedQuestion.type || "technical";

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
                    concept_tags, question_generated_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW())
            `,
                [
                    sessionId,
                    i + 1,
                    generatedQuestion.question,
                    questionType,
                    difficulty,
                    isCoding,
                    problemId,
                    JSON.stringify([conceptTag]),
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
