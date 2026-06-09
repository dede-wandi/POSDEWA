import { getSupabaseClient } from './supabase';

export async function checkWaConfigReady() {
  const supabase = getSupabaseClient();
  try {
    const { error } = await supabase
      .from('wa_notif_config')
      .select('id, provider')
      .limit(0);
    if (error) {
      if (error.message.includes('does not exist') && !error.message.includes('column')) {
        return { ready: false, message: 'Tabel wa_notif_config belum dibuat. Silakan jalankan SQL Skema.' };
      }
      if (error.message.includes('column') || error.message.includes('provider')) {
        return { ready: false, columnMissing: true, message: 'Kolom baru (provider, appkey, authkey) belum dibuat. Silakan jalankan migrasi SQL.' };
      }
      return { ready: false, message: error.message };
    }
    return { ready: true };
  } catch (e) {
    return { ready: false, message: e?.message || 'unknown' };
  }
}

export async function getWaConfig({ ownerId }) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('wa_notif_config')
    .select('id, token, provider, appkey, authkey')
    .eq('owner_id', ownerId)
    .limit(1)
    .maybeSingle();

  if (error) {
    if (error.message.includes('column') || error.message.includes('does not exist')) {
      const { data: legacyData, error: legacyError } = await supabase
        .from('wa_notif_config')
        .select('id, token')
        .eq('owner_id', ownerId)
        .limit(1)
        .maybeSingle();
      if (legacyError) throw new Error(legacyError.message);
      return legacyData ? { ...legacyData, provider: 'fonnte', appkey: '', authkey: '' } : null;
    }
    throw new Error(error.message);
  }
  return data || null;
}

export async function upsertWaConfig({ ownerId, token, provider, appkey, authkey }) {
  const supabase = getSupabaseClient();
  const payload = {
    owner_id: ownerId,
    provider: provider || 'fonnte',
    token: token || '',
    appkey: appkey || '',
    authkey: authkey || ''
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
    if (error) {
      if (error.message.includes('column') || error.message.includes('does not exist')) {
        const legacyPayload = {
          owner_id: ownerId,
          token: token || ''
        };
        const { error: legacyError } = await supabase
          .from('wa_notif_config')
          .update(legacyPayload)
          .eq('id', existing.id)
          .eq('owner_id', ownerId);
        if (legacyError) throw new Error(legacyError.message);
      } else {
        throw new Error(error.message);
      }
    }
    return { success: true, id: existing.id };
  } else {
    const { data, error } = await supabase
      .from('wa_notif_config')
      .insert(payload)
      .select('id')
      .maybeSingle();
    if (error) {
      if (error.message.includes('column') || error.message.includes('does not exist')) {
        const legacyPayload = {
          owner_id: ownerId,
          token: token || ''
        };
        const { data: legacyData, error: legacyError } = await supabase
          .from('wa_notif_config')
          .insert(legacyPayload)
          .select('id')
          .maybeSingle();
        if (legacyError) throw new Error(legacyError.message);
        return { success: true, id: legacyData?.id };
      } else {
        throw new Error(error.message);
      }
    }
    return { success: true, id: data?.id };
  }
}
