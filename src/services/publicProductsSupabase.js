import { getSupabaseClient } from './supabase';

async function getSessionUser() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { supabase: null, user: null, error: 'Supabase tidak tersedia' };
  }
  try {
    const { data } = await supabase.auth.getSession();
    const session = data?.session;
    const user = session?.user || null;
    if (!user) {
      return { supabase, user: null, error: 'User tidak ter-autentikasi' };
    }
    return { supabase, user, error: null };
  } catch (e) {
    return { supabase, user: null, error: e?.message || 'Gagal mengambil session' };
  }
}

export async function listPublicBrands() {
  const { supabase, user, error } = await getSessionUser();
  if (!supabase || !user) {
    return { success: false, error, data: [] };
  }
  const { data, error: qError } = await supabase
    .from('public_brands')
    .select('*')
    .eq('owner_id', user.id)
    .order('name', { ascending: true });
  if (qError) {
    return { success: false, error: qError.message, data: [] };
  }
  return { success: true, data: data || [] };
}

export async function createPublicBrand(name, description = '') {
  const { supabase, user, error } = await getSessionUser();
  if (!supabase || !user) {
    return { success: false, error };
  }
  const payload = {
    owner_id: user.id,
    name: String(name || '').trim(),
    description: description || null,
  };
  const { data, error: qError } = await supabase
    .from('public_brands')
    .insert(payload)
    .select()
    .single();
  if (qError) {
    return { success: false, error: qError.message };
  }
  return { success: true, data };
}

export async function listPublicCategories() {
  const { supabase, user, error } = await getSessionUser();
  if (!supabase || !user) {
    return { success: false, error, data: [] };
  }
  const { data, error: qError } = await supabase
    .from('public_categories')
    .select('*')
    .eq('owner_id', user.id)
    .order('name', { ascending: true });
  if (qError) {
    return { success: false, error: qError.message, data: [] };
  }
  return { success: true, data: data || [] };
}

export async function createPublicCategory(name, description = '') {
  const { supabase, user, error } = await getSessionUser();
  if (!supabase || !user) {
    return { success: false, error };
  }
  const payload = {
    owner_id: user.id,
    name: String(name || '').trim(),
    description: description || null,
  };
  const { data, error: qError } = await supabase
    .from('public_categories')
    .insert(payload)
    .select()
    .single();
  if (qError) {
    return { success: false, error: qError.message };
  }
  return { success: true, data };
}

export async function listPublicProductsAdmin() {
  const { supabase, user, error } = await getSessionUser();
  if (!supabase || !user) {
    return { success: false, error, data: [] };
  }
  const { data, error: qError } = await supabase
    .from('public_products')
    .select(
      `
        *,
        public_brands ( id, name ),
        public_categories ( id, name )
      `
    )
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false });
  if (qError) {
    return { success: false, error: qError.message, data: [] };
  }
  const mapped = (data || []).map((p) => ({
    ...p,
    brand: p.public_brands || null,
    category: p.public_categories || null,
  }));
  return { success: true, data: mapped };
}

export async function getPublicProductById(id) {
  const { supabase, user, error } = await getSessionUser();
  if (!supabase || !user) {
    return { success: false, error, data: null };
  }
  const { data, error: qError } = await supabase
    .from('public_products')
    .select(
      `
        *,
        public_brands ( id, name ),
        public_categories ( id, name )
      `
    )
    .eq('owner_id', user.id)
    .eq('id', id)
    .maybeSingle();
  if (qError) {
    return { success: false, error: qError.message, data: null };
  }
  if (!data) {
    return { success: true, data: null };
  }
  return {
    success: true,
    data: {
      ...data,
      brand: data.public_brands || null,
      category: data.public_categories || null,
    },
  };
}

export async function getPublicProductByIdPublic(id) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Supabase tidak tersedia', data: null };
  }
  const { data, error } = await supabase
    .from('public_products')
    .select(
      `
        id,
        title,
        price,
        stock,
        description,
        image_urls,
        is_active,
        public_brands ( id, name ),
        public_categories ( id, name )
      `
    )
    .eq('id', id)
    .maybeSingle();
  if (error) {
    return { success: false, error: error.message, data: null };
  }
  if (!data) {
    return { success: true, data: null };
  }
  return {
    success: true,
    data: {
      id: data.id,
      title: data.title,
      price: data.price,
      stock: data.stock,
      description: data.description,
      image_urls: Array.isArray(data.image_urls) ? data.image_urls : [],
      is_active: data.is_active,
      brand: data.public_brands || null,
      category: data.public_categories || null,
    },
  };
}

export async function createPublicProduct(payload) {
  const { supabase, user, error } = await getSessionUser();
  if (!supabase || !user) {
    return { success: false, error };
  }
  const imageUrls = Array.isArray(payload.image_urls) ? payload.image_urls.slice(0, 5) : [];
  const body = {
    owner_id: user.id,
    title: String(payload.title || '').trim(),
    price: Number(payload.price || 0),
    stock: Number(payload.stock || 0),
    image_urls: imageUrls,
    brand_id: payload.brand_id || null,
    category_id: payload.category_id || null,
    description: payload.description || null,
    is_active: payload.is_active !== undefined ? !!payload.is_active : true,
  };
  const { data, error: qError } = await supabase
    .from('public_products')
    .insert(body)
    .select()
    .single();
  if (qError) {
    return { success: false, error: qError.message };
  }
  return { success: true, data };
}

export async function updatePublicProduct(id, payload) {
  const { supabase, user, error } = await getSessionUser();
  if (!supabase || !user) {
    return { success: false, error };
  }
  const patch = {
    updated_at: new Date().toISOString(),
  };
  if (payload.title !== undefined) {
    patch.title = String(payload.title || '').trim();
  }
  if (payload.price !== undefined) {
    patch.price = Number(payload.price || 0);
  }
  if (payload.image_urls !== undefined) {
    patch.image_urls = Array.isArray(payload.image_urls) ? payload.image_urls.slice(0, 5) : [];
  }
  if (payload.stock !== undefined) {
    patch.stock = Number(payload.stock || 0);
  }
  if (payload.brand_id !== undefined) {
    patch.brand_id = payload.brand_id || null;
  }
  if (payload.category_id !== undefined) {
    patch.category_id = payload.category_id || null;
  }
  if (payload.description !== undefined) {
    patch.description = payload.description || null;
  }
  if (payload.is_active !== undefined) {
    patch.is_active = !!payload.is_active;
  }
  const { data, error: qError } = await supabase
    .from('public_products')
    .update(patch)
    .eq('owner_id', user.id)
    .eq('id', id)
    .select()
    .single();
  if (qError) {
    return { success: false, error: qError.message };
  }
  return { success: true, data };
}

export async function deletePublicProduct(id) {
  const { supabase, user, error } = await getSessionUser();
  if (!supabase || !user) {
    return { success: false, error };
  }
  const { error: qError } = await supabase
    .from('public_products')
    .delete()
    .eq('owner_id', user.id)
    .eq('id', id);
  if (qError) {
    return { success: false, error: qError.message };
  }
  return { success: true };
}

export async function listPublicProductsPublic() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Supabase tidak tersedia', data: [] };
  }
  const { data, error } = await supabase
    .from('public_products')
    .select(
      `
        id,
        title,
        price,
        stock,
        description,
        image_urls,
        is_active,
        public_brands ( id, name ),
        public_categories ( id, name )
      `
    )
    .eq('is_active', true)
    .order('created_at', { ascending: false });
  if (error) {
    return { success: false, error: error.message, data: [] };
  }
  const mapped = (data || []).map((p) => ({
    id: p.id,
    title: p.title,
    price: p.price,
    stock: p.stock,
    description: p.description,
    image_urls: Array.isArray(p.image_urls) ? p.image_urls : [],
    brand: p.public_brands || null,
    category: p.public_categories || null,
  }));
  return { success: true, data: mapped };
}
