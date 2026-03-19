/**
 * ============================================================================
 * Card Population Service
 * ============================================================================
 */

import { pool } from "../database/connect.db.js";
import { updateCardsForConcepts } from "./spacedRepetition.service.js";

const normalizeTagArray = (value) => {
    if (Array.isArray(value)) return value.filter(Boolean).map((item) => String(item));
    return [];
};

const mergeScore = (map, concept, score) => {
    if (!concept) return;
    const normalizedScore = Number.isFinite(score) ? score : 0;
    if (!map.has(concept)) {
        map.set(concept, normalizedScore);
        return;
    }
    const existing = map.get(concept);
    map.set(concept, Math.min(existing, normalizedScore));
};

export const populateCardsFromSession = async (sessionId, userId) => {
    if (!sessionId) {
        throw new Error("Session id is required");
    }
    if (!userId) {
        throw new Error("User id is required");
    }

    const sessionResult = await pool.query(
        `
        SELECT topic
        FROM interview_sessions
        WHERE id = $1
    `,
        [sessionId],
    );

    const sessionTopic = sessionResult.rows[0]?.topic || null;

    const turnsResult = await pool.query(
        `
        SELECT concept_tags, llm_metadata, detected_mistakes, score
        FROM interview_turns
        WHERE session_id = $1
    `,
        [sessionId],
    );

    const conceptScores = new Map();

    for (let i = 0; i < turnsResult.rows.length; i += 1) {
        const turn = turnsResult.rows[i];
        const score = Number.isFinite(turn.score) ? turn.score : 50;

        const llmTags = turn.llm_metadata && Array.isArray(turn.llm_metadata.conceptTags)
            ? turn.llm_metadata.conceptTags
            : [];
        const conceptTags = [
            ...normalizeTagArray(turn.concept_tags),
            ...normalizeTagArray(llmTags),
        ];

        const missed = normalizeTagArray(turn.detected_mistakes);

        if (conceptTags.length === 0 && sessionTopic) {
            conceptTags.push(sessionTopic);
        }

        for (let j = 0; j < conceptTags.length; j += 1) {
            mergeScore(conceptScores, conceptTags[j], score);
        }

        for (let k = 0; k < missed.length; k += 1) {
            mergeScore(conceptScores, missed[k], Math.min(score, 59));
        }
    }

    const payload = Array.from(conceptScores.entries()).map(([conceptTag, score]) => ({
        conceptTag,
        score,
    }));

    if (payload.length === 0) {
        return;
    }

    await updateCardsForConcepts(userId, payload);
};

