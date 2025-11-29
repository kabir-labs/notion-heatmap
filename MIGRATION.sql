create extension if not exists pgcrypto;
create table if not exists habits (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('number','checkbox')),
  unit text default '',
  color_hex text default '#35c27a',
  "order" integer default 0,
  streak_days text[] default array['Mon','Tue','Wed','Thu','Fri','Sat','Sun']::text[],
  created_at timestamptz default now()
);
create table if not exists logs (
  id bigserial primary key,
  habit_id uuid not null references habits(id) on delete cascade,
  d date not null,
  value numeric not null default 0,
  unique (habit_id, d)
);
create table if not exists embeds (
  id bigserial primary key,
  habit_id uuid not null references habits(id) on delete cascade,
  token text not null unique,
  can_write boolean default true,
  dark boolean default true,
  created_at timestamptz default now()
);
create index if not exists idx_logs_habit_day on logs(habit_id, d);
