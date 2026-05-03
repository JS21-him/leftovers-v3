-- ============================================================
-- Leftovers v3 — Initial Schema
-- Supports all 7 phases. Deploy once, never break.
-- ============================================================

-- ── households ──────────────────────────────────────────────
create table households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  invite_code text unique not null default substr(md5(random()::text), 1, 8),
  created_by  uuid not null,
  created_at  timestamptz not null default now()
);

-- ── profiles ────────────────────────────────────────────────
-- Created automatically via trigger on auth.users insert
create table profiles (
  id           uuid primary key references auth.users on delete cascade,
  display_name text,
  household_id uuid references households(id) on delete set null,
  created_at   timestamptz not null default now()
);

-- Add FK from households.created_by → profiles now that profiles exists
alter table households
  add constraint households_created_by_fkey
  foreign key (created_by) references profiles(id) on delete cascade;

-- ── fridge_items ─────────────────────────────────────────────
create table fridge_items (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  added_by     uuid not null references profiles(id) on delete cascade,
  name         text not null,
  quantity     text not null default '1',
  expiry_date  date,
  barcode      text,
  category     text,
  created_at   timestamptz not null default now()
);

-- ── staples ──────────────────────────────────────────────────
create table staples (
  id               uuid primary key default gen_random_uuid(),
  household_id     uuid not null references households(id) on delete cascade,
  name             text not null,
  default_quantity text not null default '1',
  reorder_when_low boolean not null default true,
  created_at       timestamptz not null default now()
);

-- ── shopping_list_items ───────────────────────────────────────
create table shopping_list_items (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  added_by     uuid not null references profiles(id) on delete cascade,
  name         text not null,
  quantity     text not null default '1',
  is_bought    boolean not null default false,
  is_staple    boolean not null default false,
  created_at   timestamptz not null default now()
);

-- ── saved_recipes ─────────────────────────────────────────────
create table saved_recipes (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  title        text not null,
  ingredients  jsonb not null default '[]',
  instructions text not null default '',
  created_at   timestamptz not null default now()
);

-- ── reorder_history ───────────────────────────────────────────
create table reorder_history (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  item_name    text not null,
  reordered_at timestamptz not null default now()
);

-- ============================================================
-- Trigger: auto-create profile on auth.users insert
-- ============================================================
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ============================================================
-- Row Level Security
-- ============================================================

alter table profiles             enable row level security;
alter table households           enable row level security;
alter table fridge_items         enable row level security;
alter table staples              enable row level security;
alter table shopping_list_items  enable row level security;
alter table saved_recipes        enable row level security;
alter table reorder_history      enable row level security;

-- profiles: users can read/update their own row only
create policy "profiles: own row" on profiles
  for all using (auth.uid() = id);

-- helper: returns the household_id for the current user
create or replace function my_household_id()
returns uuid
language sql stable security definer
as $$
  select household_id from profiles where id = auth.uid();
$$;

-- households: members of the household can read; creator can update/delete
create policy "households: members read" on households
  for select using (id = my_household_id());

create policy "households: creator write" on households
  for all using (created_by = auth.uid());

-- fridge_items: household members only
create policy "fridge_items: household" on fridge_items
  for all using (household_id = my_household_id());

-- staples: household members only
create policy "staples: household" on staples
  for all using (household_id = my_household_id());

-- shopping_list_items: household members only
create policy "shopping_list_items: household" on shopping_list_items
  for all using (household_id = my_household_id());

-- saved_recipes: household members only
create policy "saved_recipes: household" on saved_recipes
  for all using (household_id = my_household_id());

-- reorder_history: household members only
create policy "reorder_history: household" on reorder_history
  for all using (household_id = my_household_id());
