-- ════════════════════════════════════════════════
-- ARIA ADMISSIONS PLATFORM — SUPABASE SQL SCHEMA
-- Run this in the Supabase SQL Editor
-- ════════════════════════════════════════════════

-- Extensions
create extension if not exists "uuid-ossp";

-- ── UNIVERSITIES ─────────────────────────────────
create table if not exists universities (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique not null,
  logo_url text,
  settings jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- ── ADMINS ───────────────────────────────────────
create table if not exists admins (
  id uuid primary key references auth.users(id) on delete cascade,
  university_id uuid references universities(id),
  name text not null,
  email text not null unique,
  role text default 'admin',
  created_at timestamptz default now()
);

-- ── STUDENTS ─────────────────────────────────────
create table if not exists students (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text,
  phone text,
  city text,
  created_at timestamptz default now()
);

-- ── APPLICATIONS ─────────────────────────────────
create table if not exists applications (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid references students(id) on delete cascade not null,
  university_id uuid references universities(id) not null,
  branch text not null,
  stage integer default 1,
  status text default 'pending',
  form_data jsonb default '{}'::jsonb,
  eligibility_result jsonb default '{}'::jsonb,

  -- Stage 1 AI results
  ai_score numeric(5,2),
  ai_grade text,
  ai_feedback text,
  ai_strengths text[],
  ai_improvements text[],
  ai_academic_remark text,

  -- Admin
  admin_notes text,
  admin_decision text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── TEST SESSIONS ─────────────────────────────────
create table if not exists test_sessions (
  id uuid primary key default uuid_generate_v4(),
  application_id uuid references applications(id) on delete cascade,
  student_id uuid references students(id),
  answers jsonb default '{}'::jsonb,
  score numeric(5,2),
  correct integer,
  total integer,
  time_taken_seconds integer,
  tab_switches integer default 0,
  camera_denied boolean default false,
  ai_flag boolean default false,
  ai_flag_reason text,
  ai_probability numeric(4,2),
  status text default 'in_progress',
  started_at timestamptz default now(),
  completed_at timestamptz
);

-- ── INTERVIEW SESSIONS ────────────────────────────
create table if not exists interview_sessions (
  id uuid primary key default uuid_generate_v4(),
  application_id uuid references applications(id) on delete cascade,
  student_id uuid references students(id),
  messages jsonb default '[]'::jsonb,
  question_count integer default 0,
  final_score numeric(5,2),
  final_assessment text,
  communication_score numeric(5,2),
  depth_score numeric(5,2),
  enthusiasm_score numeric(5,2),
  ai_flags jsonb default '{}'::jsonb,
  status text default 'in_progress',
  started_at timestamptz default now(),
  completed_at timestamptz
);

-- ── APTITUDE TESTS ────────────────────────────────
create table if not exists aptitude_tests (
  id uuid primary key default uuid_generate_v4(),
  university_id uuid references universities(id),
  questions jsonb default '[]'::jsonb,
  time_limit_seconds integer default 900,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ════════════════════════════════════════════════
-- RLS POLICIES
-- ════════════════════════════════════════════════
alter table universities enable row level security;
alter table admins enable row level security;
alter table students enable row level security;
alter table applications enable row level security;
alter table test_sessions enable row level security;
alter table interview_sessions enable row level security;
alter table aptitude_tests enable row level security;

-- Universities: readable by all authenticated
create policy "universities_read" on universities for select to authenticated using (true);

-- Students: only own row
create policy "students_own_read" on students for select to authenticated using (auth.uid() = id);
create policy "students_own_insert" on students for insert to authenticated with check (auth.uid() = id);
create policy "students_own_update" on students for update to authenticated using (auth.uid() = id);

-- Admins: own row read + self-insert (for first-time setup) + upsert
create policy "admins_own_read" on admins for select to authenticated using (true);
create policy "admins_own_insert" on admins for insert to authenticated with check (auth.uid() = id);
create policy "admins_own_upsert" on admins for update to authenticated using (auth.uid() = id);

-- Admins can see all (service role) — students see own
create policy "applications_student_read" on applications for select to authenticated
  using (auth.uid() = student_id or auth.uid() in (select id from admins));
create policy "applications_student_insert" on applications for insert to authenticated
  with check (auth.uid() = student_id);
create policy "applications_student_update" on applications for update to authenticated
  using (auth.uid() = student_id or auth.uid() in (select id from admins));

-- Test sessions
create policy "test_sessions_read" on test_sessions for select to authenticated
  using (auth.uid() = student_id or auth.uid() in (select id from admins));
create policy "test_sessions_insert" on test_sessions for insert to authenticated
  with check (auth.uid() = student_id);
create policy "test_sessions_update" on test_sessions for update to authenticated
  using (auth.uid() = student_id or auth.uid() in (select id from admins));

-- Interview sessions
create policy "interview_sessions_read" on interview_sessions for select to authenticated
  using (auth.uid() = student_id or auth.uid() in (select id from admins));
create policy "interview_sessions_insert" on interview_sessions for insert to authenticated
  with check (auth.uid() = student_id);
create policy "interview_sessions_update" on interview_sessions for update to authenticated
  using (auth.uid() = student_id or auth.uid() in (select id from admins));

-- Aptitude tests: public read
create policy "aptitude_tests_read" on aptitude_tests for select to authenticated using (true);
create policy "aptitude_tests_admin_write" on aptitude_tests for all to authenticated
  using (auth.uid() in (select id from admins));

-- ════════════════════════════════════════════════
-- SEED DATA — DDS UNIVERSITY
-- ════════════════════════════════════════════════
insert into universities (name, slug) values
  ('DDS University for Engineering', 'dds-university')
on conflict (slug) do nothing;

-- ── SEED ADMIN (create user in Supabase Auth first, then run this) ──
-- After creating user admin@dds.edu with password DDSAdmin2025 in Auth:
-- insert into admins (id, university_id, name, email)
-- select '<<PASTE-USER-ID-HERE>>', id, 'DDS Admin', 'admin@dds.edu'
-- from universities where slug = 'dds-university';

-- ════════════════════════════════════════════════
-- SEED APTITUDE TEST — 15 Questions
-- ════════════════════════════════════════════════
insert into aptitude_tests (university_id, questions, time_limit_seconds, is_active)
select
  u.id,
  '[
    {
      "id": "m1", "subject": "Maths", "difficulty": "medium",
      "question": "If f(x) = x² + 2x + 1, what is f(3)?",
      "options": ["14", "16", "10", "12"],
      "correct": 1
    },
    {
      "id": "m2", "subject": "Maths", "difficulty": "hard",
      "question": "What is the value of ∫₀¹ x² dx?",
      "options": ["1/2", "1/3", "2/3", "1/4"],
      "correct": 1
    },
    {
      "id": "m3", "subject": "Maths", "difficulty": "easy",
      "question": "If sin θ = 3/5, what is cos θ?",
      "options": ["4/5", "3/4", "5/4", "1/5"],
      "correct": 0
    },
    {
      "id": "m4", "subject": "Maths", "difficulty": "medium",
      "question": "How many ways can 5 students be arranged in a row?",
      "options": ["60", "100", "120", "150"],
      "correct": 2
    },
    {
      "id": "m5", "subject": "Maths", "difficulty": "medium",
      "question": "The roots of x² − 5x + 6 = 0 are:",
      "options": ["2 and 3", "1 and 6", "−2 and −3", "3 and 4"],
      "correct": 0
    },
    {
      "id": "m6", "subject": "Maths", "difficulty": "hard",
      "question": "If A is a 2×2 matrix with det(A) = 4, what is det(2A)?",
      "options": ["8", "16", "4", "32"],
      "correct": 1
    },
    {
      "id": "m7", "subject": "Maths", "difficulty": "medium",
      "question": "What is the sum of the first 20 natural numbers?",
      "options": ["190", "200", "210", "220"],
      "correct": 2
    },
    {
      "id": "p1", "subject": "Physics", "difficulty": "medium",
      "question": "An object moves with velocity v = 3t² + 2t. What is its acceleration at t = 2?",
      "options": ["10 m/s²", "14 m/s²", "16 m/s²", "12 m/s²"],
      "correct": 1
    },
    {
      "id": "p2", "subject": "Physics", "difficulty": "easy",
      "question": "Which law states that Force = Mass × Acceleration?",
      "options": ["Newton''s First Law", "Newton''s Second Law", "Newton''s Third Law", "Hooke''s Law"],
      "correct": 1
    },
    {
      "id": "p3", "subject": "Physics", "difficulty": "medium",
      "question": "If a wire of resistance R is stretched to double its length, what is its new resistance?",
      "options": ["R", "2R", "4R", "R/4"],
      "correct": 2
    },
    {
      "id": "p4", "subject": "Physics", "difficulty": "hard",
      "question": "A photon has energy E = hν. If frequency doubles, the energy becomes:",
      "options": ["E", "2E", "E/2", "4E"],
      "correct": 1
    },
    {
      "id": "p5", "subject": "Physics", "difficulty": "medium",
      "question": "The efficiency of a Carnot engine working between 300 K and 600 K is:",
      "options": ["25%", "50%", "75%", "100%"],
      "correct": 1
    },
    {
      "id": "c1", "subject": "Chemistry", "difficulty": "easy",
      "question": "What is the oxidation number of sulphur in H₂SO₄?",
      "options": ["+4", "+6", "−2", "+2"],
      "correct": 1
    },
    {
      "id": "c2", "subject": "Chemistry", "difficulty": "medium",
      "question": "Which type of isomerism is shown by C₂H₅OH and CH₃OCH₃?",
      "options": ["Chain isomerism", "Position isomerism", "Functional group isomerism", "Stereoisomerism"],
      "correct": 2
    },
    {
      "id": "c3", "subject": "Chemistry", "difficulty": "hard",
      "question": "The pH of a 0.001 M HCl solution is:",
      "options": ["1", "2", "3", "4"],
      "correct": 2
    }
  ]'::jsonb,
  900,
  true
from universities u
where u.slug = 'dds-university'
on conflict do nothing;
