const { createClient } = require('@supabase/supabase-js');

const url = 'https://wdpzehzatqdkcslakbiw.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkcHplaHphdHFka2NzbGFrYml3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0NzYzMTYsImV4cCI6MjA3NzA1MjMxNn0._MzViNByTdyZ9nF9YoHP7PZAoCcI0Lq0i5b8kY0IZAg';

const supabase = createClient(url, key);

async function run() {
  try {
    const { data: categories, error: cErr } = await supabase.from('categories').select('*');
    if (cErr) throw cErr;

    const { data: brands, error: bErr } = await supabase.from('brands').select('*');
    if (bErr) throw bErr;

    const { data: products, error: pErr } = await supabase.from('products').select('*');
    if (pErr) throw pErr;

    console.log('Categories:', categories.map(c => ({ id: c.id, name: c.name })));
    console.log('Brands:', brands.map(b => ({ id: b.id, name: b.name })));
    console.log('Total Products:', products.length);

    // Let's find products in category "Paket Data Harian"
    const targetCat = categories.find(c => c.name.toLowerCase().includes('data harian') || c.name.toLowerCase().includes('paket data'));
    if (targetCat) {
      console.log(`\nProducts in Category "${targetCat.name}" (ID: ${targetCat.id}):`);
      const catProducts = products.filter(p => p.category_id === targetCat.id);
      console.log(catProducts.map(p => {
        const brand = brands.find(b => b.id === p.brand_id);
        return {
          id: p.id,
          name: p.name,
          price: p.price,
          brand_id: p.brand_id,
          brand_name: brand ? brand.name : 'Unknown'
        };
      }));
    } else {
      console.log('\nCategory "Paket Data Harian" not found.');
    }
  } catch (e) {
    console.error('Error running check:', e);
  }
}

run();
