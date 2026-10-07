import { getSupabaseClient } from './supabase';
import { addStock, adjustStock, getStockHistory } from './stockSupabase';
import { parseVariants } from '../models/StockItemModel';

/**
 * Calculates the resulting stock for a mutation.
 * mode: 'add' | 'subtract' | 'set'
 */
export function calculateFinalStock(current, mode, value) {
  const n = parseInt(value, 10);
  if (isNaN(n)) return current;
  if (mode === 'add') return current + n;
  if (mode === 'subtract') return Math.max(0, current - n);
  return n;
}

/**
 * Service (OOP) to apply stock mutations for products and their variants.
 * Unlimited products are rejected: they never have stock nor stock history.
 */
export class StockMutationService {
  constructor(userId) {
    this.userId = userId;
    this.supabase = getSupabaseClient();
  }

  /**
   * @param {StockItem} item
   * @param {StockVariant|null} variant
   * @param {{mode:'add'|'subtract'|'set', value:string, reason:string, notes?:string, source:'add'|'adjust'}} input
   */
  async apply(item, variant, { mode, value, reason, notes, source }) {
    if (item.isUnlimited) {
      throw new Error('Produk unlimited tidak menggunakan stok');
    }
    const qty = parseInt(value, 10);
    if (isNaN(qty) || qty < 0 || (source === 'add' && qty === 0)) {
      throw new Error('Jumlah stok harus berupa angka positif');
    }
    if (!reason?.trim()) throw new Error('Mohon isi alasan');

    const current = variant ? variant.stock : item.stock;
    const finalStock = calculateFinalStock(current, mode, value);

    if (variant) {
      await this._applyVariant(item, variant, current, finalStock, reason, notes);
    } else if (source === 'add') {
      const res = await addStock(item.id, qty, reason, notes || undefined);
      if (!res.success) throw new Error(res.error || 'Gagal menambahkan stok');
    } else {
      const res = await adjustStock(item.id, finalStock, reason, notes || undefined);
      if (!res.success) throw new Error(res.error || 'Gagal menyesuaikan stok');
    }
    return finalStock;
  }

  async _applyVariant(item, variant, previous, finalStock, reason, notes) {
    const { data: prod, error } = await this.supabase
      .from('products')
      .select('id, variants')
      .eq('id', item.id)
      .single();
    if (error || !prod) throw new Error(error?.message || 'Produk induk tidak ditemukan');

    const variants = parseVariants(prod.variants).map((v, i) =>
      i === variant.index ? { ...v, stock: finalStock } : v
    );
    const total = variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);

    const { error: updErr } = await this.supabase
      .from('products')
      .update({ stock: total, variants, last_change_reason: reason })
      .eq('id', item.id);
    if (updErr) throw updErr;

    const diff = finalStock - previous;
    try {
      await this.supabase.from('stock_history').insert({
        product_id: item.id,
        user_id: this.userId,
        type: diff > 0 ? 'addition' : diff < 0 ? 'reduction' : 'adjustment',
        quantity: Math.abs(diff),
        previous_stock: previous,
        new_stock: finalStock,
        reason: `${reason} (${variant.displayName})`,
        notes: notes || undefined,
      });
    } catch {
      // history is best-effort
    }
  }
}

/** Date range filter for stock history. */
export class HistoryDateFilter {
  static OPTIONS = [
    { id: 'all', label: 'Semua Waktu' },
    { id: 'today', label: 'Hari Ini' },
    { id: 'week', label: 'Minggu Ini' },
    { id: 'month', label: 'Bulan Ini' },
    { id: 'year', label: 'Tahun Ini' },
    { id: 'custom', label: 'Rentang Kustom' },
  ];

  static label(id) {
    return (HistoryDateFilter.OPTIONS.find(o => o.id === id) || HistoryDateFilter.OPTIONS[0]).label;
  }

  static _dayOnly(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  static apply(history = [], { range = 'all', start = '', end = '', search = '' } = {}) {
    const today = HistoryDateFilter._dayOnly(new Date());
    let from = null;
    let to = today;
    if (range === 'today') from = today;
    if (range === 'week') from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay());
    if (range === 'month') from = new Date(today.getFullYear(), today.getMonth(), 1);
    if (range === 'year') from = new Date(today.getFullYear(), 0, 1);
    if (range === 'custom' && start && end) {
      from = HistoryDateFilter._dayOnly(new Date(start));
      to = HistoryDateFilter._dayOnly(new Date(end));
    }

    const q = search.trim().toLowerCase();
    return history.filter(h => {
      if (from) {
        const d = HistoryDateFilter._dayOnly(new Date(h.created_at));
        if (d < from || d > to) return false;
      }
      if (!q) return true;
      return [h.products?.name, h.reason, h.notes].some(s => String(s || '').toLowerCase().includes(q));
    });
  }
}

export async function loadStockHistory(limit = 150) {
  const res = await getStockHistory(null, limit);
  if (!res.success) throw new Error(res.error || 'Gagal memuat riwayat stok');
  return res.data || [];
}
