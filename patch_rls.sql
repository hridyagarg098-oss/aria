-- ════════════════════════════════════════════════
-- ARIA — PATCH: Run this in Supabase SQL Editor
-- Fixes auth policies for email/password login
-- and admin self-registration setup flow
-- ════════════════════════════════════════════════

-- Drop old admin read-only policy if it exists
drop policy if exists "admins_own_read" on admins;

-- Allow any authenticated user to read admins table (needed to check if logged-in user is admin)
create policy "admins_read_all" on admins
  for select to authenticated using (true);

-- Allow a user to insert their own admin record (first-time setup)
create policy "admins_self_insert" on admins
  for insert to authenticated with check (auth.uid() = id);

-- Allow admin to update their own record
create policy "admins_self_update" on admins
  for update to authenticated using (auth.uid() = id);

-- ── ALSO: Disable email confirmation so students can log in immediately ──
-- In Supabase Dashboard → Authentication → Settings → Email → 
-- turn OFF "Enable email confirmations"
-- (This is a UI setting, not SQL)
