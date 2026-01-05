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

    const today = new Date().toISOString().split('T')[0];
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

    console.log('📡 dashboardSupabase: Fetching dashboard statistics...');

    // Get today's sales
    const { data: todaySales, error: todayError } = await supabase
      .from('sales')
      .select('total, profit')
      .eq('user_id', session.user.id)
      .gte('created_at', today + 'T00:00:00')
      .lt('created_at', today + 'T23:59:59');

    if (todayError) {
      console.log('❌ dashboardSupabase: Error fetching today sales:', todayError);
      return { success: false, error: todayError.message };
    }

    // Get yesterday's sales
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const { data: yesterdaySales, error: yesterdayError } = await supabase
      .from('sales')
      .select('total, profit')
      .eq('user_id', session.user.id)
      .gte('created_at', yesterdayStr + 'T00:00:00')
      .lt('created_at', yesterdayStr + 'T23:59:59');

    if (yesterdayError) {
      console.log('❌ dashboardSupabase: Error fetching yesterday sales:', yesterdayError);
      // Don't fail the whole request, just log it
    }

    // Get this month's sales
    const { data: monthSales, error: monthError } = await supabase
      .from('sales')
      .select('total, profit')
      .eq('user_id', session.user.id)
      .gte('created_at', startOfMonth + 'T00:00:00');

    if (monthError) {
      console.log('❌ dashboardSupabase: Error fetching month sales:', monthError);
      return { success: false, error: monthError.message };
    }

    // Get last month's sales
    const lastMonthStart = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().split('T')[0];
    const lastMonthEnd = new Date(new Date().getFullYear(), new Date().getMonth(), 0); // Last day of previous month
    const lastMonthEndStr = lastMonthEnd.toISOString().split('T')[0];

    const { data: lastMonthSales, error: lastMonthError } = await supabase
      .from('sales')
      .select('total, profit')
      .eq('user_id', session.user.id)
      .gte('created_at', lastMonthStart + 'T00:00:00')
      .lte('created_at', lastMonthEndStr + 'T23:59:59');

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
    const todayProfit = todaySales.reduce((sum, sale) => sum + (sale.profit || 0), 0);
    const todayTransactions = todaySales.length;

    const yesterdayTotal = yesterdaySales ? yesterdaySales.reduce((sum, sale) => sum + (sale.total || 0), 0) : 0;
    const yesterdayProfit = yesterdaySales ? yesterdaySales.reduce((sum, sale) => sum + (sale.profit || 0), 0) : 0;

    const monthTotal = monthSales.reduce((sum, sale) => sum + (sale.total || 0), 0);
    const monthProfit = monthSales.reduce((sum, sale) => sum + (sale.profit || 0), 0);
    const monthTransactions = monthSales.length;

    const lastMonthTotal = lastMonthSales ? lastMonthSales.reduce((sum, sale) => sum + (sale.total || 0), 0) : 0;
    const lastMonthProfit = lastMonthSales ? lastMonthSales.reduce((sum, sale) => sum + (sale.profit || 0), 0) : 0;

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

    const today = new Date().toISOString().split('T')[0];

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
      .gte('created_at', today + 'T00:00:00')
      .lt('created_at', today + 'T23:59:59')
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
