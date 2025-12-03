import { getSupabaseClient } from './supabase';

export async function signIn(email, password) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase belum dikonfigurasi. Isi extra.supabaseUrl & extra.supabaseAnonKey di app.json');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data?.user || null;
}

export async function signUp(email, password) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase belum dikonfigurasi. Isi extra.supabaseUrl & extra.supabaseAnonKey di app.json');
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data?.user || null;
}

export async function signOut() {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function getSession() {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error('Get session error:', error);
      return null;
    }
    return data?.session || null;
  } catch (error) {
    console.error('Get session exception:', error);
    return null;
  }
}

export function onAuthStateChange(callback) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return { unsubscribe: () => {} };
    
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      callback(session);
    });
    
    return { 
      unsubscribe: () => {
        try {
          data?.subscription?.unsubscribe();
        } catch (error) {
          console.error('Unsubscribe error:', error);
        }
      }
    };
  } catch (error) {
    console.error('Auth state change error:', error);
    return { unsubscribe: () => {} };
  }
}