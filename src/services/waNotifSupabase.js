import { getSupabaseClient } from './supabase';

export async function checkWaConfigReady() {
  const supabase = getSupabaseClient();
  try {
    const { error } = await supabase
      .from('wa_notif_config')
      .select('id', { head: true, count: 'exact' })
      .limit(0);
    if (error) return { ready: false, message: error.message };
    return { ready: true };
  } catch (e) {
    return { ready: false, message: e?.message || 'unknown' };
  }
}

export async function getWaConfig({ ownerId }) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('wa_notif_config')
    .select('id, token')
    .eq('owner_id', ownerId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data || null;
}

export async function upsertWaConfig({ ownerId, token }) {
  const supabase = getSupabaseClient();
  const payload = {
    owner_id: ownerId,
    token: token || ''
  };
  const { data: existing, error: e1 } = await supabase
    .from('wa_notif_config')
    .select('id')
    .eq('owner_id', ownerId)
    .limit(1)
    .maybeSingle();
  if (e1) throw new Error(e1.message);
  if (existing?.id) {
    const { error } = await supabase
      .from('wa_notif_config')
      .update(payload)
      .eq('id', existing.id)
      .eq('owner_id', ownerId);
    if (error) throw new Error(error.message);
    return { success: true, id: existing.id };
  } else {
    const { data, error } = await supabase
      .from('wa_notif_config')
      .insert(payload)
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    return { success: true, id: data.id };
  }
}
