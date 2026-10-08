import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  useWindowDimensions,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { getDashboardStats, getRecentSales } from '../services/dashboardSupabase';
import { getMenuConfigs } from '../services/menuConfigSupabase';
import { getProductValuation } from '../services/productValuationService';
import { getExpenseSummary } from '../services/expenseSupabase';
import { getWallets } from '../services/walletSupabase';
import { Colors, Spacing, Radii, FontSize, FontWeight } from '../theme';

const PRIMARY   = '#5B58F5';
const BG        = '#F4F6FB';
const WHITE     = '#FFFFFF';
const TEXT_DARK = '#0F172A';
const TEXT_GREY = '#94A3B8';
const TEXT_MID  = '#475569';
const SUCCESS   = '#22C55E';
const DANGER    = '#EF4444';

const MENU_ITEMS = [
  { key: 'produk',      label: 'Produk',      icon: 'cube-outline',          color: '#10B981', bg: '#ECFDF5', screen: 'Produk',                  params: { screen: 'DaftarProduk' } },
  { key: 'inject',      label: 'Voucher/Kartu', icon: 'flash-outline',       color: '#F59E0B', bg: '#FEF3C7', screen: 'InjectVoucher',           params: {} },
  { key: 'stok',        label: 'Stok',        icon: 'layers-outline',        color: '#EF4444', bg: '#FEF2F2', screen: 'StockManagement',          params: {} },
  { key: 'penjualan',   label: 'Penjualan',   icon: 'document-text-outline', color: '#0D9488', bg: '#F0FDFA', screen: 'SalesReport',              params: {} },
  { key: 'more',        label: 'Lainnya',     icon: 'grid-outline',          color: '#6366F1', bg: '#EEF2FF', screen: 'MoreMenu',                 params: {} },
];

export default function DashboardScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const { user, getBusinessName } = useAuth();
  const { showToast } = useToast();

  const [stats, setStats]             = useState(null);
  const [recentSales, setRecentSales] = useState([]);
  const [valuationData, setValuationData] = useState(null);
  const [expenseData, setExpenseData]     = useState(null);
  const [wallets, setWallets]             = useState([]);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [menuConfigs, setMenuConfigs]     = useState({});
  const [menuErrors, setMenuErrors]       = useState({});

  // Custom Info Modal State
  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [infoModalContent, setInfoModalContent] = useState({ title: '', message: '' });

  // Responsive helpers
  const isTablet   = width >= 768;
  const isDesktop  = width >= 1024;
  const PAD        = isDesktop ? 28 : isTablet ? 20 : 16;
  const MAX_W      = isDesktop ? 1040 : isTablet ? 760 : '100%';
  const HERO_R     = isDesktop ? 20 : 16;

  // Actual usable container width
  const containerW = isDesktop ? 1040 : isTablet ? Math.min(width, 760) : width;
  const contentWidth = containerW - PAD * 2;

  // Stat card width for grid layout on large screens
  // Desktop: 5 cards in 1 row (4 gaps of 12px)
  // Tablet: 3 cards per row (2 gaps of 12px)
  // Phone: 148px scrollable
  const statCardW = isDesktop
    ? (contentWidth - 12 * 4) / 5
    : isTablet
    ? (contentWidth - 12 * 2) / 3
    : 148;

  // Menu item width for grid layout on large screens
  const menuItemW = isTablet
    ? Math.min(96, (contentWidth - 8 * (MENU_ITEMS.length - 1)) / MENU_ITEMS.length)
    : 72;

  const getDynamicGreeting = () => {
    const h = new Date().getHours();
    if (h < 11) return 'Selamat Pagi 👋';
    if (h < 15) return 'Selamat Siang 👋';
    if (h < 18) return 'Selamat Sore 👋';
    return 'Selamat Malam 👋';
  };

  const fmt = (v) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0);

  const fmtDate = (s) =>
    new Date(s).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

  const loadData = async () => {
    try {
      const [sRes, rRes, cRes, vRes, eRes, wRes] = await Promise.all([
        getDashboardStats(user?.id),
        getRecentSales(user?.id, 10),
        user?.id ? getMenuConfigs(user.id) : Promise.resolve({ success: false }),
        user?.id ? getProductValuation(user.id) : Promise.resolve({ success: false }),
        user?.id ? getExpenseSummary(user.id, 'month') : Promise.resolve({ success: false }),
        user?.id ? getWallets(user.id) : Promise.resolve({ data: [] })
      ]);
      if (sRes.success) setStats(sRes.data); else showToast('Gagal memuat statistik', 'error');
      if (rRes.success) setRecentSales(rRes.data);
      if (cRes.success && cRes.data) { setMenuConfigs(cRes.data); setMenuErrors({}); }
      if (vRes?.success) setValuationData(vRes.data);
      if (eRes?.success) setExpenseData(eRes.data);
      if (wRes?.data) setWallets(wRes.data);
    } catch (e) {
      console.error('Error loading dashboard data:', e);
      showToast('Terjadi kesalahan', 'error');
    }
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { loadData(); }, [user?.id]));
  const onRefresh = () => { setRefreshing(true); loadData(); };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingBox}><ActivityIndicator size="large" color={PRIMARY} /></View>
      </SafeAreaView>
    );
  }

  const todayTotal        = stats?.today?.total        || 0;
  const todayProfit       = stats?.today?.profit       || 0;
  const todayTrx          = stats?.today?.transactions || 0;
  const monthTotal        = stats?.month?.total        || 0;
  const monthProfit       = stats?.month?.profit       || 0;
  const lowStockCount     = stats?.products?.lowStock?.length || 0;
  const totalCostValue    = valuationData?.totalCostValue || 0;
  const monthExpenseTotal = expenseData?.totalAmount || 0;
  const totalSaldoKas     = wallets?.reduce((sum, w) => sum + (Number(w.balance) || 0), 0) || 0;

  const STAT_CARDS = [
    { label: 'Total Penjualan', value: fmt(monthTotal),  icon: 'cash-outline',        color: PRIMARY,   bg: '#EEF2FF', onPress: () => navigation.navigate('SalesAnalytics', { type: 'sales',  period: 'month' }) },
    { label: 'Profit Bulan',    value: fmt(monthProfit), icon: 'bar-chart-outline',   color: '#8B5CF6', bg: '#F5F3FF', onPress: () => navigation.navigate('SalesAnalytics', { type: 'profit', period: 'month' }) },
    { label: 'Aset Modal Stok', value: fmt(totalCostValue), icon: 'pie-chart-outline', color: '#4338CA', bg: '#EEF2FF', onPress: () => navigation.navigate('ProductAssetValuation') },
    { label: 'Beban Pengeluaran', value: fmt(monthExpenseTotal), icon: 'wallet-outline', color: '#DC2626', bg: '#FEF2F2', onPress: () => navigation.navigate('Expenses') },
    { label: 'Stock Menipis',   value: lowStockCount.toString(), icon: 'warning-outline', color: DANGER, bg: '#FEF2F2', onPress: () => navigation.navigate('StockManagement') },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ alignItems: 'center' }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY} />}
      >
        <View style={{ width: '100%', maxWidth: MAX_W }}>

          {/* ── HEADER ──────────────────────────────── */}
          <View style={[styles.header, { paddingHorizontal: PAD }]}>
            <TouchableOpacity style={styles.profileRow} onPress={() => navigation.navigate('Akun')} activeOpacity={0.8}>
              <View style={styles.avatar}>
                <Text style={styles.avatarTxt}>{getBusinessName()?.charAt(0)?.toUpperCase() || 'P'}</Text>
              </View>
              <View>
                <Text style={styles.greeting}>{getDynamicGreeting()}</Text>
                <Text style={styles.bizName} numberOfLines={1}>{getBusinessName()}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.notifBtn} onPress={() => navigation.navigate('History')} activeOpacity={0.8}>
              <Ionicons name="notifications-outline" size={22} color={TEXT_DARK} />
              {todayTrx > 0 && <View style={styles.notifDot} />}
            </TouchableOpacity>
          </View>

          {/* ── SEARCH ──────────────────────────────── */}
          <TouchableOpacity
            style={[styles.search, { marginHorizontal: PAD }]}
            onPress={() => navigation.navigate('Produk', { screen: 'DaftarProduk' })}
            activeOpacity={0.8}
          >
            <Ionicons name="search-outline" size={17} color={TEXT_GREY} style={{ marginRight: 8 }} />
            <Text style={styles.searchTxt}>Cari produk, transaksi, fitur…</Text>
          </TouchableOpacity>

          {/* ── HERO CARD ───────────────────────────── */}
          <View style={[styles.hero, { marginHorizontal: PAD, borderRadius: HERO_R }]}>
            <View style={styles.b1} /><View style={styles.b2} /><View style={styles.b3} />
            <View style={{ position: 'relative', zIndex: 1 }}>
              <TouchableOpacity 
                activeOpacity={0.8}
                onPress={() => navigation.navigate('SalesAnalyticsDashboard', { initialTab: 'profit' })}
              >
                <View style={styles.heroTop}>
                  <View style={styles.badge}>
                    <Ionicons name="wallet-outline" size={11} color={WHITE} style={{ marginRight: 3 }} />
                    <Text style={styles.badgeTxt}>Hari Ini</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={15} color="rgba(255,255,255,0.4)" />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View>
                    <Text style={styles.heroLbl}>Total Profit Hari Ini</Text>
                    <Text style={[styles.heroAmt, isTablet && { fontSize: 28 }]}>{fmt(todayProfit)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.heroLbl}>Total Saldo Kas</Text>
                    <Text style={[styles.heroAmt, isTablet && { fontSize: 28 }]}>{fmt(totalSaldoKas)}</Text>
                  </View>
                </View>
              </TouchableOpacity>
              <View style={styles.heroDivider} />
              <View style={styles.heroStats}>
                {[
                  { l: 'Penjualan', v: fmt(todayTotal), tooltip: 'Total nilai penjualan kotor Anda hari ini.' },
                  { l: 'Transaksi', v: `${todayTrx}x`, tooltip: 'Jumlah transaksi (struk/nota) yang berhasil dicetak hari ini.' },
                  { l: 'Bln Ini',   v: fmt(monthProfit), tooltip: 'Profit \'Bln Ini\' sudah mencakup (akumulasi) Profit Hari Ini. Jumlah ini adalah total keuntungan Anda sejak tanggal 1 di bulan yang sama.' },
                ].map((stat, i) => (
                  <React.Fragment key={stat.l}>
                    {i > 0 && <View style={styles.heroSep} />}
                    <TouchableOpacity 
                      style={styles.heroStat}
                      activeOpacity={0.7}
                      title={Platform.OS === 'web' ? stat.tooltip : undefined}
                      onPress={() => {
                        setInfoModalContent({ title: `Info ${stat.l}`, message: stat.tooltip });
                        setInfoModalVisible(true);
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={styles.heroStatLbl}>{stat.l}</Text>
                        <Ionicons name="information-circle" size={12} color="rgba(255,255,255,0.4)" />
                      </View>
                      <Text style={styles.heroStatVal}>{stat.v}</Text>
                    </TouchableOpacity>
                  </React.Fragment>
                ))}
              </View>

              {/* DOMPET SALDO DIDALAM HERO CARD */}
              {wallets && wallets.length > 0 && (
                <>
                  <View style={[styles.heroDivider, { marginTop: 14 }]} />
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 24, rowGap: 12, marginTop: 8 }}>
                    {wallets.map((w, index) => (
                      <TouchableOpacity 
                        key={w.id} 
                        style={{ alignItems: 'flex-start' }}
                        onPress={() => {
                          if (w.type === 'PROFIT' || (w.name || '').toLowerCase().includes('profit')) {
                            navigation.navigate('AnnualProfitReport');
                          } else {
                            navigation.navigate('WalletManagement');
                          }
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 10, marginBottom: 2, fontWeight: '500' }}>{w.name}</Text>
                        <Text style={{ color: '#FFF', fontSize: 11, fontWeight: 'bold' }}>{fmt(w.balance)}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={{ marginTop: 16, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 8, flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="information-circle-outline" size={14} color="rgba(255,255,255,0.8)" style={{ marginRight: 6 }} />
                    <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 10, flex: 1, fontStyle: 'italic' }}>
                      Profit hari ini akan dipindahkan ke saldo Profit jam 12 malam secara otomatis (memotong saldo Laci Kasir).
                    </Text>
                  </View>
                </>
              )}
            </View>
          </View>

          {/* ── QUICK ACTIONS ───────────────────────── */}
          <View style={[styles.qaRow, { marginHorizontal: PAD }]}>
            {[
              { l: 'Kasir',       ic: 'cart-outline',        c: PRIMARY,   sc: 'Penjualan' },
              { l: 'Valuasi',     ic: 'pie-chart-outline',   c: '#4338CA', sc: 'ProductAssetValuation' },
              { l: 'Profit',      ic: 'bar-chart-outline',   c: '#10B981', sc: 'AnnualProfitReport' },
              { l: 'Kas & Saldo', ic: 'wallet',              c: '#8B5CF6', sc: 'WalletManagement' },
            ].map(btn => (
              <TouchableOpacity key={btn.l} style={styles.qaBtn} onPress={() => navigation.navigate(btn.sc, btn.p || {})} activeOpacity={0.75}>
                <View style={[styles.qaIcon, { backgroundColor: btn.c + '15' }]}>
                  <Ionicons name={btn.ic} size={isTablet ? 22 : 20} color={btn.c} />
                </View>
                <Text style={styles.qaLbl} numberOfLines={1}>{btn.l}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── MENU SHORTCUTS ──────────────────────── */}
          <View style={[styles.secRow, { paddingHorizontal: PAD }]}>
            <Text style={styles.secTitle}>Menu</Text>
            <TouchableOpacity onPress={() => navigation.navigate('MoreMenu')}>
              <Text style={[styles.seeAll, { color: PRIMARY }]}>Lihat Semua</Text>
            </TouchableOpacity>
          </View>

          {/* Menu always uses grid layout since there are only 5 items */}
          <View style={[styles.menuGrid, { paddingHorizontal: PAD }]}>
            {MENU_ITEMS.map(item => (
              <TouchableOpacity
                key={item.key}
                style={[styles.menuItem, { flex: 1, maxWidth: '100%' }]}
                onPress={() => navigation.navigate(item.screen, item.params)}
                activeOpacity={0.75}
              >
                <View style={[styles.menuCircle, { backgroundColor: item.bg }]}>
                  <Ionicons name={item.icon} size={22} color={item.color} />
                </View>
                <Text style={styles.menuLbl} numberOfLines={1}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── STAT CARDS ──────────────────────────── */}
          <View style={[styles.secRow, { paddingHorizontal: PAD }]}>
            <Text style={styles.secTitle}>Bulan Ini</Text>
          </View>

          {isTablet ? (
            // On tablet/desktop: grid
            <View style={[styles.statsGrid, { paddingHorizontal: PAD }, isDesktop && { flexWrap: 'nowrap' }]}>
              {STAT_CARDS.map(c => (
                <TouchableOpacity
                  key={c.label}
                  style={[styles.statCard, { width: statCardW }]}
                  onPress={c.onPress}
                  activeOpacity={0.8}
                >
                  <View style={[styles.statIcon, { backgroundColor: c.bg }]}>
                    <Ionicons name={c.icon} size={17} color={c.color} />
                  </View>
                  <Text style={[styles.statVal, isTablet && { fontSize: 14.5 }]} numberOfLines={1} adjustsFontSizeToFit>{c.value}</Text>
                  <Text style={styles.statLbl} numberOfLines={1}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            // On phone: horizontal scroll
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.statsScroll, { paddingHorizontal: PAD }]}>
              {STAT_CARDS.map(c => (
                <TouchableOpacity key={c.label} style={[styles.statCard, { width: 140 }]} onPress={c.onPress} activeOpacity={0.8}>
                  <View style={[styles.statIcon, { backgroundColor: c.bg }]}>
                    <Ionicons name={c.icon} size={17} color={c.color} />
                  </View>
                  <Text style={styles.statVal} numberOfLines={1} adjustsFontSizeToFit>{c.value}</Text>
                  <Text style={styles.statLbl} numberOfLines={1}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* ── LOW STOCK ALERT ─────────────────────── */}
          {lowStockCount > 0 && (
            <TouchableOpacity
              style={[styles.alertBanner, { marginHorizontal: PAD }]}
              onPress={() => navigation.navigate('StockManagement')}
              activeOpacity={0.85}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="warning" size={17} color={DANGER} />
                <Text style={styles.alertTxt}> {lowStockCount} produk stock menipis</Text>
              </View>
              <View style={styles.alertBtn}><Text style={styles.alertBtnTxt}>Kelola →</Text></View>
            </TouchableOpacity>
          )}

          {/* ── RECENT SALES ────────────────────────── */}
          <View style={[styles.secRow, { paddingHorizontal: PAD, marginTop: 22 }]}>
            <Text style={styles.secTitle}>Penjualan Terbaru</Text>
            <TouchableOpacity onPress={() => navigation.navigate('History')}>
              <Text style={[styles.seeAll, { color: PRIMARY }]}>Lihat Semua</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.salesCard, { marginHorizontal: PAD }]}>
            {recentSales.length > 0 ? recentSales.map((sale, idx) => {
              const items = sale.sale_items || [];
              const title = items.length > 0 
                ? `${items[0].product_name}${items.length > 1 ? ` (+${items.length - 1} item)` : ''}`
                : (sale.no_invoice || `#${sale.id.substring(0, 8)}`);

              return (
                <TouchableOpacity
                  key={sale.id}
                  style={[styles.saleRow, idx < recentSales.length - 1 && styles.saleRowBorder]}
                  onPress={() => navigation.navigate('History')}
                  activeOpacity={0.7}
                >
                  <View style={styles.saleIcon}>
                    <Ionicons name="receipt-outline" size={17} color={PRIMARY} />
                  </View>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={styles.saleInv} numberOfLines={1}>{title}</Text>
                    <Text style={styles.saleDate}>{fmtDate(sale.created_at)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.saleTot}>{fmt(sale.total)}</Text>
                    <Text style={styles.saleProfit}>+{fmt(sale.profit)}</Text>
                  </View>
                </TouchableOpacity>
              );
            }) : (
              <View style={styles.empty}>
                <Ionicons name="receipt-outline" size={40} color="#CBD5E1" />
                <Text style={styles.emptyTxt}>Belum ada penjualan hari ini</Text>
              </View>
            )}
          </View>

          <View style={{ height: 32 }} />
        </View>
      </ScrollView>

      {/* ── INFO MODAL ─────────────────────────────── */}
      {infoModalVisible && (
        <View style={StyleSheet.absoluteFill}>
          <TouchableOpacity 
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }} 
            activeOpacity={1} 
            onPress={() => setInfoModalVisible(false)}
          >
            <TouchableOpacity 
              activeOpacity={1} 
              style={{ width: '85%', maxWidth: 340, backgroundColor: '#FFF', borderRadius: 12, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <Ionicons name="information-circle" size={24} color={PRIMARY} style={{ marginRight: 8 }} />
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1E293B' }}>{infoModalContent.title}</Text>
              </View>
              <Text style={{ fontSize: 14, color: '#475569', lineHeight: 22, marginBottom: 20 }}>
                {infoModalContent.message}
              </Text>
              <TouchableOpacity 
                style={{ backgroundColor: PRIMARY, paddingVertical: 10, borderRadius: 8, alignItems: 'center' }}
                onPress={() => setInfoModalVisible(false)}
              >
                <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Mengerti</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: BG },
  scroll:     { flex: 1 },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, paddingBottom: 4 },
  profileRow:{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12 },
  avatar:    { width: 42, height: 42, borderRadius: 21, backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center', marginRight: 12, shadowColor: PRIMARY, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 4 },
  avatarTxt: { color: WHITE, fontSize: 16, fontWeight: FontWeight.bold },
  greeting:  { fontSize: FontSize.caption, color: TEXT_GREY, marginBottom: 1 },
  bizName:   { fontSize: FontSize.body, fontWeight: FontWeight.bold, color: TEXT_DARK },
  notifBtn:  { width: 40, height: 40, borderRadius: 20, backgroundColor: WHITE, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  notifDot:  { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: DANGER, borderWidth: 1.5, borderColor: WHITE },

  search:    { flexDirection: 'row', alignItems: 'center', backgroundColor: WHITE, marginTop: 14, borderRadius: 99, paddingHorizontal: 16, paddingVertical: 11, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  searchTxt: { fontSize: FontSize.caption, color: TEXT_GREY },

  hero:      { marginTop: 18, backgroundColor: PRIMARY, padding: 22, overflow: 'hidden', shadowColor: PRIMARY, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 },
  b1:        { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,255,255,0.08)', top: -70, right: -70 },
  b2:        { position: 'absolute', width: 150, height: 150, borderRadius: 75,  backgroundColor: 'rgba(255,255,255,0.06)', bottom: -40, left: -40 },
  b3:        { position: 'absolute', width: 90,  height: 90,  borderRadius: 45,  backgroundColor: 'rgba(255,255,255,0.05)', top: 60, right: 100 },
  heroTop:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  badge:     { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 99 },
  badgeTxt:  { color: WHITE, fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  heroLbl:   { color: 'rgba(255,255,255,0.75)', fontSize: 11, marginBottom: 4 },
  heroAmt:   { color: WHITE, fontSize: 24, fontWeight: FontWeight.extrabold, letterSpacing: -0.5, marginBottom: 16 },
  heroDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginBottom: 14 },
  heroStats: { flexDirection: 'row', alignItems: 'center' },
  heroStat:  { flex: 1, alignItems: 'center' },
  heroSep:   { width: 1, height: 26, backgroundColor: 'rgba(255,255,255,0.2)' },
  heroStatLbl: { color: 'rgba(255,255,255,0.65)', fontSize: FontSize.xs, marginBottom: 3 },
  heroStatVal: { color: WHITE, fontSize: FontSize.caption, fontWeight: FontWeight.bold },

  qaRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, backgroundColor: WHITE, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
  qaBtn:  { alignItems: 'center', flex: 1, maxWidth: 140 },
  qaIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  qaLbl:  { fontSize: 11.5, color: TEXT_MID, fontWeight: FontWeight.semibold },

  secRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, marginBottom: 12 },
  secTitle: { fontSize: 15, fontWeight: FontWeight.bold, color: TEXT_DARK },
  seeAll:   { fontSize: FontSize.caption, fontWeight: FontWeight.semibold },

  // Menu – phone (scroll)
  menuScroll:  { gap: 12 },
  // Menu – tablet/desktop (grid)
  menuGrid:    { flexDirection: 'row', flexWrap: 'nowrap', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' },
  menuItem:    { alignItems: 'center', maxWidth: 96 },
  menuCircle:  { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  menuLbl:     { fontSize: 11, color: TEXT_MID, fontWeight: FontWeight.semibold, textAlign: 'center' },

  // Stat cards – phone (scroll)
  statsScroll: { gap: 12, paddingBottom: 4 },
  // Stat cards – tablet/desktop (grid)
  statsGrid:   { flexDirection: 'row', gap: 12, flexWrap: 'wrap', marginBottom: 4 },
  statCard:    { backgroundColor: WHITE, borderRadius: 12, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  statIcon:    { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statVal:     { fontSize: 14.5, fontWeight: FontWeight.extrabold, color: TEXT_DARK, marginBottom: 3 },
  statLbl:     { fontSize: 10.5, color: TEXT_GREY, fontWeight: FontWeight.medium },

  alertBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFF5F5', marginTop: 14, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: '#FEE2E2' },
  alertTxt:    { fontSize: FontSize.caption, color: DANGER, fontWeight: FontWeight.semibold },
  alertBtn:    { backgroundColor: DANGER, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 5 },
  alertBtnTxt: { color: WHITE, fontSize: FontSize.xs, fontWeight: FontWeight.bold },

  salesCard:     { backgroundColor: WHITE, borderRadius: 18, paddingHorizontal: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
  saleRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  saleRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  saleIcon:      { width: 38, height: 38, borderRadius: 19, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  saleInv:       { fontSize: FontSize.caption, fontWeight: FontWeight.bold, color: TEXT_DARK, marginBottom: 2 },
  saleDate:      { fontSize: FontSize.xs, color: TEXT_GREY },
  saleTot:       { fontSize: FontSize.caption, fontWeight: FontWeight.bold, color: TEXT_DARK, marginBottom: 2 },
  saleProfit:    { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: SUCCESS },
  empty:         { alignItems: 'center', paddingVertical: 30 },
  emptyTxt:      { fontSize: FontSize.caption, color: TEXT_GREY, marginTop: 8 },
});
