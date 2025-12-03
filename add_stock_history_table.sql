-- Script untuk menambahkan tabel stock_history
-- Jalankan di Supabase SQL Editor

-- Tabel untuk mencatat riwayat perubahan stock
CREATE TABLE IF NOT EXISTS stock_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('addition', 'reduction', 'adjustment')),
  quantity INTEGER NOT NULL,
  previous_stock INTEGER NOT NULL DEFAULT 0,
  new_stock INTEGER NOT NULL DEFAULT 0,
  reason TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index untuk performa
CREATE INDEX IF NOT EXISTS idx_stock_history_product_id ON stock_history(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_history_user_id ON stock_history(user_id);
CREATE INDEX IF NOT EXISTS idx_stock_history_created_at ON stock_history(created_at);
CREATE INDEX IF NOT EXISTS idx_stock_history_type ON stock_history(type);

-- RLS Policy untuk stock_history
ALTER TABLE stock_history ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own stock history
CREATE POLICY "Users can view own stock history" ON stock_history
  FOR SELECT USING (
    user_id = auth.uid() OR 
    product_id IN (SELECT id FROM products WHERE owner_id = auth.uid())
  );

-- Policy: Users can insert stock history for their own products
CREATE POLICY "Users can insert stock history for own products" ON stock_history
  FOR INSERT WITH CHECK (
    product_id IN (SELECT id FROM products WHERE owner_id = auth.uid())
  );

-- Function untuk mencatat stock history otomatis
CREATE OR REPLACE FUNCTION log_stock_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Hanya log jika stock berubah
  IF OLD.stock != NEW.stock THEN
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
      -- Untuk penyesuaian manual stock, selalu gunakan 'adjustment'
      -- Untuk perubahan otomatis (penjualan), gunakan 'reduction'
      CASE 
        WHEN NEW.stock > OLD.stock THEN 'addition'
        WHEN NEW.stock < OLD.stock THEN 'reduction'
        ELSE 'adjustment'
      END,
      ABS(NEW.stock - OLD.stock),
      OLD.stock,
      NEW.stock,
      'Auto-logged from product update'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger jika sudah ada
DROP TRIGGER IF EXISTS trigger_log_stock_change ON products;

-- Buat trigger untuk auto-log stock changes
CREATE TRIGGER trigger_log_stock_change
    AFTER UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION log_stock_change();