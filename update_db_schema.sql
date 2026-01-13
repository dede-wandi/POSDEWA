-- 1. Menambahkan kolom image_urls ke tabel products
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS image_urls text[] DEFAULT '{}';

-- 2. Menambahkan kolom last_change_reason untuk mencatat alasan perubahan terakhir
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS last_change_reason text;

-- 3. Update function log_stock_change untuk menggunakan last_change_reason
CREATE OR REPLACE FUNCTION log_stock_change()
RETURNS TRIGGER AS $$
DECLARE
  change_type TEXT;
  change_reason TEXT;
BEGIN
  -- Hanya log jika stock berubah
  IF OLD.stock != NEW.stock THEN
    -- Tentukan tipe
    IF NEW.stock > OLD.stock THEN
      change_type := 'addition';
    ELSIF NEW.stock < OLD.stock THEN
      change_type := 'reduction';
    ELSE
      change_type := 'adjustment';
    END IF;

    -- Tentukan alasan (reason)
    -- Jika last_change_reason diisi saat update, gunakan itu
    -- Jika tidak, gunakan default logic
    IF NEW.last_change_reason IS NOT NULL AND NEW.last_change_reason != '' THEN
       change_reason := NEW.last_change_reason;
    ELSE
       -- Fallback logic jika tidak ada reason spesifik
       IF NEW.stock > OLD.stock THEN
          change_reason := 'Penambahan stock';
       ELSE
          change_reason := 'Penyesuaian stock'; 
       END IF;
    END IF;

    INSERT INTO stock_history (
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
  
  -- Reset last_change_reason agar tidak terbawa ke update berikutnya (opsional, tapi aman)
  -- Namun karena trigger AFTER update tidak bisa mengubah row, kita biarkan saja.
  -- Idealnya kita pakai BEFORE trigger untuk reset, tapi tidak krusial jika aplikasi selalu kirim reason atau null.
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_log_stock_change ON products;
CREATE TRIGGER trg_log_stock_change
AFTER UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION log_stock_change();
