-- Jalankan script ini di SQL Editor Supabase Anda untuk memperbaiki error "numeric field overflow"
-- Masalah ini terjadi karena limit kolom angka sebelumnya tidak cukup untuk menampung transaksi > 100 Juta.

-- Update tabel sales
ALTER TABLE sales 
  ALTER COLUMN total TYPE NUMERIC(20,2),
  ALTER COLUMN profit TYPE NUMERIC(20,2),
  ALTER COLUMN cash_amount TYPE NUMERIC(20,2),
  ALTER COLUMN change_amount TYPE NUMERIC(20,2);

-- Update tabel sale_items
ALTER TABLE sale_items
  ALTER COLUMN price TYPE NUMERIC(20,2),
  ALTER COLUMN cost_price TYPE NUMERIC(20,2),
  ALTER COLUMN line_total TYPE NUMERIC(20,2),
  ALTER COLUMN line_profit TYPE NUMERIC(20,2);

-- Update tabel products (jaga-jaga jika ada produk yang harganya tinggi sekali)
ALTER TABLE products
  ALTER COLUMN price TYPE NUMERIC(20,2),
  ALTER COLUMN cost_price TYPE NUMERIC(20,2);

-- Update tabel product_variants (jaga-jaga)
ALTER TABLE product_variants
  ALTER COLUMN price TYPE NUMERIC(20,2),
  ALTER COLUMN cost_price TYPE NUMERIC(20,2);
