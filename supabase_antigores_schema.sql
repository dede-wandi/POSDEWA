create extension if not exists pgcrypto;

create table if not exists public.ag_simple (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  brand text not null,
  termasuk text not null default '',
  ukuran_layar text not null default '',
  stock integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists ag_simple_set_updated_at on public.ag_simple;
create trigger ag_simple_set_updated_at
before update on public.ag_simple
for each row execute function public.set_updated_at();

create index if not exists ag_simple_owner_idx on public.ag_simple(owner_id);
create index if not exists ag_simple_brand_idx on public.ag_simple(brand);

alter table public.ag_simple enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ag_simple' and policyname='ag_simple_select_own') then
    create policy ag_simple_select_own on public.ag_simple for select using (auth.uid() = owner_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ag_simple' and policyname='ag_simple_mod_own') then
    create policy ag_simple_mod_own on public.ag_simple for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
  end if;
end $$;

alter table public.ag_simple
  add column if not exists ukuran_layar text not null default '';
