import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabaseClient } from './supabase';

const EXPENSES_STORAGE_KEY_PREFIX = '@posdewa_expenses_';

export const EXPENSE_CATEGORIES = [
  { id: 'stock', label: 'Kulakan & Stok Barang', icon: 'cube-outline', color: '#3B82F6', bg: '#EFF6FF' },
  { id: 'consignment_payout', label: 'Setor Uang Barang Titipan', icon: 'hand-right-outline', color: '#8B5CF6', bg: '#F5F3FF' },
  { id: 'operational', label: 'Operasional & Toko', icon: 'construct-outline', color: '#10B981', bg: '#ECFDF5' },
  { id: 'utilities', label: 'Listrik, Air & Internet', icon: 'flash-outline', color: '#F59E0B', bg: '#FFFBEB' },
  { id: 'salary', label: 'Gaji Karyawan', icon: 'people-outline', color: '#059669', bg: '#ECFDF5' },
  { id: 'rent', label: 'Sewa Tempat', icon: 'business-outline', color: '#EC4899', bg: '#FDF2F8' },
  { id: 'consumption', label: 'Konsumsi & Makan', icon: 'restaurant-outline', color: '#F97316', bg: '#FFF7ED' },
  { id: 'other', label: 'Biaya Lain-lain', icon: 'ellipsis-horizontal-circle-outline', color: '#64748B', bg: '#F8FAFC' },
];

export const PAYMENT_SOURCES = [
  { id: 'cash', label: 'Kas Tunai (Laci Kasir)', icon: 'cash-outline', affectsCashDrawer: true },
  { id: 'bank', label: 'Transfer / Rekening Bank', icon: 'card-outline', affectsCashDrawer: false },
  { id: 'digital', label: 'E-Wallet / Lainnya', icon: 'wallet-outline', affectsCashDrawer: false },
];

/**
 * Get all expenses for a user with optional date filtering
 */
export async function getExpenses(userId, { startDate = null, endDate = null, category = null } = {}) {
  const supabase = getSupabaseClient();
  let remoteExpenses = [];

  // Try fetching from Supabase finance_transactions where type = 'expense'
  if (supabase && userId) {
    try {
      let query = supabase
        .from('finance_transactions')
        .select('*')
        .eq('owner_id', userId)
        .eq('type', 'expense')
        .order('created_at', { ascending: false });

      if (startDate) {
        query = query.gte('created_at', startDate.toISOString ? startDate.toISOString() : startDate);
      }
      if (endDate) {
        query = query.lte('created_at', endDate.toISOString ? endDate.toISOString() : endDate);
      }

      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        remoteExpenses = data.map(item => ({
          id: item.id,
          amount: Number(item.amount || 0),
          category: item.category || 'other',
          description: item.description || '',
          source: item.source || (item.channel_id ? 'channel' : 'cash'),
          created_at: item.transaction_date || item.created_at || new Date().toISOString(),
          is_synced: true,
        }));
      }
    } catch (err) {
      // Supabase query failed or offline, fallback will handle
    }
  }

  // Get local storage expenses
  let localExpenses = [];
  try {
    const raw = await AsyncStorage.getItem(`${EXPENSES_STORAGE_KEY_PREFIX}${userId}`);
    if (raw) {
      localExpenses = JSON.parse(raw);
    }
  } catch (e) {
    localExpenses = [];
  }

  // Merge expenses (avoid duplicates by ID)
  const map = new Map();
  [...localExpenses, ...remoteExpenses].forEach(item => {
    if (item && item.id) {
      map.set(item.id, item);
    }
  });

  let combined = Array.from(map.values()).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  // Apply filters in memory
  if (startDate) {
    const startMs = new Date(startDate).getTime();
    combined = combined.filter(item => new Date(item.created_at).getTime() >= startMs);
  }
  if (endDate) {
    const endMs = new Date(endDate).getTime();
    combined = combined.filter(item => new Date(item.created_at).getTime() <= endMs);
  }
  if (category && category !== 'all') {
    combined = combined.filter(item => item.category === category);
  }

  return { success: true, data: combined };
}

/**
 * Record a new expense
 */
export async function createExpense(userId, { amount, category, description, source = 'cash', date = null }) {
  if (!amount || Number(amount) <= 0) {
    return { success: false, error: 'Nominal pengeluaran harus lebih besar dari 0' };
  }

  const newExpense = {
    id: `exp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    owner_id: userId,
    amount: Number(amount),
    category: category || 'other',
    description: description || '',
    source: source || 'cash',
    created_at: date ? new Date(date).toISOString() : new Date().toISOString(),
    is_synced: false,
  };

  // 1. Save to local storage first for instant reliability
  try {
    const storageKey = `${EXPENSES_STORAGE_KEY_PREFIX}${userId}`;
    const raw = await AsyncStorage.getItem(storageKey);
    const list = raw ? JSON.parse(raw) : [];
    list.unshift(newExpense);
    await AsyncStorage.setItem(storageKey, JSON.stringify(list));
  } catch (e) {
    // continue
  }

  // 2. Try to save to Supabase finance_transactions
  const supabase = getSupabaseClient();
  if (supabase && userId) {
    try {
      const { data, error } = await supabase
        .from('finance_transactions')
        .insert({
          owner_id: userId,
          type: 'expense',
          amount: newExpense.amount,
          category: newExpense.category,
          description: newExpense.description,
          transaction_date: newExpense.created_at,
          created_at: newExpense.created_at
        })
        .select()
        .single();

      if (!error && data) {
        newExpense.id = data.id;
        newExpense.is_synced = true;
      }
    } catch (err) {
      // offline or table mismatch, local copy is safe
    }
  }

  return { success: true, data: newExpense };
}

/**
 * Delete an expense
 */
export async function deleteExpense(userId, expenseId) {
  // 1. Remove from local storage
  try {
    const storageKey = `${EXPENSES_STORAGE_KEY_PREFIX}${userId}`;
    const raw = await AsyncStorage.getItem(storageKey);
    if (raw) {
      let list = JSON.parse(raw);
      list = list.filter(item => item.id !== expenseId);
      await AsyncStorage.setItem(storageKey, JSON.stringify(list));
    }
  } catch (e) {
    // continue
  }

  // 2. Remove from Supabase if possible
  const supabase = getSupabaseClient();
  if (supabase && userId) {
    try {
      await supabase
        .from('finance_transactions')
        .delete()
        .eq('id', expenseId)
        .eq('owner_id', userId);
    } catch (err) {
      // continue
    }
  }

  return { success: true };
}

/**
 * Get Expense Summary by period
 */
export async function getExpenseSummary(userId, period = 'month') {
  const now = new Date();
  let startDate = new Date();
  let endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  if (period === 'today') {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  } else if (period === 'month') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  } else if (period === 'year') {
    startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
  } else if (period === 'all') {
    startDate = null;
  }

  const { data: expenses } = await getExpenses(userId, { startDate, endDate });

  const totalAmount = (expenses || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const cashAmount = (expenses || [])
    .filter(item => item.source === 'cash' || !item.source)
    .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const nonCashAmount = totalAmount - cashAmount;

  // Breakdown by category
  const byCategory = {};
  (expenses || []).forEach(item => {
    const cat = item.category || 'other';
    byCategory[cat] = (byCategory[cat] || 0) + (Number(item.amount) || 0);
  });

  return {
    success: true,
    data: {
      period,
      totalAmount,
      cashAmount,
      nonCashAmount,
      count: (expenses || []).length,
      byCategory,
      expenses: expenses || [],
    }
  };
}
