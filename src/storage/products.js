import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'pos_products_v1';

export async function getProducts() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export async function saveProducts(products) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(products));
}

function genId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function getProductById(id) {
  const products = await getProducts();
  return products.find(p => p.id === id);
}

export async function createProduct(data) {
  const products = await getProducts();
  const product = {
    id: genId(),
    name: (data.name || '').trim(),
    barcode: (data.barcode || '').trim(),
    price: Number(data.price || 0), // harga jual
    costPrice: Number(data.costPrice || 0), // harga modal
    stock: Number(data.stock || 0),
  };
  products.push(product);
  await saveProducts(products);
  return product;
}

export async function updateProduct(id, data) {
  const products = await getProducts();
  const updated = products.map(p => {
    if (p.id !== id) return p;
    return {
      ...p,
      name: data.name != null ? String(data.name).trim() : p.name,
      barcode: data.barcode != null ? String(data.barcode).trim() : p.barcode,
      price: data.price != null ? Number(data.price) : p.price,
      costPrice: data.costPrice != null ? Number(data.costPrice) : (p.costPrice ?? 0),
      stock: data.stock != null ? Number(data.stock) : p.stock,
    };
  });
  await saveProducts(updated);
}

export async function deleteProduct(id) {
  const products = await getProducts();
  const filtered = products.filter(p => p.id !== id);
  await saveProducts(filtered);
}

export async function findProducts(query) {
  const q = String(query || '').toLowerCase().trim();
  const products = await getProducts();
  if (!q) return products;
  return products.filter(p =>
    (p.name || '').toLowerCase().includes(q) ||
    (p.barcode || '').toLowerCase().includes(q)
  );
}

export async function findByBarcodeOrName(query) {
  const q = String(query || '').toLowerCase().trim();
  const products = await getProducts();
  if (!q) return [];
  return products.filter(p =>
    (p.barcode || '').toLowerCase() === q ||
    (p.name || '').toLowerCase().includes(q)
  );
}

export async function findByBarcodeExact(barcode) {
  const products = await getProducts();
  const q = String(barcode || '').trim();
  return products.find(p => (p.barcode || '').trim() === q) || null;
}

export async function adjustStockOnSale(cartItems) {
  // cartItems: [{ id, qty }]
  const products = await getProducts();
  const map = new Map(products.map(p => [p.id, p]));
  for (const item of cartItems || []) {
    const target = map.get(item.id);
    if (!target) continue;
    const qty = Number(item.qty || 0);
    if (Number.isFinite(qty) && qty > 0) {
      target.stock = Math.max(0, Number(target.stock || 0) - qty);
      map.set(item.id, target);
    }
  }
  const updated = Array.from(map.values());
  await saveProducts(updated);
  return updated;
}