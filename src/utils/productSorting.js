/**
 * Smart Natural Product Sorting Engine for POSDEWA.
 * 
 * Features:
 * 1. Regex duration extraction (hari, bulan, minggu, jam)
 * 2. Regex quota extraction (GB, MB, TB, Unlimited)
 * 3. Smart category & type prioritization (Paket Data Harian -> Bulanan -> Voucher -> Pulsa)
 * 4. Multi-tier natural sort:
 *    - Brand grouping (jika brand belum dipilih)
 *    - Kategori / Tipe grouping (jika kategori belum dipilih)
 *    - Durasi hari terkecil ke terbesar (1 hari -> 3 hari -> 5 hari -> 7 hari -> 14 hari -> 30 hari)
 *    - Kuota terkecil ke terbesar jika hari sama (1GB -> 2GB -> 5GB -> 8GB -> 10GB)
 *    - Harga termurah ke termahal
 *    - Nama alfabetis
 */

/**
 * Ekstraksi durasi hari dari nama produk menggunakan Regex cerdas.
 * Mendukung format:
 * - "3HARI", "3 HARI", "3hari", "3hr", "3 hr", "7d", "7day" -> 3 / 7 hari
 * - "28Hari", "30HARI"
 * - "1BULAN", "1 BULAN", "1bln", "1 bln", "1 bulan" -> 30 hari
 * - "2BULAN" -> 60 hari
 * - "1MINGGU", "1 MINGGU" -> 7 hari
 * - "24JAM", "12 JAM" -> 1 hari / 0.5 hari
 * - Keyword "harian" -> 1, "mingguan" -> 7, "bulanan" -> 30
 * 
 * @param {string} name 
 * @returns {number|null} Angka durasi dalam hari, atau null jika tidak ada indikasi durasi
 */
export function extractDurationInDays(name) {
  if (!name) return null;
  const str = String(name).trim();

  // 1. Pola hari dengan word-boundary (e.g. "3 HARI", "3 hr", "7 days")
  const dayMatch = str.match(/\b(\d+(?:[.,]\d+)?)\s*(?:hari|hr|d|day(?:s)?)\b/i);
  if (dayMatch) {
    const val = parseFloat(dayMatch[1].replace(',', '.'));
    if (!isNaN(val) && val > 0) return val;
  }

  // 1b. Pola hari menempel (e.g. "3Hari", "28HARI", "30hari", "3hr")
  const attachedDayMatch = str.match(/(\d+(?:[.,]\d+)?)(?:hari|hr|d|day(?:s)?)\b/i);
  if (attachedDayMatch) {
    const val = parseFloat(attachedDayMatch[1].replace(',', '.'));
    if (!isNaN(val) && val > 0) return val;
  }

  // 2. Pola bulan (e.g. "1BULAN", "1 BULAN", "1bln", "1 bln", "1 bulan") -> 30 hari
  const monthMatch = str.match(/\b(\d+(?:[.,]\d+)?)\s*(?:bulan|bln|month(?:s)?)\b/i);
  if (monthMatch) {
    const val = parseFloat(monthMatch[1].replace(',', '.'));
    if (!isNaN(val) && val > 0) return val * 30;
  }

  const attachedMonth = str.match(/(\d+(?:[.,]\d+)?)(?:bulan|bln|month(?:s)?)\b/i);
  if (attachedMonth) {
    const val = parseFloat(attachedMonth[1].replace(',', '.'));
    if (!isNaN(val) && val > 0) return val * 30;
  }

  // 3. Pola minggu (e.g. "1MINGGU", "2 MINGGU", "1mgg") -> 7 hari
  const weekMatch = str.match(/\b(\d+(?:[.,]\d+)?)\s*(?:minggu|mgg|week(?:s)?)\b/i);
  if (weekMatch) {
    const val = parseFloat(weekMatch[1].replace(',', '.'));
    if (!isNaN(val) && val > 0) return val * 7;
  }

  // 4. Pola jam (e.g. "24JAM", "12 JAM", "24 jam") -> 24/24 = 1 hari
  const hourMatch = str.match(/\b(\d+(?:[.,]\d+)?)\s*(?:jam|hour(?:s)?)\b/i);
  if (hourMatch) {
    const val = parseFloat(hourMatch[1].replace(',', '.'));
    if (!isNaN(val) && val > 0) return val / 24;
  }

  // 5. Keyword kata khusus
  if (/\bharian\b/i.test(str)) return 1;
  if (/\bmingguan\b/i.test(str)) return 7;
  if (/\bbulanan\b/i.test(str)) return 30;

  return null;
}

/**
 * Ekstraksi kuota dalam satuan MB dari nama produk.
 * Mendukung format:
 * - "8GB", "8 GB", "1.5GB", "1,5 GB" -> dikonversi ke MB (* 1024)
 * - "500MB", "500 MB" -> MB
 * - "UNLIMITED" -> 99999999 MB
 * 
 * @param {string} name 
 * @returns {number|null} Kuota dalam MB, atau null jika tidak ada
 */
export function extractQuotaInMB(name) {
  if (!name) return null;
  const str = String(name).trim();

  // Unlimited
  if (/\bunlimited\b/i.test(str)) return 99999999;

  // GB
  const gbMatch = str.match(/(\d+(?:[.,]\d+)?)\s*(?:gb|giga|gigabyte)\b/i);
  if (gbMatch) {
    const val = parseFloat(gbMatch[1].replace(',', '.'));
    if (!isNaN(val) && val > 0) return val * 1024;
  }

  // MB
  const mbMatch = str.match(/(\d+(?:[.,]\d+)?)\s*(?:mb|mega|megabyte)\b/i);
  if (mbMatch) {
    const val = parseFloat(mbMatch[1].replace(',', '.'));
    if (!isNaN(val) && val > 0) return val;
  }

  // TB
  const tbMatch = str.match(/(\d+(?:[.,]\d+)?)\s*(?:tb|terabyte)\b/i);
  if (tbMatch) {
    const val = parseFloat(tbMatch[1].replace(',', '.'));
    if (!isNaN(val) && val > 0) return val * 1024 * 1024;
  }

  return null;
}

/**
 * Prioritas Kategori telekomunikasi konter:
 * 1. Paket Data Harian (harian, 1-7 hari)
 * 2. Paket Data Bulanan (bulanan, 28-30 hari)
 * 3. Paket Data umum
 * 4. Voucher (voucher data)
 * 5. Perdana (kartu perdana data)
 * 6. Pulsa (pulsa reguler / transfer)
 * 7. Token PLN / Digital lainnya
 * 8. Aksesoris / Fisik lainnya
 */
export function getCategoryPriority(categoryName) {
  if (!categoryName) return 999;
  const name = categoryName.toLowerCase();
  if (name.includes('harian')) return 10;
  if (name.includes('bulanan')) return 20;
  if (name.includes('paket data') || name.includes('data') || name.includes('kuota')) return 30;
  if (name.includes('voucher')) return 40;
  if (name.includes('perdana')) return 50;
  if (name.includes('pulsa')) return 60;
  if (name.includes('token') || name.includes('pln')) return 70;
  if (name.includes('game') || name.includes('topup') || name.includes('top up')) return 80;
  if (categoryName === 'Tanpa Kategori') return 999;
  return 100;
}

/**
 * Comparator cerdas untuk mengurutkan produk secara natural & rapih.
 */
export function compareProductsSmart(
  a,
  b,
  { brands = [], categories = [], selectedBrand = null, selectedCategory = null } = {}
) {
  // 1. Jika brand belum difilter ke 1 brand spesifik, kelompokkan per Brand dulu secara alfabet
  if (!selectedBrand) {
    const brandA = brands.find(br => br.id === a.brand_id)?.name || 'Tanpa Brand';
    const brandB = brands.find(br => br.id === b.brand_id)?.name || 'Tanpa Brand';
    const isAEmpty = brandA === 'Tanpa Brand';
    const isBEmpty = brandB === 'Tanpa Brand';
    if (isAEmpty && !isBEmpty) return 1;
    if (!isAEmpty && isBEmpty) return -1;
    const compBrand = brandA.localeCompare(brandB, undefined, { sensitivity: 'base' });
    if (compBrand !== 0) return compBrand;
  }

  // 2. Jika kategori belum difilter ke 1 kategori spesifik, kelompokkan per Kategori berdasarkan urutan tipe bisnis konter
  if (!selectedCategory) {
    const catA = categories.find(c => c.id === a.category_id)?.name || 'Tanpa Kategori';
    const catB = categories.find(c => c.id === b.category_id)?.name || 'Tanpa Kategori';
    const rankA = getCategoryPriority(catA);
    const rankB = getCategoryPriority(catB);
    if (rankA !== rankB) return rankA - rankB;
    const compCat = catA.localeCompare(catB, undefined, { sensitivity: 'base' });
    if (compCat !== 0) return compCat;
  }

  // 3. Deteksi Tipe Durasi Hari (Regex Engine)
  const daysA = extractDurationInDays(a.name);
  const daysB = extractDurationInDays(b.name);
  const hasDaysA = daysA !== null && daysA !== undefined;
  const hasDaysB = daysB !== null && daysB !== undefined;

  // Jika keduanya memiliki durasi hari (misal 1 hari, 3 hari, 5 hari, 7 hari, 28 hari, 30 hari)
  if (hasDaysA && hasDaysB) {
    if (daysA !== daysB) {
      return daysA - daysB; // Urut dari hari terkecil ke terbesar!
    }

    // Jika durasi hari sama (misal sama-sama 3 Hari: "5GB 3HARI", "8GB 3HARI", "10GB 3HARI")
    // Urutkan kuota dari terkecil ke terbesar
    const quotaA = extractQuotaInMB(a.name);
    const quotaB = extractQuotaInMB(b.name);
    if (quotaA !== null && quotaB !== null) {
      if (quotaA !== quotaB) return quotaA - quotaB;
    } else if (quotaA !== null) return -1;
    else if (quotaB !== null) return 1;

    // Jika kuota sama, urutkan harga termurah ke termahal
    const priceA = Number(a.price) || 0;
    const priceB = Number(b.price) || 0;
    if (priceA !== priceB) return priceA - priceB;

    return String(a.name || '').localeCompare(String(b.name || ''));
  }

  // Jika satu memiliki durasi hari dan satu tidak: produk berdurasi diutamakan lebih dulu
  if (hasDaysA && !hasDaysB) return -1;
  if (!hasDaysA && hasDaysB) return 1;

  // 4. Jika keduanya tidak memiliki durasi hari (misal Pulsa / Token / Aksesoris):
  // Cek kuota
  const quotaA = extractQuotaInMB(a.name);
  const quotaB = extractQuotaInMB(b.name);
  if (quotaA !== null && quotaB !== null && quotaA !== quotaB) {
    return quotaA - quotaB;
  }

  // Urutkan harga termurah ke termahal (misal Pulsa 5rb, 10rb, 25rb, 50rb...)
  const priceA = Number(a.price) || 0;
  const priceB = Number(b.price) || 0;
  if (priceA !== priceB) return priceA - priceB;

  return String(a.name || '').localeCompare(String(b.name || ''));
}

/**
 * Fungsi sorting utama untuk daftar produk.
 */
export function sortProductsIntelligently(
  products = [],
  { brands = [], categories = [], selectedBrand = null, selectedCategory = null, query = '' } = {}
) {
  if (!products || !Array.isArray(products) || products.length === 0) {
    return [];
  }

  // Jika tidak ada filter yang aktif (Semua Kategori & Semua Brand & Search kosong):
  // Tampilkan urutan barang yang paling baru ditambahkan (created_at descending)
  if (!selectedCategory && !selectedBrand && !query.trim()) {
    return [...products].sort((a, b) => {
      const dateA = a.created_at || '';
      const dateB = b.created_at || '';
      if (dateA && dateB) {
        return dateB.localeCompare(dateA);
      }
      return String(b.id || '').localeCompare(String(a.id || ''));
    });
  }

  // Jika ada filter yang aktif (misal pilih Brand Axis, pilih Kategori Paket Data Harian, atau Search query):
  // Urutkan dengan algoritma Natural Sort berdasarkan Durasi Hari -> Kuota -> Harga
  return [...products].sort((a, b) =>
    compareProductsSmart(a, b, { brands, categories, selectedBrand, selectedCategory })
  );
}
