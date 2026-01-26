-- Create categories table
create table if not exists public.categories (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  owner_id uuid references auth.users not null,
  name text not null,
  description text
);

-- Create brands table
create table if not exists public.brands (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  owner_id uuid references auth.users not null,
  name text not null,
  description text
);

-- Add foreign keys to products table
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'products' and column_name = 'category_id') then
    alter table public.products add column category_id uuid references public.categories(id);
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'products' and column_name = 'brand_id') then
    alter table public.products add column brand_id uuid references public.brands(id);
  end if;
end $$;

-- Enable RLS
alter table public.categories enable row level security;
alter table public.brands enable row level security;

-- Create policies
create policy "Users can view their own categories" on public.categories
  for select using (auth.uid() = owner_id);

create policy "Users can insert their own categories" on public.categories
  for insert with check (auth.uid() = owner_id);

create policy "Users can update their own categories" on public.categories
  for update using (auth.uid() = owner_id);

create policy "Users can delete their own categories" on public.categories
  for delete using (auth.uid() = owner_id);

create policy "Users can view their own brands" on public.brands
  for select using (auth.uid() = owner_id);

create policy "Users can insert their own brands" on public.brands
  for insert with check (auth.uid() = owner_id);

create policy "Users can update their own brands" on public.brands
  for update using (auth.uid() = owner_id);

create policy "Users can delete their own brands" on public.brands
  for delete using (auth.uid() = owner_id);
