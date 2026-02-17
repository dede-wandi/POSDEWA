import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MODEL_STORE_KEY = 'ai:sumopod:model';
const KEY_STORE_KEY = 'ai:sumopod:key';

export const AVAILABLE_MODELS = [
  'deepseek-v3-2-251201',
  'kimi-k2-250905',
  'glm-4-7-251222',
  'kimi-k2-thinking-251104',
  'seed-1-8-251228'
];

export async function getAIConfig() {
  const extra = Constants?.expoConfig?.extra || Constants?.manifest?.extra || {};
  const base = extra?.sumopodApiBase || 'https://ai.sumopod.com/v1';
  const defaultModel = extra?.sumopodModel || AVAILABLE_MODELS[0];
  const defaultKey = extra?.sumopodApiKey || '';

  let storedModel = null;
  let storedKey = null;
  try {
    storedModel = await AsyncStorage.getItem(MODEL_STORE_KEY);
    storedKey = await AsyncStorage.getItem(KEY_STORE_KEY);
  } catch (e) {}

  return {
    apiBase: base,
    apiKey: storedKey || defaultKey || '',
    model: storedModel || defaultModel
  };
}

export async function setAIConfig({ apiKey, model }) {
  if (model) {
    await AsyncStorage.setItem(MODEL_STORE_KEY, model);
  }
  if (apiKey != null) {
    await AsyncStorage.setItem(KEY_STORE_KEY, apiKey);
  }
}

export async function chatCompletion({ messages, model, temperature = 0.3, max_tokens = 400 }) {
  const cfg = await getAIConfig();
  const apiKey = cfg.apiKey;
  const apiBase = cfg.apiBase;
  const finalModel = model || cfg.model;

  if (!apiKey) {
    throw new Error('API key belum disetel');
  }

  const url = `${apiBase}/chat/completions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: finalModel,
      messages,
      max_tokens,
      temperature
    })
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Request failed with ${res.status}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content || '';
  return { content, raw: data };
}
