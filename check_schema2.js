const { createClient } = require('@supabase/supabase-js');
const url = "https://wdpzehzatqdkcslakbiw.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkcHplaHphdHFka2NzbGFrYml3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0NzYzMTYsImV4cCI6MjA3NzA1MjMxNn0._MzViNByTdyZ9nF9YoHP7PZAoCcI0Lq0i5b8kY0IZAg";
const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase.from('products').select('*');
  if (error) console.error("Error:", error);
  else if (data && data.length > 0) {
    console.log("Products schema keys:", Object.keys(data[0]));
    console.log("Sample product:", data[0]);
  } else {
    console.log("No data returned");
  }
}
run();
