-- ═══════════════════════════════════════════════════════════
-- RUN THIS IN SUPABASE SQL EDITOR
-- https://supabase.com/dashboard/project/arlxnjafyospxjbjkpey/sql/new
-- ═══════════════════════════════════════════════════════════

-- STEP 1: Confirm ALL existing auth users (no email needed)
update auth.users
set email_confirmed_at = now(),
    updated_at = now()
where email_confirmed_at is null;

-- STEP 2: Create/update admin account with confirmed email
do $$
declare
  v_user_id uuid;
  v_uni_id uuid;
begin
  -- Get university
  select id into v_uni_id from universities where slug = 'dds-university' limit 1;
  
  -- Check if admin user exists
  select id into v_user_id 
  from auth.users 
  where email = 'hridyagarg69@gmail.com' 
  limit 1;
  
  if v_user_id is null then
    -- Create new user (email pre-confirmed, no email sent)
    insert into auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      aud,
      role,
      created_at,
      updated_at,
      last_sign_in_at
    ) values (
      gen_random_uuid(),
      '00000000-0000-0000-0000-000000000000',
      'hridyagarg69@gmail.com',
      crypt('hridyaG78', gen_salt('bf')),
      now(),
      '',
      '',
      '',
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"DDS Admin"}',
      false,
      'authenticated',
      'authenticated',
      now(),
      now(),
      now()
    )
    returning id into v_user_id;
    
    raise notice 'Created admin auth user: %', v_user_id;
  else
    -- Update password and confirm email
    update auth.users set
      encrypted_password = crypt('hridyaG78', gen_salt('bf')),
      email_confirmed_at = now(),
      updated_at = now()
    where id = v_user_id;
    
    raise notice 'Updated existing user: %', v_user_id;
  end if;
  
  -- Create/update admin record
  if v_uni_id is not null then
    insert into admins (id, university_id, name, email, role)
    values (v_user_id, v_uni_id, 'DDS Admin', 'hridyagarg69@gmail.com', 'admin')
    on conflict (id) do update set
      name = 'DDS Admin',
      email = 'hridyagarg69@gmail.com',
      university_id = v_uni_id;
    raise notice 'Admin record ready!';
  else
    raise notice 'WARNING: University not found. Run schema.sql first.';
  end if;

end $$;

-- STEP 3: Disable email confirmation for future signups
-- (no SQL needed - do this in dashboard: Auth → Providers → Email → "Confirm email" OFF)

-- STEP 4: Verify everything worked
select 
  au.email,
  au.email_confirmed_at is not null as "email_confirmed",
  au.created_at,
  a.name as "admin_name",
  a.role,
  u.name as "university"
from auth.users au
left join admins a on a.id = au.id
left join universities u on u.id = a.university_id
where au.email = 'hridyagarg69@gmail.com';
