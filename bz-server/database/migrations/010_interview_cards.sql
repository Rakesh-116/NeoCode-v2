-- ============================================================================
-- Migration: Interview Cards for Smart Review
-- ============================================================================

BEGIN;

-- Ensure session_mode can include smart_review
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'interview_sessions_session_mode_check'
    ) THEN
        ALTER TABLE interview_sessions
            DROP CONSTRAINT interview_sessions_session_mode_check;
    END IF;
END $$;

ALTER TABLE interview_sessions
    ADD CONSTRAINT interview_sessions_session_mode_check
    CHECK (session_mode IN ('topic', 'role', 'smart_review'));

-- Cards table
CREATE TABLE IF NOT EXISTS interview_cards (
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
    CONSTRAINT interview_cards_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT interview_cards_user_concept_unique UNIQUE (user_id, concept_tag)
);

CREATE INDEX IF NOT EXISTS idx_interview_cards_due
    ON interview_cards (user_id, next_review_date);

COMMIT;

