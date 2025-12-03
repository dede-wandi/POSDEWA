const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://wdpzehzatqdkcslakbiw.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkcHplaHphdHFka2NzbGFrYml3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0NzYzMTYsImV4cCI6MjA3NzA1MjMxNn0._MzViNByTdyZ9nF9YoHP7PZAoCcI0Lq0i5b8kY0IZAg'
);

async function createStockHistory() {
  try {
    // Sign in first
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'admin@gmail.com',
      password: 'admin123'
    });

    if (authError) {
      console.log('Auth error:', authError);
      return;
    }

    console.log('Signed in successfully');

    // Get products
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('*')
      .limit(3);

    if (productsError || !products || products.length === 0) {
      console.log('No products found:', productsError);
      return;
    }

    console.log('Found products:', products.length);

    // Create sample stock history with correct type
    const sampleStockHistory = [
      {
        product_id: products[0].id,
        user_id: authData.user.id,
        type: 'addition',
        quantity: 20,
        previous_stock: 30,
        new_stock: 50,
        reason: 'Restok barang',
        notes: 'Pembelian dari supplier'
      },
      {
        product_id: products[1].id,
        user_id: authData.user.id,
        type: 'addition',
        quantity: 10,
        previous_stock: 20,
        new_stock: 30,
        reason: 'Restok barang',
        notes: 'Pembelian mingguan'
      },
      {
        product_id: products[0].id,
        user_id: authData.user.id,
        type: 'reduction',
        quantity: 5,
        previous_stock: 55,
        new_stock: 50,
        reason: 'Penjualan',
        notes: 'Terjual ke pelanggan'
      }
    ];

    if (products.length > 2) {
      sampleStockHistory.push({
        product_id: products[2].id,
        user_id: authData.user.id,
        type: 'adjustment',
        quantity: 3,
        previous_stock: 22,
        new_stock: 25,
        reason: 'Penyesuaian stock',
        notes: 'Koreksi stock fisik'
      });
    }

    console.log('Creating stock history...');
    const { data: stockHistory, error: stockError } = await supabase
      .from('stock_history')
      .insert(sampleStockHistory)
      .select();

    if (stockError) {
      console.log('Error creating stock history:', stockError);
    } else {
      console.log('Stock history created successfully:', stockHistory.length);
      console.log('Sample entries created');
    }

  } catch (error) {
    console.log('Exception:', error);
  }
}

createStockHistory();