import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Modal,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../context/AuthContext';
import { getStockHistory } from '../services/stockSupabase';
import { getProductById } from '../services/products';
import { formatCurrency } from '../utils/currency';
import { getProductSalesMetrics } from '../services/salesSupabase';

const { width } = Dimensions.get('window');

export default function ProductReportScreen({ navigation, route }) {
  const { user } = useAuth();
  const { productId, productName } = route.params || {};
  const [product, setProduct] = useState(null);
  const [stockHistory, setStockHistory] = useState([]);
  const [filteredHistory, setFilteredHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);
  
  // Filter states
  const [selectedPeriod, setSelectedPeriod] = useState('all');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState('start');
  const [startDate, setStartDate] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const [endDate, setEndDate] = useState(new Date());
  const [showCustomDateModal, setShowCustomDateModal] = useState(false);

  // Statistics
  const [stats, setStats] = useState({
    totalIn: 0,
    totalOut: 0,
    totalAdjustments: 0,
    netChange: 0
  });
  const [salesMetrics, setSalesMetrics] = useState({
    totalSales: 0,
    totalQuantitySold: 0,
    dailySales: [],
    maxSalesDay: null
  });

  const loadData = async () => {
    try {
      console.log('📊 ProductReportScreen: Loading data for product:', productId);
      
      // Load product details
      const productResult = await getProductById(user?.id, productId);
      if (productResult) {
        setProduct(productResult);
      }

      // Load stock history
      const historyResult = await getStockHistory(productId, 200);
      if (historyResult.success) {
        const history = historyResult.data || [];
        setStockHistory(history);
        calculateStats(history);
        applyDateFilter(history, selectedPeriod);
      } else {
        console.log('❌ ProductReportScreen: Error loading history:', historyResult.error);
        Alert.alert('Error', 'Gagal memuat riwayat stock: ' + historyResult.error);
      }

      if (productResult?.barcode) {
        const metrics = await getProductSalesMetrics(user?.id, productResult.barcode, {
          startDate,
          endDate
        });
        if (metrics.success) {
          setSalesMetrics(metrics);
        }
      }
    } catch (error) {
      console.log('❌ ProductReportScreen: Exception loading data:', error);
      Alert.alert('Error', 'Terjadi kesalahan saat memuat data');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (history) => {
    const stats = {
      totalIn: 0,
      totalOut: 0,
      totalAdjustments: 0,
      netChange: 0
    };

    history.forEach(item => {
      const quantity = Math.abs(item.quantity || 0);
      if (item.type === 'addition' || item.quantity > 0) {
        stats.totalIn += quantity;
      } else if (item.type === 'reduction' || item.quantity < 0) {
        stats.totalOut += quantity;
      } else if (item.type === 'adjustment') {
        stats.totalAdjustments += 1;
      }
    });

    stats.netChange = stats.totalIn - stats.totalOut;
    setStats(stats);
  };

  const applyDateFilter = (history, period) => {
    let filtered = [...history];
    const now = new Date();
    
    switch (period) {
      case 'today':
        filtered = history.filter(item => {
          const itemDate = new Date(item.created_at);
          return itemDate.toDateString() === now.toDateString();
        });
        break;
      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        filtered = history.filter(item => new Date(item.created_at) >= weekAgo);
        break;
      case 'month':
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        filtered = history.filter(item => new Date(item.created_at) >= monthAgo);
        break;
      case 'custom':
        filtered = history.filter(item => {
          const itemDate = new Date(item.created_at);
          return itemDate >= startDate && itemDate <= endDate;
        });
        break;
      default:
        // 'all' - no filtering
        break;
    }

    setFilteredHistory(filtered);
    calculateStats(filtered);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handlePeriodChange = (period) => {
    setSelectedPeriod(period);
    if (period === 'custom') {
      setShowCustomDateModal(true);
    } else {
      applyDateFilter(stockHistory, period);
    }
  };

  const handleCustomDateApply = () => {
    setShowCustomDateModal(false);
    applyDateFilter(stockHistory, 'custom');
  };

  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      if (datePickerMode === 'start') {
        setStartDate(selectedDate);
      } else {
        setEndDate(selectedDate);
      }
    }
  };

  useEffect(() => {
    if (productId && user?.id) {
      loadData();
    }
  }, [productId, user?.id]);

  const computeDateRange = () => {
    const now = new Date();
    if (selectedPeriod === 'all') return null;
    if (selectedPeriod === 'today') {
      const s = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const e = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return { startDate: s, endDate: e };
    }
    if (selectedPeriod === 'week') {
      const s = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      s.setHours(0, 0, 0, 0);
      const e = new Date();
      e.setHours(23, 59, 59, 999);
      return { startDate: s, endDate: e };
    }
    if (selectedPeriod === 'month') {
      const s = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      s.setHours(0, 0, 0, 0);
      const e = new Date();
      e.setHours(23, 59, 59, 999);
      return { startDate: s, endDate: e };
    }
    if (selectedPeriod === 'custom') {
      const s = new Date(startDate);
      s.setHours(0, 0, 0, 0);
      const e = new Date(endDate);
      e.setHours(23, 59, 59, 999);
      return { startDate: s, endDate: e };
    }
    return null;
  };

  useEffect(() => {
    const run = async () => {
      if (!product || !user?.id) return;
      const range = computeDateRange();
      try {
        const metrics = await getProductSalesMetrics(
          user.id,
          product?.barcode || null,
          range,
          product?.name || null
        );
        if (metrics.success) {
          setSalesMetrics(metrics);
        } else {
          setSalesMetrics({
            totalSales: 0,
            totalQuantitySold: 0,
            dailySales: [],
            maxSalesDay: null
          });
        }
      } catch (e) {
        setSalesMetrics({
          totalSales: 0,
          totalQuantitySold: 0,
          dailySales: [],
          maxSalesDay: null
        });
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPeriod, startDate, endDate, product?.barcode, product?.name, user?.id]);

  const PeriodFilter = () => {
    const periods = [
      { key: 'all', label: 'Semua', icon: 'calendar-outline', color: '#8E8E93' },
      { key: 'today', label: 'Hari Ini', icon: 'today-outline', color: '#34C759' },
      { key: 'week', label: '7 Hari', icon: 'calendar-outline', color: '#007AFF' },
      { key: 'month', label: '30 Hari', icon: 'calendar-outline', color: '#FF9500' },
      { key: 'custom', label: 'Custom', icon: 'options-outline', color: '#5856D6' }
    ];

    return (
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.periodFilterContainer}
        contentContainerStyle={styles.periodFilterContent}
      >
        {periods.map((period) => (
          <TouchableOpacity
            key={period.key}
            style={[
              styles.periodButton,
              selectedPeriod === period.key && styles.activePeriodButton,
              { borderColor: period.color }
            ]}
            onPress={() => handlePeriodChange(period.key)}
          >
            <Ionicons 
              name={period.icon} 
              size={16} 
              color={selectedPeriod === period.key ? '#FFFFFF' : period.color} 
            />
            <Text style={[
              styles.periodButtonText,
              selectedPeriod === period.key && styles.activePeriodButtonText,
              { color: selectedPeriod === period.key ? '#FFFFFF' : period.color }
            ]}>
              {period.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  const StatsCard = ({ title, value, subtitle, icon, color }) => (
    <View style={[styles.statsCard, { borderLeftColor: color }]}>
      <View style={styles.statsCardHeader}>
        <Ionicons name={icon} size={20} color={color} />
        <Text style={styles.statsCardTitle}>{title}</Text>
      </View>
      <Text style={[styles.statsCardValue, { color }]}>{value}</Text>
      {subtitle && <Text style={styles.statsCardSubtitle}>{subtitle}</Text>}
    </View>
  );

  const renderHistoryItem = ({ item }) => {
    let typeIcon = '📝';
    let typeColor = '#6c757d';
    let typeLabel = 'Penyesuaian';

    // Determine type based on the actual type field from database
    if (item.type === 'addition') {
      typeIcon = '📈';
      typeColor = '#28a745';
      typeLabel = 'Penambahan';
    } else if (item.type === 'reduction') {
      typeIcon = '📉';
      typeColor = '#dc3545';
      typeLabel = 'Pengurangan';
    } else if (item.type === 'adjustment') {
      typeIcon = '⚖️';
      typeColor = '#007AFF';
      typeLabel = 'Penyesuaian';
    }

    const formatDate = (dateString) => {
      const date = new Date(dateString);
      return date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    };

    return (
      <View style={styles.historyCard}>
        <View style={styles.historyHeader}>
          <View style={styles.typeSection}>
            <Text style={styles.typeIcon}>{typeIcon}</Text>
            <Text style={[styles.typeLabel, { color: typeColor }]}>{typeLabel}</Text>
          </View>
          <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
        </View>

        <View style={styles.quantitySection}>
          <View style={styles.quantityRow}>
            <Text style={styles.quantityLabel}>Jumlah:</Text>
            <Text style={[styles.quantityValue, { color: typeColor }]}>
              {item.type === 'addition' ? '+' : item.type === 'reduction' ? '-' : ''}{Math.abs(item.quantity)}
            </Text>
          </View>
          <View style={styles.stockRow}>
            <Text style={styles.stockLabel}>Stock:</Text>
            <Text style={styles.stockValue}>
              {item.previous_stock} → {item.new_stock}
            </Text>
          </View>
        </View>

        {item.reason && (
          <View style={styles.reasonSection}>
            <Text style={styles.reasonLabel}>Alasan:</Text>
            <Text style={styles.reasonText}>{item.reason}</Text>
          </View>
        )}

        {item.notes && (
          <View style={styles.notesSection}>
            <Text style={styles.notesLabel}>Catatan:</Text>
            <Text style={styles.notesText}>{item.notes}</Text>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Memuat data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Product Info */}
        {product && (
          <View style={styles.productInfo}>
            <Text style={styles.productName}>{product.name}</Text>
            <View style={styles.productDetails}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Stock Saat Ini:</Text>
                <Text style={styles.detailValue}>{product.stock}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Harga Jual:</Text>
                <Text style={styles.detailValue}>{formatCurrency(product.price)}</Text>
              </View>
              {product.barcode && (
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Barcode:</Text>
                  <Text style={styles.detailValue}>{product.barcode}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Period Filter */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📅 Filter Periode</Text>
          <PeriodFilter />
        </View>

        {/* Statistics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📊 Statistik</Text>
          <View style={styles.statsGrid}>
            <StatsCard
              title="Masuk"
              value={stats.totalIn.toString()}
              subtitle="Total penambahan"
              icon="arrow-up-circle"
              color="#34C759"
            />
            <StatsCard
              title="Keluar"
              value={stats.totalOut.toString()}
              subtitle="Total pengurangan"
              icon="arrow-down-circle"
              color="#FF3B30"
            />
          </View>
          <View style={styles.statsGrid}>
            <StatsCard
              title="Penyesuaian"
              value={stats.totalAdjustments.toString()}
              subtitle="Total penyesuaian"
              icon="settings"
              color="#007AFF"
            />
            <StatsCard
              title="Net Change"
              value={stats.netChange > 0 ? `+${stats.netChange}` : stats.netChange.toString()}
              subtitle="Perubahan bersih"
              icon="trending-up"
              color={stats.netChange >= 0 ? '#34C759' : '#FF3B30'}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💰 Statistik Penjualan</Text>
          <View style={styles.statsGrid}>
            <StatsCard
              title="Total Penjualan"
              value={formatCurrency(salesMetrics.totalSales)}
              subtitle="Jumlah keseluruhan"
              icon="cash-outline"
              color="#007AFF"
            />
            <StatsCard
              title="Terjual"
              value={salesMetrics.totalQuantitySold.toString()}
              subtitle="Jumlah produk"
              icon="cart-outline"
              color="#34C759"
            />
          </View>
          {salesMetrics.maxSalesDay && (
            <View style={styles.maxSalesDayContainer}>
              <Text style={styles.maxSalesDayTitle}>Hari Penjualan Terbanyak</Text>
              <Text style={styles.maxSalesDayDate}>
                {salesMetrics.maxSalesDay.date.toLocaleDateString('id-ID')}
              </Text>
              <Text style={styles.maxSalesDayValue}>
                {salesMetrics.maxSalesDay.quantity} produk • {formatCurrency(salesMetrics.maxSalesDay.amount)}
              </Text>
            </View>
          )}
          {salesMetrics.dailySales.length > 0 && (
            <View style={styles.dailySalesContainer}>
              <Text style={styles.dailySalesTitle}>Penjualan Harian</Text>
              <FlatList
                data={salesMetrics.dailySales}
                keyExtractor={(item) => item.date.toISOString()}
                renderItem={({ item }) => (
                  <View style={styles.dailySalesItem}>
                    <Text style={styles.dailySalesDate}>{item.date.toLocaleDateString('id-ID')}</Text>
                    <View style={styles.dailySalesValues}>
                      <Text style={styles.dailySalesQuantity}>{item.quantity} produk</Text>
                      <Text style={styles.dailySalesAmount}>{formatCurrency(item.amount)}</Text>
                    </View>
                  </View>
                )}
                showsVerticalScrollIndicator={false}
              />
            </View>
          )}
        </View>

        {/* History List */}
        <View style={styles.section}>
          <View style={styles.historyHeader}>
            <Text style={styles.sectionTitle}>📋 Riwayat Stock ({filteredHistory.length})</Text>
            {filteredHistory.length > 10 && (
              <TouchableOpacity 
                onPress={() => setShowAllHistory(!showAllHistory)}
                style={styles.viewAllButton}
              >
                <Text style={styles.viewAllText}>
                  {showAllHistory ? 'Tampilkan Sedikit' : 'Lihat Semua'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          
          {filteredHistory.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={48} color="#C7C7CC" />
              <Text style={styles.emptyTitle}>Belum ada riwayat</Text>
              <Text style={styles.emptySubtitle}>
                {selectedPeriod === 'all' 
                  ? 'Riwayat perubahan stock akan muncul di sini'
                  : 'Tidak ada riwayat pada periode yang dipilih'
                }
              </Text>
            </View>
          ) : (
            <FlatList
              data={showAllHistory ? filteredHistory : filteredHistory.slice(0, 10)}
              keyExtractor={(item) => item.id}
              renderItem={renderHistoryItem}
              showsVerticalScrollIndicator={false}
              scrollEnabled={false}
              contentContainerStyle={styles.listContainer}
            />
          )}
        </View>
      </ScrollView>

      {/* Custom Date Modal */}
      <Modal
        visible={showCustomDateModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCustomDateModal(false)}>
              <Text style={styles.modalCancelText}>Batal</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Pilih Periode</Text>
            <TouchableOpacity onPress={handleCustomDateApply}>
              <Text style={styles.modalSaveText}>Terapkan</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.modalContent}>
            <View style={styles.dateSection}>
              <Text style={styles.dateLabel}>Tanggal Mulai</Text>
              <TouchableOpacity 
                style={styles.dateButton}
                onPress={() => {
                  setDatePickerMode('start');
                  setShowDatePicker(true);
                }}
              >
                <Ionicons name="calendar-outline" size={20} color="#007AFF" />
                <Text style={styles.dateButtonText}>
                  {startDate.toLocaleDateString('id-ID')}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.dateSection}>
              <Text style={styles.dateLabel}>Tanggal Akhir</Text>
              <TouchableOpacity 
                style={styles.dateButton}
                onPress={() => {
                  setDatePickerMode('end');
                  setShowDatePicker(true);
                }}
              >
                <Ionicons name="calendar-outline" size={20} color="#007AFF" />
                <Text style={styles.dateButtonText}>
                  {endDate.toLocaleDateString('id-ID')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Date Picker */}
      {showDatePicker && (
        <DateTimePicker
          value={datePickerMode === 'start' ? startDate : endDate}
          mode="date"
          display="default"
          onChange={onDateChange}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6c757d',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
  },
  refreshButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
    marginLeft: 4,
  },
  productInfo: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  productName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#212529',
    marginBottom: 12,
  },
  productDetails: {
    gap: 8,
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6c757d',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 16,
    color: '#212529',
    fontWeight: '600',
  },
  
  // Period Filter Styles
  periodFilterContainer: {
    marginBottom: 8,
  },
  periodFilterContent: {
    paddingHorizontal: 4,
    gap: 8,
  },
  periodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
    backgroundColor: '#ffffff',
  },
  activePeriodButton: {
    backgroundColor: '#007AFF',
  },
  periodButtonText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  activePeriodButtonText: {
    color: '#ffffff',
  },

  // Statistics Styles
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statsCard: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
  },
  statsCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statsCardTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6c757d',
    marginLeft: 6,
  },
  statsCardValue: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  statsCardSubtitle: {
    fontSize: 10,
    color: '#6c757d',
  },
  maxSalesDayContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#34C759',
  },
  maxSalesDayTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6c757d',
    marginBottom: 4,
  },
  maxSalesDayDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212529',
  },
  maxSalesDayValue: {
    fontSize: 14,
    color: '#212529',
    marginTop: 2,
  },
  dailySalesContainer: {
    marginTop: 8,
  },
  dailySalesTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6c757d',
    marginBottom: 8,
  },
  dailySalesItem: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  dailySalesDate: {
    fontSize: 12,
    color: '#6c757d',
    marginBottom: 6,
  },
  dailySalesValues: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dailySalesQuantity: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212529',
  },
  dailySalesAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#34C759',
  },

  // History Styles
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  viewAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#007AFF',
    borderRadius: 16,
  },
  viewAllText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '600',
  },
  listContainer: {
    paddingBottom: 16,
  },
  historyCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  typeLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  dateText: {
    fontSize: 12,
    color: '#6c757d',
  },
  quantitySection: {
    marginBottom: 8,
  },
  quantityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  quantityLabel: {
    fontSize: 14,
    color: '#6c757d',
  },
  quantityValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  stockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stockLabel: {
    fontSize: 14,
    color: '#6c757d',
  },
  stockValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212529',
  },
  reasonSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  reasonLabel: {
    fontSize: 12,
    color: '#6c757d',
    fontWeight: '600',
    marginBottom: 2,
  },
  reasonText: {
    fontSize: 14,
    color: '#212529',
  },
  notesSection: {
    marginTop: 4,
  },
  notesLabel: {
    fontSize: 12,
    color: '#6c757d',
    fontWeight: '600',
    marginBottom: 2,
  },
  notesText: {
    fontSize: 14,
    color: '#495057',
    fontStyle: 'italic',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6c757d',
    marginTop: 12,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#adb5bd',
    textAlign: 'center',
    lineHeight: 20,
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212529',
  },
  modalCancelText: {
    fontSize: 16,
    color: '#6c757d',
  },
  modalSaveText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  modalContent: {
    padding: 16,
  },
  dateSection: {
    marginBottom: 24,
  },
  dateLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 8,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  dateButtonText: {
    fontSize: 16,
    color: '#212529',
    marginLeft: 8,
  },
});
