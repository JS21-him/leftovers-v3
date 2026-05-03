-- Update handle_new_user to also create a personal household
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  new_household_id uuid;
  display_name_val text;
begin
  display_name_val := coalesce(
    new.raw_user_meta_data->>'display_name',
    split_part(new.email, '@', 1)
  );

  -- 1. Create profile first (household_id NULL for now — avoids circular FK)
  insert into public.profiles (id, display_name)
  values (new.id, display_name_val);

  -- 2. Create personal household (profile now exists to satisfy created_by FK)
  insert into public.households (name, created_by)
  values (display_name_val || '''s Kitchen', new.id)
  returning id into new_household_id;

  -- 3. Link profile to household
  update public.profiles
  set household_id = new_household_id
  where id = new.id;

  return new;
end;
$$;
