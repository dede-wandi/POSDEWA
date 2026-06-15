import { getSupabaseClient } from './supabase';

/**
 * Ambil riwayat perubahan semua field untuk satu produk
 * @param {string} productId - UUID produk
 * @param {object} options - { fieldName, limit, page }
 */
export const getProductChangeLog = async (productId, options = {}) => {
  try {
    const supabase = getSupabaseClient();
    const { fieldName = null, limit = 50, page = 0 } = options;

    let query = supabase
      .from('product_change_log')
      .select('*')
      .eq('product_id', productId)
      .order('changed_at', { ascending: false })
      .range(page * limit, (page + 1) * limit - 1);

    if (fieldName) {
      query = query.eq('field_name', fieldName);
    }

    const { data, error } = await query;
    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (error) {
    return { success: false, error: error.message, data: [] };
  }
};

/**
 * Ambil riwayat perubahan SEMUA produk milik user (untuk halaman log global)
 * @param {string} userId
 * @param {object} options - { fieldName, startDate, endDate, limit, page }
 */
export const getAllProductChangeLogs = async (userId, options = {}) => {
  try {
    const supabase = getSupabaseClient();
    const { fieldName = null, startDate = null, endDate = null, limit = 100, page = 0, productId = null } = options;

    let query = supabase
      .from('product_change_log')
      .select(`
        id,
        product_id,
        field_name,
        old_value,
        new_value,
        change_reason,
        note,
        changed_at,
        products (
          id,
          name,
          barcode
        )
      `)
      .eq('owner_id', userId)
      .order('changed_at', { ascending: false })
      .range(page * limit, (page + 1) * limit - 1);

    if (productId) query = query.eq('product_id', productId);
    if (fieldName)  query = query.eq('field_name', fieldName);
    if (startDate)  query = query.gte('changed_at', startDate);
    if (endDate)    query = query.lte('changed_at', endDate);

    const { data, error } = await query;
    if (error) throw error;

    // Flatten: sertakan nama produk langsung di objek log
    const transformed = (data || []).map(row => ({
      ...row,
      product_name: row.products?.name || '-',
      current_barcode: row.products?.barcode || '-',
    }));

    return { success: true, data: transformed };
  } catch (error) {
    return { success: false, error: error.message, data: [] };
  }
};

/**
 * Ambil riwayat khusus HARGA JUAL untuk satu produk
 */
export const getPriceHistory = async (productId, limit = 30) => {
  return getProductChangeLog(productId, { fieldName: 'price', limit });
};

/**
 * Ambil riwayat khusus HARGA MODAL untuk satu produk
 */
export const getCostPriceHistory = async (productId, limit = 30) => {
  return getProductChangeLog(productId, { fieldName: 'cost_price', limit });
};

/**
 * Ambil riwayat khusus STOK untuk satu produk
 */
export const getStockHistory = async (productId, limit = 30) => {
  return getProductChangeLog(productId, { fieldName: 'stock', limit });
};

/**
 * Ambil riwayat khusus BARCODE untuk satu produk
 */
export const getBarcodeHistory = async (productId, limit = 30) => {
  return getProductChangeLog(productId, { fieldName: 'barcode', limit });
};

/**
 * Ambil riwayat khusus NAMA PRODUK
 */
export const getNameHistory = async (productId, limit = 30) => {
  return getProductChangeLog(productId, { fieldName: 'name', limit });
};

/**
 * Catat perubahan manual ke log (untuk kasus yang tidak di-trigger otomatis)
 * Biasanya TIDAK perlu karena sudah ada DB trigger.
 * Gunakan ini hanya jika insert manual diperlukan.
 */
export const logProductChange = async (userId, productId, fieldName, oldValue, newValue, reason = 'edit_manual', note = null) => {
  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('product_change_log')
      .insert({
        product_id: productId,
        owner_id: userId,
        field_name: fieldName,
        old_value: oldValue != null ? String(oldValue) : null,
        new_value: newValue != null ? String(newValue) : null,
        change_reason: reason,
        note,
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Label field yang mudah dibaca manusia
 */
export const FIELD_LABELS = {
  name:       'Nama Produk',
  price:      'Harga Jual',
  cost_price: 'Harga Modal',
  stock:      'Stok',
  barcode:    'Barcode',
};

/**
 * Label alasan perubahan
 */
export const REASON_LABELS = {
  edit_manual: '✏️ Edit Manual',
  penjualan:   '🛒 Penjualan',
  restock:     '📦 Restock',
  koreksi:     '🔧 Koreksi',
  import:      '📥 Import',
};

/**
 * Format nilai log agar lebih mudah dibaca (harga, stok, dll)
 */
export const formatLogValue = (fieldName, value) => {
  if (value === null || value === undefined || value === '') return '-';
  if (fieldName === 'price' || fieldName === 'cost_price') {
    const num = Number(value);
    if (!isNaN(num)) {
      return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
      }).format(num);
    }
  }
  return String(value);
};
