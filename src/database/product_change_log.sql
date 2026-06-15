-- ====================================================================
-- SQL Script: Product Change Log — Tracking Perubahan Produk
--
-- Tabel ini mencatat SETIAP perubahan pada produk:
--   • Harga Jual (price)
--   • Harga Modal (cost_price)
--   • Stok (stock)
--   • Barcode
--   • Nama Produk (name)
--
-- Cara penggunaan:
-- 1. Jalankan seluruh script ini di SQL Editor Supabase Anda
-- 2. Trigger akan otomatis mencatat setiap UPDATE pada tabel products
-- ====================================================================


-- ============================================================
-- 1. BUAT TABEL product_change_log
-- ============================================================
CREATE TABLE IF NOT EXISTS public.product_change_log (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id    UUID        NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  owner_id      UUID        NOT NULL,

  -- Jenis field yang berubah: 'price', 'cost_price', 'stock', 'barcode', 'name'
  field_name    TEXT        NOT NULL,

  -- Nilai sebelum & sesudah (disimpan sebagai TEXT agar fleksibel untuk semua tipe)
  old_value     TEXT,
  new_value     TEXT,

  -- Alasan perubahan (misal: 'edit_manual', 'penjualan', 'restock', dll)
  change_reason TEXT        DEFAULT 'edit_manual',

  -- Metadata
  changed_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  note          TEXT        -- catatan tambahan opsional
);

-- Index untuk mempercepat query per produk dan per owner
CREATE INDEX IF NOT EXISTS idx_product_change_log_product_id 
  ON public.product_change_log(product_id);

CREATE INDEX IF NOT EXISTS idx_product_change_log_owner_id 
  ON public.product_change_log(owner_id);

CREATE INDEX IF NOT EXISTS idx_product_change_log_changed_at 
  ON public.product_change_log(changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_change_log_field_name 
  ON public.product_change_log(field_name);


-- ============================================================
-- 2. ROW LEVEL SECURITY (RLS) — Setiap user hanya lihat datanya sendiri
-- ============================================================
ALTER TABLE public.product_change_log ENABLE ROW LEVEL SECURITY;

-- Policy: user hanya bisa SELECT log miliknya sendiri
CREATE POLICY "product_change_log_select_own"
  ON public.product_change_log
  FOR SELECT
  USING (owner_id = auth.uid());

-- Policy: user hanya bisa INSERT log miliknya sendiri
CREATE POLICY "product_change_log_insert_own"
  ON public.product_change_log
  FOR INSERT
  WITH CHECK (owner_id = auth.uid());

-- Policy: user tidak bisa UPDATE log (audit trail harus immutable)
-- (tidak ada UPDATE policy)

-- Policy: user bisa DELETE log miliknya (opsional, bisa dihapus jika tidak perlu)
CREATE POLICY "product_change_log_delete_own"
  ON public.product_change_log
  FOR DELETE
  USING (owner_id = auth.uid());


-- ============================================================
-- 3. TRIGGER OTOMATIS — Catat perubahan saat products di-UPDATE
-- ============================================================

-- Fungsi trigger: akan jalan setiap kali row di products diubah
CREATE OR REPLACE FUNCTION public.fn_log_product_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Log perubahan NAMA PRODUK
  IF OLD.name IS DISTINCT FROM NEW.name THEN
    INSERT INTO public.product_change_log
      (product_id, owner_id, field_name, old_value, new_value, change_reason)
    VALUES
      (NEW.id, NEW.owner_id, 'name', OLD.name::TEXT, NEW.name::TEXT, 'edit_manual');
  END IF;

  -- Log perubahan HARGA JUAL
  IF OLD.price IS DISTINCT FROM NEW.price THEN
    INSERT INTO public.product_change_log
      (product_id, owner_id, field_name, old_value, new_value, change_reason)
    VALUES
      (NEW.id, NEW.owner_id, 'price', OLD.price::TEXT, NEW.price::TEXT, 'edit_manual');
  END IF;

  -- Log perubahan HARGA MODAL
  IF OLD.cost_price IS DISTINCT FROM NEW.cost_price THEN
    INSERT INTO public.product_change_log
      (product_id, owner_id, field_name, old_value, new_value, change_reason)
    VALUES
      (NEW.id, NEW.owner_id, 'cost_price', OLD.cost_price::TEXT, NEW.cost_price::TEXT, 'edit_manual');
  END IF;

  -- Log perubahan STOK
  IF OLD.stock IS DISTINCT FROM NEW.stock THEN
    INSERT INTO public.product_change_log
      (product_id, owner_id, field_name, old_value, new_value, 
       change_reason)
    VALUES
      (NEW.id, NEW.owner_id, 'stock', OLD.stock::TEXT, NEW.stock::TEXT,
       COALESCE(NEW.last_change_reason, 'edit_manual'));
  END IF;

  -- Log perubahan BARCODE
  IF OLD.barcode IS DISTINCT FROM NEW.barcode THEN
    INSERT INTO public.product_change_log
      (product_id, owner_id, field_name, old_value, new_value, change_reason)
    VALUES
      (NEW.id, NEW.owner_id, 'barcode', OLD.barcode::TEXT, NEW.barcode::TEXT, 'edit_manual');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Pasang trigger ke tabel products
DROP TRIGGER IF EXISTS trg_log_product_changes ON public.products;
CREATE TRIGGER trg_log_product_changes
  AFTER UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_log_product_changes();


-- ============================================================
-- 4. VIEW UNTUK KEMUDAHAN QUERY (opsional tapi sangat berguna)
-- ============================================================

-- View: log lengkap dengan nama produk (join ke products)
CREATE OR REPLACE VIEW public.v_product_change_log AS
SELECT
  cl.id,
  cl.product_id,
  p.name          AS product_name,
  p.barcode       AS current_barcode,
  cl.owner_id,
  cl.field_name,
  CASE cl.field_name
    WHEN 'name'       THEN 'Nama Produk'
    WHEN 'price'      THEN 'Harga Jual'
    WHEN 'cost_price' THEN 'Harga Modal'
    WHEN 'stock'      THEN 'Stok'
    WHEN 'barcode'    THEN 'Barcode'
    ELSE cl.field_name
  END             AS field_label,
  cl.old_value,
  cl.new_value,
  cl.change_reason,
  cl.note,
  cl.changed_at
FROM public.product_change_log cl
LEFT JOIN public.products p ON p.id = cl.product_id
ORDER BY cl.changed_at DESC;


-- ============================================================
-- 5. CONTOH QUERY BERGUNA
-- ============================================================

-- [A] Lihat semua riwayat perubahan harga produk tertentu:
-- SELECT * FROM v_product_change_log
-- WHERE product_id = 'UUID-PRODUK-ANDA'
-- ORDER BY changed_at DESC;

-- [B] Lihat semua produk yang harga jualnya pernah berubah bulan ini:
-- SELECT * FROM v_product_change_log
-- WHERE field_name = 'price'
--   AND changed_at >= date_trunc('month', NOW())
-- ORDER BY changed_at DESC;

-- [C] Lihat history stok produk tertentu:
-- SELECT product_name, old_value as stok_lama, new_value as stok_baru,
--        change_reason, changed_at
-- FROM v_product_change_log
-- WHERE product_id = 'UUID-PRODUK-ANDA'
--   AND field_name = 'stock'
-- ORDER BY changed_at DESC;

-- [D] Ringkasan: produk dengan perubahan harga terbanyak:
-- SELECT product_name, COUNT(*) as jumlah_perubahan
-- FROM v_product_change_log
-- WHERE field_name = 'price'
-- GROUP BY product_name
-- ORDER BY jumlah_perubahan DESC;
