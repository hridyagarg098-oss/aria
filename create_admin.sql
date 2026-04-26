-- ════════════════════════════════════════════════
-- ARIA — CREATE ADMIN USER (Run in Supabase SQL Editor)
-- This bypasses the email rate limit completely
-- ════════════════════════════════════════════════

-- Step 1: Create the auth user directly (bypasses email sending)
do $$
declare
  user_id uuid;
  uni_id uuid;
begin
  -- Get university ID
  select id into uni_id from universities where slug = 'dds-university';
  
  -- Check if user already exists
  select id into user_id from auth.users where email = 'hridyagarg69@gmail.com';
  
  if user_id is null then
    -- Create user with confirmed email (no email confirmation needed)
    insert into auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      aud,
      role,
      created_at,
      updated_at
    ) values (
      gen_random_uuid(),
      '00000000-0000-0000-0000-000000000000',
      'hridyagarg69@gmail.com',
      crypt('hridyaG78', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"DDS Admin"}',
      'authenticated',
      'authenticated',
      now(),
      now()
    )
    returning id into user_id;

    raise notice 'Created new auth user: %', user_id;
  else
    -- Update password for existing user
    update auth.users
    set 
      encrypted_password = crypt('hridyaG78', gen_salt('bf')),
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      updated_at = now()
    where id = user_id;

    raise notice 'Updated existing auth user: %', user_id;
  end if;

  -- Step 2: Insert or update admin record
  if uni_id is not null then
    insert into admins (id, university_id, name, email, role)
    values (user_id, uni_id, 'DDS Admin', 'hridyagarg69@gmail.com', 'admin')
    on conflict (id) do update
      set name = 'DDS Admin',
          email = 'hridyagarg69@gmail.com',
          university_id = uni_id;

    raise notice 'Admin record created/updated for user: %', user_id;
  else
    raise exception 'University dds-university not found. Run schema.sql first.';
  end if;

end $$;

-- Verify it worked
select 
  a.id,
  a.name,
  a.email,
  a.role,
  u.name as university,
  au.email_confirmed_at is not null as email_confirmed
from admins a
join universities u on u.id = a.university_id
join auth.users au on au.id = a.id
where a.email = 'hridyagarg69@gmail.com';
