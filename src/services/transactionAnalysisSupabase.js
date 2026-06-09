import { getSupabaseClient } from './supabase';

// Paginated loader to bypass Supabase's 1000-row selection cap
const fetchAllSalesForTransactions = async (userId, startDate, endDate) => {
  const supabase = getSupabaseClient();
  let allSales = [];
  let page = 0;
  const pageSize = 1000;
  let keepFetching = true;

  while (keepFetching) {
    let query = supabase
      .from('sales')
      .select('created_at')
      .eq('user_id', userId);
      
    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lt('created_at', endDate);
    }
    
    const { data, error } = await query
      .order('created_at', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) throw error;

    if (!data || data.length === 0) {
      keepFetching = false;
    } else {
      allSales = [...allSales, ...data];
      if (data.length < pageSize) {
        keepFetching = false;
      } else {
        page++;
      }
    }
  }
  return allSales;
};

export const getDailyTransactionAnalysis = async (userId, month, year) => {
  try {
    const startDateObj = new Date(year, month - 1, 1);
    const endDateObj = new Date(year, month, 1); // Start of next month

    const sales = await fetchAllSalesForTransactions(userId, startDateObj.toISOString(), endDateObj.toISOString());

    const lastDay = new Date(year, month, 0).getDate();
    const dailyData = new Array(lastDay).fill(0);
    
    sales.forEach(sale => {
      const day = new Date(sale.created_at).getDate(); // 1-31
      if (day >= 1 && day <= lastDay) {
        dailyData[day - 1] += 1;
      }
    });

    const labels = Array.from({length: lastDay}, (_, i) => String(i + 1));

    return { labels, data: dailyData };

  } catch (error) {
    console.error('Error in getDailyTransactionAnalysis:', error);
    return { labels: [], data: [] };
  }
};

export const getMonthlyTransactionAnalysis = async (userId, year) => {
  try {
    const startDateObj = new Date(year, 0, 1);
    const endDateObj = new Date(year + 1, 0, 1);

    const sales = await fetchAllSalesForTransactions(userId, startDateObj.toISOString(), endDateObj.toISOString());

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
    console.error('Error in getMonthlyTransactionAnalysis:', error);
    return { labels: [], data: [] };
  }
};

export const getYearlyTransactionAnalysis = async (userId) => {
  try {
    const sales = await fetchAllSalesForTransactions(userId, null, null);

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
    console.error('Error in getYearlyTransactionAnalysis:', error);
    return { labels: [], data: [] };
  }
};
