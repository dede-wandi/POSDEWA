import Constants from 'expo-constants';
import { createClient } from '@supabase/supabase-js';

let supabaseClient = null;

export function getSupabaseClient() {
  if (supabaseClient) {
    return supabaseClient;
  }
  
  const extra = Constants?.expoConfig?.extra || Constants?.manifest?.extra || {};
  const url = extra?.supabaseUrl;
  const key = extra?.supabaseAnonKey;
  
  console.log('🔧 Supabase: Initializing client with URL:', url ? 'exists' : 'missing');
  console.log('🔧 Supabase: Initializing client with key:', key ? 'exists' : 'missing');
  
  if (!url || !key) {
    console.log('❌ Supabase: Missing URL or key');
    return null;
  }
  
  supabaseClient = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  
  console.log('✅ Supabase: Client initialized successfully');
  return supabaseClient;
}

/**
 * Log transaksi penjualan ke Supabase.
 * Tabel:
 *  - sales: id (uuid), user_id (uuid), created_at (timestamp), total (numeric), profit (numeric)
 *  - sale_items: id (uuid), sale_id (uuid), product_name (text), barcode (text), qty (int), price (numeric), cost_price (numeric), line_total (numeric), line_profit (numeric)
 */
export async function logSale({ items, total, profit, userId }) {
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, error: 'Supabase belum dikonfigurasi.' };
  try {
    const createdAt = new Date().toISOString();
    const { data: sale, error: saleErr } = await supabase
      .from('sales')
      .insert({ user_id: userId || null, created_at: createdAt, total, profit })
      .select()
      .single();
    if (saleErr) throw saleErr;

    const rows = (items || []).map(it => ({
      sale_id: sale.id,
      product_name: it.name,
      barcode: it.barcode || null,
      qty: it.qty,
      price: it.price,
      cost_price: it.costPrice ?? 0,
      line_total: it.price * it.qty,
      line_profit: (it.price - (it.costPrice ?? 0)) * it.qty,
    }));

    if (rows.length) {
      const { error: itemErr } = await supabase.from('sale_items').insert(rows);
      if (itemErr) throw itemErr;
    }

    return { success: true, saleId: sale.id };
  } catch (e) {
    return { success: false, error: e?.message || String(e) };
  }
}