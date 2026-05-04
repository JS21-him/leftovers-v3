-- supabase/migrations/004_dietary_preferences.sql
alter table households
  add column dietary_restrictions text[] not null default '{}';
