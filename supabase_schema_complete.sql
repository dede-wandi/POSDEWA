-- ==============================================================================
-- MASTER DATABASE SCHEMA POS DEWA (SUPABASE POSTGRESQL)
-- ==============================================================================
-- Script ini berisi pembuatan seluruh tabel, indeks, trigger, RLS policies,
-- dan fungsi RPC yang dibutuhkan oleh aplikasi POS DEWA.
-- 
-- CARA PENGGUNAAN:
-- 1. Buka Supabase Dashboard (https://supabase.com/dashboard)
-- 2. Pilih Project Anda -> Masuk ke menu "SQL Editor"
-- 3. Buat "New Query", paste seluruh isi file ini, lalu klik "Run"
-- ==============================================================================

-- 0. AKTIFKAN EKSTENSI
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- FUNGSI GLOBAL UTILITY
-- ==============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- 1. MASTER KATEGORI & BRAND PRODUK
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.brands (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_categories_owner ON public.categories(owner_id);
CREATE INDEX IF NOT EXISTS idx_brands_owner ON public.brands(owner_id);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "categories_owner_policy" ON public.categories FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "brands_owner_policy" ON public.brands FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ==============================================================================
-- 2. TABEL PRODUK & RIWAYAT PERUBAHAN (PRODUCTS, STOCK & CHANGE LOG)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  barcode TEXT,
  price NUMERIC(20,2) NOT NULL DEFAULT 0,
  cost_price NUMERIC(20,2) NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  variants JSONB DEFAULT '[]'::jsonb,
  image_urls TEXT[] DEFAULT '{}',
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL,
  product_type TEXT DEFAULT 'physical', -- 'physical', 'unlimited', 'consignment', 'voucher'
  consignor_name TEXT,
  last_change_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_owner_id ON public.products(owner_id);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_name ON public.products(name);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "products_owner_policy" ON public.products FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DROP TRIGGER IF EXISTS update_products_updated_at ON public.products;
CREATE TRIGGER update_products_updated_at 
  BEFORE UPDATE ON public.products 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Riwayat Stok Produk (Stock History)
CREATE TABLE IF NOT EXISTS public.stock_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('addition', 'reduction', 'adjustment')),
  quantity INTEGER NOT NULL,
  previous_stock INTEGER NOT NULL DEFAULT 0,
  new_stock INTEGER NOT NULL DEFAULT 0,
  reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_history_product_id ON public.stock_history(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_history_user_id ON public.stock_history(user_id);
CREATE INDEX IF NOT EXISTS idx_stock_history_created_at ON public.stock_history(created_at);

ALTER TABLE public.stock_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "stock_history_select_policy" ON public.stock_history FOR SELECT USING (
    user_id = auth.uid() OR product_id IN (SELECT id FROM public.products WHERE owner_id = auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "stock_history_insert_policy" ON public.stock_history FOR INSERT WITH CHECK (
    user_id = auth.uid() OR product_id IN (SELECT id FROM public.products WHERE owner_id = auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Trigger Log Perubahan Stok Otomatis
CREATE OR REPLACE FUNCTION log_stock_change()
RETURNS TRIGGER AS $$
DECLARE
  change_type TEXT;
  change_reason TEXT;
BEGIN
  IF OLD.stock != NEW.stock THEN
    IF NEW.stock > OLD.stock THEN
      change_type := 'addition';
    ELSIF NEW.stock < OLD.stock THEN
      change_type := 'reduction';
    ELSE
      change_type := 'adjustment';
    END IF;

    IF NEW.last_change_reason IS NOT NULL AND NEW.last_change_reason != '' THEN
       change_reason := NEW.last_change_reason;
    ELSE
       IF NEW.stock > OLD.stock THEN
          change_reason := 'Penambahan stock';
       ELSE
          change_reason := 'Penyesuaian stock'; 
       END IF;
    END IF;

    INSERT INTO public.stock_history (
      product_id,
      user_id,
      type,
      quantity,
      previous_stock,
      new_stock,
      reason
    ) VALUES (
      NEW.id,
      NEW.owner_id,
      change_type,
      ABS(NEW.stock - OLD.stock),
      OLD.stock,
      NEW.stock,
      change_reason
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_log_stock_change ON public.products;
CREATE TRIGGER trg_log_stock_change
  AFTER UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION log_stock_change();

-- Log Audit Lengkap Perubahan Produk (Product Change Log)
CREATE TABLE IF NOT EXISTS public.product_change_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  change_reason TEXT DEFAULT 'edit_manual',
  note TEXT,
  changed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_product_change_log_product_id ON public.product_change_log(product_id);
CREATE INDEX IF NOT EXISTS idx_product_change_log_owner_id ON public.product_change_log(owner_id);
CREATE INDEX IF NOT EXISTS idx_product_change_log_changed_at ON public.product_change_log(changed_at DESC);

ALTER TABLE public.product_change_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "product_change_log_all_own" ON public.product_change_log FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Trigger Audit Perubahan Produk
CREATE OR REPLACE FUNCTION public.fn_log_product_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.name IS DISTINCT FROM NEW.name THEN
    INSERT INTO public.product_change_log (product_id, owner_id, field_name, old_value, new_value, change_reason)
    VALUES (NEW.id, NEW.owner_id, 'name', OLD.name::TEXT, NEW.name::TEXT, 'edit_manual');
  END IF;

  IF OLD.price IS DISTINCT FROM NEW.price THEN
    INSERT INTO public.product_change_log (product_id, owner_id, field_name, old_value, new_value, change_reason)
    VALUES (NEW.id, NEW.owner_id, 'price', OLD.price::TEXT, NEW.price::TEXT, 'edit_manual');
  END IF;

  IF OLD.cost_price IS DISTINCT FROM NEW.cost_price THEN
    INSERT INTO public.product_change_log (product_id, owner_id, field_name, old_value, new_value, change_reason)
    VALUES (NEW.id, NEW.owner_id, 'cost_price', OLD.cost_price::TEXT, NEW.cost_price::TEXT, 'edit_manual');
  END IF;

  IF OLD.stock IS DISTINCT FROM NEW.stock THEN
    INSERT INTO public.product_change_log (product_id, owner_id, field_name, old_value, new_value, change_reason)
    VALUES (NEW.id, NEW.owner_id, 'stock', OLD.stock::TEXT, NEW.stock::TEXT, COALESCE(NEW.last_change_reason, 'edit_manual'));
  END IF;

  IF OLD.barcode IS DISTINCT FROM NEW.barcode THEN
    INSERT INTO public.product_change_log (product_id, owner_id, field_name, old_value, new_value, change_reason)
    VALUES (NEW.id, NEW.owner_id, 'barcode', OLD.barcode::TEXT, NEW.barcode::TEXT, 'edit_manual');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_log_product_changes ON public.products;
CREATE TRIGGER trg_log_product_changes
  AFTER UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_log_product_changes();

-- ==============================================================================
-- 3. CHANNEL PEMBAYARAN & KEUANGAN TOKO
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.payment_channels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'digital', -- 'cash', 'digital', 'bank'
  balance DECIMAL(20,2) NOT NULL DEFAULT 0.00,
  initial_balance DECIMAL(20,2) NOT NULL DEFAULT 0.00,
  is_active BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_channels_owner ON public.payment_channels(owner_id);
ALTER TABLE public.payment_channels ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "payment_channels_owner_policy" ON public.payment_channels FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Riwayat Transaksi Keuangan Toko (Pengeluaran & Pemasukan)
CREATE TABLE IF NOT EXISTS public.finance_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id UUID REFERENCES public.payment_channels(id) ON DELETE SET NULL,
  payment_channel_id UUID REFERENCES public.payment_channels(id) ON DELETE SET NULL,
  type VARCHAR(50) NOT NULL, -- 'income', 'expense', 'transfer', 'adjustment'
  amount DECIMAL(20,2) NOT NULL,
  previous_balance DECIMAL(20,2) DEFAULT 0,
  new_balance DECIMAL(20,2) DEFAULT 0,
  category TEXT,
  description TEXT NOT NULL,
  source TEXT DEFAULT 'cash',
  reference_type VARCHAR(50), -- 'sale', 'manual', 'initial'
  reference_id UUID,
  transaction_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finance_transactions_owner ON public.finance_transactions(owner_id);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_date ON public.finance_transactions(created_at);
ALTER TABLE public.finance_transactions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "finance_transactions_owner_policy" ON public.finance_transactions FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ==============================================================================
-- 4. MANAJEMEN DOMPET DIGITAL & KAS (WALLETS, TRANSACTIONS & MUTATIONS)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.wallets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'CASH', -- 'CASH', 'BANK', 'APP_BALANCE', 'PROFIT', 'SUPPLIER'
  balance NUMERIC(20,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallets_user ON public.wallets(user_id);
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "wallets_user_policy" ON public.wallets FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Mutasi Antar Dompet
CREATE TABLE IF NOT EXISTS public.wallet_mutations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  from_wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  to_wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  amount NUMERIC(20,2) NOT NULL,
  admin_fee NUMERIC(20,2) DEFAULT 0,
  description TEXT DEFAULT 'Pindah Saldo',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.wallet_mutations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "wallet_mutations_policy" ON public.wallet_mutations FOR ALL USING (
    EXISTS (SELECT 1 FROM public.wallets WHERE wallets.id = wallet_mutations.from_wallet_id AND wallets.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.wallets WHERE wallets.id = wallet_mutations.from_wallet_id AND wallets.user_id = auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Transaksi Buku Besar Dompet (Ledger)
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('IN', 'OUT')),
  amount NUMERIC(20,2) NOT NULL,
  balance_before NUMERIC(20,2),
  balance_after NUMERIC(20,2),
  reference_type TEXT DEFAULT 'ADJUSTMENT', -- 'SALE', 'PURCHASE', 'MUTATION', 'ADJUSTMENT'
  reference_id UUID,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet ON public.wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_ref ON public.wallet_transactions(reference_id);
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "wallet_transactions_policy" ON public.wallet_transactions FOR ALL USING (
    EXISTS (SELECT 1 FROM public.wallets WHERE wallets.id = wallet_transactions.wallet_id AND wallets.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.wallets WHERE wallets.id = wallet_transactions.wallet_id AND wallets.user_id = auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Trigger Otomatis Snapshot Saldo Sebelum & Sesudah pada Transaksi Dompet
CREATE OR REPLACE FUNCTION populate_wallet_transaction_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_curr_balance NUMERIC(20,2);
BEGIN
  SELECT COALESCE(balance, 0) INTO v_curr_balance 
  FROM public.wallets 
  WHERE id = NEW.wallet_id;

  IF v_curr_balance IS NULL THEN
    v_curr_balance := 0;
  END IF;

  IF NEW.balance_before IS NULL THEN
    NEW.balance_before := v_curr_balance;
  END IF;

  IF NEW.balance_after IS NULL THEN
    IF NEW.type = 'IN' THEN
      NEW.balance_after := NEW.balance_before + NEW.amount;
    ELSIF NEW.type = 'OUT' THEN
      NEW.balance_after := NEW.balance_before - NEW.amount;
    ELSE
      NEW.balance_after := NEW.balance_before;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_populate_wallet_transaction_balance ON public.wallet_transactions;
CREATE TRIGGER trg_populate_wallet_transaction_balance
  BEFORE INSERT ON public.wallet_transactions
  FOR EACH ROW
  EXECUTE FUNCTION populate_wallet_transaction_balance();

-- Trigger Sinkronisasi Saldo Otomatis pada Dompet (Auto Balance Sync)
CREATE OR REPLACE FUNCTION update_wallet_balance_from_transaction()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.type = 'IN' THEN
      UPDATE public.wallets SET balance = balance + NEW.amount, updated_at = NOW() WHERE id = NEW.wallet_id;
    ELSIF NEW.type = 'OUT' THEN
      UPDATE public.wallets SET balance = balance - NEW.amount, updated_at = NOW() WHERE id = NEW.wallet_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.type = 'IN' THEN
      UPDATE public.wallets SET balance = balance - OLD.amount, updated_at = NOW() WHERE id = OLD.wallet_id;
    ELSIF OLD.type = 'OUT' THEN
      UPDATE public.wallets SET balance = balance + OLD.amount, updated_at = NOW() WHERE id = OLD.wallet_id;
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.type = 'IN' THEN
      UPDATE public.wallets SET balance = balance - OLD.amount WHERE id = OLD.wallet_id;
    ELSIF OLD.type = 'OUT' THEN
      UPDATE public.wallets SET balance = balance + OLD.amount WHERE id = OLD.wallet_id;
    END IF;
    IF NEW.type = 'IN' THEN
      UPDATE public.wallets SET balance = balance + NEW.amount, updated_at = NOW() WHERE id = NEW.wallet_id;
    ELSIF NEW.type = 'OUT' THEN
      UPDATE public.wallets SET balance = balance - NEW.amount, updated_at = NOW() WHERE id = NEW.wallet_id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Hapus trigger lama (nama berbeda) agar saldo tidak terupdate dobel
DROP TRIGGER IF EXISTS trigger_update_wallet_balance ON public.wallet_transactions;
DROP TRIGGER IF EXISTS trg_update_wallet_balance ON public.wallet_transactions;
CREATE TRIGGER trg_update_wallet_balance
  AFTER INSERT OR UPDATE OR DELETE ON public.wallet_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_wallet_balance_from_transaction();

-- ==============================================================================
-- 5. TRANSAKSI PENJUALAN (SALES & SALE ITEMS)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.sales (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  no_invoice TEXT UNIQUE NOT NULL,
  total NUMERIC(20,2) NOT NULL DEFAULT 0,
  profit NUMERIC(20,2) NOT NULL DEFAULT 0,
  payment_method VARCHAR(50) DEFAULT 'cash',
  payment_channel_id UUID REFERENCES public.payment_channels(id) ON DELETE SET NULL,
  cash_amount NUMERIC(20,2) DEFAULT 0,
  change_amount NUMERIC(20,2) DEFAULT 0,
  customer_name TEXT,
  notes TEXT,
  is_profit_synced BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_user_id ON public.sales(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON public.sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_no_invoice ON public.sales(no_invoice);

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "sales_user_policy" ON public.sales FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Generator Nomor Faktur Otomatis
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
    counter INTEGER;
    invoice_date TEXT;
    invoice_number TEXT;
BEGIN
    invoice_date := TO_CHAR(NOW() AT TIME ZONE 'Asia/Jakarta', 'YYYYMMDD');
    
    SELECT COUNT(*) + 1 INTO counter
    FROM public.sales 
    WHERE DATE(created_at AT TIME ZONE 'Asia/Jakarta') = DATE(NOW() AT TIME ZONE 'Asia/Jakarta');
    
    invoice_number := 'INV-' || invoice_date || '-' || LPAD(counter::TEXT, 4, '0');
    RETURN invoice_number;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.no_invoice IS NULL OR NEW.no_invoice = '' THEN
        NEW.no_invoice := generate_invoice_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_invoice_number ON public.sales;
CREATE TRIGGER trigger_set_invoice_number
    BEFORE INSERT ON public.sales
    FOR EACH ROW
    EXECUTE FUNCTION set_invoice_number();

-- Detail Item Penjualan
CREATE TABLE IF NOT EXISTS public.sale_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID REFERENCES public.sales(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  barcode TEXT,
  qty INTEGER NOT NULL DEFAULT 1,
  price NUMERIC(20,2) NOT NULL DEFAULT 0,
  cost_price NUMERIC(20,2) NOT NULL DEFAULT 0,
  line_total NUMERIC(20,2) NOT NULL DEFAULT 0,
  line_profit NUMERIC(20,2) NOT NULL DEFAULT 0,
  token_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_token_code ON public.sale_items(token_code);

ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "sale_items_user_policy" ON public.sale_items FOR ALL USING (
    EXISTS (SELECT 1 FROM public.sales WHERE sales.id = sale_items.sale_id AND sales.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.sales WHERE sales.id = sale_items.sale_id AND sales.user_id = auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ==============================================================================
-- 6. RPC: SINKRONISASI PROFIT MANUAL KE DOMPET LABA
-- ==============================================================================
CREATE OR REPLACE FUNCTION get_unsynced_profits(p_user_id UUID)
RETURNS TABLE (
    tanggal TEXT,
    total_transaksi BIGINT,
    total_profit BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        TO_CHAR(DATE(created_at AT TIME ZONE 'Asia/Jakarta'), 'YYYY-MM-DD') AS tanggal,
        COUNT(id)::BIGINT AS total_transaksi,
        COALESCE(SUM(profit), 0)::BIGINT AS total_profit
    FROM public.sales
    WHERE user_id = p_user_id
      AND is_profit_synced = false
      AND profit > 0
      AND DATE(created_at AT TIME ZONE 'Asia/Jakarta') < DATE(NOW() AT TIME ZONE 'Asia/Jakarta')
    GROUP BY DATE(created_at AT TIME ZONE 'Asia/Jakarta')
    ORDER BY tanggal ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION manual_sync_pending_profits(p_user_id UUID, p_cash_wallet_id UUID, p_profit_wallet_id UUID)
RETURNS json AS $$
DECLARE
    v_total_profit BIGINT;
    v_total_trx INT;
    v_mutation_id UUID;
BEGIN
    SELECT COALESCE(SUM(profit), 0), COUNT(id)
    INTO v_total_profit, v_total_trx
    FROM public.sales
    WHERE user_id = p_user_id 
      AND is_profit_synced = false 
      AND profit > 0
      AND DATE(created_at AT TIME ZONE 'Asia/Jakarta') < DATE(NOW() AT TIME ZONE 'Asia/Jakarta');

    IF v_total_profit > 0 THEN
        INSERT INTO public.wallet_mutations (from_wallet_id, to_wallet_id, amount, description)
        VALUES (p_cash_wallet_id, p_profit_wallet_id, v_total_profit, 'Tarik Profit Manual (' || v_total_trx || ' trx)')
        RETURNING id INTO v_mutation_id;
        
        INSERT INTO public.wallet_transactions (wallet_id, type, amount, reference_type, reference_id, description)
        VALUES (p_cash_wallet_id, 'OUT', v_total_profit, 'MUTATION', v_mutation_id, 'Tarik Laba (' || v_total_trx || ' trx)');

        INSERT INTO public.wallet_transactions (wallet_id, type, amount, reference_type, reference_id, description)
        VALUES (p_profit_wallet_id, 'IN', v_total_profit, 'MUTATION', v_mutation_id, 'Simpan Laba (' || v_total_trx || ' trx)');

        UPDATE public.sales
        SET is_profit_synced = true
        WHERE user_id = p_user_id 
          AND is_profit_synced = false 
          AND profit > 0
          AND DATE(created_at AT TIME ZONE 'Asia/Jakarta') < DATE(NOW() AT TIME ZONE 'Asia/Jakarta');

        RETURN json_build_object('success', true, 'synced_amount', v_total_profit, 'synced_trx', v_total_trx);
    ELSE
        RETURN json_build_object('success', false, 'message', 'Tidak ada profit yang bisa ditarik');
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 7. REKONSILIASI KAS LACI (CASH RECONCILIATIONS)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.cash_reconciliations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date_str TEXT NOT NULL,
  starting_cash NUMERIC(20,2) DEFAULT 0,
  expected_cash NUMERIC(20,2) DEFAULT 0,
  actual_cash NUMERIC(20,2) DEFAULT 0,
  difference NUMERIC(20,2) DEFAULT 0,
  status TEXT DEFAULT 'balanced',
  denominations JSONB DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_cash_reconciliation UNIQUE(user_id, date_str)
);

CREATE INDEX IF NOT EXISTS idx_cash_reconciliations_user ON public.cash_reconciliations(user_id);
ALTER TABLE public.cash_reconciliations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "cash_reconciliations_user_policy" ON public.cash_reconciliations FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ==============================================================================
-- 8. KEUANGAN PRIBADI (PERSONAL ACCOUNTS & TRANSACTIONS)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.personal_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('cash', 'digital', 'bank')),
  balance NUMERIC(20,2) DEFAULT 0,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.personal_accounts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "personal_accounts_policy" ON public.personal_accounts FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.personal_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID REFERENCES public.personal_accounts(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  amount NUMERIC(20,2) NOT NULL,
  category TEXT,
  description TEXT,
  transaction_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.personal_transactions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "personal_transactions_policy" ON public.personal_transactions FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ==============================================================================
-- 9. PENGATURAN STRUK & DASHBOARD (INVOICE SETTINGS & MENU CONFIGS)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.invoice_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name VARCHAR(255) DEFAULT 'TOKO SAYA',
  business_address TEXT DEFAULT 'Alamat Toko',
  business_phone VARCHAR(50) DEFAULT '0812-3456-7890',
  business_email VARCHAR(255) DEFAULT 'toko@email.com',
  header_logo_url TEXT,
  header_text TEXT DEFAULT 'Terima kasih telah berbelanja di toko kami',
  footer_text TEXT DEFAULT 'Barang yang sudah dibeli tidak dapat dikembalikan',
  show_business_info BOOLEAN DEFAULT true,
  show_header_logo BOOLEAN DEFAULT false,
  show_footer_text BOOLEAN DEFAULT true,
  invoice_template VARCHAR(50) DEFAULT 'default',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_invoice_settings_user UNIQUE(user_id)
);

ALTER TABLE public.invoice_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "invoice_settings_user_policy" ON public.invoice_settings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.menu_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  menu_key VARCHAR(50) NOT NULL,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_menu UNIQUE (user_id, menu_key)
);

ALTER TABLE public.menu_configs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "menu_configs_user_policy" ON public.menu_configs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Custom Invoices Generator
CREATE TABLE IF NOT EXISTS public.custom_invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  customer_name TEXT,
  items JSONB DEFAULT '[]'::jsonb,
  total_amount NUMERIC(20,2) DEFAULT 0,
  header_content TEXT,
  footer_content TEXT,
  paper_size TEXT DEFAULT '58mm',
  show_logo BOOLEAN DEFAULT true,
  details JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.custom_invoices ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "custom_invoices_user_policy" ON public.custom_invoices FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ==============================================================================
-- 10. NOTIFIKASI WHATSAPP (FONNTE / WAPANELS)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.wa_notif_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT DEFAULT 'fonnte', -- 'fonnte', 'wapanels'
  token TEXT DEFAULT '',
  appkey TEXT DEFAULT '',
  authkey TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_wa_notif_owner UNIQUE(owner_id)
);

ALTER TABLE public.wa_notif_config ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "wa_notif_config_policy" ON public.wa_notif_config FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ==============================================================================
-- 11. MODUL ANTI GORES (TEMPERED GLASS / AG SEARCH)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.ag_simple (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand TEXT NOT NULL,
  termasuk TEXT NOT NULL DEFAULT '',
  ukuran_layar TEXT NOT NULL DEFAULT '',
  stock INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ag_simple_owner_idx ON public.ag_simple(owner_id);
CREATE INDEX IF NOT EXISTS ag_simple_brand_idx ON public.ag_simple(brand);
ALTER TABLE public.ag_simple ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "ag_simple_owner_policy" ON public.ag_simple FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.ag_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand TEXT,
  model_label TEXT NOT NULL,
  search_normalized TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ag_devices_owner_idx ON public.ag_devices(owner_id);
ALTER TABLE public.ag_devices ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "ag_devices_owner_policy" ON public.ag_devices FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.ag_device_alias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES public.ag_devices(id) ON DELETE CASCADE,
  alias_label TEXT NOT NULL,
  search_normalized TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ag_device_alias_device_idx ON public.ag_device_alias(device_id);
ALTER TABLE public.ag_device_alias ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "ag_device_alias_owner_policy" ON public.ag_device_alias FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.ag_type_device (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type_id UUID NOT NULL REFERENCES public.ag_simple(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES public.ag_devices(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_ag_type_device UNIQUE(type_id, device_id)
);

ALTER TABLE public.ag_type_device ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "ag_type_device_owner_policy" ON public.ag_type_device FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Trigger Normalisasi Pencarian Device
CREATE OR REPLACE FUNCTION normalize_ag_search()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_normalized := LOWER(REGEXP_REPLACE(COALESCE(NEW.brand, '') || ' ' || COALESCE(NEW.model_label, ''), '[^a-zA-Z0-9]', '', 'g'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_normalize_ag_devices ON public.ag_devices;
CREATE TRIGGER trg_normalize_ag_devices
  BEFORE INSERT OR UPDATE ON public.ag_devices
  FOR EACH ROW
  EXECUTE FUNCTION normalize_ag_search();

-- ==============================================================================
-- 12. FITUR AI (INTERACTIONS & MEMORY)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.ai_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  response TEXT,
  intent TEXT,
  context TEXT,
  model TEXT,
  status TEXT CHECK (status IN ('answered','unknown','error')) DEFAULT 'answered',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_interactions_user_id_idx ON public.ai_interactions (user_id, created_at DESC);
ALTER TABLE public.ai_interactions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "ai_interactions_user_policy" ON public.ai_interactions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.ai_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_memory_user_id_idx ON public.ai_memory (user_id, created_at DESC);
ALTER TABLE public.ai_memory ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "ai_memory_user_policy" ON public.ai_memory FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ==============================================================================
-- 13. KATALOG PRODUK PUBLIK (WEB STORE / PUBLIC CATALOG)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.public_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.public_brands (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.public_products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  price NUMERIC(20,2) NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  image_urls TEXT[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  category_id UUID REFERENCES public.public_categories(id) ON DELETE SET NULL,
  brand_id UUID REFERENCES public.public_brands(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.public_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_products ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "public_categories_owner" ON public.public_categories FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
  CREATE POLICY "public_categories_public_view" ON public.public_categories FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "public_brands_owner" ON public.public_brands FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
  CREATE POLICY "public_brands_public_view" ON public.public_brands FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "public_products_owner" ON public.public_products FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
  CREATE POLICY "public_products_public_view" ON public.public_products FOR SELECT USING (is_active = true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Selesai

