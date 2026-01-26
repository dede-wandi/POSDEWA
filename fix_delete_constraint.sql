-- Script untuk memperbaiki masalah penghapusan produk
-- Jalankan script ini di Supabase SQL Editor

-- 1. Pastikan stock_history memiliki ON DELETE CASCADE
ALTER TABLE public.stock_history
DROP CONSTRAINT IF EXISTS stock_history_product_id_fkey;

ALTER TABLE public.stock_history
ADD CONSTRAINT stock_history_product_id_fkey
FOREIGN KEY (product_id)
REFERENCES public.products(id)
ON DELETE CASCADE;

-- 2. Pastikan RLS policies mengizinkan delete
DROP POLICY IF EXISTS "Users can delete their own products" ON public.products;
CREATE POLICY "Users can delete their own products" ON public.products
  FOR DELETE USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can delete their own stock history" ON public.stock_history;
CREATE POLICY "Users can delete their own stock history" ON public.stock_history
  FOR DELETE USING (
    user_id = auth.uid() OR 
    product_id IN (SELECT id FROM products WHERE owner_id = auth.uid())
  );

-- 3. Cek apakah ada foreign key lain yang menghalangi (opsional, hanya log)
-- Tidak ada perubahan lain yang aman dilakukan secara otomatis.
