-- ============================================================================
-- Migration 008: Link Interview Turns to Problems + Store Judging Results
-- ============================================================================
-- Goal:
-- - Allow coding interview turns to reference a real `problem` record
-- - Store verdict/test results on `interview_code_submissions` (separate from `submissions`)
--
-- Created: 2026-03-16
-- ============================================================================

-- 1) Link interview_turns -> problem
ALTER TABLE public.interview_turns
ADD COLUMN IF NOT EXISTS problem_id INTEGER;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'interview_turns_problem_id_fkey'
          AND conrelid = 'public.interview_turns'::regclass
    ) THEN
        ALTER TABLE public.interview_turns
        ADD CONSTRAINT interview_turns_problem_id_fkey
        FOREIGN KEY (problem_id)
        REFERENCES public.problem(id)
        ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_interview_turns_problem_id
ON public.interview_turns (problem_id);

-- 2) Store judge outputs on interview_code_submissions
ALTER TABLE public.interview_code_submissions
ADD COLUMN IF NOT EXISTS verdict TEXT;

ALTER TABLE public.interview_code_submissions
ADD COLUMN IF NOT EXISTS test_results JSONB;

