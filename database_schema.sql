-- Database Schema untuk POS System
-- Jalankan SQL ini di Supabase SQL Editor

-- 1. Tabel Products
CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  barcode TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  cost_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index untuk performa
CREATE INDEX IF NOT EXISTS idx_products_owner_id ON products(owner_id);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);

-- 2. Tabel Sales (Transaksi Penjualan)
CREATE TABLE IF NOT EXISTS sales (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  no_invoice TEXT UNIQUE NOT NULL DEFAULT 'INV-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(EXTRACT(EPOCH FROM NOW())::TEXT, 10, '0'),
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  profit NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index untuk performa
CREATE INDEX IF NOT EXISTS idx_sales_user_id ON sales(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);

-- 3. Tabel Sale Items (Detail Item Penjualan)
CREATE TABLE IF NOT EXISTS sale_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  barcode TEXT,
  qty INTEGER NOT NULL DEFAULT 1,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  cost_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  line_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  line_profit NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index untuk performa
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);

-- 4. Row Level Security (RLS) Policies
-- Enable RLS pada semua tabel
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;

-- Policy untuk Products: User hanya bisa akses produk miliknya
CREATE POLICY "Users can manage their own products" ON products
  FOR ALL USING (auth.uid() = owner_id);

-- Policy untuk Sales: User hanya bisa akses transaksi miliknya
CREATE POLICY "Users can manage their own sales" ON sales
  FOR ALL USING (auth.uid() = user_id);

-- Policy untuk Sale Items: User hanya bisa akses item dari transaksi miliknya
CREATE POLICY "Users can manage their own sale items" ON sale_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM sales 
      WHERE sales.id = sale_items.sale_id 
      AND sales.user_id = auth.uid()
    )
  );

-- 5. Trigger untuk update timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_products_updated_at 
  BEFORE UPDATE ON products 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6. Sample data untuk testing (opsional)
-- INSERT INTO products (owner_id, name, barcode, price, cost_price, stock) VALUES
-- (auth.uid(), 'Contoh Produk 1', '1234567890', 15000, 10000, 50),
-- (auth.uid(), 'Contoh Produk 2', '0987654321', 25000, 18000, 30);