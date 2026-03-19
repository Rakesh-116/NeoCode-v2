-- ============================================================================
-- Migration 007: Interview Retake Link (Attempts)
-- ============================================================================
-- Goal:
-- Track retakes as separate sessions, linked back to the original session.
-- This enables attempt history and prevents mixing "retake" with "new setup".
--
-- Created: 2026-03-16
-- ============================================================================

ALTER TABLE public.interview_sessions
ADD COLUMN IF NOT EXISTS retake_of_session_id UUID;

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

CREATE INDEX IF NOT EXISTS idx_interview_sessions_retake_of
ON public.interview_sessions (retake_of_session_id);
