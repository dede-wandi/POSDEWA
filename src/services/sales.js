import { getSupabaseClient } from './supabase';

export async function createSale(saleData) {
  console.log('💾 sales: createSale called with data:', saleData);
  
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.log('❌ sales: Supabase client not available');
    return { success: false, error: 'Supabase tidak tersedia' };
  }

  try {
    // Get current session
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session;
    
    if (!session || !session.user) {
      console.log('❌ sales: User not authenticated');
      return { success: false, error: 'User tidak ter-autentikasi' };
    }

    console.log('📡 sales: Creating sale transaction...');
    
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
      console.log('❌ sales: Error creating sale record:', saleError);
      return { success: false, error: saleError.message };
    }

    console.log('✅ sales: Sale record created:', saleRecord);

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

      console.log('📡 sales: Creating sale items:', saleItems);
      
      const { data: itemsData, error: itemsError } = await supabase
        .from('sale_items')
        .insert(saleItems)
        .select();

      if (itemsError) {
        console.log('❌ sales: Error creating sale items:', itemsError);
        // Try to rollback sale record
        await supabase.from('sales').delete().eq('id', saleRecord.id);
        return { success: false, error: itemsError.message };
      }

      console.log('✅ sales: Sale items created:', itemsData);
    }

    console.log('✅ sales: Sale transaction completed successfully');
    return { 
      success: true, 
      data: {
        sale: saleRecord,
        items: saleData.items
      }
    };

  } catch (error) {
    console.log('❌ sales: Exception in createSale:', error);
    return { success: false, error: error.message };
  }
}

export async function getSales(userId, limit = 50) {
  console.log('🔄 sales: getSales called for user:', userId);
  
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.log('❌ sales: Supabase client not available');
    return { success: false, error: 'Supabase tidak tersedia', data: [] };
  }

  try {
    // Get current session
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session;
    
    if (!session || !session.user) {
      console.log('❌ sales: User not authenticated');
      return { success: false, error: 'User tidak ter-autentikasi', data: [] };
    }

    console.log('📡 sales: Fetching sales records...');
    
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
      console.log('❌ sales: Error fetching sales:', error);
      return { success: false, error: error.message, data: [] };
    }

    console.log('✅ sales: Sales fetched:', data?.length || 0, 'records');
    return { success: true, data: data || [] };

  } catch (error) {
    console.log('❌ sales: Exception in getSales:', error);
    return { success: false, error: error.message, data: [] };
  }
}

export async function getSaleById(userId, saleId) {
  console.log('🔄 sales: getSaleById called for user:', userId, 'sale:', saleId);
  
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.log('❌ sales: Supabase client not available');
    return { success: false, error: 'Supabase tidak tersedia', data: null };
  }

  try {
    // Get current session
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session;
    
    if (!session || !session.user) {
      console.log('❌ sales: User not authenticated');
      return { success: false, error: 'User tidak ter-autentikasi', data: null };
    }

    console.log('📡 sales: Fetching sale by ID...');
    
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
      console.log('❌ sales: Error fetching sale:', error);
      return { success: false, error: error.message, data: null };
    }

    console.log('✅ sales: Sale fetched:', data);
    return { success: true, data };

  } catch (error) {
    console.log('❌ sales: Exception in getSaleById:', error);
    return { success: false, error: error.message, data: null };
  }
}

export async function getSalesReport(userId, startDate, endDate) {
  console.log('📊 sales: getSalesReport called for user:', userId, 'period:', startDate, 'to', endDate);
  
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.log('❌ sales: Supabase client not available');
    return { success: false, error: 'Supabase tidak tersedia', data: null };
  }

  try {
    // Get current session
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session;
    
    if (!session || !session.user) {
      console.log('❌ sales: User not authenticated');
      return { success: false, error: 'User tidak ter-autentikasi', data: null };
    }

    console.log('📡 sales: Fetching sales report...');
    
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
      console.log('❌ sales: Error fetching sales report:', error);
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

    console.log('✅ sales: Sales report generated:', report.summary);
    return { success: true, data: report };

  } catch (error) {
    console.log('❌ sales: Exception in getSalesReport:', error);
    return { success: false, error: error.message, data: null };
  }
}