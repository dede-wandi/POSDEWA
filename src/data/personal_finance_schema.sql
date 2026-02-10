-- Tabel Akun/Rekening Pribadi (Terpisah dari Toko)
create table if not exists personal_accounts (
  id uuid default gen_random_uuid() primary key,
  owner_id uuid references auth.users not null,
  name text not null, -- e.g., 'BCA Pribadi', 'Dompet', 'Tabungan'
  type text check (type in ('cash', 'digital', 'bank')),
  balance numeric default 0,
  description text,
  is_active boolean default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable RLS for accounts
alter table personal_accounts enable row level security;

create policy "Users can manage their own personal accounts"
  on personal_accounts for all
  using (auth.uid() = owner_id);

-- Tabel Transaksi Keuangan Pribadi
create table if not exists personal_transactions (
  id uuid default gen_random_uuid() primary key,
  owner_id uuid references auth.users not null,
  account_id uuid references personal_accounts(id) on delete set null,
  type text not null check (type in ('income', 'expense')),
  amount numeric not null,
  category text, -- e.g., 'Gaji', 'Makan', 'Transport', 'Investasi'
  description text,
  transaction_date timestamp with time zone default now(),
  created_at timestamp with time zone default now()
);

-- Enable RLS for transactions
alter table personal_transactions enable row level security;

create policy "Users can manage their own personal transactions"
  on personal_transactions for all
  using (auth.uid() = owner_id);
