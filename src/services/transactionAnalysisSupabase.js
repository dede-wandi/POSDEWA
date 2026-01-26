import { getSupabaseClient } from './supabase';

export const getDailyTransactionAnalysis = async (userId, month, year) => {
  try {
    const supabase = getSupabaseClient();
    
    // Construct date range for the month
    // month is 0-indexed if coming from JS Date, or 1-indexed?
    // Let's assume standard JS Month (0 = Jan, 11 = Dec) to be consistent or 1-12.
    // Based on ProfitAnalysis usage, it seems we use constructed dates.
    // Let's expect month as 1-12 for easier API usage, or 0-11. 
    // Let's use 1-12 for the argument to be safe, or just JS Date objects.
    // Let's stick to: year (2024), month (1-12).

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    // Get last day of month
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

    const { data: sales, error } = await supabase
      .from('sales')
      .select('created_at')
      .eq('user_id', userId)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (error) throw error;

    // Aggregate by day
    const dailyData = new Array(lastDay).fill(0);
    
    sales.forEach(sale => {
      const day = new Date(sale.created_at).getDate(); // 1-31
      if (day >= 1 && day <= lastDay) {
        dailyData[day - 1] += 1; // Count transaction
      }
    });

    // Generate labels 1..lastDay
    const labels = Array.from({length: lastDay}, (_, i) => String(i + 1));

    return { labels, data: dailyData };

  } catch (error) {
    console.error('Error getting daily transaction analysis:', error);
    return { labels: [], data: [] };
  }
};

export const getMonthlyTransactionAnalysis = async (userId, year) => {
  try {
    const supabase = getSupabaseClient();
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const { data: sales, error } = await supabase
      .from('sales')
      .select('created_at')
      .eq('user_id', userId)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (error) throw error;

    const monthlyData = new Array(12).fill(0);
    
    sales.forEach(sale => {
      const d = new Date(sale.created_at);
      const m = d.getMonth(); // 0-11
      monthlyData[m] += 1;
    });

    return {
      labels: ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"],
      data: monthlyData
    };

  } catch (error) {
    console.error('Error getting monthly transaction analysis:', error);
    return { labels: [], data: [] };
  }
};

export const getYearlyTransactionAnalysis = async (userId) => {
  try {
    const supabase = getSupabaseClient();
    
    const { data: sales, error } = await supabase
      .from('sales')
      .select('created_at')
      .eq('user_id', userId);

    if (error) throw error;

    const yearlyData = {};
    
    sales.forEach(sale => {
      const y = new Date(sale.created_at).getFullYear();
      if (!yearlyData[y]) yearlyData[y] = 0;
      yearlyData[y] += 1;
    });

    const sortedYears = Object.keys(yearlyData).sort();
    const values = sortedYears.map(year => yearlyData[year]);
    
    return {
      labels: sortedYears,
      data: values
    };

  } catch (error) {
    console.error('Error getting yearly transaction analysis:', error);
    return { labels: [], data: [] };
  }
};
