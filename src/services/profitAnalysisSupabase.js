import { getSupabaseClient } from './supabase';

// Helper to calculate profit from sale items to match SalesAnalytics
const calculateSaleProfit = (sale) => {
  const items = sale.sale_items || sale.items || [];
  if (items.length > 0) {
    return items.reduce((sum, item) => {
      const profit = (typeof item.line_profit === 'number' && item.line_profit !== 0)
        ? item.line_profit
        : ((Number(item.price) - Number(item.cost_price || 0)) * Number(item.qty || 1));
      return sum + profit;
    }, 0);
  }
  return Number(sale.profit) || 0;
};

// Paginated loader to bypass Supabase's 1000-row selection cap
const fetchAllSalesForProfit = async (userId, startDate, endDate) => {
  const supabase = getSupabaseClient();
  let allSales = [];
  let page = 0;
  const pageSize = 1000;
  let keepFetching = true;

  while (keepFetching) {
    let query = supabase
      .from('sales')
      .select('created_at, profit, sale_items(qty, price, cost_price, line_profit)')
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

export const getProfitAnalysis = async (userId, year) => {
  try {
    const startDateObj = new Date(year, 0, 1);
    const endDateObj = new Date(year + 1, 0, 1);
    
    const sales = await fetchAllSalesForProfit(userId, startDateObj.toISOString(), endDateObj.toISOString());

    const monthlyData = new Array(12).fill(0);
    
    sales.forEach(sale => {
      const date = new Date(sale.created_at);
      const month = date.getMonth(); // 0-11
      monthlyData[month] += calculateSaleProfit(sale);
    });

    return monthlyData;

  } catch (error) {
    console.error('Error in getProfitAnalysis:', error);
    return new Array(12).fill(0);
  }
};

export const getYearlyProfitAnalysis = async (userId) => {
  try {
    const sales = await fetchAllSalesForProfit(userId, null, null);

    const yearlyData = {};
    
    sales.forEach(sale => {
      const year = new Date(sale.created_at).getFullYear();
      if (!yearlyData[year]) yearlyData[year] = 0;
      yearlyData[year] += calculateSaleProfit(sale);
    });

    const sortedYears = Object.keys(yearlyData).sort();
    const values = sortedYears.map(year => yearlyData[year]);
    
    return {
      labels: sortedYears,
      data: values
    };

  } catch (error) {
    console.error('Error in getYearlyProfitAnalysis:', error);
    return { labels: [], data: [] };
  }
};

export const getProfitAnalysisByRange = async (userId, startDate, endDate) => {
  try {
    let queryStartDate = startDate;
    let queryEndDate = endDate;

    if (/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
        const [y, m, d] = startDate.split('-').map(Number);
        queryStartDate = new Date(y, m - 1, d).toISOString();
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
        const [y, m, d] = endDate.split('-').map(Number);
        const nextDay = new Date(y, m - 1, d);
        nextDay.setDate(nextDay.getDate() + 1);
        queryEndDate = nextDay.toISOString();
    }
    
    const sales = await fetchAllSalesForProfit(userId, queryStartDate, queryEndDate);

    const getMonthKey = (date) => {
      const d = new Date(date);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    };

    const getLabel = (date) => {
        const d = new Date(date);
        const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
        return `${months[d.getMonth()]} ${d.getFullYear().toString().substr(-2)}`;
    };

    const aggregatedData = {};
    sales.forEach(sale => {
      const key = getMonthKey(sale.created_at);
      if (!aggregatedData[key]) aggregatedData[key] = 0;
      aggregatedData[key] += calculateSaleProfit(sale);
    });

    const labels = [];
    const data = [];
    
    const [sYear, sMonth, sDay] = startDate.split('-').map(Number);
    const [eYear, eMonth, eDay] = endDate.split('-').map(Number);
    
    const current = new Date(sYear, sMonth - 1, sDay);
    const end = new Date(eYear, eMonth - 1, eDay);
    
    current.setDate(1); 
    
    while (current <= end) {
      const key = getMonthKey(current);
      labels.push(getLabel(current));
      data.push(aggregatedData[key] || 0);
      current.setMonth(current.getMonth() + 1);
    }

    return { labels, data };

  } catch (error) {
    console.error('Error in getProfitAnalysisByRange:', error);
    return { labels: [], data: [] };
  }
};
