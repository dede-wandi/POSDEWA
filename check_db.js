const { createClient } = require('@supabase/supabase-js');

const url = "https://wdpzehzatqdkcslakbiw.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkcHplaHphdHFka2NzbGFrYml3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0NzYzMTYsImV4cCI6MjA3NzA1MjMxNn0._MzViNByTdyZ9nF9YoHP7PZAoCcI0Lq0i5b8kY0IZAg";

const supabase = createClient(url, key);

async function run() {
  try {
    const { data: products, error } = await supabase
      .from('products')
      .select('id, name, owner_id, category_id, brand_id, price');
      
    if (error) {
      console.error("Error fetching products:", error);
      return;
    }
    
    console.log("Total products in database:", products.length);
    console.log("Unique owners in products:", [...new Set(products.map(p => p.owner_id))]);
    
    // Group by owner
    const grouped = {};
    products.forEach(p => {
      grouped[p.owner_id] = (grouped[p.owner_id] || 0) + 1;
    });
    console.log("Products count per owner:", grouped);
    
    console.log("First 10 products:");
    console.log(JSON.stringify(products.slice(0, 10), null, 2));
  } catch (err) {
    console.error("Execution error:", err);
  }
}

run();
