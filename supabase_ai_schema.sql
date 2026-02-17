create extension if not exists pgcrypto;

create table if not exists public.ai_interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  created_at timestamptz not null default now(),
  query text not null,
  response text,
  intent text,
  context text,
  model text,
  status text check (status in ('answered','unknown','error')) default 'answered'
);

create index if not exists ai_interactions_user_id_idx on public.ai_interactions (user_id, created_at desc);

alter table public.ai_interactions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'ai_interactions' and policyname = 'ai_interactions_select_own'
  ) then
    create policy ai_interactions_select_own on public.ai_interactions
      for select using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'ai_interactions' and policyname = 'ai_interactions_insert_own'
  ) then
    create policy ai_interactions_insert_own on public.ai_interactions
      for insert with check (auth.uid() = user_id);
  end if;
end $$;

create table if not exists public.ai_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  content text not null,
  tags text[] null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_memory_user_id_idx on public.ai_memory (user_id, created_at desc);

alter table public.ai_memory enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'ai_memory' and policyname = 'ai_memory_select_own'
  ) then
    create policy ai_memory_select_own on public.ai_memory
      for select using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'ai_memory' and policyname = 'ai_memory_insert_own'
  ) then
    create policy ai_memory_insert_own on public.ai_memory
      for insert with check (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'ai_memory' and policyname = 'ai_memory_update_own'
  ) then
    create policy ai_memory_update_own on public.ai_memory
      for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'ai_memory' and policyname = 'ai_memory_delete_own'
  ) then
    create policy ai_memory_delete_own on public.ai_memory
      for delete using (auth.uid() = user_id);
  end if;
end $$;
