-- ============================================================================
-- Migration 009: Interview Turn Concepts + Validation Criteria
-- ============================================================================
-- Goal:
-- - Store concept tags and validation criteria for Anki + evaluator
--
-- Created: 2026-03-19
-- ============================================================================

ALTER TABLE public.interview_turns
ADD COLUMN IF NOT EXISTS concept_tags JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.interview_turns
ADD COLUMN IF NOT EXISTS validation_criteria JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_interview_turns_concept_tags
ON public.interview_turns USING gin (concept_tags);
