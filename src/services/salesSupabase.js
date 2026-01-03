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
export const getSalesAnalytics = async (userId, period = 'today', customRange = null) => {
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
      case 'yesterday':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
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
      case 'custom':
        if (customRange && customRange.startDate && customRange.endDate) {
          startDate = new Date(customRange.startDate);
          endDate = new Date(customRange.endDate);
          // Ensure we cover the full end date by adding 1 day if it's just a date without time or same as start
          // Assuming the UI passes dates at 00:00:00
          const endDateTime = new Date(endDate);
          endDateTime.setHours(23, 59, 59, 999);
          endDate = endDateTime;
        } else {
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        }
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

// Get last 10 days performance
export const getSalesPerformance = async (userId) => {
  console.log('📊 salesSupabase: Getting sales performance for user:', userId);
  
  try {
    const supabase = getSupabaseClient();
    
    // Calculate date range (last 10 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 10);
    startDate.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('sales')
      .select('created_at, total, profit')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ salesSupabase: Error getting sales performance:', error);
      return { success: false, error: error.message };
    }

    // Initialize last 10 days with 0
    const dailyStats = {};
    for (let i = 0; i < 10; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      
      const dayName = d.toLocaleDateString('id-ID', { weekday: 'long' });
      const fullDate = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
      
      dailyStats[dateStr] = {
        date: d,
        dateStr,
        dayName,
        fullDate,
        totalSales: 0,
        totalProfit: 0,
        transactions: 0
      };
    }

    // Aggregate data
    if (data) {
      data.forEach(sale => {
        const saleDate = new Date(sale.created_at);
        // Adjust for timezone offset if necessary, but ISO string split is UTC.
        // Better to use local date string for grouping to match the key generation above?
        // Let's stick to ISO date part for grouping key consistency if both use same logic.
        // Actually, to be safe with timezones, let's match based on local date components.
        const dateStr = saleDate.toISOString().split('T')[0];
        
        // Find matching key in dailyStats (which might be off by timezone)
        // A safer way is to check date equality
        const key = Object.keys(dailyStats).find(k => {
            const statDate = dailyStats[k].date;
            return statDate.getDate() === saleDate.getDate() && 
                   statDate.getMonth() === saleDate.getMonth() && 
                   statDate.getFullYear() === saleDate.getFullYear();
        });

        if (key && dailyStats[key]) {
          dailyStats[key].totalSales += (sale.total || 0);
          dailyStats[key].totalProfit += (sale.profit || 0);
          dailyStats[key].transactions += 1;
        }
      });
    }

    const result = Object.values(dailyStats).sort((a, b) => b.date - a.date);
    
    console.log('✅ salesSupabase: Sales performance calculated, days:', result.length);
    return { success: true, data: result };
  } catch (error) {
    console.error('❌ salesSupabase: Error in getSalesPerformance:', error);
    return { success: false, error: error.message };
  }
};