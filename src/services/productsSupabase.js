import { getSupabaseClient } from './supabase';

export async function listProducts(userId) {
  console.log('🔄 productsSupabase: listProducts called with userId:', userId);
  
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.log('❌ productsSupabase: Supabase client not available');
    return [];
  }

  // Check current session with retry mechanism
  let session = null;
  let sessionError = null;
  
  try {
    const sessionResult = await supabase.auth.getSession();
    session = sessionResult.data?.session;
    sessionError = sessionResult.error;
    
    console.log('🔐 productsSupabase: Current session:', session ? 'exists' : 'null');
    console.log('🔐 productsSupabase: Session user:', session?.user?.id);
    console.log('🔐 productsSupabase: Session error:', sessionError);
    
    // If no session, try to refresh
    if (!session) {
      console.log('🔄 productsSupabase: No session found, attempting refresh...');
      const refreshResult = await supabase.auth.refreshSession();
      session = refreshResult.data?.session;
      console.log('🔄 productsSupabase: After refresh - session:', session ? 'exists' : 'null');
    }
  } catch (error) {
    console.log('❌ productsSupabase: Error getting session:', error);
  }
  
  if (!session || !session.user) {
    console.log('❌ productsSupabase: User not authenticated for listProducts');
    return [];
  }

  try {
    console.log('📡 productsSupabase: Querying products table...');
    
    const { data, error, count } = await supabase
      .from('products')
      .select('*', { count: 'exact' })
      .eq('owner_id', session.user.id) // Use session user ID
      .order('created_at', { ascending: false });

    console.log('📡 productsSupabase: Query result:', { data, dataCount: count, error });

    if (error) {
      console.log('❌ productsSupabase: Query error:', error);
      throw error;
    }

    console.log('✅ productsSupabase: Products loaded:', data?.length || 0);
    return data || [];
  } catch (e) {
    console.log('❌ productsSupabase: listProducts exception:', e);
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
  console.log('🔄 productsSupabase: findProducts called with userId:', userId, 'query:', query);
  const result = await searchProducts(userId, query);
  return result;
}

export async function getProduct(userId, id) {
  console.log('🔄 productsSupabase: getProduct called with userId:', userId, 'id:', id);
  
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.log('❌ productsSupabase: Supabase client not available');
    return { data: null, error: 'Supabase tidak tersedia' };
  }

  // Check current session
  let session = null;
  try {
    const sessionResult = await supabase.auth.getSession();
    session = sessionResult.data?.session;
    
    if (!session || !session.user) {
      console.log('❌ productsSupabase: User not authenticated for getProduct');
      return { data: null, error: 'User tidak ter-autentikasi' };
    }
  } catch (error) {
    console.log('❌ productsSupabase: Error getting session:', error);
    return { data: null, error: 'Error getting session' };
  }

  try {
    console.log('📡 productsSupabase: Querying product by id:', id);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('owner_id', session.user.id)
      .eq('id', id)
      .single();

    console.log('📡 productsSupabase: getProduct result:', { data, error });
    return { data, error };
  } catch (error) {
    console.log('❌ productsSupabase: Exception in getProduct:', error);
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
  console.log('🔄 productsSupabase: createProduct payload:', payload);
  
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.log('❌ productsSupabase: Supabase client not available');
    return { success: false, error: 'Supabase tidak tersedia' };
  }

  // Check current session with retry mechanism
  let session = null;
  let sessionError = null;
  
  try {
    const sessionResult = await supabase.auth.getSession();
    session = sessionResult.data?.session;
    sessionError = sessionResult.error;
    
    console.log('🔐 productsSupabase: Current session:', session ? 'exists' : 'null');
    console.log('🔐 productsSupabase: Session user:', session?.user?.id);
    console.log('🔐 productsSupabase: Session error:', sessionError);
    
    // If no session, try to refresh
    if (!session) {
      console.log('🔄 productsSupabase: No session found, attempting refresh...');
      const refreshResult = await supabase.auth.refreshSession();
      session = refreshResult.data?.session;
      console.log('🔄 productsSupabase: After refresh - session:', session ? 'exists' : 'null');
    }
  } catch (error) {
    console.log('❌ productsSupabase: Error getting session:', error);
  }
  
  if (!session || !session.user) {
    console.log('❌ productsSupabase: User not authenticated');
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

    console.log('📤 productsSupabase: Inserting product data:', productData);

    const { data, error } = await supabase
      .from('products')
      .insert([productData])
      .select()
      .single();

    if (error) {
      console.log('❌ productsSupabase: Insert error:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      return { success: false, error: error.message };
    }

    console.log('✅ productsSupabase: Product created successfully:', data);
    return { success: true, data };
  } catch (error) {
    console.log('❌ productsSupabase: Exception:', error);
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
  console.log('🔄 productsSupabase: updateProduct called with userId:', userId, 'id:', id, 'payload:', payload);
  
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.log('❌ productsSupabase: Supabase client not available');
    return { data: null, error: 'Supabase tidak tersedia' };
  }

  // Check current session
  let session = null;
  try {
    const sessionResult = await supabase.auth.getSession();
    session = sessionResult.data?.session;
    
    if (!session || !session.user) {
      console.log('❌ productsSupabase: User not authenticated for updateProduct');
      return { data: null, error: 'User tidak ter-autentikasi' };
    }
  } catch (error) {
    console.log('❌ productsSupabase: Error getting session:', error);
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

    console.log('📤 productsSupabase: Updating product with patch:', patch);

    const { data, error } = await supabase
      .from('products')
      .update(patch)
      .eq('owner_id', session.user.id)
      .eq('id', id)
      .select()
      .single();

    console.log('📡 productsSupabase: updateProduct result:', { data, error });
    return { data, error };
  } catch (error) {
    console.log('❌ productsSupabase: Exception in updateProduct:', error);
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

  const { error, data } = await supabase
    .from('products')
    .delete()
    .eq('owner_id', userId)
    .eq('id', id)
    .select();

  if (error) {
    // Jika error foreign key violation (23503), berarti database menahan penghapusan
    // karena setting ON DELETE masih RESTRICT atau CASCADE (tapi user mau history disimpan)
    if (error.code === '23503') {
      console.log('⚠️ Delete failed due to FK constraint. User needs to update DB schema.');
      return { 
        error: 'Gagal hapus: Data terkunci oleh riwayat stok. Harap jalankan script "fix_product_delete.sql" di Supabase agar produk bisa dihapus tanpa menghilangkan history.' 
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
  console.log('📦 productsSupabase: adjustStockOnSale called with userId:', userId, 'items:', cartItems);
  
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.log('❌ productsSupabase: Supabase client not available');
    return { success: false, error: 'Supabase tidak tersedia' };
  }

  try {
    // Get current session
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session;
    
    if (!session || !session.user) {
      console.log('❌ productsSupabase: User not authenticated');
      return { success: false, error: 'User tidak ter-autentikasi' };
    }

    console.log('📡 productsSupabase: Processing stock adjustments...');
    
    // Process each cart item
    for (const item of cartItems) {
      console.log('📦 productsSupabase: Adjusting stock for product:', item.productId, 'qty:', item.qty);
      
      // Get current product stock
      const { data: product, error: getError } = await supabase
        .from('products')
        .select('stock')
        .eq('id', item.productId)
        .eq('owner_id', session.user.id)
        .single();

      if (getError) {
        console.log('❌ productsSupabase: Error getting product:', item.productId, getError);
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
        console.log('❌ productsSupabase: Error updating stock for product:', item.productId, updateError);
      } else {
        console.log('✅ productsSupabase: Stock updated for product:', item.productId, 'from', currentStock, 'to', newStock);
      }
    }

    console.log('✅ productsSupabase: Stock adjustment completed');
    return { success: true };

  } catch (error) {
    console.log('❌ productsSupabase: Exception in adjustStockOnSale:', error);
    return { success: false, error: error.message };
  }
}
