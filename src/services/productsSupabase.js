import { getSupabaseClient } from './supabase';

export async function listProducts(userId) {
  
  const supabase = getSupabaseClient();
  if (!supabase) {
    return [];
  }

  // Check current session with retry mechanism
  let session = null;
  let sessionError = null;
  
  try {
    const sessionResult = await supabase.auth.getSession();
    session = sessionResult.data?.session;
    sessionError = sessionResult.error;
    
    
    // If no session, try to refresh
    if (!session) {
      const refreshResult = await supabase.auth.refreshSession();
      session = refreshResult.data?.session;
    }
  } catch (error) {
  }
  
  if (!session || !session.user) {
    return [];
  }

  try {
    
    const { data, error, count } = await supabase
      .from('products')
      .select('*', { count: 'exact' })
      .eq('owner_id', session.user.id) // Use session user ID
      .order('created_at', { ascending: false });


    if (error) {
      throw error;
    }

    return data || [];
  } catch (e) {
    return [];
  }
}

export async function searchProducts(userId, q) {
  const supabase = getSupabaseClient();
  if (!supabase) return { data: [], error: 'Supabase tidak tersedia' };

  // Selalu gunakan session user agar konsisten, abaikan userId arg jika tidak cocok/undefined
  let session = null;
  try {
    const sessionResult = await supabase.auth.getSession();
    session = sessionResult.data?.session;
    if (!session) {
      const refreshResult = await supabase.auth.refreshSession();
      session = refreshResult.data?.session;
    }
  } catch (e) {
    // ignore
  }

  if (!session || !session.user) {
    return { data: [], error: 'User tidak ter-autentikasi' };
  }

  const query = String(q || '').toLowerCase();
  if (!query) return listProducts(session.user.id);

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('owner_id', session.user.id)
    .or(`name.ilike.%${query}%,barcode.ilike.%${query}%`)
    .order('created_at', { ascending: false });

  return { data: data || [], error };
}

// Alias untuk kompatibilitas dengan kode yang sudah ada
export async function findProducts(userId, query) {
  const result = await searchProducts(userId, query);
  return result;
}

export async function getProduct(userId, id) {
  
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { data: null, error: 'Supabase tidak tersedia' };
  }

  // Check current session
  let session = null;
  try {
    const sessionResult = await supabase.auth.getSession();
    session = sessionResult.data?.session;
    
    if (!session || !session.user) {
      return { data: null, error: 'User tidak ter-autentikasi' };
    }
  } catch (error) {
    return { data: null, error: 'Error getting session' };
  }

  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('owner_id', session.user.id)
      .eq('id', id)
      .single();

    return { data, error };
  } catch (error) {
    return { data: null, error: error.message };
  }
}

export async function findByBarcodeExact(userId, barcode) {
  const supabase = getSupabaseClient();
  if (!supabase) return { data: null, error: 'Supabase tidak tersedia' };

  // Gunakan session user agar konsisten
  let session = null;
  try {
    const sessionResult = await supabase.auth.getSession();
    session = sessionResult.data?.session;
    if (!session) {
      const refreshResult = await supabase.auth.refreshSession();
      session = refreshResult.data?.session;
    }
  } catch (e) {
    // ignore
  }

  if (!session || !session.user) {
    return { data: null, error: 'User tidak ter-autentikasi' };
  }

  const cleanBarcode = String(barcode || '').trim();
  
  // Use textSearch or ilike to find potential matches
  // Because barcodes are stored as "A,B,C", we search for substring
  const { data: potentialMatches, error } = await supabase
    .from('products')
    .select('*')
    .eq('owner_id', session.user.id)
    .ilike('barcode', `%${cleanBarcode}%`);

  if (error) return { data: null, error };

  // Filter in memory to find exact match in comma-separated list
  const exactMatch = (potentialMatches || []).find(p => {
    if (!p.barcode) return false;
    const codes = p.barcode.split(',').map(b => b.trim());
    return codes.includes(cleanBarcode);
  });

  return { data: exactMatch || null, error: null };
}

export async function createProduct(payload) {
  
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Supabase tidak tersedia' };
  }

  // Check current session with retry mechanism
  let session = null;
  let sessionError = null;
  
  try {
    const sessionResult = await supabase.auth.getSession();
    session = sessionResult.data?.session;
    sessionError = sessionResult.error;
    
    
    // If no session, try to refresh
    if (!session) {
      const refreshResult = await supabase.auth.refreshSession();
      session = refreshResult.data?.session;
    }
  } catch (error) {
  }
  
  if (!session || !session.user) {
    return { success: false, error: 'User tidak ter-autentikasi. Silakan login ulang.' };
  }

  try {
    const productData = {
      name: payload.name,
      barcode: payload.barcode || null,
      price: Number(payload.price || 0),
      cost_price: Number(payload.costPrice || 0), // Gunakan cost_price sesuai schema database
      stock: Number(payload.stock || 0),
      image_urls: Array.isArray(payload.image_urls) ? payload.image_urls : [],
      category_id: payload.category_id || null,
      brand_id: payload.brand_id || null,
      owner_id: session.user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };


    const { data, error } = await supabase
      .from('products')
      .insert([productData])
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function listCategories(userId) {
  const supabase = getSupabaseClient();
  if (!supabase) return { data: [], error: 'Supabase tidak tersedia' };

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session;
    
    if (!session || !session.user) return { data: [], error: 'User tidak ter-autentikasi' };

    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('owner_id', session.user.id)
      .order('name', { ascending: true });

    return { data: data || [], error };
  } catch (error) {
    return { data: [], error: error.message };
  }
}

export async function createCategory(userId, name) {
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, error: 'Supabase tidak tersedia' };

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session;
    
    if (!session || !session.user) return { success: false, error: 'User tidak ter-autentikasi' };

    const { data, error } = await supabase
      .from('categories')
      .insert({
        owner_id: session.user.id,
        name: String(name).trim(),
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function listBrands(userId) {
  const supabase = getSupabaseClient();
  if (!supabase) return { data: [], error: 'Supabase tidak tersedia' };

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session;
    
    if (!session || !session.user) return { data: [], error: 'User tidak ter-autentikasi' };

    const { data, error } = await supabase
      .from('brands')
      .select('*')
      .eq('owner_id', session.user.id)
      .order('name', { ascending: true });

    return { data: data || [], error };
  } catch (error) {
    return { data: [], error: error.message };
  }
}

export async function createBrand(userId, name) {
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, error: 'Supabase tidak tersedia' };

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session;
    
    if (!session || !session.user) return { success: false, error: 'User tidak ter-autentikasi' };

    const { data, error } = await supabase
      .from('brands')
      .insert({
        owner_id: session.user.id,
        name: String(name).trim(),
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
export async function updateProduct(userId, id, payload) {
  
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { data: null, error: 'Supabase tidak tersedia' };
  }

  // Check current session
  let session = null;
  try {
    const sessionResult = await supabase.auth.getSession();
    session = sessionResult.data?.session;
    
    if (!session || !session.user) {
      return { data: null, error: 'User tidak ter-autentikasi' };
    }
  } catch (error) {
    return { data: null, error: 'Error getting session' };
  }

  try {
    const patch = {
      updated_at: new Date().toISOString()
    };
    
    if (payload.name != null) patch.name = String(payload.name);
    if (payload.barcode != null) patch.barcode = String(payload.barcode || '').trim() || null;
    if (payload.price != null) patch.price = Number(payload.price);
    if (payload.costPrice != null) patch.cost_price = Number(payload.costPrice);
    if (payload.stock != null) patch.stock = Number(payload.stock);
    if (payload.image_urls != null) patch.image_urls = payload.image_urls;
    if (payload.category_id !== undefined) patch.category_id = payload.category_id;
    if (payload.brand_id !== undefined) patch.brand_id = payload.brand_id;


    const { data, error } = await supabase
      .from('products')
      .update(patch)
      .eq('owner_id', session.user.id)
      .eq('id', id)
      .select()
      .single();

    return { data, error };
  } catch (error) {
    return { data: null, error: error.message };
  }
}

export async function deleteProduct(userId, id) {
  const supabase = getSupabaseClient();
  if (!supabase || !userId) return { error: 'Supabase tidak tersedia atau user tidak login' };
  
  // Cek dulu apakah produk ada dan milik user
  const { data: existing, error: checkError } = await supabase
    .from('products')
    .select('id, owner_id')
    .eq('id', id)
    .single();

  if (checkError) {
    return { error: `Gagal mengecek produk: ${checkError.message}` };
  }

  if (!existing) {
    return { error: 'Produk tidak ditemukan' };
  }

  if (existing.owner_id !== userId) {
    return { error: 'Anda tidak memiliki izin menghapus produk ini' };
  }

  // 1. Hapus riwayat stok produk ini terlebih dahulu di level aplikasi
  try {
    const { error: stockHistError } = await supabase
      .from('stock_history')
      .delete()
      .eq('product_id', id);
    if (stockHistError) {
      console.log('Error deleting related stock history:', stockHistError);
    }
  } catch (err) {
    console.log('Failed to execute stock history deletion:', err);
  }

  // 2. Hapus produk
  const { error, data } = await supabase
    .from('products')
    .delete()
    .eq('owner_id', userId)
    .eq('id', id)
    .select();

  if (error) {
    if (error.code === '23503') {
      return { 
        error: 'Gagal hapus: Data masih terikat oleh foreign key constraint. Silakan jalankan script SQL di file "src/database/fix_product_delete.sql" pada Supabase editor Anda untuk mengaktifkan CASCADE.' 
      };
    }
    return { error: error.message };
  }

  if (!data || data.length === 0) {
    return { error: 'Gagal menghapus produk (tidak ada data terhapus). Mungkin terkait RLS atau Foreign Key.' };
  }

  return { error: null };
}

export async function adjustStockOnSale(userId, cartItems) {
  
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Supabase tidak tersedia' };
  }

  try {
    // Get current session
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session;
    
    if (!session || !session.user) {
      return { success: false, error: 'User tidak ter-autentikasi' };
    }

    
    // Process each cart item
    for (const item of cartItems) {
      
      // Get current product stock
      const { data: product, error: getError } = await supabase
        .from('products')
        .select('stock')
        .eq('id', item.productId)
        .eq('owner_id', session.user.id)
        .single();

      if (getError) {
        continue;
      }

      // Calculate new stock
      const currentStock = product.stock || 0;
      const newStock = Math.max(0, currentStock - item.qty);

      // Update stock
      const { error: updateError } = await supabase
        .from('products')
        .update({ stock: newStock, last_change_reason: 'penjualan' })
        .eq('id', item.productId)
        .eq('owner_id', session.user.id);

      if (updateError) {
      } else {
      }
    }

    return { success: true };

  } catch (error) {
    return { success: false, error: error.message };
  }
}
