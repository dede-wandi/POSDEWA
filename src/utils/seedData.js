import { getSupabaseClient } from '../services/supabase';

export async function seedSampleProducts(userId, session = null) {
  console.log('🌱 seedData: Starting to seed sample products for user:', userId);
  
  const supabase = getSupabaseClient();
  if (!supabase || !userId) {
    console.log('❌ seedData: No supabase client or userId');
    return { success: false, error: 'Supabase tidak tersedia atau user tidak login' };
  }

  // If session is provided, set it temporarily
  if (session) {
    console.log('🔐 seedData: Using provided session');
    await supabase.auth.setSession(session);
  }

  // Debug: Check current auth state
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  console.log('🔐 seedData: Current auth user:', { 
    userId: user?.id, 
    email: user?.email, 
    providedUserId: userId,
    authError: authError?.message,
    hasSession: !!session
  });

  // If no user from getUser, try using the provided userId directly
  if (!user && userId) {
    console.log('⚠️ seedData: No auth user found, proceeding with provided userId');
  } else if (user && user.id !== userId) {
    console.log('❌ seedData: Auth user ID mismatch');
    return { success: false, error: 'User ID tidak cocok dengan session' };
  }

  // Verify user is authenticated
  if (!user || user.id !== userId) {
    console.log('❌ seedData: Auth mismatch or no user');
    return { success: false, error: 'User tidak terautentikasi atau ID tidak cocok' };
  }

  const sampleProducts = [
    {
      owner_id: userId,
      name: 'Indomie Goreng',
      barcode: '8992388101012',
      price: 3500,
      cost_price: 2800,
      stock: 100
    },
    {
      owner_id: userId,
      name: 'Aqua 600ml',
      barcode: '8993675010016',
      price: 4000,
      cost_price: 3200,
      stock: 75
    },
    {
      owner_id: userId,
      name: 'Teh Botol Sosro',
      barcode: '8992761111014',
      price: 5500,
      cost_price: 4200,
      stock: 50
    },
    {
      owner_id: userId,
      name: 'Roti Tawar Sari Roti',
      barcode: '8992696010013',
      price: 12000,
      cost_price: 9500,
      stock: 25
    },
    {
      owner_id: userId,
      name: 'Kopi Kapal Api',
      barcode: '8992696020012',
      price: 8500,
      cost_price: 6800,
      stock: 40
    }
  ];

  try {
    console.log('📡 seedData: Inserting sample products...');
    const { data, error } = await supabase
      .from('products')
      .insert(sampleProducts)
      .select();

    if (error) {
      console.error('❌ seedData: Error inserting products:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ seedData: Successfully inserted', data?.length || 0, 'products');
    return { success: true, data };
  } catch (error) {
    console.error('❌ seedData: Exception:', error);
    return { success: false, error: error.message };
  }
}