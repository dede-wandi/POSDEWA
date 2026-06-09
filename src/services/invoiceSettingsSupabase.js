import { getSupabaseClient } from './supabase';

// Get invoice settings for current user
export const getInvoiceSettings = async (userId) => {
  try {
    
    const supabase = getSupabaseClient();
    if (!supabase) {
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
        return await createDefaultInvoiceSettings(userId);
      }
      throw error;
    }

    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Create default invoice settings
export const createDefaultInvoiceSettings = async (userId) => {
  try {
    
    const supabase = getSupabaseClient();
    if (!supabase) {
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

    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Update invoice settings
export const updateInvoiceSettings = async (userId, settings) => {
  try {
    
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { success: false, error: 'Supabase tidak tersedia' };
    }
    
    const { data, error } = await supabase
      .from('invoice_settings')
      .update(settings)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Delete invoice settings (reset to default)
export const resetInvoiceSettings = async (userId) => {
  try {
    
    const supabase = getSupabaseClient();
    if (!supabase) {
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
    return { success: false, error: error.message };
  }
};