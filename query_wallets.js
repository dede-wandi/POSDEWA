import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data: user } = await supabase.from('sales').select('user_id').limit(1);
  const userId = user?.[0]?.user_id;
  
  if (userId) {
    const { data: wallets } = await supabase.from('wallets').select('name, type').eq('user_id', userId);
    console.log("Wallets:", wallets);
  }
}
run();
