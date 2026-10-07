import { formatIDR } from '../utils/currency';
import { updateProduct } from '../services/products';
import { setProductTypeMeta, PRODUCT_TYPES } from '../services/productTypeService';

/**
 * Domain Model (OOP) representing an inline-editable product row.
 * Encapsulates original state, draft modifications, validation,
 * reactive margin calculations, and persistence.
 */
export class EditableProduct {
  constructor(raw = {}) {
    this.id = raw.id;
    this.category_id = raw.category_id || null;
    this.brand_id = raw.brand_id || null;
    this.created_at = raw.created_at || null;
    this.image_urls = raw.image_urls || [];
    this.variants = raw.variants || [];

    // Snapshot of original data
    this.original = {
      name: String(raw.name || '').trim(),
      barcode: String(raw.barcode || '').trim(),
      costPrice: Number(raw.cost_price || raw.costPrice || 0),
      price: Number(raw.price || 0),
      stock: Number(raw.stock || 0),
      productType: raw.product_type || raw.productType || 'physical',
      categoryId: raw.category_id || raw.categoryId || null,
      brandId: raw.brand_id || raw.brandId || null,
      consignorName: String(raw.consignor_name || raw.consignorName || '').trim(),
      consignorPhone: String(raw.consignor_phone || raw.consignorPhone || '').trim(),
    };

    // Active mutable draft during table editing
    this.draft = { ...this.original };

    this.saving = false;
    this.savedJustNow = false;
    this.errorMessage = null;
  }

  // --- Mutation Methods ---
  updateField(field, value) {
    if (field === 'price' || field === 'costPrice' || field === 'stock') {
      const numVal = value === '' ? 0 : Number(value);
      this.draft[field] = isNaN(numVal) ? 0 : numVal;
    } else {
      this.draft[field] = value;
    }
    this.savedJustNow = false;
    this.errorMessage = null;
  }

  revert() {
    this.draft = { ...this.original };
    this.errorMessage = null;
    this.savedJustNow = false;
  }

  commit() {
    this.original = { ...this.draft };
    this.saving = false;
    this.savedJustNow = true;
    this.errorMessage = null;
  }

  // --- Dirty State Detection ---
  isDirty(field = null) {
    if (field) {
      return this.draft[field] !== this.original[field];
    }
    return (
      this.draft.name !== this.original.name ||
      this.draft.barcode !== this.original.barcode ||
      this.draft.costPrice !== this.original.costPrice ||
      this.draft.price !== this.original.price ||
      this.draft.stock !== this.original.stock ||
      this.draft.productType !== this.original.productType ||
      this.draft.categoryId !== this.original.categoryId ||
      this.draft.brandId !== this.original.brandId ||
      this.draft.consignorName !== this.original.consignorName
    );
  }

  get changedFields() {
    const changes = {};
    if (this.draft.name !== this.original.name) changes.name = this.draft.name;
    if (this.draft.barcode !== this.original.barcode) changes.barcode = this.draft.barcode;
    if (this.draft.costPrice !== this.original.costPrice) changes.costPrice = this.draft.costPrice;
    if (this.draft.price !== this.original.price) changes.price = this.draft.price;
    if (this.draft.stock !== this.original.stock) changes.stock = this.draft.stock;
    if (this.draft.productType !== this.original.productType) changes.product_type = this.draft.productType;
    if (this.draft.categoryId !== this.original.categoryId) changes.category_id = this.draft.categoryId;
    if (this.draft.brandId !== this.original.brandId) changes.brand_id = this.draft.brandId;
    if (this.draft.consignorName !== this.original.consignorName) changes.consignor_name = this.draft.consignorName;
    return changes;
  }

  validate() {
    if (!this.draft.name || !this.draft.name.trim()) {
      return { isValid: false, message: 'Nama produk tidak boleh kosong' };
    }
    if (this.draft.price < 0) {
      return { isValid: false, message: 'Harga jual tidak boleh negatif' };
    }
    if (this.draft.costPrice < 0) {
      return { isValid: false, message: 'Harga modal tidak boleh negatif' };
    }
    if (this.draft.stock < 0) {
      return { isValid: false, message: 'Stok tidak boleh negatif' };
    }
    return { isValid: true, message: null };
  }

  // --- Reactive Getters ---
  get name() {
    return this.draft.name;
  }

  get barcode() {
    return this.draft.barcode;
  }

  get costPrice() {
    return this.draft.costPrice;
  }

  get price() {
    return this.draft.price;
  }

  get stock() {
    return this.draft.stock;
  }

  get productType() {
    return this.draft.productType;
  }

  get categoryId() {
    return this.draft.categoryId;
  }

  get brandId() {
    return this.draft.brandId;
  }

  get consignorName() {
    return this.draft.consignorName;
  }

  get marginRp() {
    return Math.max(0, this.price - this.costPrice);
  }

  get marginPercent() {
    return this.price > 0 ? (this.marginRp / this.price) * 100 : 0;
  }

  get formattedCost() {
    return formatIDR(this.costPrice);
  }

  get formattedPrice() {
    return formatIDR(this.price);
  }

  get formattedProfit() {
    return `+${formatIDR(this.marginRp)}`;
  }

  get typeInfo() {
    const found = PRODUCT_TYPES.find(t => t.id === this.productType);
    return found || PRODUCT_TYPES[0];
  }

  cycleProductType() {
    const types = ['physical', 'consignment', 'voucher', 'digital', 'financial_service'];
    const currentIdx = types.indexOf(this.productType);
    const nextIdx = (currentIdx + 1) % types.length;
    this.updateField('productType', types[nextIdx]);
  }

  toPayload() {
    return {
      name: this.draft.name.trim(),
      barcode: this.draft.barcode.trim() || null,
      price: Number(this.draft.price),
      costPrice: Number(this.draft.costPrice),
      stock: Number(this.draft.stock),
      product_type: this.draft.productType,
      category_id: this.draft.categoryId || null,
      brand_id: this.draft.brandId || null,
      consignor_name: this.draft.consignorName.trim() || null,
      changeReason: 'edit_manual',
    };
  }

  async save(userId) {
    const validation = this.validate();
    if (!validation.isValid) {
      this.errorMessage = validation.message;
      throw new Error(validation.message);
    }

    this.saving = true;
    this.errorMessage = null;

    try {
      const payload = this.toPayload();
      await updateProduct(userId, this.id, payload);

      // Sinkronkan juga metadata tipe produk ke local/cloud helper
      await setProductTypeMeta(userId, this.id, {
        type: this.draft.productType,
        consignorName: this.draft.consignorName,
      });

      this.commit();
      return true;
    } catch (err) {
      this.saving = false;
      this.errorMessage = err.message || 'Gagal menyimpan produk';
      throw err;
    }
  }
}
