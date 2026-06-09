import { getSupabaseClient } from './supabase';

export async function createSale(saleData) {
  
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

    
    // Start transaction by creating sale record
    const { data: saleRecord, error: saleError } = await supabase
      .from('sales')
      .insert({
        user_id: session.user.id,
        total: saleData.total,
        profit: saleData.profit,
        payment_method: saleData.payment_method,
        payment_channel_id: saleData.payment_channel_id,
        cash_amount: saleData.cash_amount,
        change_amount: saleData.change_amount,
        customer_name: saleData.customer_name,
        notes: saleData.notes
      })
      .select()
      .single();

    if (saleError) {
      return { success: false, error: saleError.message };
    }


    // Create sale items
    if (saleData.items && saleData.items.length > 0) {
      const saleItems = saleData.items.map(item => ({
        sale_id: saleRecord.id,
        product_name: item.product_name,
        barcode: item.barcode || '',
        qty: item.qty,
        price: item.price,
        cost_price: item.cost_price,
        line_total: item.line_total,
        line_profit: item.line_profit,
        token_code: item.token_code || null
      }));

      
      const { data: itemsData, error: itemsError } = await supabase
        .from('sale_items')
        .insert(saleItems)
        .select();

      if (itemsError) {
        // Try to rollback sale record
        await supabase.from('sales').delete().eq('id', saleRecord.id);
        return { success: false, error: itemsError.message };
      }

    }

    return { 
      success: true, 
      data: {
        sale: saleRecord,
        items: saleData.items
      }
    };

  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function getSales(userId, limit = 50) {
  
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Supabase tidak tersedia', data: [] };
  }

  try {
    // Get current session
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session;
    
    if (!session || !session.user) {
      return { success: false, error: 'User tidak ter-autentikasi', data: [] };
    }

    
    const { data, error } = await supabase
      .from('sales')
      .select(`
        *,
        sale_items (*)
      `)
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return { success: false, error: error.message, data: [] };
    }

    return { success: true, data: data || [] };

  } catch (error) {
    return { success: false, error: error.message, data: [] };
  }
}

export async function getSaleById(userId, saleId) {
  
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Supabase tidak tersedia', data: null };
  }

  try {
    // Get current session
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session;
    
    if (!session || !session.user) {
      return { success: false, error: 'User tidak ter-autentikasi', data: null };
    }

    
    const { data, error } = await supabase
      .from('sales')
      .select(`
        *,
        sale_items (*)
      `)
      .eq('user_id', session.user.id)
      .eq('id', saleId)
      .single();

    if (error) {
      return { success: false, error: error.message, data: null };
    }

    return { success: true, data };

  } catch (error) {
    return { success: false, error: error.message, data: null };
  }
}

export async function getSalesReport(userId, startDate, endDate) {
  
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Supabase tidak tersedia', data: null };
  }

  try {
    // Get current session
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session;
    
    if (!session || !session.user) {
      return { success: false, error: 'User tidak ter-autentikasi', data: null };
    }

    
    let query = supabase
      .from('sales')
      .select(`
        *,
        sale_items (*)
      `)
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    
    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, error: error.message, data: null };
    }

    // Calculate summary
    const totalSales = data?.length || 0;
    const totalRevenue = data?.reduce((sum, sale) => sum + (sale.total || 0), 0) || 0;
    const totalProfit = data?.reduce((sum, sale) => sum + (sale.profit || 0), 0) || 0;
    const totalItems = data?.reduce((sum, sale) => sum + (sale.sale_items?.length || 0), 0) || 0;

    const report = {
      sales: data || [],
      summary: {
        totalSales,
        totalRevenue,
        totalProfit,
        totalItems,
        averageSale: totalSales > 0 ? totalRevenue / totalSales : 0
      }
    };

    return { success: true, data: report };

  } catch (error) {
    return { success: false, error: error.message, data: null };
  }
}