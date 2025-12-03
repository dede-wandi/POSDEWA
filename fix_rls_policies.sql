-- Fix RLS Policies untuk POS System
-- Jalankan SQL ini di Supabase SQL Editor untuk memperbaiki error RLS

-- 1. Drop existing policies terlebih dahulu
DROP POLICY IF EXISTS "Users can manage their own products" ON products;
DROP POLICY IF EXISTS "Users can manage their own sales" ON sales;
DROP POLICY IF EXISTS "Users can manage their own sale items" ON sale_items;

-- 2. Buat policies yang lebih spesifik untuk setiap operasi

-- Products Policies
CREATE POLICY "Users can view their own products" ON products
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert their own products" ON products
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own products" ON products
  FOR UPDATE USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own products" ON products
  FOR DELETE USING (auth.uid() = owner_id);

-- Sales Policies
CREATE POLICY "Users can view their own sales" ON sales
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sales" ON sales
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sales" ON sales
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sales" ON sales
  FOR DELETE USING (auth.uid() = user_id);

-- Sale Items Policies
CREATE POLICY "Users can view their own sale items" ON sale_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sales 
      WHERE sales.id = sale_items.sale_id 
      AND sales.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own sale items" ON sale_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales 
      WHERE sales.id = sale_items.sale_id 
      AND sales.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own sale items" ON sale_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM sales 
      WHERE sales.id = sale_items.sale_id 
      AND sales.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales 
      WHERE sales.id = sale_items.sale_id 
      AND sales.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own sale items" ON sale_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM sales 
      WHERE sales.id = sale_items.sale_id 
      AND sales.user_id = auth.uid()
    )
  );

-- 3. Pastikan RLS masih enabled
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;

-- 4. Test query untuk memastikan policies bekerja
-- SELECT auth.uid() as current_user_id;
-- SELECT * FROM products WHERE owner_id = auth.uid();