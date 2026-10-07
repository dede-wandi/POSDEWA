import { isUnlimitedProduct } from '../services/productTypeService';

export const LOW_STOCK_THRESHOLD = 5;

/** Parse variants which may arrive as array, JSON string, or object map. */
export function parseVariants(raw) {
  let list = raw;
  if (typeof list === 'string') {
    try { list = JSON.parse(list); } catch { list = []; }
  }
  if (list && typeof list === 'object' && !Array.isArray(list)) list = Object.values(list);
  return Array.isArray(list) ? list : [];
}

/** Stock status value object: 'unlimited' | 'out' | 'low' | 'safe'. */
export class StockStatus {
  static of(stock, isUnlimited = false) {
    if (isUnlimited) return 'unlimited';
    if (stock <= 0) return 'out';
    if (stock <= LOW_STOCK_THRESHOLD) return 'low';
    return 'safe';
  }

  static META = {
    unlimited: { label: '∞ Unlimited', text: '#6D28D9', bg: '#F5F3FF', border: '#DDD6FE', accent: '#8B5CF6' },
    out: { label: '🔴 Habis', text: '#991B1B', bg: '#FEE2E2', border: '#FECACA', accent: '#EF4444' },
    low: { label: '⚠️ Menipis', text: '#92400E', bg: '#FEF3C7', border: '#FDE68A', accent: '#F59E0B' },
    safe: { label: '🟢 Aman', text: '#166534', bg: '#DCFCE7', border: '#BBF7D0', accent: null },
  };

  static meta(status) {
    return StockStatus.META[status] || StockStatus.META.safe;
  }
}

/** A single variant row of a product. */
export class StockVariant {
  constructor(raw, index, parent) {
    this.raw = raw;
    this.index = index;
    this.parent = parent;
    this.name = raw.name || raw.variantName || `Varian ${index + 1}`;
    this.barcode = raw.barcode || '';
    this.stock = Number(raw.stock) || 0;
  }

  get isUnlimited() {
    return this.parent.isUnlimited;
  }

  get status() {
    return StockStatus.of(this.stock, this.isUnlimited);
  }

  get key() {
    return this.raw.id || `${this.parent.id}-var-${this.index}`;
  }

  get displayName() {
    return `${this.parent.name} - ${this.name}`;
  }
}

/** Product row in the stock table. */
export class StockItem {
  constructor(raw, categoryMap = {}) {
    this.raw = raw;
    this.id = raw.id;
    this.name = raw.name || '';
    this.code = raw.barcode || raw.sku || '';
    this.categoryName = categoryMap[raw.category_id] || raw.category_name || raw.category || 'Umum';
    this.isUnlimited = isUnlimitedProduct(raw);
    this.variants = parseVariants(raw.variants).map((v, i) => new StockVariant(v, i, this));
  }

  get hasVariants() {
    return this.variants.length > 0;
  }

  /** Total stock: sum of variant stocks if any, else product stock. */
  get stock() {
    if (this.hasVariants) return this.variants.reduce((sum, v) => sum + v.stock, 0);
    return Number(this.raw.stock) || 0;
  }

  get status() {
    return StockStatus.of(this.stock, this.isUnlimited);
  }

  matches(query) {
    if (!query) return true;
    const q = query.toLowerCase();
    const hay = [this.name, this.code, this.raw.sku, this.categoryName]
      .concat(this.variants.flatMap(v => [v.name, v.barcode]))
      .map(s => String(s || '').toLowerCase());
    return hay.some(s => s.includes(q));
  }
}

/** Collection-level operations: metrics, filtering and sorting. */
export class StockCollection {
  constructor(rawProducts = [], categoryMap = {}) {
    this.items = rawProducts.map(p => new StockItem(p, categoryMap));
  }

  get metrics() {
    const m = { total: this.items.length, units: 0, low: 0, out: 0, safe: 0, unlimited: 0 };
    this.items.forEach(item => {
      m[item.status] += 1;
      if (!item.isUnlimited) m.units += item.stock;
    });
    return m;
  }

  query({ status = 'all', search = '', sortBy = 'stock', sortOrder = 'asc' } = {}) {
    const dir = sortOrder === 'asc' ? 1 : -1;
    return this.items
      .filter(item => status === 'all' || item.status === status)
      .filter(item => item.matches(search.trim()))
      .sort((a, b) => {
        if (sortBy === 'name') return dir * a.name.localeCompare(b.name);
        // Unlimited items always go to the bottom when sorting by stock
        if (a.isUnlimited !== b.isUnlimited) return a.isUnlimited ? 1 : -1;
        return dir * (a.stock - b.stock);
      });
  }
}
