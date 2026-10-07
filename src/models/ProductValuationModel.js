import { formatIDR } from '../utils/currency';

/**
 * Domain Model (OOP) representing a single product valuation item.
 * Encapsulates properties, calculations, and presentation rules.
 */
export class ValuationProductItem {
  constructor(raw = {}) {
    this.id = raw.id;
    this.name = raw.name || 'Produk Tanpa Nama';
    this.parentName = raw.parentName || this.name;
    this.variantName = raw.variantName || '';
    this._hasVariant = Boolean(raw.hasVariant || raw.hasVariants || (Array.isArray(raw.variants) && raw.variants.length > 0));
    this.barcode = raw.barcode || '';
    this.productType = raw.productType || 'physical';
    this.consignorName = raw.consignorName || '';
    this.stock = Number(raw.stock || 0);

    this.costPrice = Number(raw.costPrice || 0);
    this.costPriceMin = Number(raw.costPriceMin !== undefined ? raw.costPriceMin : this.costPrice);
    this.costPriceMax = Number(raw.costPriceMax !== undefined ? raw.costPriceMax : this.costPrice);
    this.sellPrice = Number(raw.sellPrice || 0);
    this.sellPriceMin = Number(raw.sellPriceMin !== undefined ? raw.sellPriceMin : this.sellPrice);
    this.sellPriceMax = Number(raw.sellPriceMax !== undefined ? raw.sellPriceMax : this.sellPrice);
    this.variants = Array.isArray(raw.variants) ? raw.variants : [];
    this.storeItemCapital = Number(raw.storeItemCapital || 0);
    this.totalItemCost = Number(raw.totalItemCost || 0);
    this.profitPerTrx = Number(raw.profitPerTrx !== undefined ? raw.profitPerTrx : Math.max(0, this.sellPrice - this.costPrice));
    this.totalItemRetail = Number(raw.totalItemRetail || 0);
    this.itemPotentialProfit = Number(raw.itemPotentialProfit || 0);
    this.marginPercent = Number(raw.marginPercent || 0);

    this.isPhysicalStock = Boolean(raw.isPhysicalStock);
    this.isConsignment = Boolean(raw.isConsignment);
    this.isDigital = Boolean(raw.isDigital);
    this.isVoucher = Boolean(raw.isVoucher);
    this.isService = Boolean(raw.isService);
    this.isPhysical = Boolean(raw.isPhysical);
  }

  // --- Variant Getters ---
  get hasVariant() {
    return Boolean(this._hasVariant || (Array.isArray(this.variants) && this.variants.length > 0));
  }

  get hasVariants() {
    return Boolean(this._hasVariant || (Array.isArray(this.variants) && this.variants.length > 0));
  }

  // --- Type Getters ---
  get typeBadgeLabel() {
    if (this.isConsignment) return '🤝 Titipan';
    if (this.productType === 'digital') return '⚡ Digital/PPOB';
    if (this.productType === 'voucher') return '🎟️ Voucher';
    if (this.productType === 'financial_service') return '💳 Jasa/Admin';
    return '📦 Fisik Toko';
  }

  get typeCategory() {
    if (this.isConsignment) return 'consignment';
    if (this.productType === 'digital') return 'digital';
    if (this.productType === 'voucher') return 'voucher';
    if (this.productType === 'financial_service') return 'service';
    return 'physical';
  }

  // --- Stock Condition Getters ---
  get isOutOfStock() {
    return this.isPhysicalStock && this.stock === 0;
  }

  get isLowStock() {
    return this.isPhysicalStock && this.stock > 0 && this.stock <= 5;
  }

  get isSafeStock() {
    return this.isPhysicalStock && this.stock > 5;
  }

  get stockDisplay() {
    if (!this.isPhysicalStock) {
      return this.isDigital ? 'Saldo Server' : 'Jasa/Kas';
    }
    if (this.isOutOfStock) return '0 (Habis)';
    return `${this.stock} pcs`;
  }

  // --- Financial Formatted Getters ---
  get formattedCost() {
    if (this.hasVariants && this.variants.length > 0 && this.costPriceMin !== this.costPriceMax) {
      return `${formatIDR(this.costPriceMin)} ~ ${formatIDR(this.costPriceMax)}`;
    }
    return formatIDR(this.costPrice);
  }

  get formattedSell() {
    if (this.hasVariants && this.variants.length > 0 && this.sellPriceMin !== this.sellPriceMax) {
      return `${formatIDR(this.sellPriceMin)} ~ ${formatIDR(this.sellPriceMax)}`;
    }
    return formatIDR(this.sellPrice);
  }

  get formattedStoreCapital() {
    if (this.isConsignment || this.isDigital || this.isService) {
      return 'Rp 0';
    }
    return formatIDR(this.storeItemCapital);
  }

  get formattedPotentialProfit() {
    if (this.isDigital || this.isService) {
      return `+${formatIDR(this.profitPerTrx)}`;
    }
    return `+${formatIDR(this.itemPotentialProfit)}`;
  }

  get formattedTotalRetail() {
    if (this.isDigital || this.isService) {
      return '-';
    }
    return formatIDR(this.totalItemRetail);
  }

  get marginText() {
    if (this.isDigital || this.isService) {
      return `${this.marginPercent.toFixed(0)}% /trx`;
    }
    return `${this.marginPercent.toFixed(0)}%${this.isConsignment ? ' Komisi' : ''}`;
  }

  // --- Query & Filter Matching ---
  matchesQuery(query) {
    if (!query) return true;
    const q = query.trim().toLowerCase();
    const selfMatches = (
      this.name.toLowerCase().includes(q) ||
      (this.variantName && this.variantName.toLowerCase().includes(q)) ||
      this.barcode.toLowerCase().includes(q) ||
      this.consignorName.toLowerCase().includes(q) ||
      this.productType.toLowerCase().includes(q)
    );
    if (selfMatches) return true;
    if (Array.isArray(this.variants) && this.variants.length > 0) {
      return this.variants.some(v =>
        (v.name && v.name.toLowerCase().includes(q)) ||
        (v.variantName && v.variantName.toLowerCase().includes(q)) ||
        (v.barcode && v.barcode.toLowerCase().includes(q))
      );
    }
    return false;
  }

  matchesTab(activeTab) {
    switch (activeTab) {
      case 'physical':
        return this.productType === 'physical';
      case 'consignment':
        return this.isConsignment;
      case 'digital':
        return this.productType === 'digital';
      case 'voucher':
        return this.productType === 'voucher';
      case 'service':
        return this.productType === 'financial_service';
      case 'low':
        return this.isLowStock;
      case 'empty':
        return this.isOutOfStock;
      default:
        return true;
    }
  }

  // --- Serialization for Excel Export ---
  toExcelRow(index) {
    const isDigitalOrService = this.isDigital || this.isService;
    return {
      'No': index,
      'Tipe Produk': this.typeBadgeLabel,
      'Nama Produk': this.parentName || this.name,
      'Varian': this.hasVariants && this.variants.length > 0 ? `Total ${this.variants.length} Varian` : this.variantName || '-',
      'Nama Penitip': this.consignorName || '-',
      'Stok Fisik': this.isPhysicalStock ? this.stock : 'Non-Fisik',
      'Harga Modal / Setor': this.formattedCost,
      'Harga Jual': this.formattedSell,
      'Modal Fisik Toko': this.isPhysical || this.isVoucher ? this.totalItemCost : 0,
      'Kewajiban Setor Penitip': this.isConsignment ? this.totalItemCost : 0,
      'Total Nilai Jual': isDigitalOrService ? '-' : this.totalItemRetail,
      'Potensi Keuntungan': isDigitalOrService ? `${formatIDR(this.profitPerTrx)} /trx` : this.itemPotentialProfit,
      'Status Stok': !this.isPhysicalStock
        ? 'Digital / Saldo'
        : this.stock === 0
        ? 'Habis'
        : this.stock <= 5
        ? 'Menipis'
        : 'Aman',
    };
  }

  toExcelRows(index) {
    const mainRow = this.toExcelRow(index);
    if (this.hasVariants && this.variants.length > 0) {
      const variantRows = this.variants.map((v, vIdx) => ({
        'No': `${index}.${vIdx + 1}`,
        'Tipe Produk': '  ↳ Varian',
        'Nama Produk': `  ↳ ${v.variantName}`,
        'Varian': v.variantName,
        'Nama Penitip': this.consignorName || '-',
        'Stok Fisik': v.stock,
        'Harga Modal / Setor': v.costPrice,
        'Harga Jual': v.sellPrice,
        'Modal Fisik Toko': this.isPhysical || this.isVoucher ? v.totalItemCost : 0,
        'Kewajiban Setor Penitip': this.isConsignment ? v.totalItemCost : 0,
        'Total Nilai Jual': v.totalItemRetail,
        'Potensi Keuntungan': v.itemPotentialProfit,
        'Status Stok': v.stock === 0 ? 'Habis' : v.stock <= 5 ? 'Menipis' : 'Aman',
      }));
      return [mainRow, ...variantRows];
    }
    return [mainRow];
  }
}

/**
 * Domain Model (OOP) representing dynamic aggregate table summary.
 * Mimics Excel's =SUBTOTAL() row for reactive calculations.
 */
export class ValuationSummaryModel {
  constructor({
    count = 0,
    physicalCount = 0,
    totalStock = 0,
    totalStoreCost = 0,
    totalConsignmentCost = 0,
    totalRetail = 0,
    totalProfit = 0,
    margin = 0,
  } = {}) {
    this.count = count;
    this.physicalCount = physicalCount;
    this.totalStock = totalStock;
    this.totalStoreCost = totalStoreCost;
    this.totalConsignmentCost = totalConsignmentCost;
    this.totalRetail = totalRetail;
    this.totalProfit = totalProfit;
    this.margin = margin;
  }

  static calculate(products = []) {
    let totalStock = 0;
    let totalStoreCost = 0;
    let totalConsignmentCost = 0;
    let totalRetail = 0;
    let totalProfit = 0;
    let physicalCount = 0;

    for (const p of products) {
      if (p.isPhysicalStock) {
        totalStock += p.stock;
      }
      if (p.isPhysical || p.isVoucher) {
        physicalCount += 1;
        totalStoreCost += p.storeItemCapital;
        totalRetail += p.totalItemRetail;
        totalProfit += p.itemPotentialProfit;
      } else if (p.isConsignment) {
        totalConsignmentCost += p.totalItemCost;
        totalRetail += p.totalItemRetail;
        totalProfit += p.itemPotentialProfit;
      }
      // Produk Digital & Jasa Keuangan tidak menambah totalRetail atau totalProfit persediaan fisik di rak
    }

    const margin = totalRetail > 0 ? (totalProfit / totalRetail) * 100 : 0;

    return new ValuationSummaryModel({
      count: products.length,
      physicalCount,
      totalStock,
      totalStoreCost,
      totalConsignmentCost,
      totalRetail,
      totalProfit,
      margin,
    });
  }

  toExcelSummaryRow() {
    return {
      'No': '',
      'Tipe Produk': '',
      'Nama Produk': `TOTAL (${this.count} Produk)`,
      'Varian': '',
      'Nama Penitip': '',
      'Stok Fisik': this.totalStock,
      'Harga Modal / Setor': '',
      'Harga Jual': '',
      'Modal Fisik Toko': this.totalStoreCost,
      'Kewajiban Setor Penitip': this.totalConsignmentCost,
      'Total Nilai Jual': this.totalRetail,
      'Potensi Keuntungan': this.totalProfit,
      'Status Stok': '',
    };
  }
}

/**
 * Filter & Sorting Service (OOP) for Product Valuation.
 */
export class ValuationFilterService {
  static filter(products = [], { activeTab = 'all', searchQuery = '' } = {}) {
    return products.filter(p => p.matchesTab(activeTab) && p.matchesQuery(searchQuery));
  }

  static sort(products = [], sortBy = 'storeItemCapital', sortAsc = false) {
    const list = [...products];
    list.sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];

      if (sortBy === 'name' || sortBy === 'productType') {
        aVal = (aVal || '').toLowerCase();
        bVal = (bVal || '').toLowerCase();
        return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }

      aVal = Number(aVal || 0);
      bVal = Number(bVal || 0);
      return sortAsc ? aVal - bVal : bVal - aVal;
    });
    return list;
  }

  static countByType(products = []) {
    return {
      all: products.length,
      physical: products.filter(p => p.productType === 'physical').length,
      consignment: products.filter(p => p.isConsignment).length,
      digital: products.filter(p => p.productType === 'digital').length,
      voucher: products.filter(p => p.productType === 'voucher').length,
      service: products.filter(p => p.productType === 'financial_service').length,
      low: products.filter(p => p.isLowStock).length,
      empty: products.filter(p => p.isOutOfStock).length,
    };
  }
}
