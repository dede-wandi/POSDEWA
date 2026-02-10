-- Tabel Transaksi Keuangan (Uang Masuk/Keluar)
create table if not exists finance_transactions (
  id uuid default gen_random_uuid() primary key,
  owner_id uuid references auth.users not null, -- Changed from user_id to owner_id to match code conventions
  channel_id uuid references payment_channels(id) on delete set null,
  type text not null check (type in ('income', 'expense')),
  amount numeric not null,
  category text, -- e.g., 'Penjualan', 'Gaji', 'Listrik', 'Lainnya'
  description text,
  transaction_date timestamp with time zone default now(),
  created_at timestamp with time zone default now()
);

-- Enable RLS
alter table finance_transactions enable row level security;

-- Policies
create policy "Users can view their own transactions"
  on finance_transactions for select
  using (auth.uid() = owner_id);

create policy "Users can insert their own transactions"
  on finance_transactions for insert
  with check (auth.uid() = owner_id);

create policy "Users can update their own transactions"
  on finance_transactions for update
  using (auth.uid() = owner_id);

create policy "Users can delete their own transactions"
  on finance_transactions for delete
  using (auth.uid() = owner_id);
