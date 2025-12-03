import { getSupabaseClient } from './supabase';

// Get invoice settings for current user
export const getInvoiceSettings = async (userId) => {
  try {
    console.log('📋 Getting invoice settings for user:', userId);
    
    const supabase = getSupabaseClient();
    if (!supabase) {
      console.log('❌ Supabase client not available');
      return { success: false, error: 'Supabase tidak tersedia' };
    }
    
    const { data, error } = await supabase
      .from('invoice_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No settings found, create default
        console.log('📋 No invoice settings found, creating default...');
        return await createDefaultInvoiceSettings(userId);
      }
      throw error;
    }

    console.log('✅ Invoice settings retrieved successfully');
    return { success: true, data };
  } catch (error) {
    console.error('❌ Error getting invoice settings:', error);
    return { success: false, error: error.message };
  }
};

// Create default invoice settings
export const createDefaultInvoiceSettings = async (userId) => {
  try {
    console.log('📋 Creating default invoice settings for user:', userId);
    
    const supabase = getSupabaseClient();
    if (!supabase) {
      console.log('❌ Supabase client not available');
      return { success: false, error: 'Supabase tidak tersedia' };
    }
    
    const defaultSettings = {
      user_id: userId,
      business_name: 'TOKO SAYA',
      business_address: 'Alamat Toko',
      business_phone: '0812-3456-7890',
      business_email: 'toko@email.com',
      header_text: 'Terima kasih telah berbelanja di toko kami',
      footer_text: 'Barang yang sudah dibeli tidak dapat dikembalikan',
      show_business_info: true,
      show_header_logo: false,
      show_footer_text: true,
      invoice_template: 'default'
    };

    const { data, error } = await supabase
      .from('invoice_settings')
      .insert([defaultSettings])
      .select()
      .single();

    if (error) throw error;

    console.log('✅ Default invoice settings created successfully');
    return { success: true, data };
  } catch (error) {
    console.error('❌ Error creating default invoice settings:', error);
    return { success: false, error: error.message };
  }
};

// Update invoice settings
export const updateInvoiceSettings = async (userId, settings) => {
  try {
    console.log('📋 Updating invoice settings for user:', userId);
    
    const supabase = getSupabaseClient();
    if (!supabase) {
      console.log('❌ Supabase client not available');
      return { success: false, error: 'Supabase tidak tersedia' };
    }
    
    const { data, error } = await supabase
      .from('invoice_settings')
      .update(settings)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;

    console.log('✅ Invoice settings updated successfully');
    return { success: true, data };
  } catch (error) {
    console.error('❌ Error updating invoice settings:', error);
    return { success: false, error: error.message };
  }
};

// Delete invoice settings (reset to default)
export const resetInvoiceSettings = async (userId) => {
  try {
    console.log('📋 Resetting invoice settings for user:', userId);
    
    const supabase = getSupabaseClient();
    if (!supabase) {
      console.log('❌ Supabase client not available');
      return { success: false, error: 'Supabase tidak tersedia' };
    }
    
    // Delete existing settings
    const { error: deleteError } = await supabase
      .from('invoice_settings')
      .delete()
      .eq('user_id', userId);

    if (deleteError) throw deleteError;

    // Create new default settings
    return await createDefaultInvoiceSettings(userId);
  } catch (error) {
    console.error('❌ Error resetting invoice settings:', error);
    return { success: false, error: error.message };
  }
};