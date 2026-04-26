-- ════════════════════════════════════════════════
-- ARIA PLATFORM v2 — RUN AFTER schema.sql
-- Supabase SQL Editor → paste and run
-- ════════════════════════════════════════════════

-- ── APPLICATIONS — attempt tracking ──────────────
alter table applications
  add column if not exists s2_attempts int default 0,
  add column if not exists s3_attempts int default 0,
  add column if not exists s2_best_score float,
  add column if not exists s3_best_score float,
  add column if not exists s2_attempt1_session_id uuid,
  add column if not exists s2_attempt2_session_id uuid,
  add column if not exists s3_attempt1_session_id uuid,
  add column if not exists s3_attempt2_session_id uuid,
  add column if not exists s2_retry_available_at timestamptz,
  add column if not exists s3_retry_available_at timestamptz;

-- ── TEST SESSIONS — anti-cheat + attempt tracking ─
alter table test_sessions
  add column if not exists generated_questions jsonb default '[]'::jsonb,
  add column if not exists question_ids text[] default '{}',
  add column if not exists per_question_time int[] default '{}',
  add column if not exists integrity_log jsonb default '[]'::jsonb,
  add column if not exists face_warning_count int default 0,
  add column if not exists no_face_duration_seconds int default 0,
  add column if not exists audio_violation_count int default 0,
  add column if not exists force_terminated boolean default false,
  add column if not exists termination_reason text,
  add column if not exists attempt_number int default 1;

-- ── INTERVIEW SESSIONS — detailed scoring ─────────
alter table interview_sessions
  add column if not exists project_depth_score numeric(5,2),
  add column if not exists academic_understanding_score numeric(5,2),
  add column if not exists motivation_clarity_score numeric(5,2),
  add column if not exists communication_score_v2 numeric(5,2),
  add column if not exists problem_solving_score numeric(5,2),
  add column if not exists grade text,
  add column if not exists recommendation text,
  add column if not exists key_strengths text[],
  add column if not exists red_flags text[],
  add column if not exists summary text,
  add column if not exists admit_confidence numeric(5,2);

-- ── APTITUDE TESTS — question pool column ─────────
alter table aptitude_tests
  add column if not exists question_pool jsonb default '[]'::jsonb;
