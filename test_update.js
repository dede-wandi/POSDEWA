import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data: user } = await supabase.from('sales').select('user_id').limit(1);
  const userId = user?.[0]?.user_id;
  
  const { data: products } = await supabase.from('products').select('*').limit(1);
  if (products && products.length > 0) {
    console.log("Found product:", products[0].name);
    const { error } = await supabase.from('products')
      .update({ last_change_reason: 'test_reason' })
      .eq('id', products[0].id);
    if (error) {
      console.log("UPDATE ERROR:", error);
    } else {
      console.log("UPDATE SUCCESS!");
    }
  }
}
run();
