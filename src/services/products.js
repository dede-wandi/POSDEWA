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
  console.log('🔄 products: getProducts called with userId:', userId);
  
  const supabase = getSupabaseClient();
  
  if (supabase && userId) {
    console.log('📡 products: Using Supabase for getProducts');
    const result = await listProducts(userId);
    console.log('📡 products: Supabase result:', result);
    
    // Handle both old format {data, error} and new format (direct array)
    if (Array.isArray(result)) {
      return result;
    } else if (result && result.data) {
      return result.data;
    } else {
      return [];
    }
  } else {
    console.log('📦 products: Falling back to local storage for getProducts');
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
  console.log('📦 products: Falling back to local storage for findProducts');
  return await local.findProducts(query);
}

export async function findByBarcodeOrName(userId, query) {
  console.log('🔄 products: findByBarcodeOrName called with userId:', userId, 'query:', query);
  
  const supabase = getSupabaseClient();
  if (supabase && userId) {
    console.log('📡 products: Using Supabase for findByBarcodeOrName');
    const result = await searchProducts(userId, query);
    console.log('📡 products: Search result:', result);
    
    if (Array.isArray(result)) {
      return result;
    } else if (result && result.data) {
      return result.data;
    } else {
      return [];
    }
  } else {
    console.log('📦 products: Falling back to local storage for findByBarcodeOrName');
    return await local.findByBarcodeOrName(query);
  }
}

export async function findByBarcodeExact(userId, barcode) {
  console.log('🔄 products: findByBarcodeExact called with userId:', userId, 'barcode:', barcode);
  
  const supabase = getSupabaseClient();
  if (supabase && userId) {
    console.log('📡 products: Using Supabase for findByBarcodeExact');
    const { data } = await cloud.findByBarcodeExact(userId, barcode);
    console.log('📡 products: Exact search result:', data);
    return data || null;
  } else {
    console.log('📦 products: Falling back to local storage for findByBarcodeExact');
    return await local.findByBarcodeExact(barcode);
  }
}

export async function getProductById(userId, id) {
  console.log('🔄 products: getProductById called with userId:', userId, 'id:', id);
  
  const supabase = getSupabaseClient();
  if (supabase && userId) {
    console.log('📡 products: Using Supabase for getProductById');
    const result = await cloud.getProduct(userId, id);
    console.log('📡 products: getProduct result:', result);
    
    if (result && result.data) {
      return result.data;
    } else {
      console.log('❌ products: No data returned from getProduct');
      return null;
    }
  }
  console.log('❌ products: No Supabase client or userId available for getProductById');
  return null;
}

export async function createProduct(userId, payload) {
  console.log('📝 products: createProduct called with userId:', userId);
  console.log('📝 products: createProduct payload:', payload);
  
  try {
    // Always use Supabase directly, no local storage fallback
    console.log('📡 products: Using Supabase for createProduct');
    const result = await cloud.createProduct(payload);
    console.log('📡 products: Supabase createProduct result:', result);
    
    if (result.success) {
      console.log('✅ products: Supabase create successful');
      return result;
    } else {
      console.log('❌ products: Supabase create failed:', result.error);
      return { success: false, error: result.error || 'Gagal membuat produk' };
    }
  } catch (error) {
    console.error('❌ products: createProduct error:', error);
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
    const { data } = await cloud.deleteProduct(userId, id);
    return data || null;
  }
  return await local.deleteProduct(id);
}