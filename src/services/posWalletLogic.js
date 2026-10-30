// Logika murni (tanpa dependency React/Supabase) untuk menentukan
// mutasi dompet dari sebuah transaksi kasir. Dipakai oleh PaymentScreen
// dan juga oleh script pengujian otomatis.

const lower = (v) => String(v || '').toLowerCase();

// Barang yang modalnya dipotong dari saldo digital SAAT TERJUAL
// (top-up e-wallet, transfer bank, tarik tunai, pulsa/paket data elektrik).
// Produk fisik, voucher/perdana stok, dan barang titipan TIDAK memotong saldo digital.
export function isRealTimeDigitalService(item) {
  if (!item) return false;

  const type = item.product_type || item.productType;
  const nameLower = lower(item.name);
  const catLower = lower(item.category_name || item.category);

  // Tipe eksplisit dari database selalu diutamakan
  if (type === 'physical' || type === 'voucher' || type === 'consignment') return false;
  if (type === 'digital' || type === 'financial_service' || type === 'service') return true;

  // Titipan / konsinyasi
  if (item.consignorName || nameLower.includes('titipan') || nameLower.includes('konsinyasi')) return false;

  // Voucher fisik & perdana: modal sudah dipotong saat inject / beli stok
  if (nameLower.includes('voucher') || nameLower.includes('perdana')) return false;

  const keywords = [
    'transfer', 'tarik tunai', 'top up', 'topup', 'dana', 'gopay', 'ovo',
    'shopeepay', 'linkaja', 'token pln', 'pulsa', 'paket data',
  ];
  if (keywords.some((k) => nameLower.includes(k))) return true;

  if (['ppob', 'digital', 'transfer', 'tarik tunai'].some((k) => catLower.includes(k))) return true;

  return false;
}

export function isConsignmentItem(item) {
  if (!item) return false;
  const type = item.product_type || item.productType;
  const nameLower = lower(item.name);
  return type === 'consignment' || !!item.consignorName || nameLower.includes('titipan') || nameLower.includes('konsinyasi');
}

export function isTarikTunaiCart(cart) {
  return (cart || []).some((i) => lower(i.name).includes('tarik tunai') || (i.product_type || i.productType) === 'tarik_tunai');
}

const isProfitWallet = (w) => w.type === 'PROFIT' || lower(w.name).includes('profit') || lower(w.name).includes('laba');
const isTitipanWallet = (w) => lower(w.name).includes('titipan') || lower(w.name).includes('supplier');

// Tentukan dompet default:
// - selectedWalletId: dompet penerima uang pelanggan
// - digitalWalletId : dompet sumber modal digital (null = tidak ada yang dipotong)
export function pickDefaultWallets(cart, wallets) {
  const list = wallets || [];
  if (list.length === 0) return { selectedWalletId: null, digitalWalletId: null };

  const cashWallet = list.find((w) => w.type === 'CASH' && !isProfitWallet(w) && !isTitipanWallet(w))
    || list.find((w) => w.type === 'CASH');
  const nonCash = list.filter((w) => w.type !== 'CASH' && !isProfitWallet(w) && !isTitipanWallet(w));

  if (isTarikTunaiCart(cart)) {
    // Pelanggan transfer ke rekening/e-wallet toko, toko memberi uang tunai dari laci
    const bank = nonCash.find((w) => w.type === 'BANK') || nonCash[0];
    return {
      selectedWalletId: bank ? bank.id : list[0].id,
      digitalWalletId: cashWallet ? cashWallet.id : null,
    };
  }

  const selectedWalletId = cashWallet ? cashWallet.id : list[0].id;
  const digitalItems = (cart || []).filter(isRealTimeDigitalService);
  if (digitalItems.length === 0) return { selectedWalletId, digitalWalletId: null };

  const nameLower = lower(digitalItems[0].name);
  const byName = (key) => nonCash.find((w) => lower(w.name).includes(key));

  let matched = null;
  for (const key of ['dana', 'ovo', 'gopay', 'shopee', 'digipos', 'qgrow', 'isimple']) {
    if (nameLower.includes(key)) { matched = byName(key); break; }
  }
  if (!matched && (nameLower.includes('transfer') || nameLower.includes('kirim uang'))) {
    for (const key of ['bca', 'bri', 'bni', 'seabank', 'mandiri']) {
      if (nameLower.includes(key)) { matched = byName(key); break; }
    }
    if (!matched) matched = nonCash.find((w) => w.type === 'BANK');
  }
  if (!matched) matched = byName('pulsa') || nonCash.find((w) => w.type === 'APP_BALANCE') || nonCash[0];

  return { selectedWalletId, digitalWalletId: matched ? matched.id : null };
}

export function computeCartCosts(cart) {
  const items = cart || [];
  const cost = (i) => (Number(i.costPrice) || 0) * (Number(i.qty) || 0);
  const totalDigitalCost = items.filter(isRealTimeDigitalService).reduce((s, i) => s + cost(i), 0);
  const totalTitipanCost = items.filter(isConsignmentItem).reduce((s, i) => s + cost(i), 0);
  const totalCartCost = items.reduce((s, i) => s + cost(i), 0);
  return { totalDigitalCost, totalTitipanCost, totalCartCost, totalPhysicalCost: totalCartCost - totalDigitalCost };
}

// Bangun daftar mutasi dompet untuk satu transaksi kasir
export function buildSaleWalletPostings({ cart, total, wallets, selectedWalletId, digitalWalletId, saleId = null, invoice = '' }) {
  const list = wallets || [];
  const postings = [];
  const { totalDigitalCost, totalTitipanCost } = computeCartCosts(cart);
  const nameOf = (id) => (list.find((w) => w.id === id) || {}).name;

  if (selectedWalletId && Number(total) > 0) {
    postings.push({
      wallet_id: selectedWalletId,
      type: 'IN',
      amount: Number(total),
      reference_type: 'SALE',
      reference_id: saleId,
      description: `Penjualan #${invoice} via ${nameOf(selectedWalletId) || 'Kas'}`,
    });
  }

  if (digitalWalletId && totalDigitalCost > 0) {
    postings.push({
      wallet_id: digitalWalletId,
      type: 'OUT',
      amount: totalDigitalCost,
      reference_type: 'PURCHASE',
      reference_id: saleId,
      description: `Modal digital #${invoice} via ${nameOf(digitalWalletId) || 'Platform'}`,
    });
  }

  if (totalTitipanCost > 0) {
    const titipan = list.find(isTitipanWallet);
    if (titipan) {
      postings.push({
        wallet_id: titipan.id,
        type: 'IN',
        amount: totalTitipanCost,
        reference_type: 'SALE',
        reference_id: saleId,
        description: `Akumulasi Modal Terjual trx #${invoice}`,
      });
    }
  }

  return postings;
}

