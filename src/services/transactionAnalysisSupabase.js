import { getSupabaseClient } from './supabase';

export const getDailyTransactionAnalysis = async (userId, month, year) => {
  try {
    const supabase = getSupabaseClient();
    
    // Construct date range using Date objects for correct Timezone handling
    const startDateObj = new Date(year, month - 1, 1);
    const endDateObj = new Date(year, month, 1); // Start of next month

    const { data: sales, error } = await supabase
      .from('sales')
      .select('created_at')
      .eq('user_id', userId)
      .gte('created_at', startDateObj.toISOString())
      .lt('created_at', endDateObj.toISOString());

    if (error) throw error;

    // Aggregate by day
    // Get last day of the specific month
    const lastDay = new Date(year, month, 0).getDate();
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
    const startDateObj = new Date(year, 0, 1);
    const endDateObj = new Date(year + 1, 0, 1);

    const { data: sales, error } = await supabase
      .from('sales')
      .select('created_at')
      .eq('user_id', userId)
      .gte('created_at', startDateObj.toISOString())
      .lt('created_at', endDateObj.toISOString());

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
