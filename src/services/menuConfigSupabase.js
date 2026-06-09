import { getSupabaseClient } from './supabase';

/**
 * Get menu custom image URL configurations for the current user.
 * Returns a dictionary mapping menu_key to image_url.
 */
export const getMenuConfigs = async (userId) => {
  try {
    
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { success: false, error: 'Supabase tidak tersedia' };
    }
    
    const { data, error } = await supabase
      .from('menu_configs')
      .select('menu_key, image_url')
      .eq('user_id', userId);

    if (error) {
      throw error;
    }

    // Convert list of configurations to a map: { [menu_key]: image_url }
    const configMap = {};
    if (data) {
      data.forEach(item => {
        configMap[item.menu_key] = item.image_url;
      });
    }

    return { success: true, data: configMap };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Save menu configurations for the current user.
 * Accepts a configMap of { [menu_key]: image_url }.
 */
export const saveMenuConfigs = async (userId, configMap) => {
  try {
    
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { success: false, error: 'Supabase tidak tersedia' };
    }

    // Map dictionary keys to database rows
    const rows = Object.keys(configMap).map(key => ({
      user_id: userId,
      menu_key: key,
      image_url: configMap[key]?.trim() || null
    }));

    if (rows.length === 0) {
      return { success: true, data: {} };
    }

    const { data, error } = await supabase
      .from('menu_configs')
      .upsert(rows, { onConflict: 'user_id,menu_key' })
      .select();

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
