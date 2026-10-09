import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { error } = await supabase.rpc('execute_sql', {
    sql: 'ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS is_profit_synced BOOLEAN DEFAULT false;'
  });
  console.log("RPC Error:", error);
}
run();
