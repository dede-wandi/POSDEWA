import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabaseClient } from './supabase';
import { getExpenses } from './expenseSupabase';

const RECONCILIATION_HISTORY_KEY_PREFIX = '@posdewa_cash_reconciliation_';
const STARTING_CASH_KEY_PREFIX = '@posdewa_starting_cash_';

// Denominasi rupiah standar untuk penghitungan fisik uang laci
export const CASH_DENOMINATIONS = [
  { value: 100000, label: 'Rp 100.000', type: 'bill' },
  { value: 50000,  label: 'Rp 50.000',  type: 'bill' },
  { value: 20000,  label: 'Rp 20.000',  type: 'bill' },
  { value: 10000,  label: 'Rp 10.000',  type: 'bill' },
  { value: 5000,   label: 'Rp 5.000',   type: 'bill' },
  { value: 2000,   label: 'Rp 2.000',   type: 'bill' },
  { value: 1000,   label: 'Rp 1.000',   type: 'bill' },
  { value: 500,    label: 'Koin Rp 500',type: 'coin' },
  { value: 200,    label: 'Koin Rp 200',type: 'coin' },
  { value: 100,    label: 'Koin Rp 100',type: 'coin' },
];

/**
 * Format date to YYYY-MM-DD
 */
export function getLocalDateString(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get starting cash for a specific date
 */
export async function getStartingCash(userId, dateStr = getLocalDateString()) {
  try {
    const raw = await AsyncStorage.getItem(`${STARTING_CASH_KEY_PREFIX}${userId}_${dateStr}`);
    return raw ? Number(raw) : 0;
  } catch {
    return 0;
  }
}

/**
 * Set starting cash for a specific date
 */
export async function setStartingCash(userId, amount, dateStr = getLocalDateString()) {
  try {
    await AsyncStorage.setItem(`${STARTING_CASH_KEY_PREFIX}${userId}_${dateStr}`, String(amount || 0));
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Calculate expected cash drawer balance for a date
 */
export async function calculateCashBalance(userId, dateStr = getLocalDateString()) {
  const supabase = getSupabaseClient();

  const [year, month, day] = dateStr.split('-').map(Number);
  const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0);
  const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);

  // 1. Get Starting Cash
  const startingCash = await getStartingCash(userId, dateStr);

  // 2. Get Sales for this date
  let cashSalesTotal = 0;
  let nonCashSalesTotal = 0;
  let totalSalesCount = 0;
  let cashSalesCount = 0;
  let totalSalesAmount = 0;

  if (supabase && userId) {
    try {
      const { data: sales, error } = await supabase
        .from('sales')
        .select('id, total, payment_method, cash_amount, change_amount, created_at')
        .eq('user_id', userId)
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString());

      if (!error && Array.isArray(sales)) {
        sales.forEach(sale => {
          const tot = Number(sale.total || 0);
          totalSalesAmount += tot;
          totalSalesCount += 1;

          // Periksa apakah pembayaran tunai
          const isCash = !sale.payment_method || sale.payment_method.toLowerCase() === 'cash';
          if (isCash) {
            cashSalesTotal += tot;
            cashSalesCount += 1;
          } else {
            nonCashSalesTotal += tot;
          }
        });
      }
    } catch {
      // ignore
    }
  }

  // 3. Get Cash Expenses for this date
  const { data: expenses } = await getExpenses(userId, {
    startDate: startOfDay,
    endDate: endOfDay
  });

  let cashExpensesTotal = 0;
  let nonCashExpensesTotal = 0;
  (expenses || []).forEach(exp => {
    const amt = Number(exp.amount || 0);
    if (exp.source === 'cash' || !exp.source) {
      cashExpensesTotal += amt;
    } else {
      nonCashExpensesTotal += amt;
    }
  });

  // 4. Expected cash in drawer
  const expectedCash = startingCash + cashSalesTotal - cashExpensesTotal;

  // 5. Get saved reconciliation if any
  const latestCount = await getSavedReconciliation(userId, dateStr);

  return {
    success: true,
    data: {
      dateStr,
      startingCash,
      cashSalesTotal,
      nonCashSalesTotal,
      totalSalesAmount,
      totalSalesCount,
      cashSalesCount,
      cashExpensesTotal,
      nonCashExpensesTotal,
      totalExpenses: cashExpensesTotal + nonCashExpensesTotal,
      expectedCash,
      netCashFlow: cashSalesTotal - cashExpensesTotal,
      savedReconciliation: latestCount,
    }
  };
}

/**
 * Save reconciliation session
 */
export async function saveReconciliation(userId, reconciliationData) {
  const {
    dateStr = getLocalDateString(),
    startingCash = 0,
    expectedCash = 0,
    actualCash = 0,
    denominations = {},
    notes = '',
  } = reconciliationData;

  const diff = Number(actualCash) - Number(expectedCash);
  let status = 'balanced';
  if (diff > 0) status = 'surplus';
  if (diff < 0) status = 'deficit';

  const entry = {
    id: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    userId,
    dateStr,
    startingCash: Number(startingCash),
    expectedCash: Number(expectedCash),
    actualCash: Number(actualCash),
    difference: diff,
    status,
    denominations,
    notes,
    timestamp: new Date().toISOString(),
  };

  try {
    // 1. Save as latest for this date
    await AsyncStorage.setItem(
      `${RECONCILIATION_HISTORY_KEY_PREFIX}latest_${userId}_${dateStr}`,
      JSON.stringify(entry)
    );

    // 2. Append to all historical records
    const allKey = `${RECONCILIATION_HISTORY_KEY_PREFIX}all_${userId}`;
    const raw = await AsyncStorage.getItem(allKey);
    const history = raw ? JSON.parse(raw) : [];
    const filtered = history.filter(h => h.dateStr !== dateStr);
    filtered.unshift(entry);
    await AsyncStorage.setItem(allKey, JSON.stringify(filtered.slice(0, 100)));

    // 3. Try to sync to Supabase cash_reconciliations table
    const supabase = getSupabaseClient();
    if (supabase && userId) {
      try {
        await supabase
          .from('cash_reconciliations')
          .upsert({
            user_id: userId,
            date_str: dateStr,
            starting_cash: Number(startingCash),
            expected_cash: Number(expectedCash),
            actual_cash: Number(actualCash),
            difference: diff,
            status,
            denominations,
            notes,
            created_at: new Date().toISOString(),
          }, { onConflict: 'user_id,date_str' });
      } catch {
        // Table might not exist yet, local copy is safe
      }
    }

    return { success: true, data: entry };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Get saved reconciliation for date
 */
export async function getSavedReconciliation(userId, dateStr = getLocalDateString()) {
  try {
    const raw = await AsyncStorage.getItem(
      `${RECONCILIATION_HISTORY_KEY_PREFIX}latest_${userId}_${dateStr}`
    );
    if (raw) return JSON.parse(raw);

    // Fallback to Supabase
    const supabase = getSupabaseClient();
    if (supabase && userId) {
      const { data, error } = await supabase
        .from('cash_reconciliations')
        .select('*')
        .eq('user_id', userId)
        .eq('date_str', dateStr)
        .single();

      if (!error && data) {
        return {
          id: data.id,
          userId: data.user_id,
          dateStr: data.date_str,
          startingCash: Number(data.starting_cash || 0),
          expectedCash: Number(data.expected_cash || 0),
          actualCash: Number(data.actual_cash || 0),
          difference: Number(data.difference || 0),
          status: data.status || 'balanced',
          denominations: data.denominations || {},
          notes: data.notes || '',
          timestamp: data.created_at,
        };
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Get all past reconciliations
 */
export async function getReconciliationHistory(userId) {
  let localList = [];
  try {
    const allKey = `${RECONCILIATION_HISTORY_KEY_PREFIX}all_${userId}`;
    const raw = await AsyncStorage.getItem(allKey);
    localList = raw ? JSON.parse(raw) : [];
  } catch {
    localList = [];
  }

  // Also fetch from Supabase if table exists
  const supabase = getSupabaseClient();
  let remoteList = [];
  if (supabase && userId) {
    try {
      const { data, error } = await supabase
        .from('cash_reconciliations')
        .select('*')
        .eq('user_id', userId)
        .order('date_str', { ascending: false });

      if (!error && Array.isArray(data)) {
        remoteList = data.map(item => ({
          id: item.id,
          userId: item.user_id,
          dateStr: item.date_str,
          startingCash: Number(item.starting_cash || 0),
          expectedCash: Number(item.expected_cash || 0),
          actualCash: Number(item.actual_cash || 0),
          difference: Number(item.difference || 0),
          status: item.status || 'balanced',
          denominations: item.denominations || {},
          notes: item.notes || '',
          timestamp: item.created_at,
        }));
      }
    } catch {
      // continue
    }
  }

  const map = new Map();
  [...localList, ...remoteList].forEach(item => {
    if (item && item.dateStr) {
      map.set(item.dateStr, item);
    }
  });

  return Array.from(map.values()).sort((a, b) => (b.dateStr > a.dateStr ? 1 : -1));
}
