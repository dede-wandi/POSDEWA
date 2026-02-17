import { getSupabaseClient } from './supabase';

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

export async function searchAntiGores({ ownerId, query, limit = 100 }) {
  const supabase = getSupabaseClient();
  const hasQuery = query && query.trim().length > 0;
  const q = query?.trim() || '';

  let req = supabase
    .from('ag_simple')
    .select('id, brand, termasuk, ukuran_layar, stock')
    .eq('owner_id', ownerId)
    .limit(limit);

  if (hasQuery) {
    const like = `%${q}%`;
    req = req.or(`brand.ilike.${like},termasuk.ilike.${like},ukuran_layar.ilike.${like}`);
  } else {
    req = req.order('stock', { ascending: true });
  }

  const { data, error } = await req;
  if (error) throw new Error(error.message || 'error_simple_list');

  return (data || []).map(r => {
    const tokens = String(r.termasuk || '')
      .split(/[,/;\n]+/)
      .map(s => s.trim())
      .filter(Boolean);
    return {
      id: r.id,
      code: null,
      name: r.brand,
      stock: r.stock,
      ukuran_layar: r.ukuran_layar || '',
      devices: tokens.slice(0, 6),
      deviceCount: tokens.length,
      termasuk: r.termasuk
    };
  });
}

export async function checkAntiGoresReady() {
  const supabase = getSupabaseClient();
  try {
    const { error } = await supabase
      .from('ag_simple')
      .select('id', { head: true, count: 'exact' })
      .limit(0);
    if (error) {
      return { ready: false, message: error.message };
    }
    return { ready: true };
  } catch (e) {
    return { ready: false, message: e?.message || 'unknown' };
  }
}

export async function upsertType({ ownerId, id, code, name, stock = 0, termasuk = '' }) {
  const supabase = getSupabaseClient();
  const payload = {
    owner_id: ownerId,
    brand: name,
    termasuk: String(termasuk || ''),
    ukuran_layar: null,
    stock: Number(stock) || 0
  };
  if (arguments.length >= 1 && typeof arguments[0] === 'object' && arguments[0].ukuran_layar !== undefined) {
    payload.ukuran_layar = String(arguments[0].ukuran_layar || '');
  }
  if (payload.ukuran_layar === null) payload.ukuran_layar = '';
  if (id) {
    const { error } = await supabase.from('ag_simple').update(payload).eq('id', id).eq('owner_id', ownerId);
    if (error) throw new Error(error.message || 'error_update_simple');
    return { success: true, id };
  } else {
    const { data, error } = await supabase.from('ag_simple').insert(payload).select('id').single();
    if (error) throw new Error(error.message || 'error_insert_simple');
    return { success: true, id: data.id };
  }
}

export async function deleteType({ ownerId, id }) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('ag_simple').delete().eq('id', id).eq('owner_id', ownerId);
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function adjustTypeStock({ ownerId, id, delta }) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('ag_simple').select('stock').eq('id', id).eq('owner_id', ownerId).single();
  if (error) throw new Error(error.message);
  const newStock = Math.max(0, (Number(data.stock) || 0) + (Number(delta) || 0));
  const { error: uErr } = await supabase.from('ag_simple').update({ stock: newStock }).eq('id', id).eq('owner_id', ownerId);
  if (uErr) throw new Error(uErr.message);
  return { success: true, stock: newStock };
}

export async function listDevices({ ownerId, query, limit = 50 }) {
  const supabase = getSupabaseClient();
  const nq = norm(query || '');
  if (nq) {
    const { data: dev1, error: e1 } = await supabase
      .from('ag_devices')
      .select('id, brand, model_label')
      .eq('owner_id', ownerId)
      .ilike('search_normalized', `%${nq}%`)
      .limit(limit);
    if (e1) throw new Error(e1.message);
    const { data: dev2, error: e2 } = await supabase
      .from('ag_device_alias')
      .select('device_id')
      .eq('owner_id', ownerId)
      .ilike('search_normalized', `%${nq}%`)
      .limit(limit);
    if (e2) throw new Error(e2.message);
    const idSet = new Set();
    (dev1 || []).forEach(d => idSet.add(d.id));
    (dev2 || []).forEach(a => idSet.add(a.device_id));
    const ids = Array.from(idSet);
    if (ids.length === 0) return [];
    const { data, error } = await supabase
      .from('ag_devices')
      .select('id, brand, model_label')
      .eq('owner_id', ownerId)
      .in('id', ids)
      .limit(limit);
    if (error) throw new Error(error.message);
    return data || [];
  }
  const { data, error } = await supabase
    .from('ag_devices')
    .select('id, brand, model_label')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data || [];
}

export async function createDevice({ ownerId, brand, model_label }) {
  const supabase = getSupabaseClient();
  const payload = { owner_id: ownerId, brand: brand || null, model_label };
  const { data, error } = await supabase.from('ag_devices').insert(payload).select('id').single();
  if (error) throw new Error(error.message);
  return { success: true, id: data.id };
}

export async function updateDevice({ ownerId, id, brand, model_label }) {
  const supabase = getSupabaseClient();
  const payload = { brand: brand || null, model_label };
  const { error } = await supabase.from('ag_devices').update(payload).eq('id', id).eq('owner_id', ownerId);
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function deleteDevice({ ownerId, id }) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('ag_devices').delete().eq('id', id).eq('owner_id', ownerId);
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function addAlias({ ownerId, device_id, alias_label }) {
  const supabase = getSupabaseClient();
  const payload = { owner_id: ownerId, device_id, alias_label };
  const { error } = await supabase.from('ag_device_alias').insert(payload);
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function linkTypeDevice({ ownerId, type_id, device_id }) {
  const supabase = getSupabaseClient();
  const payload = { owner_id: ownerId, type_id, device_id };
  const { error } = await supabase.from('ag_type_device').insert(payload);
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function unlinkTypeDevice({ ownerId, type_id, device_id }) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('ag_type_device').delete().eq('owner_id', ownerId).eq('type_id', type_id).eq('device_id', device_id);
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function getTypeDevices({ ownerId, type_id }) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('ag_type_device')
    .select('device:ag_devices(id, brand, model_label)')
    .eq('owner_id', ownerId)
    .eq('type_id', type_id)
    .limit(2000);
  if (error) throw new Error(error.message);
  return (data || []).map(r => r.device);
}
