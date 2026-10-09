ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS is_profit_synced BOOLEAN DEFAULT false;
