import { getSupabaseClient } from './supabase';

export async function listCustomInvoices() {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('custom_invoices')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching custom invoices:', error);
    return [];
  }
  return data;
}

export async function createCustomInvoice(payload) {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('custom_invoices')
    .insert([payload])
    .select()
    .single();

  if (error) {
    console.error('Error creating custom invoice:', error);
    throw error;
  }
  return data;
}

export async function updateCustomInvoice(id, payload) {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('custom_invoices')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating custom invoice:', error);
    throw error;
  }
  return data;
}

export async function deleteCustomInvoice(id) {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const { error } = await supabase
    .from('custom_invoices')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting custom invoice:', error);
    return false;
  }
  return true;
}
