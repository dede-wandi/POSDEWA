import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data: sales } = await supabase.from('sales').select('id, user_id').limit(1);
  console.log('User ID from sales:', sales?.[0]?.user_id);
  const userId = sales?.[0]?.user_id;
  
  if (userId) {
    const { data: products } = await supabase.from('products').select('id, name, owner_id').limit(5);
    console.log('Products:', products);
  }
}
run();
