import { getSupabaseClient } from './supabase';

export async function logAIInteraction({ userId, query, response, intent, context, model, status }) {
  const supabase = getSupabaseClient();
  if (!supabase || !userId || !query) return { success: false, error: 'invalid' };
  const payload = {
    user_id: userId,
    query,
    response: response || null,
    intent: intent || null,
    context: context || null,
    model: model || null,
    status: status || 'answered'
  };
  const { error } = await supabase.from('ai_interactions').insert(payload);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function addAIMemory({ userId, title, content, tags }) {
  const supabase = getSupabaseClient();
  if (!supabase || !userId || !title || !content) return { success: false, error: 'invalid' };
  const payload = {
    user_id: userId,
    title,
    content,
    tags: Array.isArray(tags) ? tags : null,
  };
  const { data, error } = await supabase.from('ai_memory').insert(payload).select().single();
  if (error) return { success: false, error: error.message };
  return { success: true, data };
}
