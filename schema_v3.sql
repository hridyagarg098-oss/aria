-- ════════════════════════════════════════════════
-- ARIA PLATFORM v3 — RUN AFTER schema_v2.sql
-- Supabase SQL Editor → paste and run
-- ════════════════════════════════════════════════

-- ── APPLICATIONS — extended attempt tracking ──────
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS s2_attempts INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS s3_attempts INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS s2_best_score FLOAT,
  ADD COLUMN IF NOT EXISTS s3_best_score FLOAT,
  ADD COLUMN IF NOT EXISTS s2_attempt1_session_id UUID,
  ADD COLUMN IF NOT EXISTS s2_attempt2_session_id UUID,
  ADD COLUMN IF NOT EXISTS s3_attempt1_session_id UUID,
  ADD COLUMN IF NOT EXISTS s3_attempt2_session_id UUID,
  ADD COLUMN IF NOT EXISTS s2_retry_available_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS s3_retry_available_at TIMESTAMPTZ;

-- ── TEST SESSIONS — anti-cheat + face detection ────
ALTER TABLE test_sessions
  ADD COLUMN IF NOT EXISTS generated_questions JSONB DEFAULT '[]'::JSONB,
  ADD COLUMN IF NOT EXISTS question_ids TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS per_question_time INT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS integrity_log JSONB DEFAULT '[]'::JSONB,
  ADD COLUMN IF NOT EXISTS face_warning_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS no_face_duration_seconds INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS audio_violation_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS force_terminated BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS termination_reason TEXT,
  ADD COLUMN IF NOT EXISTS attempt_number INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS session_hash TEXT;

-- ── INTERVIEW SESSIONS — detailed sub-scores ───────
ALTER TABLE interview_sessions
  ADD COLUMN IF NOT EXISTS project_depth_score NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS academic_understanding_score NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS motivation_clarity_score NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS communication_score_v2 NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS problem_solving_score NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS grade TEXT,
  ADD COLUMN IF NOT EXISTS recommendation TEXT,
  ADD COLUMN IF NOT EXISTS key_strengths TEXT[],
  ADD COLUMN IF NOT EXISTS red_flags TEXT[],
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS admit_confidence NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS attempt_number INT DEFAULT 1;

-- ── APTITUDE TESTS — question pool ─────────────────
ALTER TABLE aptitude_tests
  ADD COLUMN IF NOT EXISTS question_pool JSONB DEFAULT '[]'::JSONB;

-- ── STATUS ENUM EXTENSIONS ─────────────────────────
-- New statuses used by attempt system:
-- 's2_attempt1_failed'      — failed attempt 1, retry allowed in 24h
-- 'rejected_s2_both_attempts' — failed both attempts
-- 's3_attempt1_failed'      — failed interview attempt 1, retry in 48h
-- 'rejected_s3_both_attempts' — failed both interview attempts
-- These are stored as text in the status column (already text type)

-- ── RLS: allow students to read their own retry timestamps ──
-- (Already covered by existing applications_student_read policy)

-- Verification: check columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'applications' 
  AND column_name IN ('s2_attempts','s3_attempts','s2_retry_available_at','s3_retry_available_at')
ORDER BY column_name;
