import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getProductValuation } from '../../services/productValuationService';
import {
  ValuationProductItem,
  ValuationSummaryModel,
  ValuationFilterService,
} from '../../models/ProductValuationModel';
import { ValuationExcelExporter } from '../../services/valuationExportService';
import { ValuationHeroCard } from './components/valuation/ValuationHeroCard';
import { ValuationConsignmentCard } from './components/valuation/ValuationConsignmentCard';
import { ValuationFilterToolbar } from './components/valuation/ValuationFilterToolbar';
import { ValuationTableView } from './components/valuation/ValuationTableView';
import { Colors } from '../../theme';

/**
 * Screen Controller: Product Asset Valuation
 * Refactored using Clean Architecture and OOP Domain Models.
 */
export default function ProductAssetValuationScreen({ navigation }) {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [data, setData] = useState(null);

  // Filter & View State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('physical');
  const [sortBy, setSortBy] = useState('storeItemCapital');
  const [sortAsc, setSortAsc] = useState(false);

  // Fetch product valuation
  const loadData = useCallback(async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) {
        setRefreshing(true);
      }
      const res = await getProductValuation(user?.id);
      if (res.success) {
        setData(res.data);
        if (isManualRefresh) {
          showToast('Data valuasi berhasil diperbarui', 'success');
        }
      } else {
        showToast(res.error || 'Gagal memuat valuasi produk', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan saat memuat valuasi', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, showToast]);

  // Otomatis refresh data saat screen difokuskan kembali
  useFocusEffect(
    useCallback(() => {
      loadData(false);
    }, [loadData])
  );

  const onRefresh = () => {
    loadData(true);
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(field);
      setSortAsc(field === 'name');
    }
  };

  // Convert raw API products to OOP Domain Model instances
  const domainProducts = useMemo(() => {
    if (!data?.products) return [];
    return data.products.map(raw => new ValuationProductItem(raw));
  }, [data?.products]);

  // Aggregate category counts using OOP Service
  const typeCounts = useMemo(() => {
    return ValuationFilterService.countByType(domainProducts);
  }, [domainProducts]);

  // Filter & Sort using OOP Service
  const filteredProducts = useMemo(() => {
    const filtered = ValuationFilterService.filter(domainProducts, {
      activeTab,
      searchQuery,
    });
    return ValuationFilterService.sort(filtered, sortBy, sortAsc);
  }, [domainProducts, activeTab, searchQuery, sortBy, sortAsc]);

  // Dynamic Excel-style Subtotal Summary
  const tableSummary = useMemo(() => {
    return ValuationSummaryModel.calculate(filteredProducts);
  }, [filteredProducts]);

  // Export to Excel using OOP Exporter Service
  const handleExportExcel = () => {
    ValuationExcelExporter.export({
      products: filteredProducts,
      summary: tableSummary,
      showToast,
      setExporting,
    });
  };

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('MainTabs', { screen: 'Home' });
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Menghitung Valuasi Aset Stok...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color={Colors.primary} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Valuasi Aset Stok</Text>
          <Text style={styles.headerSubtitle}>Pantau Modal Fisik, Barang Titipan & Digital</Text>
        </View>
        <TouchableOpacity
          onPress={onRefresh}
          style={[styles.refreshButton, refreshing && styles.refreshButtonActive]}
          disabled={refreshing}
          activeOpacity={0.7}
          accessibilityLabel="Refresh Data Valuasi"
        >
          {refreshing ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Ionicons name="refresh" size={20} color={Colors.primary} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
          />
        }
      >
        {/* KPI Hero Card */}
        <ValuationHeroCard data={data} />

        {/* Consignment / Barang Titipan Summary Card */}
        <ValuationConsignmentCard consignmentStats={data?.consignmentStats} />

        {/* Action Toolbar, Search, Filter Tabs & Export */}
        <ValuationFilterToolbar
          navigation={navigation}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          typeCounts={typeCounts}
          exporting={exporting}
          onExportExcel={handleExportExcel}
          refreshing={refreshing}
          onRefresh={onRefresh}
        />

        {/* Tabel Valuasi */}
        <ValuationTableView
          products={filteredProducts}
          summary={tableSummary}
          sortBy={sortBy}
          sortAsc={sortAsc}
          onSort={handleSort}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.muted,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    padding: 6,
    marginRight: 8,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 11,
    color: Colors.muted,
    marginTop: 1,
  },
  refreshButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshButtonActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 40,
  },
});
