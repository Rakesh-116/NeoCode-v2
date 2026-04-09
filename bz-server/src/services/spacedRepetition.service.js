/**
 * ============================================================================
 * Spaced Repetition Service (SM-2 Simplified)
 * ============================================================================
 */

import { pool } from "../database/connect.db.js";

const dueCache = new Map();
const ONE_HOUR_MS = 60 * 60 * 1000;
let smartReviewSchemaPromise = null;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const normalizeScore = (score) => {
    const parsed = parseInt(score, 10);
    if (Number.isNaN(parsed)) return 0;
    return clamp(parsed, 0, 100);
};

const toDateOnly = (date) => {
    const value = new Date(date);
    const iso = value.toISOString().slice(0, 10);
    return iso;
};

const addDays = (date, days) => {
    const base = new Date(date);
    const next = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + days));
    return next;
};

const applySm2 = (card, score, now) => {
    const safeScore = normalizeScore(score);
    let ease = Number(card.ease_factor) || 2.5;
    let interval = parseInt(card.interval_days, 10) || 1;
    let repetitions = parseInt(card.repetitions, 10) || 0;
    let consecutiveEasy = parseInt(card.consecutive_easy_count, 10) || 0;

    if (safeScore <= 59) {
        interval = 1;
        ease = ease - 0.2;
        repetitions = 0;
        consecutiveEasy = 0;
    } else if (safeScore <= 74) {
        interval = Math.max(1, Math.round(interval * 1.2));
        ease = ease - 0.15;
        repetitions += 1;
        consecutiveEasy = 0;
    } else if (safeScore <= 89) {
        interval = Math.max(1, Math.round(interval * ease));
        repetitions += 1;
        consecutiveEasy = 0;
    } else {
        interval = Math.max(1, Math.round(interval * ease));
        ease = ease + 0.15;
        repetitions += 1;
        consecutiveEasy += 1;
    }

    if (ease < 1.8 && consecutiveEasy >= 3) {
        ease = 2.0;
    }

    ease = clamp(ease, 1.3, 3.5);
    interval = Math.max(1, interval);

    const nextReviewDate = addDays(now, interval);

    return {
        ease_factor: ease,
        interval_days: interval,
        repetitions,
        consecutive_easy_count: consecutiveEasy,
        next_review_date: toDateOnly(nextReviewDate),
        last_score: safeScore,
        last_reviewed_at: now,
    };
};

export const invalidateDueCache = (userId) => {
    if (!userId) return;
    dueCache.delete(userId);
};

export const ensureSmartReviewSchema = async () => {
    if (!smartReviewSchemaPromise) {
        smartReviewSchemaPromise = (async () => {
            const client = await pool.connect();
            try {
                await client.query("BEGIN");

                await client.query(`
                    DO $$
                    BEGIN
                        IF EXISTS (
                            SELECT 1
                            FROM pg_constraint
                            WHERE conname = 'interview_sessions_session_mode_check'
                              AND conrelid = 'public.interview_sessions'::regclass
                        ) THEN
                            ALTER TABLE public.interview_sessions
                                DROP CONSTRAINT interview_sessions_session_mode_check;
                        END IF;
                    END $$;
                `);

                await client.query(`
                    ALTER TABLE public.interview_sessions
                        ADD CONSTRAINT interview_sessions_session_mode_check
                        CHECK (session_mode IN ('topic', 'role', 'smart_review'));
                `).catch(async (error) => {
                    if (!String(error.message || "").includes("already exists")) {
                        throw error;
                    }
                });

                await client.query(`
                    CREATE TABLE IF NOT EXISTS public.interview_cards (
                        id uuid DEFAULT gen_random_uuid() NOT NULL,
                        user_id uuid NOT NULL,
                        concept_tag text NOT NULL,
                        ease_factor numeric(3,2) NOT NULL DEFAULT 2.50,
                        interval_days integer NOT NULL DEFAULT 1,
                        repetitions integer NOT NULL DEFAULT 0,
                        consecutive_easy_count integer NOT NULL DEFAULT 0,
                        next_review_date date NOT NULL DEFAULT CURRENT_DATE,
                        last_score integer,
                        last_reviewed_at timestamp without time zone,
                        created_at timestamp without time zone DEFAULT now(),
                        CONSTRAINT interview_cards_pkey PRIMARY KEY (id),
                        CONSTRAINT interview_cards_user_id_fkey
                            FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
                        CONSTRAINT interview_cards_user_concept_unique UNIQUE (user_id, concept_tag)
                    );
                `);

                await client.query(`
                    CREATE INDEX IF NOT EXISTS idx_interview_cards_due
                    ON public.interview_cards (user_id, next_review_date);
                `);

                await client.query("COMMIT");
            } catch (error) {
                await client.query("ROLLBACK");
                smartReviewSchemaPromise = null;
                throw error;
            } finally {
                client.release();
            }
        })();
    }

    return smartReviewSchemaPromise;
};

export const getDueCards = async (userId, limit) => {
    if (!userId) {
        throw new Error("User id is required");
    }
    if (!Number.isFinite(limit)) {
        throw new Error("Limit is required");
    }

    await ensureSmartReviewSchema();

    const cached = dueCache.get(userId);
    if (cached && Date.now() - cached.timestamp < ONE_HOUR_MS) {
        return cached.cards;
    }

    const result = await pool.query(
        `
        SELECT
            id,
            concept_tag,
            ease_factor,
            interval_days,
            repetitions,
            consecutive_easy_count,
            next_review_date,
            last_score,
            last_reviewed_at,
            (CURRENT_DATE - next_review_date) AS overdue_days
        FROM interview_cards
        WHERE user_id = $1
          AND next_review_date <= CURRENT_DATE
        ORDER BY (CURRENT_DATE - next_review_date) DESC, next_review_date ASC
        LIMIT $2
    `,
        [userId, parseInt(limit, 10)],
    );

    dueCache.set(userId, { timestamp: Date.now(), cards: result.rows });
    return result.rows;
};

export const updateCardsForConcepts = async (userId, conceptScores) => {
    if (!userId) {
        throw new Error("User id is required");
    }
    if (!Array.isArray(conceptScores)) {
        throw new Error("conceptScores must be an array");
    }

    await ensureSmartReviewSchema();

    const now = new Date();

    for (let i = 0; i < conceptScores.length; i += 1) {
        const entry = conceptScores[i];
        if (!entry || !entry.conceptTag) continue;

        const conceptTag = String(entry.conceptTag);
        const score = normalizeScore(entry.score);

        const existing = await pool.query(
            `
            SELECT *
            FROM interview_cards
            WHERE user_id = $1 AND concept_tag = $2
        `,
            [userId, conceptTag],
        );

        const baseCard = existing.rows[0] || {
            ease_factor: 2.5,
            interval_days: 1,
            repetitions: 0,
            consecutive_easy_count: 0,
        };

        const nextState = applySm2(baseCard, score, now);

        await pool.query(
            `
            INSERT INTO interview_cards (
                user_id,
                concept_tag,
                ease_factor,
                interval_days,
                repetitions,
                consecutive_easy_count,
                next_review_date,
                last_score,
                last_reviewed_at
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            ON CONFLICT (user_id, concept_tag)
            DO UPDATE SET
                ease_factor = EXCLUDED.ease_factor,
                interval_days = EXCLUDED.interval_days,
                repetitions = EXCLUDED.repetitions,
                consecutive_easy_count = EXCLUDED.consecutive_easy_count,
                next_review_date = EXCLUDED.next_review_date,
                last_score = EXCLUDED.last_score,
                last_reviewed_at = EXCLUDED.last_reviewed_at
        `,
            [
                userId,
                conceptTag,
                nextState.ease_factor,
                nextState.interval_days,
                nextState.repetitions,
                nextState.consecutive_easy_count,
                nextState.next_review_date,
                nextState.last_score,
                nextState.last_reviewed_at,
            ],
        );
    }

    invalidateDueCache(userId);
};

export const getSmartReviewStats = async (userId) => {
    if (!userId) {
        throw new Error("User id is required");
    }

    await ensureSmartReviewSchema();

    const totals = await pool.query(
        `
        SELECT
            COUNT(*)::int AS total_concepts,
            COUNT(*) FILTER (WHERE next_review_date <= CURRENT_DATE)::int AS due_today,
            COUNT(*) FILTER (WHERE ease_factor > 2.8 AND interval_days > 21)::int AS mastered_concepts,
            COUNT(*) FILTER (WHERE ease_factor < 1.5)::int AS in_ease_hell,
            MIN(next_review_date) AS next_review_date
        FROM interview_cards
        WHERE user_id = $1
    `,
        [userId],
    );

    const datesResult = await pool.query(
        `
        SELECT DISTINCT DATE(last_reviewed_at) AS review_date
        FROM interview_cards
        WHERE user_id = $1 AND last_reviewed_at IS NOT NULL
        ORDER BY review_date DESC
    `,
        [userId],
    );

    const dateSet = new Set(datesResult.rows.map((row) => toDateOnly(row.review_date)));
    let streak = 0;
    let cursor = new Date();
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate()));

    while (dateSet.has(toDateOnly(cursor))) {
        streak += 1;
        cursor = addDays(cursor, -1);
    }

    return {
        totalConcepts: totals.rows[0]?.total_concepts || 0,
        dueToday: totals.rows[0]?.due_today || 0,
        masteredConcepts: totals.rows[0]?.mastered_concepts || 0,
        inEaseHell: totals.rows[0]?.in_ease_hell || 0,
        streakDays: streak,
        nextReviewDate: totals.rows[0]?.next_review_date ? toDateOnly(totals.rows[0].next_review_date) : null,
    };
};
