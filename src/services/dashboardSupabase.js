import { getSupabaseClient } from './supabase';

export async function getDashboardStats(userId) {
  console.log('📊 dashboardSupabase: getDashboardStats called with userId:', userId);
  
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.log('❌ dashboardSupabase: Supabase client not available');
    return { success: false, error: 'Supabase tidak tersedia' };
  }

  try {
    // Get current session
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session;
    
    if (!session || !session.user) {
      console.log('❌ dashboardSupabase: User not authenticated');
      return { success: false, error: 'User tidak ter-autentikasi' };
    }

    // Date Helpers (Local -> ISO UTC)
    const now = new Date();
    
    // Today
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    
    // Yesterday
    const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const yesterdayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // This Month
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Last Month
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1); // Start of this month is end of last month

    console.log('📡 dashboardSupabase: Fetching dashboard statistics...');

    // Helper to calculate total profit from sales array
    const calculateTotalProfit = (sales) => {
      if (!sales) return 0;
      return sales.reduce((totalProfit, sale) => {
        const items = sale.sale_items || [];
        if (items.length > 0) {
          const saleProfit = items.reduce((itemSum, item) => {
            let p = typeof item.line_profit === 'number'
               ? item.line_profit
               : ((Number(item.price) - Number(item.cost_price || 0)) * Number(item.qty || 0));
            return itemSum + p;
          }, 0);
          return totalProfit + saleProfit;
        }
        return totalProfit + (sale.profit || 0);
      }, 0);
    };

    // Get today's sales
    const { data: todaySales, error: todayError } = await supabase
      .from('sales')
      .select('total, profit, sale_items (qty, price, cost_price, line_profit)')
      .eq('user_id', session.user.id)
      .gte('created_at', todayStart.toISOString())
      .lt('created_at', todayEnd.toISOString());

    if (todayError) {
      console.log('❌ dashboardSupabase: Error fetching today sales:', todayError);
      return { success: false, error: todayError.message };
    }

    // Get yesterday's sales
    const { data: yesterdaySales, error: yesterdayError } = await supabase
      .from('sales')
      .select('total, profit, sale_items (qty, price, cost_price, line_profit)')
      .eq('user_id', session.user.id)
      .gte('created_at', yesterdayStart.toISOString())
      .lt('created_at', yesterdayEnd.toISOString());

    if (yesterdayError) {
      console.log('❌ dashboardSupabase: Error fetching yesterday sales:', yesterdayError);
      // Don't fail the whole request, just log it
    }

    // Get this month's sales
    const { data: monthSales, error: monthError } = await supabase
      .from('sales')
      .select('total, profit, sale_items (qty, price, cost_price, line_profit)')
      .eq('user_id', session.user.id)
      .gte('created_at', thisMonthStart.toISOString());

    if (monthError) {
      console.log('❌ dashboardSupabase: Error fetching month sales:', monthError);
      return { success: false, error: monthError.message };
    }

    // Get last month's sales
    const { data: lastMonthSales, error: lastMonthError } = await supabase
      .from('sales')
      .select('total, profit, sale_items (qty, price, cost_price, line_profit)')
      .eq('user_id', session.user.id)
      .gte('created_at', lastMonthStart.toISOString())
      .lt('created_at', lastMonthEnd.toISOString());

    if (lastMonthError) {
      console.log('❌ dashboardSupabase: Error fetching last month sales:', lastMonthError);
      // Don't fail, just log
    }

    // Get total products count
    const { count: totalProducts, error: productsError } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('owner_id', session.user.id);

    if (productsError) {
      console.log('❌ dashboardSupabase: Error fetching products count:', productsError);
      return { success: false, error: productsError.message };
    }

    // Get low stock products (stock <= 5)
    const { data: lowStockProducts, error: lowStockError } = await supabase
      .from('products')
      .select('id, name, stock')
      .eq('owner_id', session.user.id)
      .lte('stock', 5)
      .order('stock', { ascending: true });

    if (lowStockError) {
      console.log('❌ dashboardSupabase: Error fetching low stock products:', lowStockError);
      return { success: false, error: lowStockError.message };
    }

    // Calculate statistics
    const todayTotal = todaySales.reduce((sum, sale) => sum + (sale.total || 0), 0);
    const todayProfit = calculateTotalProfit(todaySales);
    const todayTransactions = todaySales.length;

    const yesterdayTotal = yesterdaySales ? yesterdaySales.reduce((sum, sale) => sum + (sale.total || 0), 0) : 0;
    const yesterdayProfit = calculateTotalProfit(yesterdaySales);

    const monthTotal = monthSales.reduce((sum, sale) => sum + (sale.total || 0), 0);
    const monthProfit = calculateTotalProfit(monthSales);
    const monthTransactions = monthSales.length;

    const lastMonthTotal = lastMonthSales ? lastMonthSales.reduce((sum, sale) => sum + (sale.total || 0), 0) : 0;
    const lastMonthProfit = calculateTotalProfit(lastMonthSales);

    const stats = {
      today: {
        total: todayTotal,
        profit: todayProfit,
        transactions: todayTransactions,
        yesterdayTotal: yesterdayTotal,
        yesterdayProfit: yesterdayProfit
      },
      month: {
        total: monthTotal,
        profit: monthProfit,
        transactions: monthTransactions,
        lastMonthTotal: lastMonthTotal,
        lastMonthProfit: lastMonthProfit
      },
      products: {
        total: totalProducts || 0,
        lowStock: lowStockProducts || []
      }
    };

    console.log('✅ dashboardSupabase: Dashboard stats retrieved:', stats);
    return { success: true, data: stats };

  } catch (error) {
    console.log('❌ dashboardSupabase: Exception in getDashboardStats:', error);
    return { success: false, error: error.message };
  }
}

export async function getRecentSales(userId, limit = 5) {
  console.log('📊 dashboardSupabase: getRecentSales called with userId:', userId, 'limit:', limit);
  
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.log('❌ dashboardSupabase: Supabase client not available');
    return { success: false, error: 'Supabase tidak tersedia' };
  }

  try {
    // Get current session
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session;
    
    if (!session || !session.user) {
      console.log('❌ dashboardSupabase: User not authenticated');
      return { success: false, error: 'User tidak ter-autentikasi' };
    }

    console.log('📡 dashboardSupabase: Fetching recent sales...');

    // Today Date (Local -> ISO UTC)
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    const { data: recentSales, error } = await supabase
      .from('sales')
      .select(`
        id,
        no_invoice,
        total,
        profit,
        created_at,
        sale_items (
          product_name,
          qty,
          price,
          line_total
        )
      `)
      .eq('user_id', session.user.id)
      .gte('created_at', todayStart.toISOString())
      .lt('created_at', todayEnd.toISOString())
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.log('❌ dashboardSupabase: Error fetching recent sales:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ dashboardSupabase: Recent sales retrieved:', recentSales?.length || 0, 'items');
    return { success: true, data: recentSales || [] };

  } catch (error) {
    console.log('❌ dashboardSupabase: Exception in getRecentSales:', error);
    return { success: false, error: error.message };
  }
}
