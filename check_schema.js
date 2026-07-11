const { createClient } = require('@supabase/supabase-js');
const url = "https://wdpzehzatqdkcslakbiw.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkcHplaHphdHFka2NzbGFrYml3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0NzYzMTYsImV4cCI6MjA3NzA1MjMxNn0._MzViNByTdyZ9nF9YoHP7PZAoCcI0Lq0i5b8kY0IZAg";
const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase.from('products').select('*').limit(1);
  if (error) console.error(error);
  console.log("Products schema:", data ? Object.keys(data[0] || {}) : "No data");
  
  const { data: vData, error: vError } = await supabase.from('product_variants').select('*').limit(1);
  if (vError) console.log("No product_variants table");
  else console.log("product_variants schema:", vData ? Object.keys(vData[0] || {}) : "No data, but table exists");
}
run();
