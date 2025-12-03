-- Create invoice_settings table for custom header and footer
CREATE TABLE IF NOT EXISTS invoice_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    business_name VARCHAR(255) DEFAULT 'TOKO SAYA',
    business_address TEXT DEFAULT 'Alamat Toko',
    business_phone VARCHAR(50) DEFAULT '0812-3456-7890',
    business_email VARCHAR(255) DEFAULT 'toko@email.com',
    header_logo_url TEXT,
    header_text TEXT DEFAULT 'Terima kasih telah berbelanja di toko kami',
    footer_text TEXT DEFAULT 'Barang yang sudah dibeli tidak dapat dikembalikan',
    show_business_info BOOLEAN DEFAULT true,
    show_header_logo BOOLEAN DEFAULT false,
    show_footer_text BOOLEAN DEFAULT true,
    invoice_template VARCHAR(50) DEFAULT 'default',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_invoice_settings_user_id ON invoice_settings(user_id);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_invoice_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_invoice_settings_updated_at
    BEFORE UPDATE ON invoice_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_invoice_settings_updated_at();

-- Insert default settings for existing users (optional)
INSERT INTO invoice_settings (user_id, business_name, business_address, business_phone, business_email)
SELECT 
    id,
    'TOKO SAYA',
    'Alamat Toko',
    '0812-3456-7890',
    'toko@email.com'
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM invoice_settings);

-- Enable RLS (Row Level Security)
ALTER TABLE invoice_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own invoice settings" ON invoice_settings
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own invoice settings" ON invoice_settings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own invoice settings" ON invoice_settings
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own invoice settings" ON invoice_settings
    FOR DELETE USING (auth.uid() = user_id);