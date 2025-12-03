import { getSupabaseClient } from './supabase';

// Get sales history for a user
export const getSalesHistory = async (userId) => {
  console.log('📋 salesSupabase: Getting sales history for user:', userId);
  
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('sales')
      .select(`
        id,
        no_invoice,
        total,
        profit,
        payment_method,
        payment_channel_id,
        cash_amount,
        change_amount,
        customer_name,
        notes,
        created_at,
        sale_items (
          id,
          product_name,
          barcode,
          price,
          qty,
          line_total
        ),
        payment_channels (
          id,
          name,
          type
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ salesSupabase: Error getting sales history:', error);
      throw error;
    }

    // Transform the data to include items array for each sale
    const transformedData = data.map(sale => ({
      ...sale,
      items: sale.sale_items || [],
      payment_channel: sale.payment_channels
    }));

    console.log('✅ salesSupabase: Sales history retrieved, count:', transformedData.length);
    return transformedData;
  } catch (error) {
    console.error('❌ salesSupabase: Error in getSalesHistory:', error);
    throw error;
  }
};

// Get sale by ID with items
export const getSaleById = async (saleId) => {
  console.log('🔄 salesSupabase: Getting sale by ID:', saleId);
  
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('sales')
      .select(`
        id,
        no_invoice,
        total,
        profit,
        payment_method,
        payment_channel_id,
        cash_amount,
        change_amount,
        customer_name,
        notes,
        created_at,
        sale_items (
          id,
          product_name,
          barcode,
          price,
          qty,
          line_total
        ),
        payment_channels (
          id,
          name,
          type
        )
      `)
      .eq('id', saleId)
      .single();

    if (error) {
      console.error('❌ salesSupabase: Error getting sale by ID:', error);
      throw error;
    }

    // Transform the data to include items array
    const transformedData = {
      ...data,
      items: data.sale_items || [],
      payment_channel: data.payment_channels
    };

    console.log('✅ salesSupabase: Sale retrieved:', transformedData.id);
    return transformedData;
  } catch (error) {
    console.error('❌ salesSupabase: Error in getSaleById:', error);
    throw error;
  }
};

// Get sales analytics for different periods
export const getSalesAnalytics = async (userId, period = 'today') => {
  console.log('📊 salesSupabase: Getting sales analytics for user:', userId, 'period:', period);
  
  try {
    const supabase = getSupabaseClient();
    
    // Calculate date range based on period
    const now = new Date();
    let startDate, endDate;
    
    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        break;
      case 'week':
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        startDate = startOfWeek;
        endDate = new Date(startOfWeek);
        endDate.setDate(startOfWeek.getDate() + 7);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear() + 1, 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    }

    const { data, error } = await supabase
      .from('sales')
      .select('id, total, profit, created_at')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString())
      .lt('created_at', endDate.toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ salesSupabase: Error getting sales analytics:', error);
      return { success: false, error: error.message };
    }

    // Calculate analytics
    const sales = data || [];
    const totalSales = sales.reduce((sum, sale) => sum + (sale.total || 0), 0);
    const totalProfit = sales.reduce((sum, sale) => sum + (sale.profit || 0), 0);
    const transactions = sales.length;
    const average = transactions > 0 ? totalSales / transactions : 0;
    
    const amounts = sales.map(sale => sale.total || 0);
    const highest = amounts.length > 0 ? Math.max(...amounts) : 0;
    const lowest = amounts.length > 0 ? Math.min(...amounts) : 0;

    // Calculate growth (simplified - comparing with previous period)
    let growth = 0;
    // This is a simplified growth calculation
    // In a real app, you'd compare with the previous period's data

    const analytics = {
      total: totalSales,
      profit: totalProfit,
      transactions,
      average,
      highest,
      lowest,
      growth,
      period,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    };

    console.log('✅ salesSupabase: Sales analytics calculated:', analytics);
    return { success: true, data: analytics };
  } catch (error) {
    console.error('❌ salesSupabase: Error in getSalesAnalytics:', error);
    return { success: false, error: error.message };
  }
};