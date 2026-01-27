import { getSupabaseClient } from './supabase';
import { getSalesHistory } from './salesSupabase';
import { getProducts, getCategories, getBrands } from './products';

// Helper to get date range for "last 1 year"
const getOneYearAgo = () => {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 1);
  return date.toISOString();
};

export const getTopProducts = async (userId, limit = 20) => {
  try {
    const sales = await getSalesHistory(userId);
    const productStats = {};

    sales.forEach(sale => {
      if (sale.items && Array.isArray(sale.items)) {
        sale.items.forEach(item => {
          // Key by product name since ID might not be in sale_items (based on schema)
          // Ideally use product_id if available, but fallback to name
          const key = item.product_name;
          if (!productStats[key]) {
            productStats[key] = {
              name: item.product_name,
              qty: 0,
              total: 0
            };
          }
          productStats[key].qty += Number(item.qty || 0);
          productStats[key].total += Number(item.line_total || 0);
        });
      }
    });

    return Object.values(productStats)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, limit)
      .map((item, index) => ({ ...item, rank: index + 1 }));
  } catch (error) {
    console.error('Error getting top products:', error);
    return [];
  }
};

export const getTopCategories = async (userId, limit = 20) => {
  try {
    const [sales, products, categories] = await Promise.all([
      getSalesHistory(userId),
      getProducts(userId),
      getCategories(userId)
    ]);

    const productMap = new Map(products.map(p => [p.name, p])); // Map Name -> Product
    const categoryMap = new Map(categories.map(c => [c.id, c.name])); // Map ID -> Name

    const stats = {};

    sales.forEach(sale => {
      if (sale.items) {
        sale.items.forEach(item => {
          const product = productMap.get(item.product_name);
          if (product && product.category_id) {
            const catName = categoryMap.get(product.category_id) || 'Uncategorized';
            if (!stats[catName]) {
              stats[catName] = { name: catName, qty: 0, total: 0 };
            }
            stats[catName].qty += Number(item.qty || 0);
            stats[catName].total += Number(item.line_total || 0);
          }
        });
      }
    });

    return Object.values(stats)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, limit)
      .map((item, index) => ({ ...item, rank: index + 1 }));

  } catch (error) {
    console.error('Error getting top categories:', error);
    return [];
  }
};

export const getTopBrands = async (userId, limit = 20) => {
  try {
    const [sales, products, brands] = await Promise.all([
      getSalesHistory(userId),
      getProducts(userId),
      getBrands(userId)
    ]);

    const productMap = new Map(products.map(p => [p.name, p]));
    const brandMap = new Map(brands.map(b => [b.id, b.name]));

    const stats = {};

    sales.forEach(sale => {
      if (sale.items) {
        sale.items.forEach(item => {
          const product = productMap.get(item.product_name);
          if (product && product.brand_id) {
            const brandName = brandMap.get(product.brand_id) || 'No Brand';
            if (!stats[brandName]) {
              stats[brandName] = { name: brandName, qty: 0, total: 0 };
            }
            stats[brandName].qty += Number(item.qty || 0);
            stats[brandName].total += Number(item.line_total || 0);
          }
        });
      }
    });

    return Object.values(stats)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, limit)
      .map((item, index) => ({ ...item, rank: index + 1 }));

  } catch (error) {
    console.error('Error getting top brands:', error);
    return [];
  }
};

export const getTopDates = async (userId, limit = 20) => {
  try {
    const supabase = getSupabaseClient();
    const oneYearAgo = getOneYearAgo();

    // Fetch sales only for last year
    const { data: sales, error } = await supabase
      .from('sales')
      .select('created_at, profit') // Changed from total to profit
      .eq('user_id', userId)
      .gte('created_at', oneYearAgo)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const stats = {};

    sales.forEach(sale => {
      const dateKey = new Date(sale.created_at).toISOString().split('T')[0]; // YYYY-MM-DD
      if (!stats[dateKey]) {
        stats[dateKey] = { name: dateKey, total: 0, count: 0 };
      }
      stats[dateKey].total += (sale.profit || 0); // Aggregate Profit
      stats[dateKey].count += 1;
    });

    return Object.values(stats)
      .sort((a, b) => b.total - a.total) // Sort by Profit
      .slice(0, limit)
      .map((item, index) => ({ ...item, rank: index + 1 }));

  } catch (error) {
    console.error('Error getting top dates:', error);
    return [];
  }
};
