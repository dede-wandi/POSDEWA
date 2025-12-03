-- Script untuk menambahkan kolom token_code ke tabel sale_items
-- Jalankan di Supabase SQL Editor

-- Tambahkan kolom token_code untuk menyimpan kode token listrik
ALTER TABLE sale_items 
ADD COLUMN IF NOT EXISTS token_code TEXT;

-- Tambahkan index untuk performa pencarian token
CREATE INDEX IF NOT EXISTS idx_sale_items_token_code ON sale_items(token_code);

-- Tambahkan comment untuk dokumentasi
COMMENT ON COLUMN sale_items.token_code IS 'Kode token untuk produk listrik/pulsa';

-- Verifikasi struktur tabel
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'sale_items' 
ORDER BY ordinal_position;