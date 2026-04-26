-- ARIA v4 — run after v3
ALTER TABLE test_sessions ADD COLUMN IF NOT EXISTS session_hash TEXT;
