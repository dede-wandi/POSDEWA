-- SQL for creating/updating custom_invoices table
-- Run this in your Supabase SQL Editor

-- 1. Create table if it doesn't exist
create table if not exists public.custom_invoices (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  customer_name text,
  items jsonb default '[]'::jsonb,
  total_amount numeric default 0,
  header_content text,
  footer_content text,
  paper_size text default '58mm',
  show_logo boolean default true,
  details jsonb default '[]'::jsonb, -- New column for key-value details (e.g. Bank Info)
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid references auth.users(id)
);

-- 2. If table exists but missing 'details' column, add it
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'custom_invoices' and column_name = 'details') then
    alter table public.custom_invoices add column details jsonb default '[]'::jsonb;
  end if;
end $$;

-- 3. Enable RLS
alter table public.custom_invoices enable row level security;

-- 4. Create policies (if not exist)
create policy "Users can view their own custom invoices"
  on public.custom_invoices for select
  using (auth.uid() = user_id);

create policy "Users can insert their own custom invoices"
  on public.custom_invoices for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own custom invoices"
  on public.custom_invoices for update
  using (auth.uid() = user_id);

create policy "Users can delete their own custom invoices"
  on public.custom_invoices for delete
  using (auth.uid() = user_id);
