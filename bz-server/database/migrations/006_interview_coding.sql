-- ============================================================================
-- Migration 006: Interview Coding Flag + Code Submissions
-- ============================================================================
-- Goal:
-- 1) Explicitly flag interview turns that should render with a code editor UI
-- 2) Store interview coding submissions separately from normal problem/courses
--
-- Notes:
-- - `requires_code_editor` is intentionally explicit (not derived) so UI logic
--   doesn't depend on LLM "type" correctness forever.
-- - `interview_code_submissions` is separate from `submissions` to preserve a
--   strong product boundary between "practice/course submissions" and
--   "interview submissions".
--
-- Created: 2026-03-16
-- ============================================================================

-- 1) Flag on interview turns
ALTER TABLE public.interview_turns
ADD COLUMN IF NOT EXISTS requires_code_editor BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_interview_turns_requires_code_editor
ON public.interview_turns (requires_code_editor);

-- 2) Interview code submissions table (separate from public.submissions)
CREATE TABLE IF NOT EXISTS public.interview_code_submissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
    turn_id UUID NOT NULL REFERENCES public.interview_turns(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

    language VARCHAR(50) NOT NULL,
    source_code TEXT NOT NULL,
    stdin TEXT,

    -- Optional execution metadata (filled later if/when we add judged runs)
    stdout TEXT,
    stderr TEXT,
    execution_time_ms INTEGER,
    status VARCHAR(20) NOT NULL DEFAULT 'submitted',
    metadata JSONB DEFAULT '{}'::jsonb,

    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_interview_code_submissions_session
ON public.interview_code_submissions (session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_interview_code_submissions_turn
ON public.interview_code_submissions (turn_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_interview_code_submissions_user
ON public.interview_code_submissions (user_id, created_at DESC);

