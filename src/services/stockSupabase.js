import { getSupabaseClient } from './supabase';

export async function addStock(productId, quantity, reason = '', notes = '') {
  console.log('📦 stockSupabase: addStock called with productId:', productId, 'quantity:', quantity);
  
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.log('❌ stockSupabase: Supabase client not available');
    return { success: false, error: 'Supabase tidak tersedia' };
  }

  try {
    // Get current session
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session;
    
    if (!session || !session.user) {
      console.log('❌ stockSupabase: User not authenticated');
      return { success: false, error: 'User tidak ter-autentikasi' };
    }

    // Get current product data
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, name, stock, owner_id')
      .eq('id', productId)
      .eq('owner_id', session.user.id)
      .single();

    if (productError) {
      console.log('❌ stockSupabase: Error fetching product:', productError);
      return { success: false, error: productError.message };
    }

    if (!product) {
      console.log('❌ stockSupabase: Product not found or not owned by user');
      return { success: false, error: 'Produk tidak ditemukan' };
    }

    const previousStock = product.stock;
    const newStock = previousStock + quantity;

    console.log('📡 stockSupabase: Updating product stock from', previousStock, 'to', newStock);

    // Update product stock
    const { error: updateError } = await supabase
      .from('products')
      .update({ stock: newStock, last_change_reason: reason || 'penyesuaian' })
      .eq('id', productId)
      .eq('owner_id', session.user.id);

    if (updateError) {
      console.log('❌ stockSupabase: Error updating product stock:', updateError);
      return { success: false, error: updateError.message };
    }

    // Add stock history record
    const { error: historyError } = await supabase
      .from('stock_history')
      .insert({
        product_id: productId,
        user_id: session.user.id,
        type: 'addition',
        quantity: quantity,
        previous_stock: previousStock,
        new_stock: newStock,
        reason: reason || 'Manual stock addition',
        notes: notes
      });

    if (historyError) {
      console.log('❌ stockSupabase: Error adding stock history:', historyError);
      // Don't return error here, stock update was successful
    }

    console.log('✅ stockSupabase: Stock added successfully');
    return { 
      success: true, 
      data: { 
        productId, 
        previousStock, 
        newStock, 
        quantity 
      } 
    };

  } catch (error) {
    console.log('❌ stockSupabase: Exception in addStock:', error);
    return { success: false, error: error.message };
  }
}

export async function getStockHistory(productId = null, limit = 50) {
  console.log('📦 stockSupabase: getStockHistory called with productId:', productId, 'limit:', limit);
  
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.log('❌ stockSupabase: Supabase client not available');
    return { success: false, error: 'Supabase tidak tersedia' };
  }

  try {
    // Get current session
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session;
    
    if (!session || !session.user) {
      console.log('❌ stockSupabase: User not authenticated');
      return { success: false, error: 'User tidak ter-autentikasi' };
    }

    console.log('📡 stockSupabase: Fetching stock history...');

    let query = supabase
      .from('stock_history')
      .select(`
        id,
        type,
        quantity,
        previous_stock,
        new_stock,
        reason,
        notes,
        created_at,
        products (
          id,
          name,
          barcode
        )
      `)
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Filter by product if specified
    if (productId) {
      query = query.eq('product_id', productId);
    }

    const { data: stockHistory, error } = await query;

    if (error) {
      console.log('❌ stockSupabase: Error fetching stock history:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ stockSupabase: Stock history retrieved:', stockHistory?.length || 0, 'items');
    return { success: true, data: stockHistory || [] };

  } catch (error) {
    console.log('❌ stockSupabase: Exception in getStockHistory:', error);
    return { success: false, error: error.message };
  }
}

export async function adjustStock(productId, newStock, reason = '', notes = '') {
  console.log('📦 stockSupabase: adjustStock called with productId:', productId, 'newStock:', newStock);
  
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.log('❌ stockSupabase: Supabase client not available');
    return { success: false, error: 'Supabase tidak tersedia' };
  }

  try {
    // Get current session
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session;
    
    if (!session || !session.user) {
      console.log('❌ stockSupabase: User not authenticated');
      return { success: false, error: 'User tidak ter-autentikasi' };
    }

    // Get current product data
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, name, stock, owner_id')
      .eq('id', productId)
      .eq('owner_id', session.user.id)
      .single();

    if (productError) {
      console.log('❌ stockSupabase: Error fetching product:', productError);
      return { success: false, error: productError.message };
    }

    if (!product) {
      console.log('❌ stockSupabase: Product not found or not owned by user');
      return { success: false, error: 'Produk tidak ditemukan' };
    }

    const previousStock = product.stock;
    const quantity = Math.abs(newStock - previousStock);
    const type = newStock > previousStock ? 'addition' : newStock < previousStock ? 'reduction' : 'adjustment';

    console.log('📡 stockSupabase: Adjusting product stock from', previousStock, 'to', newStock);

    // Update product stock
    const { error: updateError } = await supabase
      .from('products')
      .update({ stock: newStock, last_change_reason: reason || 'penyesuaian' })
      .eq('id', productId)
      .eq('owner_id', session.user.id);

    if (updateError) {
      console.log('❌ stockSupabase: Error updating product stock:', updateError);
      return { success: false, error: updateError.message };
    }

    // Stock history will be automatically logged by database trigger
    // No need to manually insert into stock_history table

    console.log('✅ stockSupabase: Stock adjusted successfully');
    return { 
      success: true, 
      data: { 
        productId, 
        previousStock, 
        newStock, 
        quantity,
        type
      } 
    };

  } catch (error) {
    console.log('❌ stockSupabase: Exception in adjustStock:', error);
    return { success: false, error: error.message };
  }
}
