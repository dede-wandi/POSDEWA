-- Script Penting: Perbaikan Izin Hapus Produk & Simpan History
-- Jalankan script ini di Supabase SQL Editor agar Anda bisa menghapus produk tanpa kehilangan riwayat stok.

-- 1. Izinkan kolom product_id bernilai NULL di stock_history
-- Ini penting agar saat produk dihapus, baris history tidak ikut terhapus (hanya product_id jadi kosong)
ALTER TABLE stock_history ALTER COLUMN product_id DROP NOT NULL;

-- 2. Hapus constraint Foreign Key yang lama (mungkin diset CASCADE atau RESTRICT)
ALTER TABLE stock_history DROP CONSTRAINT IF EXISTS stock_history_product_id_fkey;

-- 3. Buat constraint baru dengan aturan "ON DELETE SET NULL"
-- Artinya: Kalau produk dihapus, kolom product_id di history akan otomatis diubah jadi NULL.
-- Data history (jumlah, tanggal, alasan) TETAP AMAN tersimpan.
ALTER TABLE stock_history 
ADD CONSTRAINT stock_history_product_id_fkey 
FOREIGN KEY (product_id) 
REFERENCES products(id) 
ON DELETE SET NULL;

-- 4. Pastikan Policy RLS mengizinkan penghapusan produk sendiri
DROP POLICY IF EXISTS "Users can delete their own products" ON products;
CREATE POLICY "Users can delete their own products" ON products
  FOR DELETE USING (auth.uid() = owner_id);

-- 5. Pastikan Policy RLS mengizinkan update history (jika diperlukan sistem)
-- (Opsional, tapi bagus untuk jaga-jaga)
DROP POLICY IF EXISTS "Users can update own stock history" ON stock_history;
CREATE POLICY "Users can update own stock history" ON stock_history
  FOR UPDATE USING (
    user_id = auth.uid() OR 
    product_id IN (SELECT id FROM products WHERE owner_id = auth.uid())
  );
