import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { getDashboardStats, getRecentSales } from '../services/dashboardSupabase';
import { getMenuConfigs } from '../services/menuConfigSupabase';
import { Colors, Spacing, Radii, FontSize, FontWeight } from '../theme';

const { width } = Dimensions.get('window');

const PRIMARY   = '#5B58F5';
const BG        = '#F4F6FB';
const WHITE     = '#FFFFFF';
const TEXT_DARK = '#0F172A';
const TEXT_GREY = '#94A3B8';
const TEXT_MID  = '#475569';
const SUCCESS   = '#22C55E';
const DANGER    = '#EF4444';

const MENU_ITEMS = [
  { key: 'kasir',     label: 'Kasir',     icon: 'cart-outline',          color: '#3B82F6', bg: '#EFF6FF', screen: 'Penjualan',        params: {} },
  { key: 'produk',    label: 'Produk',    icon: 'cube-outline',          color: '#10B981', bg: '#ECFDF5', screen: 'Produk',           params: { screen: 'DaftarProduk' } },
  { key: 'laporan',   label: 'Laporan',   icon: 'pie-chart-outline',     color: '#8B5CF6', bg: '#F5F3FF', screen: 'AnnualProfitReport', params: {} },
  { key: 'riwayat',   label: 'Riwayat',   icon: 'time-outline',          color: '#F59E0B', bg: '#FFFBEB', screen: 'History',           params: {} },
  { key: 'stok',      label: 'Stok',      icon: 'layers-outline',        color: '#EF4444', bg: '#FEF2F2', screen: 'StockManagement',   params: {} },
  { key: 'barcode',   label: 'Scan',      icon: 'barcode-outline',       color: '#64748B', bg: '#F8FAFC', screen: 'Scan',              params: {} },
  { key: 'penjualan', label: 'Penjualan', icon: 'document-text-outline', color: '#0D9488', bg: '#F0FDFA', screen: 'SalesReport',       params: {} },
  { key: 'more',      label: 'Lainnya',   icon: 'grid-outline',          color: '#6366F1', bg: '#EEF2FF', screen: 'MoreMenu',          params: {} },
];

export default function DashboardScreen({ navigation }) {
  const { user, getBusinessName } = useAuth();
  const { showToast } = useToast();

  const [stats, setStats]             = useState(null);
  const [recentSales, setRecentSales] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [menuConfigs, setMenuConfigs] = useState({});
  const [menuErrors, setMenuErrors]   = useState({});

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
      const [sRes, rRes, cRes] = await Promise.all([
        getDashboardStats(user?.id),
        getRecentSales(user?.id, 5),
        user?.id ? getMenuConfigs(user.id) : Promise.resolve({ success: false }),
      ]);
      if (sRes.success) setStats(sRes.data); else showToast('Gagal memuat statistik', 'error');
      if (rRes.success) setRecentSales(rRes.data);
      if (cRes.success && cRes.data) { setMenuConfigs(cRes.data); setMenuErrors({}); }
    } catch { showToast('Terjadi kesalahan', 'error'); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { loadData(); }, [user?.id]));
  const onRefresh = () => { setRefreshing(true); loadData(); };

  if (loading) {
    return (
      <SafeAreaView style={s.container} edges={['top']}>
        <View style={s.loadingBox}><ActivityIndicator size="large" color={PRIMARY} /></View>
      </SafeAreaView>
    );
  }

  const todayTotal    = stats?.today?.total        || 0;
  const todayProfit   = stats?.today?.profit       || 0;
  const todayTrx      = stats?.today?.transactions || 0;
  const monthTotal    = stats?.month?.total        || 0;
  const monthProfit   = stats?.month?.profit       || 0;
  const lowStockCount = stats?.products?.lowStock?.length || 0;

  const STAT_CARDS = [
    { label: 'Total Penjualan', value: fmt(monthTotal),  icon: 'cash-outline',        color: PRIMARY,   bg: '#EEF2FF', onPress: () => navigation.navigate('SalesAnalytics', { type: 'sales',  period: 'month' }) },
    { label: 'Profit Bulan',    value: fmt(monthProfit), icon: 'bar-chart-outline',   color: '#8B5CF6', bg: '#F5F3FF', onPress: () => navigation.navigate('SalesAnalytics', { type: 'profit', period: 'month' }) },
    { label: 'Total Produk',    value: (stats?.products?.total || 0).toString(), icon: 'cube-outline',  color: '#10B981', bg: '#ECFDF5', onPress: () => navigation.navigate('Produk', { screen: 'DaftarProduk' }) },
    { label: 'Stock Menipis',   value: lowStockCount.toString(), icon: 'warning-outline', color: DANGER, bg: '#FEF2F2', onPress: () => navigation.navigate('StockManagement') },
  ];

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY} />}>

        {/* ── HEADER ──────────────────────────────── */}
        <View style={s.header}>
          <TouchableOpacity style={s.profileRow} onPress={() => navigation.navigate('Akun')} activeOpacity={0.8}>
            <View style={s.avatar}>
              <Text style={s.avatarTxt}>{getBusinessName()?.charAt(0)?.toUpperCase() || 'P'}</Text>
            </View>
            <View>
              <Text style={s.greeting}>{getDynamicGreeting()}</Text>
              <Text style={s.bizName} numberOfLines={1}>{getBusinessName()}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={s.notifBtn} onPress={() => navigation.navigate('History')} activeOpacity={0.8}>
            <Ionicons name="notifications-outline" size={22} color={TEXT_DARK} />
            {todayTrx > 0 && <View style={s.notifDot} />}
          </TouchableOpacity>
        </View>

        {/* ── SEARCH ──────────────────────────────── */}
        <TouchableOpacity style={s.search} onPress={() => navigation.navigate('Produk', { screen: 'DaftarProduk' })} activeOpacity={0.8}>
          <Ionicons name="search-outline" size={17} color={TEXT_GREY} style={{ marginRight: 8 }} />
          <Text style={s.searchTxt}>Cari produk, transaksi, fitur…</Text>
        </TouchableOpacity>

        {/* ── HERO CARD ───────────────────────────── */}
        <TouchableOpacity style={s.hero} onPress={() => navigation.navigate('SalesAnalyticsDashboard', { initialTab: 'profit' })} activeOpacity={0.9}>
          <View style={s.b1} /><View style={s.b2} /><View style={s.b3} />
          <View style={{ position: 'relative', zIndex: 1 }}>
            {/* top badge row */}
            <View style={s.heroTop}>
              <View style={s.badge}>
                <Ionicons name="wallet-outline" size={11} color={WHITE} style={{ marginRight: 3 }} />
                <Text style={s.badgeTxt}>Hari Ini</Text>
              </View>
              <Ionicons name="chevron-forward" size={15} color="rgba(255,255,255,0.4)" />
            </View>
            <Text style={s.heroLbl}>Total Profit Hari Ini</Text>
            <Text style={s.heroAmt}>{fmt(todayProfit)}</Text>
            <View style={s.heroDivider} />
            {/* bottom stats row */}
            <View style={s.heroStats}>
              {[
                { l: 'Penjualan', v: fmt(todayTotal) },
                { l: 'Transaksi', v: `${todayTrx}x` },
                { l: 'Bln Ini',   v: fmt(monthProfit) },
              ].map((stat, i) => (
                <React.Fragment key={stat.l}>
                  {i > 0 && <View style={s.heroSep} />}
                  <View style={s.heroStat}>
                    <Text style={s.heroStatLbl}>{stat.l}</Text>
                    <Text style={s.heroStatVal}>{stat.v}</Text>
                  </View>
                </React.Fragment>
              ))}
            </View>
          </View>
        </TouchableOpacity>

        {/* ── QUICK ACTIONS ───────────────────────── */}
        <View style={s.qaRow}>
          {[
            { l: 'Kasir',     ic: 'cart-outline',        c: PRIMARY,   sc: 'Penjualan' },
            { l: 'Keuangan',  ic: 'trending-up-outline', c: '#8B5CF6', sc: 'AnnualProfitReport' },
            { l: 'Riwayat',   ic: 'time-outline',        c: '#F59E0B', sc: 'History' },
            { l: 'Produk',    ic: 'cube-outline',        c: '#10B981', sc: 'Produk', p: { screen: 'DaftarProduk' } },
          ].map(btn => (
            <TouchableOpacity key={btn.l} style={s.qaBtn} onPress={() => navigation.navigate(btn.sc, btn.p || {})} activeOpacity={0.75}>
              <View style={[s.qaIcon, { backgroundColor: btn.c + '15' }]}>
                <Ionicons name={btn.ic} size={22} color={btn.c} />
              </View>
              <Text style={s.qaLbl}>{btn.l}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── MENU SHORTCUTS (horizontal scroll) ─── */}
        <View style={s.secRow}>
          <Text style={s.secTitle}>Menu</Text>
          <TouchableOpacity onPress={() => navigation.navigate('MoreMenu')}><Text style={s.seeAll}>Lihat Semua</Text></TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.menuScroll}>
          {MENU_ITEMS.map(item => (
            <TouchableOpacity key={item.key} style={s.menuItem} onPress={() => navigation.navigate(item.screen, item.params)} activeOpacity={0.75}>
              <View style={[s.menuCircle, { backgroundColor: item.bg }]}>
                <Ionicons name={item.icon} size={24} color={item.color} />
              </View>
              <Text style={s.menuLbl}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── STAT MINI CARDS (horizontal scroll) ── */}
        <View style={s.secRow}>
          <Text style={s.secTitle}>Bulan Ini</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.statsScroll}>
          {STAT_CARDS.map(c => (
            <TouchableOpacity key={c.label} style={s.statCard} onPress={c.onPress} activeOpacity={0.8}>
              <View style={[s.statIcon, { backgroundColor: c.bg }]}>
                <Ionicons name={c.icon} size={18} color={c.color} />
              </View>
              <Text style={s.statVal}>{c.value}</Text>
              <Text style={s.statLbl}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── LOW STOCK ALERT ─────────────────────── */}
        {lowStockCount > 0 && (
          <TouchableOpacity style={s.alertBanner} onPress={() => navigation.navigate('StockManagement')} activeOpacity={0.85}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="warning" size={18} color={DANGER} />
              <Text style={s.alertTxt}> {lowStockCount} produk stock menipis</Text>
            </View>
            <View style={s.alertBtn}><Text style={s.alertBtnTxt}>Kelola →</Text></View>
          </TouchableOpacity>
        )}

        {/* ── RECENT SALES ────────────────────────── */}
        <View style={[s.secRow, { marginTop: 24 }]}>
          <Text style={s.secTitle}>Penjualan Terbaru</Text>
          <TouchableOpacity onPress={() => navigation.navigate('History')}><Text style={s.seeAll}>Lihat Semua</Text></TouchableOpacity>
        </View>

        <View style={s.salesCard}>
          {recentSales.length > 0 ? recentSales.map((sale, idx) => (
            <TouchableOpacity
              key={sale.id}
              style={[s.saleRow, idx < recentSales.length - 1 && s.saleRowBorder]}
              onPress={() => navigation.navigate('History')}
              activeOpacity={0.7}
            >
              <View style={s.saleIcon}>
                <Ionicons name="receipt-outline" size={18} color={PRIMARY} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.saleInv} numberOfLines={1}>{sale.no_invoice || `#${sale.id.substring(0, 8)}`}</Text>
                <Text style={s.saleDate}>{fmtDate(sale.created_at)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.saleTot}>{fmt(sale.total)}</Text>
                <Text style={s.saleProfit}>+{fmt(sale.profit)}</Text>
              </View>
            </TouchableOpacity>
          )) : (
            <View style={s.empty}>
              <Ionicons name="receipt-outline" size={44} color="#CBD5E1" />
              <Text style={s.emptyTxt}>Belum ada penjualan hari ini</Text>
            </View>
          )}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: BG },
  scroll:     { flex: 1 },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // header
  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  profileRow:{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12 },
  avatar:    { width: 44, height: 44, borderRadius: 22, backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center', marginRight: 12, shadowColor: PRIMARY, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  avatarTxt: { color: WHITE, fontSize: FontSize.subtitle, fontWeight: FontWeight.bold },
  greeting:  { fontSize: FontSize.caption, color: TEXT_GREY, marginBottom: 1 },
  bizName:   { fontSize: FontSize.body, fontWeight: FontWeight.bold, color: TEXT_DARK },
  notifBtn:  { width: 42, height: 42, borderRadius: 21, backgroundColor: WHITE, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  notifDot:  { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: DANGER, borderWidth: 1.5, borderColor: WHITE },

  // search
  search:    { flexDirection: 'row', alignItems: 'center', backgroundColor: WHITE, marginHorizontal: 20, marginTop: 16, borderRadius: 99, paddingHorizontal: 18, paddingVertical: 13, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  searchTxt: { fontSize: FontSize.caption, color: TEXT_GREY },

  // hero
  hero:      { marginHorizontal: 20, marginTop: 20, backgroundColor: PRIMARY, borderRadius: 28, padding: 24, overflow: 'hidden', shadowColor: PRIMARY, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.35, shadowRadius: 20, elevation: 10 },
  b1:        { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.08)', top: -60, right: -60 },
  b2:        { position: 'absolute', width: 130, height: 130, borderRadius: 65,  backgroundColor: 'rgba(255,255,255,0.06)', bottom: -30, left: -30 },
  b3:        { position: 'absolute', width: 80,  height: 80,  borderRadius: 40,  backgroundColor: 'rgba(255,255,255,0.05)', top: 60, right: 80 },
  heroTop:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  badge:     { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 },
  badgeTxt:  { color: WHITE, fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  heroLbl:   { color: 'rgba(255,255,255,0.75)', fontSize: FontSize.caption, marginBottom: 4 },
  heroAmt:   { color: WHITE, fontSize: 30, fontWeight: FontWeight.extrabold, letterSpacing: -0.5, marginBottom: 20 },
  heroDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginBottom: 16 },
  heroStats: { flexDirection: 'row', alignItems: 'center' },
  heroStat:  { flex: 1, alignItems: 'center' },
  heroSep:   { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.2)' },
  heroStatLbl: { color: 'rgba(255,255,255,0.65)', fontSize: FontSize.xs, marginBottom: 3 },
  heroStatVal: { color: WHITE, fontSize: FontSize.caption, fontWeight: FontWeight.bold },

  // quick actions
  qaRow:  { flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 20, marginTop: 20, backgroundColor: WHITE, borderRadius: 20, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 14, elevation: 4 },
  qaBtn:  { alignItems: 'center', flex: 1 },
  qaIcon: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  qaLbl:  { fontSize: FontSize.xs, color: TEXT_MID, fontWeight: FontWeight.semibold },

  // section header
  secRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 28, marginBottom: 14 },
  secTitle: { fontSize: FontSize.body, fontWeight: FontWeight.bold, color: TEXT_DARK },
  seeAll:   { fontSize: FontSize.caption, color: PRIMARY, fontWeight: FontWeight.semibold },

  // menu shortcuts
  menuScroll:  { paddingHorizontal: 20, gap: 16 },
  menuItem:    { alignItems: 'center', width: 64 },
  menuCircle:  { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  menuLbl:     { fontSize: FontSize.xs, color: TEXT_MID, fontWeight: FontWeight.semibold, textAlign: 'center' },

  // stat mini cards
  statsScroll: { paddingHorizontal: 20, gap: 12 },
  statCard:    { backgroundColor: WHITE, borderRadius: 20, padding: 16, width: 148, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 3 },
  statIcon:    { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  statVal:     { fontSize: FontSize.body, fontWeight: FontWeight.extrabold, color: TEXT_DARK, marginBottom: 4 },
  statLbl:     { fontSize: FontSize.xs, color: TEXT_GREY, fontWeight: FontWeight.medium },

  // alert
  alertBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFF5F5', marginHorizontal: 20, marginTop: 12, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#FEE2E2' },
  alertTxt:    { fontSize: FontSize.caption, color: DANGER, fontWeight: FontWeight.semibold },
  alertBtn:    { backgroundColor: DANGER, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 5 },
  alertBtnTxt: { color: WHITE, fontSize: FontSize.xs, fontWeight: FontWeight.bold },

  // recent sales
  salesCard:     { backgroundColor: WHITE, marginHorizontal: 20, borderRadius: 20, paddingHorizontal: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 14, elevation: 4 },
  saleRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  saleRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  saleIcon:      { width: 44, height: 44, borderRadius: 22, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  saleInv:       { fontSize: FontSize.caption, fontWeight: FontWeight.bold, color: TEXT_DARK, marginBottom: 3 },
  saleDate:      { fontSize: FontSize.xs, color: TEXT_GREY },
  saleTot:       { fontSize: FontSize.caption, fontWeight: FontWeight.bold, color: TEXT_DARK, marginBottom: 3 },
  saleProfit:    { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: SUCCESS },
  empty:         { alignItems: 'center', paddingVertical: 32 },
  emptyTxt:      { fontSize: FontSize.caption, color: TEXT_GREY, marginTop: 10 },
});
