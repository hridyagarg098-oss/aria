-- ═══════════════════════════════════════════════════════════
-- ARIA PLATFORM — Schema Migration v5
-- New interview sub-score columns + integrity log + question tracking
-- Run AFTER v4. Idempotent — safe to re-run.
-- ═══════════════════════════════════════════════════════════

-- ── Interview Sessions: 5-dimension scoring ────────────────
ALTER TABLE interview_sessions
  ADD COLUMN IF NOT EXISTS project_depth_score numeric,
  ADD COLUMN IF NOT EXISTS academic_understanding_score numeric,
  ADD COLUMN IF NOT EXISTS motivation_clarity_score numeric,
  ADD COLUMN IF NOT EXISTS problem_solving_score numeric,
  ADD COLUMN IF NOT EXISTS interview_grade text,
  ADD COLUMN IF NOT EXISTS recommendation text,
  ADD COLUMN IF NOT EXISTS admit_confidence numeric,
  ADD COLUMN IF NOT EXISTS key_strengths jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS red_flags jsonb DEFAULT '[]'::jsonb;

-- ── Test Sessions: question tracking + integrity log ───────
ALTER TABLE test_sessions
  ADD COLUMN IF NOT EXISTS generated_questions jsonb,
  ADD COLUMN IF NOT EXISTS question_ids jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS integrity_log jsonb DEFAULT '[]'::jsonb;

-- ── Aptitude Tests: support question pool format ───────────
ALTER TABLE aptitude_tests
  ADD COLUMN IF NOT EXISTS question_pool jsonb;
