-- Create menu_configs table for custom dashboard shortcut images
CREATE TABLE IF NOT EXISTS menu_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    menu_key VARCHAR(50) NOT NULL,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_user_menu UNIQUE (user_id, menu_key)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_menu_configs_user_id ON menu_configs(user_id);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_menu_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_menu_configs_updated_at
    BEFORE UPDATE ON menu_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_menu_configs_updated_at();

-- Enable RLS (Row Level Security)
ALTER TABLE menu_configs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own menu configs" ON menu_configs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own menu configs" ON menu_configs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own menu configs" ON menu_configs
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own menu configs" ON menu_configs
    FOR DELETE USING (auth.uid() = user_id);
