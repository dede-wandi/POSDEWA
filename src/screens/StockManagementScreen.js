import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Modal, ScrollView, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { listProducts } from '../services/productsSupabase';
import { getCategories } from '../services/products';
import { StockItem } from '../models/StockItemModel';
import {
  StockMutationService,
  HistoryDateFilter,
  loadStockHistory
} from '../services/stockMutationService';
import { StockProductTable } from './Stock/components/StockProductTable';
import { StockHistoryTable } from './Stock/components/StockHistoryTable';
import { StockMutationModal } from './Stock/components/StockMutationModal';

export default function StockManagementScreen({ navigation }) {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stockHistory, setStockHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [activeTab, setActiveTab] = useState('products');

  // Search & Filter (Products)
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, low, out, safe
  const [sortBy, setSortBy] = useState('stock'); // stock, name
  const [sortOrder, setSortOrder] = useState('asc'); // asc, desc

  // Search & Filter (History)
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [showDateFilterModal, setShowDateFilterModal] = useState(false);

  // Modal State
  const [mutationTarget, setMutationTarget] = useState(null); // { source, item, variant }

  // 1. Data Loading
  const loadData = async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    else setRefreshing(true);
    try {
      const [fetchedProducts, fetchedCategories, fetchedHistory] = await Promise.all([
        listProducts(user?.id),
        getCategories(user?.id),
        loadStockHistory(150).catch(() => [])
      ]);
      setProducts(fetchedProducts || []);
      setCategories(fetchedCategories || []);
      setStockHistory(fetchedHistory || []);
    } catch (error) {
      showToast('Gagal memuat data', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { loadData(); }, [user?.id]));

  // 2. Computed Models
  const categoryMap = useMemo(() => {
    const map = {};
    (categories || []).forEach(c => { if (c?.id) map[c.id] = c.name; });
    return map;
  }, [categories]);

  const stockItems = useMemo(() => {
    return products.map(p => new StockItem(p, categoryMap));
  }, [products, categoryMap]);

  // 3. KPIs
  const metrics = useMemo(() => {
    let totalStockUnits = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let safeStockCount = 0;

    stockItems.forEach(item => {
      // we only count products that have stock (isUnlimited == false)
      if (item.isUnlimited) return; 
      
      totalStockUnits += item.stock;
      if (item.status === 'out') outOfStockCount++;
      else if (item.status === 'low') lowStockCount++;
      else if (item.status === 'safe') safeStockCount++;
    });

    return {
      totalProducts: stockItems.length,
      totalStockUnits,
      lowStockCount,
      outOfStockCount,
      safeStockCount,
    };
  }, [stockItems]);

  // 4. Products Filtering
  const filteredProducts = useMemo(() => {
    let list = [...stockItems];

    if (statusFilter !== 'all') {
      list = list.filter(p => p.status === statusFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(p => {
        const matchesMain = [p.name, p.code, p.categoryName].some(s => String(s || '').toLowerCase().includes(q));
        const matchesVar = p.variants.some(v => [v.name, v.barcode].some(s => String(s || '').toLowerCase().includes(q)));
        return matchesMain || matchesVar;
      });
    }

    list.sort((a, b) => {
      if (sortBy === 'name') {
        const res = (a.name || '').localeCompare(b.name || '');
        return sortOrder === 'asc' ? res : -res;
      } else {
        const sa = a.isUnlimited ? 9999999 : a.stock;
        const sb = b.isUnlimited ? 9999999 : b.stock;
        return sortOrder === 'asc' ? sa - sb : sb - sa;
      }
    });

    return list;
  }, [stockItems, statusFilter, searchQuery, sortBy, sortOrder]);

  // 5. History Filtering
  const displayedHistory = useMemo(() => {
    return HistoryDateFilter.apply(stockHistory, {
      range: dateFilter,
      search: historySearchQuery,
    });
  }, [stockHistory, dateFilter, historySearchQuery]);

  // 6. Action Handlers
  const handleSort = (field) => {
    if (sortBy === field) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortOrder('asc'); }
  };

  const handleMutationAction = (source, item, variant) => {
    setMutationTarget({ source, item, variant });
  };

  const handleMutationSubmit = async (input) => {
    if (!mutationTarget) return;
    const srv = new StockMutationService(user?.id);
    try {
      await srv.apply(mutationTarget.item, mutationTarget.variant, input);
      showToast('Stok berhasil diperbarui', 'success');
      setMutationTarget(null);
      loadData(true);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Date filter helper for History Modal
  const renderDateFilterModal = () => (
    <Modal visible={showDateFilterModal} animationType="fade" transparent onRequestClose={() => setShowDateFilterModal(false)}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalCardTitle}>Pilih Periode</Text>
          {HistoryDateFilter.OPTIONS.map(opt => {
            if (opt.id === 'custom') return null; // We can skip custom for simplicity or implement it later
            return (
              <TouchableOpacity
                key={opt.id}
                style={[styles.dateFilterRow, dateFilter === opt.id && styles.dateFilterRowActive]}
                onPress={() => { setDateFilter(opt.id); setShowDateFilterModal(false); }}
              >
                <Text style={[styles.dateFilterText, dateFilter === opt.id && styles.dateFilterTextActive]}>{opt.label}</Text>
                {dateFilter === opt.id && <Ionicons name="checkmark" size={18} color="#0284C7" />}
              </TouchableOpacity>
            )
          })}
          <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setShowDateFilterModal(false)}>
            <Text style={styles.modalBtnCancelText}>Tutup</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0284C7" />
          <Text style={styles.loadingText}>Memuat tabel stok...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER BAR */}
      <View style={styles.topHeader}>
        <View style={styles.topHeaderLeft}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color="#0F172A" />
          </TouchableOpacity>
          <View>
            <Text style={styles.topHeaderTitle}>Manajemen Stok</Text>
            <Text style={styles.topHeaderSubtitle}>Pantau, tambah, dan sesuaikan ketersediaan fisik barang</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.refreshIconButton} onPress={() => loadData(true)} activeOpacity={0.7}>
          <Ionicons name="refresh-outline" size={18} color="#475569" />
        </TouchableOpacity>
      </View>

      {/* TABS */}
      <View style={styles.tabBarContainer}>
        <TouchableOpacity style={[styles.tabButton, activeTab === 'products' && styles.tabButtonActive]} onPress={() => setActiveTab('products')}>
          <Ionicons name="layers-outline" size={16} color={activeTab === 'products' ? '#0284C7' : '#64748B'} />
          <Text style={[styles.tabButtonText, activeTab === 'products' && styles.tabButtonTextActive]}>Daftar Stok Produk</Text>
          <View style={[styles.tabBadge, activeTab === 'products' && styles.tabBadgeActive]}>
            <Text style={[styles.tabBadgeText, activeTab === 'products' && styles.tabBadgeTextActive]}>{products.length}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabButton, activeTab === 'history' && styles.tabButtonActive]} onPress={() => setActiveTab('history')}>
          <Ionicons name="time-outline" size={16} color={activeTab === 'history' ? '#0284C7' : '#64748B'} />
          <Text style={[styles.tabButtonText, activeTab === 'history' && styles.tabButtonTextActive]}>Riwayat Mutasi</Text>
          <View style={[styles.tabBadge, activeTab === 'history' && styles.tabBadgeActive]}>
            <Text style={[styles.tabBadgeText, activeTab === 'history' && styles.tabBadgeTextActive]}>{displayedHistory.length}</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* PRODUCTS TAB */}
      {activeTab === 'products' && (
        <ScrollView style={styles.scrollableContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} />}>
          <View style={styles.kpiContainer}>
            <View style={styles.kpiCard}>
              <View style={styles.kpiHeader}>
                <Text style={styles.kpiLabel}>TOTAL PRODUK</Text>
                <View style={[styles.kpiIconWrapper, { backgroundColor: '#F0F9FF' }]}><Ionicons name="cube-outline" size={14} color="#0284C7" /></View>
              </View>
              <Text style={styles.kpiValue}>{metrics.totalProducts}</Text>
              <Text style={styles.kpiSub}>Item master terdaftar</Text>
            </View>
            <View style={styles.kpiCard}>
              <View style={styles.kpiHeader}>
                <Text style={styles.kpiLabel}>TOTAL FISIK STOK</Text>
                <View style={[styles.kpiIconWrapper, { backgroundColor: '#F0FDF4' }]}><Ionicons name="layers-outline" size={14} color="#16A34A" /></View>
              </View>
              <Text style={styles.kpiValue}>{metrics.totalStockUnits.toLocaleString()} pcs</Text>
              <Text style={styles.kpiSub}>Akumulasi seluruh stok</Text>
            </View>
            <TouchableOpacity style={[styles.kpiCard, statusFilter === 'low' && styles.kpiCardSelectedLow]} onPress={() => setStatusFilter(f => f === 'low' ? 'all' : 'low')}>
              <View style={styles.kpiHeader}>
                <Text style={[styles.kpiLabel, { color: '#B45309' }]}>STOK MENIPIS</Text>
                <View style={[styles.kpiIconWrapper, { backgroundColor: '#FEF3C7' }]}><Ionicons name="warning-outline" size={14} color="#D97706" /></View>
              </View>
              <Text style={[styles.kpiValue, { color: '#B45309' }]}>{metrics.lowStockCount}</Text>
              <Text style={styles.kpiSub}>Perlu segera restok (≤ 5)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.kpiCard, statusFilter === 'out' && styles.kpiCardSelectedOut]} onPress={() => setStatusFilter(f => f === 'out' ? 'all' : 'out')}>
              <View style={styles.kpiHeader}>
                <Text style={[styles.kpiLabel, { color: '#B91C1C' }]}>STOK HABIS</Text>
                <View style={[styles.kpiIconWrapper, { backgroundColor: '#FEE2E2' }]}><Ionicons name="alert-circle-outline" size={14} color="#DC2626" /></View>
              </View>
              <Text style={[styles.kpiValue, { color: '#B91C1C' }]}>{metrics.outOfStockCount}</Text>
              <Text style={styles.kpiSub}>Ketersediaan kosong (0)</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.toolbarCard}>
            <View style={styles.searchBar}>
              <Ionicons name="search-outline" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
              <TextInput style={styles.searchInput} value={searchQuery} onChangeText={setSearchQuery} placeholder="Cari nama produk, SKU, varian..." placeholderTextColor="#94A3B8" />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
              <View style={styles.chipsRow}>
                {['all', 'low', 'out', 'safe'].map(s => {
                  const label = s === 'all' ? `Semua (${metrics.totalProducts})` : s === 'low' ? `⚠️ Menipis (${metrics.lowStockCount})` : s === 'out' ? `🔴 Habis (${metrics.outOfStockCount})` : `🟢 Aman (${metrics.safeStockCount})`;
                  return (
                    <TouchableOpacity key={s} style={[styles.chipButton, statusFilter === s && styles.chipButtonActive]} onPress={() => setStatusFilter(s)}>
                      <Text style={[styles.chipButtonText, statusFilter === s && styles.chipButtonTextActive]}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>

          <StockProductTable
            items={filteredProducts}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={handleSort}
            onAction={handleMutationAction}
            emptyHint={searchQuery ? 'Coba ubah kata kunci pencarian Anda' : 'Belum ada produk pada status filter ini'}
          />
        </ScrollView>
      )}

      {/* HISTORY TAB */}
      {activeTab === 'history' && (
        <ScrollView style={styles.scrollableContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} />}>
          <View style={styles.toolbarCard}>
            <View style={styles.searchBar}>
              <Ionicons name="search-outline" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
              <TextInput style={styles.searchInput} value={historySearchQuery} onChangeText={setHistorySearchQuery} placeholder="Cari nama produk, alasan, atau catatan..." placeholderTextColor="#94A3B8" />
              {historySearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setHistorySearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.historyFilterRow}>
              <TouchableOpacity style={styles.dateFilterChip} onPress={() => setShowDateFilterModal(true)}>
                <Ionicons name="calendar-outline" size={16} color="#0284C7" />
                <Text style={styles.dateFilterChipText}>Periode: {HistoryDateFilter.label(dateFilter)} ({displayedHistory.length} mutasi)</Text>
                <Ionicons name="chevron-down" size={14} color="#0284C7" />
              </TouchableOpacity>
            </View>
          </View>

          <StockHistoryTable
            history={displayedHistory}
            emptyHint={historySearchQuery ? 'Tidak ada riwayat yang sesuai pencarian' : 'Aktivitas mutasi stok akan tercatat di sini'}
          />
        </ScrollView>
      )}

      {/* MODALS */}
      <StockMutationModal
        target={mutationTarget}
        onClose={() => setMutationTarget(null)}
        onSubmit={handleMutationSubmit}
      />
      {renderDateFilterModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, color: '#64748B' },
  topHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  topHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  topHeaderTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  topHeaderSubtitle: { fontSize: 12, color: '#64748B', marginTop: 2 },
  refreshIconButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  tabBarContainer: { flexDirection: 'row', backgroundColor: '#FFFFFF', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingBottom: 0 },
  tabButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 2, borderBottomColor: 'transparent', gap: 6 },
  tabButtonActive: { borderBottomColor: '#0284C7' },
  tabButtonText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  tabButtonTextActive: { color: '#0284C7', fontWeight: '700' },
  tabBadge: { backgroundColor: '#F1F5F9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  tabBadgeActive: { backgroundColor: '#E0F2FE' },
  tabBadgeText: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  tabBadgeTextActive: { color: '#0284C7' },
  scrollableContent: { flex: 1, padding: 16 },
  kpiContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  kpiCard: { flex: 1, minWidth: 150, backgroundColor: '#FFFFFF', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  kpiCardSelectedLow: { borderColor: '#F59E0B', backgroundColor: '#FEF3C7' },
  kpiCardSelectedOut: { borderColor: '#EF4444', backgroundColor: '#FEE2E2' },
  kpiHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  kpiLabel: { fontSize: 10, fontWeight: '700', color: '#64748B' },
  kpiIconWrapper: { width: 24, height: 24, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  kpiValue: { fontSize: 20, fontWeight: '800', color: '#0F172A', marginBottom: 2 },
  kpiSub: { fontSize: 11, color: '#94A3B8' },
  toolbarCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 8, paddingHorizontal: 12, height: 40, borderWidth: 1, borderColor: '#E2E8F0' },
  searchInput: { flex: 1, fontSize: 13, color: '#0F172A' },
  chipsScroll: { marginTop: 12 },
  chipsRow: { flexDirection: 'row', gap: 8 },
  chipButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
  chipButtonActive: { backgroundColor: '#0284C7', borderColor: '#0284C7' },
  chipButtonText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  chipButtonTextActive: { color: '#FFFFFF' },
  historyFilterRow: { marginTop: 12, flexDirection: 'row' },
  dateFilterChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E0F2FE', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 6 },
  dateFilterChipText: { fontSize: 12, fontWeight: '600', color: '#0284C7' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: { backgroundColor: '#fff', borderRadius: 12, width: '100%', maxWidth: 300, padding: 20 },
  modalCardTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 15 },
  dateFilterRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  dateFilterRowActive: { backgroundColor: '#f8fafc' },
  dateFilterText: { fontSize: 14, color: '#334155' },
  dateFilterTextActive: { color: '#0284C7', fontWeight: 'bold' },
  modalBtnCancel: { marginTop: 15, paddingVertical: 10, alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 8 },
  modalBtnCancelText: { color: '#475569', fontWeight: '600' }
});