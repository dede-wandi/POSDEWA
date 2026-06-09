import { getSupabaseClient } from './supabase';
import * as local from '../storage/products';
import * as cloud from './productsSupabase';
import { listProducts, searchProducts, listCategories, createCategory, listBrands, createBrand } from './productsSupabase';

export async function getCategories(userId) {
  const supabase = getSupabaseClient();
  if (supabase && userId) {
    const { data } = await listCategories(userId);
    return data || [];
  }
  return [];
}

export async function addCategory(userId, name) {
  const supabase = getSupabaseClient();
  if (supabase && userId) {
    return await createCategory(userId, name);
  }
  return { success: false, error: 'Supabase required' };
}

export async function getBrands(userId) {
  const supabase = getSupabaseClient();
  if (supabase && userId) {
    const { data } = await listBrands(userId);
    return data || [];
  }
  return [];
}

export async function addBrand(userId, name) {
  const supabase = getSupabaseClient();
  if (supabase && userId) {
    return await createBrand(userId, name);
  }
  return { success: false, error: 'Supabase required' };
}

export async function getProducts(userId) {
  
  const supabase = getSupabaseClient();
  
  if (supabase && userId) {
    const result = await listProducts(userId);
    
    // Handle both old format {data, error} and new format (direct array)
    if (Array.isArray(result)) {
      return result;
    } else if (result && result.data) {
      return result.data;
    } else {
      return [];
    }
  } else {
    return await local.getProducts();
  }
}

export async function findProducts(userId, query) {
  const supabase = getSupabaseClient();
  if (supabase && userId) {
    const result = await cloud.findProducts(userId, query);
    if (Array.isArray(result)) {
      return result;
    } else if (result && result.data) {
      return result.data;
    } else {
      return [];
    }
  }
  return await local.findProducts(query);
}

export async function findByBarcodeOrName(userId, query) {
  
  const supabase = getSupabaseClient();
  if (supabase && userId) {
    const result = await searchProducts(userId, query);
    
    if (Array.isArray(result)) {
      return result;
    } else if (result && result.data) {
      return result.data;
    } else {
      return [];
    }
  } else {
    return await local.findByBarcodeOrName(query);
  }
}

export async function findByBarcodeExact(userId, barcode) {
  
  const supabase = getSupabaseClient();
  if (supabase && userId) {
    const { data } = await cloud.findByBarcodeExact(userId, barcode);
    return data || null;
  } else {
    return await local.findByBarcodeExact(barcode);
  }
}

export async function getProductById(userId, id) {
  
  const supabase = getSupabaseClient();
  if (supabase && userId) {
    const result = await cloud.getProduct(userId, id);
    
    if (result && result.data) {
      return result.data;
    } else {
      return null;
    }
  }
  return null;
}

export async function createProduct(userId, payload) {
  
  try {
    // Always use Supabase directly, no local storage fallback
    const result = await cloud.createProduct(payload);
    
    if (result.success) {
      return result;
    } else {
      return { success: false, error: result.error || 'Gagal membuat produk' };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function updateProduct(userId, id, payload) {
  const supabase = getSupabaseClient();
  if (supabase && userId) {
    const { data } = await cloud.updateProduct(userId, id, payload);
    return data || null;
  }
  return await local.updateProduct(id, payload);
}

export async function deleteProduct(userId, id) {
  const supabase = getSupabaseClient();
  if (supabase && userId) {
    const { error } = await cloud.deleteProduct(userId, id);
    if (error) {
      throw new Error(typeof error === 'string' ? error : error.message || 'Gagal menghapus produk');
    }
    return true;
  }
  return await local.deleteProduct(id);
}