-- Tabel untuk channel pembayaran
CREATE TABLE IF NOT EXISTS payment_channels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'digital', -- 'cash', 'digital', 'bank'
  balance DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  initial_balance DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  is_active BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabel untuk riwayat transaksi keuangan
CREATE TABLE IF NOT EXISTS finance_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_channel_id UUID NOT NULL REFERENCES payment_channels(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'income', 'expense', 'transfer', 'adjustment'
  amount DECIMAL(15,2) NOT NULL,
  previous_balance DECIMAL(15,2) NOT NULL,
  new_balance DECIMAL(15,2) NOT NULL,
  description TEXT NOT NULL,
  reference_type VARCHAR(50), -- 'sale', 'manual', 'initial'
  reference_id UUID, -- ID dari tabel terkait (sales, dll)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index untuk performa
CREATE INDEX IF NOT EXISTS idx_payment_channels_owner ON payment_channels(owner_id);
CREATE INDEX IF NOT EXISTS idx_payment_channels_active ON payment_channels(owner_id, is_active);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_owner ON finance_transactions(owner_id);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_channel ON finance_transactions(payment_channel_id);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_date ON finance_transactions(created_at);

-- RLS (Row Level Security)
ALTER TABLE payment_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_transactions ENABLE ROW LEVEL SECURITY;

-- Policy untuk payment_channels
CREATE POLICY "Users can view their own payment channels" ON payment_channels
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert their own payment channels" ON payment_channels
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own payment channels" ON payment_channels
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own payment channels" ON payment_channels
  FOR DELETE USING (auth.uid() = owner_id);

-- Policy untuk finance_transactions
CREATE POLICY "Users can view their own finance transactions" ON finance_transactions
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert their own finance transactions" ON finance_transactions
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- Function untuk update balance otomatis
CREATE OR REPLACE FUNCTION update_payment_channel_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- Update balance di payment channel
  UPDATE payment_channels 
  SET balance = NEW.new_balance,
      updated_at = NOW()
  WHERE id = NEW.payment_channel_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger untuk update balance otomatis
DROP TRIGGER IF EXISTS trigger_update_payment_channel_balance ON finance_transactions;
CREATE TRIGGER trigger_update_payment_channel_balance
    AFTER INSERT ON finance_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_payment_channel_balance();

-- Insert default cash channel untuk setiap user baru
CREATE OR REPLACE FUNCTION create_default_payment_channels()
RETURNS TRIGGER AS $$
BEGIN
  -- Buat channel cash default
  INSERT INTO payment_channels (owner_id, name, type, balance, initial_balance, description)
  VALUES (
    NEW.id,
    'Kas Tunai',
    'cash',
    0.00,
    0.00,
    'Channel pembayaran tunai default'
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger untuk membuat default channels saat user baru
DROP TRIGGER IF EXISTS trigger_create_default_payment_channels ON auth.users;
CREATE TRIGGER trigger_create_default_payment_channels
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_default_payment_channels();