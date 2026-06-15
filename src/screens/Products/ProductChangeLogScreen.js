import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, ScrollView, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Radii, Spacing } from '../../theme';
import { getAllProductChangeLogs, FIELD_LABELS, REASON_LABELS, formatLogValue } from '../../services/productChangeLogSupabase';
import { useAuth } from '../../context/AuthContext';

const FIELD_FILTERS = [
  { key: null,         label: 'Semua' },
  { key: 'price',      label: 'Harga Jual' },
  { key: 'cost_price', label: 'Harga Modal' },
  { key: 'stock',      label: 'Stok' },
  { key: 'barcode',    label: 'Barcode' },
  { key: 'name',       label: 'Nama' },
];

const FIELD_COLORS = {
  price:      { bg: '#EBF5FB', icon: '#2980B9', text: '#1A5276' },
  cost_price: { bg: '#FEF9E7', icon: '#D4AC0D', text: '#7D6608' },
  stock:      { bg: '#EAFAF1', icon: '#27AE60', text: '#1E8449' },
  barcode:    { bg: '#F5EEF8', icon: '#8E44AD', text: '#6C3483' },
  name:       { bg: '#FDEDEC', icon: '#E74C3C', text: '#922B21' },
};

const FIELD_ICONS = {
  price:      'pricetag',
  cost_price: 'wallet',
  stock:      'cube',
  barcode:    'barcode',
  name:       'create',
};

export default function ProductChangeLogScreen({ navigation, route }) {
  const { user } = useAuth();

  // Jika dibuka dari detail produk tertentu, gunakan productId & productName dari params
  const { productId = null, productName = null } = route?.params || {};

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedField, setSelectedField] = useState(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 50;

  const loadLogs = useCallback(async (reset = false) => {
    if (!user?.id) return;
    const currentPage = reset ? 0 : page;
    if (!reset && !hasMore) return;

    if (reset) setLoading(true);

    try {
      const { data, success } = await getAllProductChangeLogs(user.id, {
        fieldName: selectedField,
        limit: PAGE_SIZE,
        page: currentPage,
        // Jika dibuka dari halaman produk tertentu, filter by productId
        ...(productId ? { productId } : {}),
      });

      if (reset) {
        setLogs(data || []);
      } else {
        setLogs(prev => [...prev, ...(data || [])]);
      }
      setHasMore((data || []).length === PAGE_SIZE);
      setPage(currentPage + 1);
    } catch (e) {
      // handle error silently
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, selectedField, productId, page, hasMore]);

  useEffect(() => {
    setPage(0);
    setHasMore(true);
    setLogs([]);
    loadLogs(true);
  }, [selectedField]);

  const onRefresh = async () => {
    setRefreshing(true);
    setPage(0);
    setHasMore(true);
    await loadLogs(true);
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const renderLogItem = ({ item }) => {
    const color = FIELD_COLORS[item.field_name] || { bg: '#F2F3F4', icon: '#7F8C8D', text: '#566573' };
    const icon  = FIELD_ICONS[item.field_name]  || 'document-text';
    const label = FIELD_LABELS[item.field_name]  || item.field_name;
    const reason = REASON_LABELS[item.change_reason] || item.change_reason || '-';

    const oldVal = formatLogValue(item.field_name, item.old_value);
    const newVal = formatLogValue(item.field_name, item.new_value);

    return (
      <View style={[styles.logCard, { borderLeftColor: color.icon }]}>
        {/* Header baris */}
        <View style={styles.logHeader}>
          <View style={[styles.fieldBadge, { backgroundColor: color.bg }]}>
            <Ionicons name={icon} size={13} color={color.icon} style={{ marginRight: 4 }} />
            <Text style={[styles.fieldBadgeText, { color: color.text }]}>{label}</Text>
          </View>
          <Text style={styles.logDate}>{formatDate(item.changed_at)}</Text>
        </View>

        {/* Nama produk */}
        {!productId && (
          <Text style={styles.productName} numberOfLines={1}>
            📦 {item.product_name || 'Produk'}
          </Text>
        )}

        {/* Perubahan nilai */}
        <View style={styles.changeRow}>
          <View style={styles.valueBox}>
            <Text style={styles.valueLabel}>Sebelum</Text>
            <Text style={[styles.valueText, styles.valueOld]} numberOfLines={2}>{oldVal}</Text>
          </View>
          <Ionicons name="arrow-forward" size={18} color={Colors.muted} style={{ marginHorizontal: 8, alignSelf: 'center' }} />
          <View style={styles.valueBox}>
            <Text style={styles.valueLabel}>Sesudah</Text>
            <Text style={[styles.valueText, styles.valueNew]} numberOfLines={2}>{newVal}</Text>
          </View>
        </View>

        {/* Alasan & catatan */}
        <View style={styles.metaRow}>
          <Text style={styles.reasonText}>{reason}</Text>
          {item.note ? <Text style={styles.noteText}>{item.note}</Text> : null}
        </View>
      </View>
    );
  };

  const isNoData = !loading && logs.length === 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>
            {productName ? `Log: ${productName}` : 'Log Perubahan Produk'}
          </Text>
          {!productName && (
            <Text style={styles.headerSub}>Tracking semua perubahan produk</Text>
          )}
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {FIELD_FILTERS.map(f => (
            <TouchableOpacity
              key={String(f.key)}
              style={[styles.filterBtn, selectedField === f.key && styles.filterBtnActive]}
              onPress={() => setSelectedField(f.key)}
            >
              <Text style={[styles.filterBtnText, selectedField === f.key && styles.filterBtnTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Info banner jika belum setup DB */}
      {isNoData && (
        <View style={styles.emptyBanner}>
          <Ionicons name="information-circle-outline" size={36} color={Colors.muted} />
          <Text style={styles.emptyTitle}>Belum ada log</Text>
          <Text style={styles.emptyDesc}>
            Pastikan sudah menjalankan SQL{'\n'}
            <Text style={{ fontWeight: '700' }}>product_change_log.sql</Text>
            {'\n'}di Supabase SQL Editor.{'\n\n'}
            Setelah itu, setiap perubahan produk akan otomatis tercatat di sini.
          </Text>
        </View>
      )}

      {/* Log List */}
      {loading && logs.length === 0 ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Memuat log...</Text>
        </View>
      ) : (
        <FlatList
          data={logs}
          keyExtractor={item => item.id}
          renderItem={renderLogItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
          }
          onEndReached={() => loadLogs(false)}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            !hasMore && logs.length > 0 ? (
              <Text style={styles.endText}>— Semua log telah ditampilkan —</Text>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  backBtn: { marginRight: 12 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  headerSub: { fontSize: 12, color: Colors.muted, marginTop: 2 },

  filterWrap: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
    paddingVertical: 8,
  },
  filterRow: { paddingHorizontal: Spacing.lg, gap: 8 },
  filterBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Radii.pill,
    backgroundColor: '#F2F3F4',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterBtnText: { fontSize: 13, color: Colors.text, fontWeight: '600' },
  filterBtnTextActive: { color: '#fff' },

  listContent: { padding: Spacing.md, paddingBottom: 80 },

  logCard: {
    backgroundColor: '#fff',
    borderRadius: Radii.md,
    padding: Spacing.md,
    marginBottom: 10,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  fieldBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radii.pill,
  },
  fieldBadgeText: { fontSize: 12, fontWeight: '700' },
  logDate: { fontSize: 11, color: Colors.muted },

  productName: { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 8 },

  changeRow: { flexDirection: 'row', alignItems: 'stretch', marginVertical: 8 },
  valueBox: { flex: 1, backgroundColor: '#F8F9FA', borderRadius: 8, padding: 8 },
  valueLabel: { fontSize: 10, color: Colors.muted, fontWeight: '600', marginBottom: 2 },
  valueText: { fontSize: 13, fontWeight: '700' },
  valueOld: { color: '#E74C3C' },
  valueNew: { color: '#27AE60' },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  reasonText: { fontSize: 11, color: Colors.muted },
  noteText: { fontSize: 11, color: Colors.muted, fontStyle: 'italic' },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 12, color: Colors.muted, fontSize: 14 },

  emptyBanner: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginTop: 12, marginBottom: 8 },
  emptyDesc: { fontSize: 14, color: Colors.muted, textAlign: 'center', lineHeight: 22 },

  endText: { textAlign: 'center', color: Colors.muted, fontSize: 12, paddingVertical: 16 },
});
