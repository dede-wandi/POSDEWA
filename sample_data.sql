-- Sample Data untuk Testing POS System
-- Jalankan SQL ini di Supabase SQL Editor setelah menjalankan database_schema.sql

-- Pastikan user sudah login dan auth.uid() tersedia
-- Jika belum, ganti auth.uid() dengan UUID user yang valid

-- Insert 5 sample products
INSERT INTO products (owner_id, name, barcode, price, cost_price, stock) VALUES
(auth.uid(), 'Indomie Goreng', '8992388101012', 3500, 2800, 100),
(auth.uid(), 'Aqua 600ml', '8993675010016', 4000, 3200, 75),
(auth.uid(), 'Teh Botol Sosro', '8992761111014', 5500, 4200, 50),
(auth.uid(), 'Roti Tawar Sari Roti', '8992696010013', 12000, 9500, 25),
(auth.uid(), 'Kopi Kapal Api', '8992696020012', 8500, 6800, 40);

-- Verifikasi data berhasil diinsert
SELECT * FROM products WHERE owner_id = auth.uid() ORDER BY created_at DESC;