-- Script untuk menambahkan kolom no_invoice ke tabel sales yang sudah ada
-- Jalankan di Supabase SQL Editor

-- Tambahkan kolom no_invoice dengan auto-generate
ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS no_invoice TEXT UNIQUE;

-- Buat function untuk generate invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
    counter INTEGER;
    invoice_date TEXT;
    invoice_number TEXT;
BEGIN
    -- Format tanggal YYYYMMDD
    invoice_date := TO_CHAR(NOW(), 'YYYYMMDD');
    
    -- Hitung jumlah invoice hari ini + 1
    SELECT COUNT(*) + 1 INTO counter
    FROM sales 
    WHERE DATE(created_at) = CURRENT_DATE;
    
    -- Format: INV-YYYYMMDD-XXXX (4 digit counter)
    invoice_number := 'INV-' || invoice_date || '-' || LPAD(counter::TEXT, 4, '0');
    
    RETURN invoice_number;
END;
$$ LANGUAGE plpgsql;

-- Update existing records yang belum punya no_invoice
UPDATE sales 
SET no_invoice = generate_invoice_number()
WHERE no_invoice IS NULL;

-- Buat trigger untuk auto-generate no_invoice pada insert baru
CREATE OR REPLACE FUNCTION set_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.no_invoice IS NULL OR NEW.no_invoice = '' THEN
        NEW.no_invoice := generate_invoice_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger jika sudah ada
DROP TRIGGER IF EXISTS trigger_set_invoice_number ON sales;

-- Buat trigger baru
CREATE TRIGGER trigger_set_invoice_number
    BEFORE INSERT ON sales
    FOR EACH ROW
    EXECUTE FUNCTION set_invoice_number();

-- Buat constraint untuk memastikan no_invoice tidak null
ALTER TABLE sales 
ALTER COLUMN no_invoice SET NOT NULL;