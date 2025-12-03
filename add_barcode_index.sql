-- Tambah index untuk kolom barcode di tabel products
-- Jalankan di Supabase SQL Editor jika belum ada index

CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);

COMMENT ON INDEX idx_products_barcode IS 'Index untuk mempercepat pencarian produk berdasarkan barcode';