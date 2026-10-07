import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabaseClient } from './supabase';

const PRODUCT_TYPE_STORAGE_PREFIX = '@posdewa_prod_types_';

export const PRODUCT_TYPES = [
  {
    id: 'physical',
    label: 'Produk Fisik Toko',
    icon: 'cube-outline',
    color: '#3B82F6',
    bg: '#EFF6FF',
    desc: 'Barang kulakan sendiri (modal toko tertanam di stok).',
  },
  {
    id: 'consignment',
    label: 'Barang Titipan / Konsinyasi',
    icon: 'hand-right-outline',
    color: '#8B5CF6',
    bg: '#F5F3FF',
    desc: 'Barang titipan orang lain (Modal Toko Rp 0, toko ambil komisi keuntungan).',
  },
  {
    id: 'voucher',
    label: 'Voucher Internet Fisik',
    icon: 'card-outline',
    color: '#10B981',
    bg: '#ECFDF5',
    desc: 'Voucher fisik gesek / perdana (modal beli per lembar pcs).',
  },
  {
    id: 'digital',
    label: 'Produk Digital / Non-Fisik',
    icon: 'flash-outline',
    color: '#F59E0B',
    bg: '#FFFBEB',
    desc: 'Pulsa, Paket Data, PPOB, Tiket, atau Topup (tanpa stok fisik).',
  },
  {
    id: 'financial_service',
    label: 'Jasa Tarik Tunai / Transfer',
    icon: 'swap-horizontal-outline',
    color: '#EC4899',
    bg: '#FDF2F8',
    desc: 'Layanan penarikan tunai & transfer (pendapatan murni biaya admin).',
  },
];

/**
 * Get map of all product metadata (type, consignor info)
 */
export async function getProductTypesMap(userId) {
  if (!userId) return {};
  let map = {};

  // 1. Get from AsyncStorage
  try {
    const raw = await AsyncStorage.getItem(`${PRODUCT_TYPE_STORAGE_PREFIX}${userId}`);
    if (raw) {
      map = JSON.parse(raw);
    }
  } catch {
    map = {};
  }

  // 2. Sync from Supabase products table if columns exist
  const supabase = getSupabaseClient();
  if (supabase && userId) {
    try {
      const { data: dbProducts, error } = await supabase
        .from('products')
        .select('id, product_type, consignor_name, consignor_phone, is_unlimited, track_stock')
        .eq('owner_id', userId);

      if (!error && Array.isArray(dbProducts)) {
        dbProducts.forEach(p => {
          const isUnlim = typeof p.is_unlimited === 'boolean'
            ? p.is_unlimited
            : (p.track_stock === false || p.product_type === 'digital' || p.product_type === 'financial_service');
          if (p.product_type || p.consignor_name || isUnlim) {
            map[p.id] = {
              type: p.product_type || map[p.id]?.type || 'physical',
              consignorName: p.consignor_name || map[p.id]?.consignorName || '',
              consignorPhone: p.consignor_phone || map[p.id]?.consignorPhone || '',
              isUnlimited: isUnlim || map[p.id]?.isUnlimited || false,
              updatedAt: new Date().toISOString(),
            };
          }
        });
      }
    } catch {
      // Columns may not exist yet, local storage remains safe
    }
  }

  return map;
}

/**
 * Set metadata for a product
 */
export async function setProductTypeMeta(userId, productId, { type = 'physical', consignorName = '', consignorPhone = '', isUnlimited = null }) {
  if (!userId || !productId) return false;
  try {
    const map = await getProductTypesMap(userId);
    const existing = map[productId] || {};
    
    // Auto-detect isUnlimited if not specified
    const determinedUnlimited = isUnlimited !== null 
      ? Boolean(isUnlimited)
      : (type === 'digital' || type === 'financial_service' ? true : Boolean(existing.isUnlimited));

    const metaObj = {
      ...existing,
      type,
      consignorName: consignorName || existing.consignorName || '',
      consignorPhone: consignorPhone || existing.consignorPhone || '',
      isUnlimited: determinedUnlimited,
      updatedAt: new Date().toISOString(),
    };
    // Simpan dalam key asli, string, dan number agar aman dari mismatch tipe data
    map[productId] = metaObj;
    map[String(productId)] = metaObj;
    const numId = Number(productId);
    if (!isNaN(numId)) {
      map[numId] = metaObj;
    }

    await AsyncStorage.setItem(`${PRODUCT_TYPE_STORAGE_PREFIX}${userId}`, JSON.stringify(map));

    // Try saving directly to Supabase products table
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const updatePayload = {
          product_type: type,
          consignor_name: consignorName || null,
          consignor_phone: consignorPhone || null,
          is_unlimited: determinedUnlimited,
          track_stock: !determinedUnlimited,
        };
        const { error } = await supabase
          .from('products')
          .update(updatePayload)
          .eq('id', productId)
          .eq('owner_id', userId);

        if (error && (error.message?.includes('is_unlimited') || error.message?.includes('track_stock'))) {
          // If is_unlimited or track_stock columns do not exist yet, fallback without them
          delete updatePayload.is_unlimited;
          delete updatePayload.track_stock;
          await supabase
            .from('products')
            .update(updatePayload)
            .eq('id', productId)
            .eq('owner_id', userId);
        }
      } catch {
        // Continue silently if column not created yet
      }
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Helper to get metadata config for a product type
 */
export function getProductTypeConfig(typeId) {
  const found = PRODUCT_TYPES.find(t => t.id === typeId);
  return found || {
    id: 'physical',
    label: 'Fisik Toko',
    icon: 'cube-outline',
    color: '#3B82F6',
    bg: '#EFF6FF',
  };
}

/**
 * Helper to determine if a product is consignment based on metadata, name, or category
 */
export function isConsignmentProduct(product, meta = {}) {
  if (!product) return false;
  if (product.product_type === 'consignment') return true;

  const idStr = String(product.id || '');
  const idNum = Number(product.id);
  const pMeta = meta[product.id] || meta[idStr] || (!isNaN(idNum) ? meta[idNum] : null);
  if (pMeta && pMeta.type === 'consignment') return true;

  // Check category or name keywords
  const nameLower = (product.name || '').toLowerCase();
  const catLower = (product.category_name || product.category || '').toLowerCase();

  return (
    nameLower.includes('[titip') ||
    nameLower.includes('(titip') ||
    nameLower.includes('titipan') ||
    nameLower.includes('konsinyasi') ||
    catLower.includes('titip') ||
    catLower.includes('konsinyasi')
  );
}

/**
 * Helper to detect product type
 */
export function detectProductType(product, meta = {}) {
  if (!product) return 'physical';

  // 1. Cek langsung properti product_type dari database
  if (product.product_type) return product.product_type;

  // 2. Cek metadata map (string & number keys)
  const idStr = String(product.id || '');
  const idNum = Number(product.id);
  const pMeta = meta[product.id] || meta[idStr] || (!isNaN(idNum) ? meta[idNum] : null);
  if (pMeta?.type) return pMeta.type;

  // 3. Cek apakah barang titipan
  if (isConsignmentProduct(product, meta)) return 'consignment';

  // 4. Deteksi cerdas nama / kategori
  const nameLower = (product.name || '').toLowerCase();
  const catLower = (product.category_name || product.category || '').toLowerCase();

  if (nameLower.includes('voucher') || catLower.includes('voucher') || nameLower.includes('perdana')) {
    return 'voucher';
  }
  if (nameLower.includes('tarik tunai') || nameLower.includes('transfer') || catLower.includes('tarik tunai')) {
    return 'financial_service';
  }
  if (nameLower.includes('paket data') || nameLower.includes('pulsa') || catLower.includes('ppob') || catLower.includes('digital') || nameLower.includes('token pln')) {
    return 'digital';
  }

  return 'physical';
}

/**
 * Helper to determine if a product has unlimited / non-tracked stock
 * (e.g. Paket Data, Pulsa, Token Listrik, Jasa, or manually marked unlimited)
 */
export function isUnlimitedProduct(product, meta = {}) {
  if (!product) return false;

  // 1. Explicit flags from DB or model (true OR false wins)
  if (typeof product.is_unlimited === 'boolean') return product.is_unlimited;
  if (typeof product.isUnlimited === 'boolean') return product.isUnlimited;
  if (product.track_stock === false || product.trackStock === false) return true;

  // 2. Check metadata
  const idStr = String(product.id || '');
  const idNum = Number(product.id);
  const pMeta = meta[product.id] || meta[idStr] || (!isNaN(idNum) ? meta[idNum] : null);
  if (pMeta?.isUnlimited === true) return true;

  // 3. Check detected type (digital and financial services are inherently unlimited)
  const pType = detectProductType(product, meta);
  if (pType === 'digital' || pType === 'financial_service') return true;

  return false;
}

