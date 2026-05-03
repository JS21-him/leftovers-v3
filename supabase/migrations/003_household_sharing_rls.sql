-- supabase/migrations/003_household_sharing_rls.sql

-- Allow household members to read each other's profiles (needed for member list)
create policy "profiles: household members read"
  on profiles for select
  using (household_id = my_household_id());

-- Secure RPC: look up household id by invite code without exposing all households
create or replace function get_household_id_by_code(code text)
returns uuid
language sql security definer stable set search_path = public
as $$
  select id from households where invite_code = lower(trim(code)) limit 1;
$$;
