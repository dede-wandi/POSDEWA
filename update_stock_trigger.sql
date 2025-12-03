-- Update trigger untuk membedakan penyesuaian manual dan otomatis
CREATE OR REPLACE FUNCTION log_stock_change()
RETURNS TRIGGER AS $$
DECLARE
  change_type TEXT;
  change_reason TEXT;
BEGIN
  -- Hanya log jika stock berubah
  IF OLD.stock != NEW.stock THEN
    -- Tentukan tipe berdasarkan konteks
    IF NEW.stock > OLD.stock THEN
      change_type := 'addition';
      change_reason := 'Penambahan stock';
    ELSIF NEW.stock < OLD.stock THEN
      -- Jika ini adalah penyesuaian manual (biasanya dari stock management)
      -- Kita akan menggunakan 'adjustment' untuk semua perubahan manual
      change_type := 'adjustment';
      change_reason := 'Penyesuaian stock';
    ELSE
      change_type := 'adjustment';
      change_reason := 'Penyesuaian stock';
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
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop dan buat ulang trigger
DROP TRIGGER IF EXISTS trigger_log_stock_change ON products;

CREATE TRIGGER trigger_log_stock_change
    AFTER UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION log_stock_change();