-- Update tabel sales untuk menambahkan informasi payment method
-- Jalankan SQL ini di Supabase SQL Editor

-- Tambahkan kolom payment method dan informasi pembayaran ke tabel sales
ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'cash',
ADD COLUMN IF NOT EXISTS payment_channel_id UUID REFERENCES payment_channels(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS cash_amount NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS change_amount NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS customer_name TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Tambahkan index untuk performa
CREATE INDEX IF NOT EXISTS idx_sales_payment_method ON sales(payment_method);
CREATE INDEX IF NOT EXISTS idx_sales_payment_channel ON sales(payment_channel_id);

-- Update existing records to have default payment method
UPDATE sales 
SET payment_method = 'cash', 
    cash_amount = total, 
    change_amount = 0 
WHERE payment_method IS NULL;