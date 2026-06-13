import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { getAllSalesForSummary } from '../services/salesSupabase';
import { Colors, FontSize, FontWeight, Spacing } from '../theme';

export default function AnnualProfitReportScreen({ navigation }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [annualData, setAnnualData] = useState({});

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      if (user?.id) {
        const sales = await getAllSalesForSummary(user.id);
        processSalesData(sales);
      }
    } catch (e) {
      console.error(e);
      showToast('Gagal memuat data profit tahunan', 'error');
    } finally {
      setRefreshing(false);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      if (!user?.id) return;
      const sales = await getAllSalesForSummary(user.id);
      processSalesData(sales);
    } catch (error) {
      console.error(error);
      showToast('Gagal memuat data profit tahunan', 'error');
    } finally {
      setLoading(false);
    }
  };

  const processSalesData = (sales) => {
    const yearsData = {};

    (sales || []).forEach(sale => {
      if (!sale.created_at) return;
      
      const date = new Date(sale.created_at);
      const year = date.getFullYear();
      const month = date.getMonth(); // 0-11

      // Calculate profit for this transaction
      let saleProfit = 0;
      if (sale.sale_items && sale.sale_items.length > 0) {
        saleProfit = sale.sale_items.reduce((sum, item) => {
          let p = (typeof item.line_profit === 'number' && item.line_profit !== 0)
            ? item.line_profit
            : ((Number(item.price) - Number(item.cost_price || 0)) * Number(item.qty || 1));
          return sum + p;
        }, 0);
      } else {
        saleProfit = Number(sale.profit) || 0;
      }

      if (!yearsData[year]) {
        yearsData[year] = Array(12).fill(0);
      }
      yearsData[year][month] += saleProfit;
    });

    setAnnualData(yearsData);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  // Ascending order as requested (so 2025 is on top, 2026 below it)
  const years = Object.keys(annualData)
    .map(Number)
    .sort((a, b) => a - b);

  const renderYearTable = (year) => {
    const monthsProfit = annualData[year];
    const totalYearProfit = monthsProfit.reduce((sum, val) => sum + val, 0);

    return (
      <View key={year} style={styles.yearCard}>
        <View style={styles.yearHeader}>
          <Ionicons name="calendar-outline" size={20} color={Colors.primary} style={{ marginRight: 8 }} />
          <Text style={styles.yearTitle}>Tahun {year}</Text>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.headerCell, { flex: 1 }]}>Bulan</Text>
            <Text style={[styles.headerCell, { width: 140, textAlign: 'right' }]}>Profit</Text>
          </View>

          {monthNames.map((name, index) => {
            const profit = monthsProfit[index] || 0;
            const isAlt = index % 2 === 1;
            return (
              <View key={index} style={[styles.tableRow, isAlt && styles.altRow]}>
                <Text style={styles.cellBulan}>{name}</Text>
                <Text style={[styles.cellProfit, profit > 0 ? styles.positiveProfit : styles.zeroProfit]}>
                  {formatCurrency(profit)}
                </Text>
              </View>
            );
          })}

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Profit {year}</Text>
            <Text style={styles.totalValue}>{formatCurrency(totalYearProfit)}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={22} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Laporan Profit Tahunan</Text>
        <TouchableOpacity onPress={loadData} style={styles.refreshButton}>
          <Ionicons name="refresh" size={20} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Memuat data profit...</Text>
        </View>
      ) : years.length === 0 ? (
        <ScrollView
          contentContainerStyle={[styles.emptyContainer, { flexGrow: 1 }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[Colors.primary]}
              tintColor={Colors.primary}
            />
          }
        >
          <Ionicons name="analytics-outline" size={64} color={Colors.muted} style={{ alignSelf: 'center', marginTop: '40%' }} />
          <Text style={styles.emptyText}>Belum ada data penjualan tersedia.</Text>
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[Colors.primary]}
              tintColor={Colors.primary}
            />
          }
        >
          {/* Shortcut to Graph Analytics */}
          <TouchableOpacity
            style={styles.analyticsButtonCard}
            onPress={() => navigation.navigate('SalesAnalyticsDashboard', { initialTab: 'profit' })}
          >
            <View style={styles.analyticsButtonContent}>
              <View style={styles.analyticsIconContainer}>
                <Ionicons name="bar-chart" size={22} color={Colors.primary} />
              </View>
              <View style={styles.analyticsTextContainer}>
                <Text style={styles.analyticsButtonTitle}>Lihat Grafik Analisis</Text>
                <Text style={styles.analyticsButtonSubtitle}>Analisis data profit & transaksi lebih detail</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.muted} />
            </View>
          </TouchableOpacity>

          {years.map(renderYearTable)}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    padding: 4,
  },
  refreshButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    fontFamily: 'Poppins',
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  yearCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    marginBottom: Spacing.xl,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  yearHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.borderLight,
    paddingBottom: Spacing.sm,
  },
  yearTitle: {
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    fontFamily: 'Poppins',
  },
  table: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: Colors.primaryLight,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerCell: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
    fontFamily: 'Poppins',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    alignItems: 'center',
  },
  altRow: {
    backgroundColor: Colors.lightBg,
  },
  cellBulan: {
    flex: 1,
    fontSize: FontSize.body,
    color: Colors.text,
    fontFamily: 'Poppins',
  },
  cellProfit: {
    width: 140,
    textAlign: 'right',
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    fontFamily: 'Poppins',
  },
  positiveProfit: {
    color: Colors.success,
  },
  zeroProfit: {
    color: Colors.muted,
  },
  totalRow: {
    flexDirection: 'row',
    backgroundColor: Colors.primaryLight,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderTopWidth: 1.5,
    borderTopColor: Colors.primary,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: FontSize.bodyLg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    fontFamily: 'Poppins',
  },
  totalValue: {
    fontSize: FontSize.bodyLg,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
    fontFamily: 'Poppins',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  loadingText: {
    marginTop: Spacing.sm,
    color: Colors.muted,
    fontSize: FontSize.body,
    fontFamily: 'Poppins',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxl,
  },
  emptyText: {
    marginTop: Spacing.md,
    color: Colors.muted,
    fontSize: FontSize.body,
    fontFamily: 'Poppins',
    textAlign: 'center',
  },
  analyticsButtonCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  analyticsButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  analyticsIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  analyticsTextContainer: {
    flex: 1,
  },
  analyticsButtonTitle: {
    fontSize: FontSize.bodyLg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    fontFamily: 'Poppins',
  },
  analyticsButtonSubtitle: {
    fontSize: FontSize.caption,
    color: Colors.muted,
    fontFamily: 'Poppins',
    marginTop: 2,
  },
});
