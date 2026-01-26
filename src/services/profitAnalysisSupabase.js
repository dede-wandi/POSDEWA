import { getSupabaseClient } from './supabase';

export const getProfitAnalysis = async (userId, year) => {
  try {
    const supabase = getSupabaseClient();
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const { data: sales, error } = await supabase
      .from('sales')
      .select('created_at, profit')
      .eq('user_id', userId)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (error) throw error;

    const monthlyData = new Array(12).fill(0);
    
    sales.forEach(sale => {
      const date = new Date(sale.created_at);
      const month = date.getMonth(); // 0-11
      monthlyData[month] += (sale.profit || 0);
    });

    return monthlyData;

  } catch (error) {
    console.error('Error getting profit analysis:', error);
    return new Array(12).fill(0);
  }
};

export const getYearlyProfitAnalysis = async (userId) => {
  try {
    const supabase = getSupabaseClient();
    
    // Get all sales
    const { data: sales, error } = await supabase
      .from('sales')
      .select('created_at, profit')
      .eq('user_id', userId);

    if (error) throw error;

    const yearlyData = {};
    
    sales.forEach(sale => {
      const year = new Date(sale.created_at).getFullYear();
      if (!yearlyData[year]) yearlyData[year] = 0;
      yearlyData[year] += (sale.profit || 0);
    });

    // Convert to sorted array
    const sortedYears = Object.keys(yearlyData).sort();
    const values = sortedYears.map(year => yearlyData[year]);
    
    return {
      labels: sortedYears,
      data: values
    };

  } catch (error) {
    console.error('Error getting yearly profit analysis:', error);
    return { labels: [], data: [] };
  }
};

export const getProfitAnalysisByRange = async (userId, startDate, endDate) => {
  try {
    const supabase = getSupabaseClient();
    
    // Get sales within range
    const { data: sales, error } = await supabase
      .from('sales')
      .select('created_at, profit')
      .eq('user_id', userId)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Helper to format YYYY-MM
    const getMonthKey = (date) => {
      const d = new Date(date);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    };

    // Helper to format Label (e.g., "Jan 24")
    const getLabel = (date) => {
        const d = new Date(date);
        const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
        return `${months[d.getMonth()]} ${d.getFullYear().toString().substr(-2)}`;
    };

    // 1. Aggregate data by month
    const aggregatedData = {};
    sales.forEach(sale => {
      const key = getMonthKey(sale.created_at);
      if (!aggregatedData[key]) aggregatedData[key] = 0;
      aggregatedData[key] += (sale.profit || 0);
    });

    // 2. Generate all months in range to ensure continuity
    const labels = [];
    const data = [];
    
    // Parse dates as local time to avoid timezone shifts
    const [sYear, sMonth, sDay] = startDate.split('-').map(Number);
    const [eYear, eMonth, eDay] = endDate.split('-').map(Number);
    
    const current = new Date(sYear, sMonth - 1, sDay);
    const end = new Date(eYear, eMonth - 1, eDay);
    
    // Set to start of month to avoid skipping issues
    current.setDate(1); 
    
    while (current <= end) {
      const key = getMonthKey(current);
      labels.push(getLabel(current));
      data.push(aggregatedData[key] || 0);
      
      // Next month
      current.setMonth(current.getMonth() + 1);
    }

    return { labels, data };

  } catch (error) {
    console.error('Error getting range profit analysis:', error);
    return { labels: [], data: [] };
  }
};
