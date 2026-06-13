-- ====================================================================
-- SQL Script: Memperbaiki Hapus Produk (Foreign Key ON DELETE CASCADE)
--
-- Jalankan query di bawah ini pada SQL Editor di Dashboard Supabase Anda
-- untuk mengizinkan penghapusan produk secara langsung dari database
-- tanpa menabrak constraint "Foreign Key violation".
--
-- Catatan: 
-- - Tabel `sale_items` (riwayat penjualan) tidak memiliki foreign key
--   ke tabel `products` (ia hanya menyimpan nama produk & barcode secara teks),
--   sehingga riwayat transaksi penjualan Anda AKAN TETAP AMAN dan UTUH.
-- - Tabel `stock_history` (riwayat stok) memiliki foreign key ke `products`.
--   Dengan script ini, menghapus produk akan menghapus riwayat stoknya.
-- ====================================================================

-- 1. Hapus constraint foreign key yang lama dari tabel stock_history
ALTER TABLE public.stock_history 
DROP CONSTRAINT IF EXISTS stock_history_product_id_fkey;

-- 2. Tambahkan kembali constraint dengan aturan ON DELETE CASCADE
ALTER TABLE public.stock_history
ADD CONSTRAINT stock_history_product_id_fkey
FOREIGN KEY (product_id)
REFERENCES public.products(id)
ON DELETE CASCADE;

-- 3. Verifikasi apakah ada constraint lain (opsional)
-- Jika Anda mendapatkan error constraint lain saat menghapus produk,
-- gunakan format di atas untuk mengganti constraint tersebut dengan ON DELETE CASCADE.
