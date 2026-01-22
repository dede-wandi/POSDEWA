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
          line_total,
          cost_price,
          line_profit
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
          line_total,
          cost_price,
          line_profit
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

// Delete sale item by ID
export const deleteSaleItem = async (itemId) => {
  console.log('🗑️ salesSupabase: Deleting sale item:', itemId);
  
  try {
    const supabase = getSupabaseClient();
    
    // First, get the sale_id and line_total/profit to update the parent sale
    const { data: itemData, error: fetchError } = await supabase
      .from('sale_items')
      .select('sale_id, line_total, line_profit')
      .eq('id', itemId)
      .single();
      
    if (fetchError) throw fetchError;
    
    if (!itemData) {
      throw new Error('Item not found');
    }

    const { sale_id, line_total, line_profit } = itemData;

    // Delete the item
    const { error: deleteError } = await supabase
      .from('sale_items')
      .delete()
      .eq('id', itemId);

    if (deleteError) throw deleteError;

    // Update parent sale totals
    // Get current sale totals
    const { data: saleData, error: saleError } = await supabase
      .from('sales')
      .select('total, profit')
      .eq('id', sale_id)
      .single();
      
    if (saleError) throw saleError;
    
    // Update sale
    const newTotal = (saleData.total || 0) - (line_total || 0);
    const newProfit = (saleData.profit || 0) - (line_profit || 0);
    
    const { error: updateError } = await supabase
      .from('sales')
      .update({ 
        total: Math.max(0, newTotal),
        profit: newProfit
      })
      .eq('id', sale_id);
      
    if (updateError) throw updateError;
    
    // Check if sale has no more items, if so delete the sale?
    // For now, let's just leave the empty sale or we could check count
    const { count, error: countError } = await supabase
      .from('sale_items')
      .select('id', { count: 'exact', head: true })
      .eq('sale_id', sale_id);
      
    if (!countError && count === 0) {
      // Delete the empty sale record
      await supabase.from('sales').delete().eq('id', sale_id);
      console.log('🗑️ salesSupabase: Deleted empty sale record:', sale_id);
    }

    console.log('✅ salesSupabase: Sale item deleted successfully');
    return { success: true };
  } catch (error) {
    console.error('❌ salesSupabase: Error deleting sale item:', error);
    return { success: false, error: error.message };
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

// Get sales performance (custom range, default last 10 days)
export const getSalesPerformance = async (userId, customStartDate = null, customEndDate = null) => {
  console.log('📊 salesSupabase: Getting sales performance for user:', userId);
  
  try {
    const supabase = getSupabaseClient();
    
    // Calculate date range
    let startDate, endDate;
    
    if (customStartDate && customEndDate) {
       startDate = new Date(customStartDate);
       endDate = new Date(customEndDate);
       // Ensure end date includes the full day
       endDate.setHours(23, 59, 59, 999);
    } else {
       // Default 10 days
       endDate = new Date();
       startDate = new Date();
       startDate.setDate(startDate.getDate() - 10);
    }
    
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

    // Initialize daily stats
    const dailyStats = {};
    const dayCount = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    
    // Create a map for all days in range
    for (let i = 0; i <= dayCount; i++) {
      const d = new Date(endDate);
      d.setDate(d.getDate() - i);
      
      // Stop if we go before start date (can happen with rough dayCount calculation)
      if (d < startDate) break;

      const dateStr = d.toISOString().split('T')[0];
      
      const dayName = d.toLocaleDateString('id-ID', { weekday: 'long' });
      const fullDate = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
      
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
        const dateStr = saleDate.toISOString().split('T')[0];
        
        // Find matching key (handling potential timezone mismatches by just using the date part string)
        // Since we initialized keys with ISO string split, this should match directly
        if (dailyStats[dateStr]) {
          dailyStats[dateStr].totalSales += (sale.total || 0);
          dailyStats[dateStr].totalProfit += (sale.profit || 0);
          dailyStats[dateStr].transactions += 1;
        }
      });
    }

    const result = Object.values(dailyStats).sort((a, b) => b.date - a.date);
    
    // Calculate trends (growth vs next item in the sorted list which is the previous day)
    const resultWithTrend = result.map((item, index) => {
        const prevItem = result[index + 1]; // Since it's sorted descending, next item is previous day
        let growth = 0;
        let trend = 'stable'; // 'up', 'down', 'stable'

        if (prevItem && prevItem.totalSales > 0) {
            growth = ((item.totalSales - prevItem.totalSales) / prevItem.totalSales) * 100;
        } else if (prevItem && prevItem.totalSales === 0 && item.totalSales > 0) {
            growth = 100; // Treated as 100% growth from 0
        }

        if (growth > 0) trend = 'up';
        if (growth < 0) trend = 'down';

        return {
            ...item,
            growth,
            trend
        };
    });
    
    console.log('✅ salesSupabase: Sales performance calculated, days:', resultWithTrend.length);
    return { success: true, data: resultWithTrend };
  } catch (error) {
    console.error('❌ salesSupabase: Error in getSalesPerformance:', error);
    return { success: false, error: error.message };
  }
};

export const getProductSalesMetrics = async (userId, productBarcode, dateRange = null, productName = null) => {
  console.log('📊 salesSupabase: Getting product sales metrics for user:', userId, 'barcode:', productBarcode, 'productName:', productName);
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { success: false, error: 'Supabase tidak tersedia' };
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session;
    if (!session || !session.user) {
      return { success: false, error: 'User tidak ter-autentikasi' };
    }

    let startDate = null;
    let endDate = null;
    if (dateRange && dateRange.startDate && dateRange.endDate) {
      startDate = new Date(dateRange.startDate);
      endDate = new Date(dateRange.endDate);
      endDate.setHours(23, 59, 59, 999);
    }

    let salesQuery = supabase
      .from('sales')
      .select('id, created_at')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (startDate) {
      salesQuery = salesQuery.gte('created_at', startDate.toISOString());
    }
    if (endDate) {
      salesQuery = salesQuery.lte('created_at', endDate.toISOString());
    }

    const { data: salesData, error: salesError } = await salesQuery;
    if (salesError) {
      return { success: false, error: salesError.message };
    }
    const saleIds = (salesData || []).map(s => s.id);
    if (saleIds.length === 0) {
      return {
        success: true,
        totalSales: 0,
        totalQuantitySold: 0,
        dailySales: [],
        maxSalesDay: null
      };
    }

    let itemsQuery = supabase
      .from('sale_items')
      .select('sale_id, qty, line_total, product_name, barcode')
      .in('sale_id', saleIds);

    if (productBarcode) {
      itemsQuery = itemsQuery.eq('barcode', String(productBarcode).trim());
    } else if (productName) {
      itemsQuery = itemsQuery.eq('product_name', String(productName).trim());
    } else {
      // Tanpa identitas produk, tidak bisa lanjut
      return {
        success: true,
        totalSales: 0,
        totalQuantitySold: 0,
        dailySales: [],
        maxSalesDay: null
      };
    }

    const { data: itemsData, error: itemsError } = await itemsQuery;
    if (itemsError) {
      return { success: false, error: itemsError.message };
    }

    const saleDateMap = {};
    (salesData || []).forEach(s => {
      saleDateMap[s.id] = new Date(s.created_at);
    });

    const totalSales = (itemsData || []).reduce((sum, it) => sum + (Number(it.line_total) || 0), 0);
    const totalQuantitySold = (itemsData || []).reduce((sum, it) => sum + (Number(it.qty) || 0), 0);

    const dailySalesMap = {};
    (itemsData || []).forEach(it => {
      const saleDate = saleDateMap[it.sale_id];
      if (!saleDate) return;
      const key = saleDate.toISOString().split('T')[0];
      if (!dailySalesMap[key]) {
        dailySalesMap[key] = {
          date: saleDate,
          quantity: 0,
          amount: 0
        };
      }
      dailySalesMap[key].quantity += Number(it.qty) || 0;
      dailySalesMap[key].amount += Number(it.line_total) || 0;
    });

    const dailySales = Object.values(dailySalesMap).sort((a, b) => b.date - a.date);
    const maxSalesDay = dailySales.length > 0
      ? dailySales.reduce((max, day) => (day.quantity > max.quantity ? day : max), dailySales[0])
      : null;

    return {
      success: true,
      totalSales,
      totalQuantitySold,
      dailySales,
      maxSalesDay
    };
  } catch (error) {
    console.error('❌ salesSupabase: Error in getProductSalesMetrics:', error);
    return { success: false, error: error.message };
  }
};
