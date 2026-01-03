import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../context/AuthContext';
import { getSalesAnalytics, getSalesPerformance } from '../services/salesSupabase';

const { width } = Dimensions.get('window');

export default function SalesAnalyticsScreen({ navigation, route }) {
  const { user } = useAuth();
  const { type = 'sales', period: initialPeriod = 'today' } = route.params || {};
  
  const [selectedPeriod, setSelectedPeriod] = useState(initialPeriod);
  const [analytics, setAnalytics] = useState(null);
  const [performanceData, setPerformanceData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customDateRange, setCustomDateRange] = useState({
    startDate: new Date(),
    endDate: new Date()
  });
  
  // Date Picker State
  const [tempDateRange, setTempDateRange] = useState({
    startDate: new Date(),
    endDate: new Date()
  });
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState('start'); // 'start' or 'end'

  const periods = [
    { key: 'today', label: 'Hari Ini', icon: 'today-outline', color: '#34C759' },
    { key: 'yesterday', label: 'Kemarin', icon: 'time-outline', color: '#8E8E93' },
    { key: 'week', label: 'Minggu Ini', icon: 'calendar-outline', color: '#007AFF' },
    { key: 'month', label: 'Bulan Ini', icon: 'calendar-number-outline', color: '#FF9500' },
    { key: 'year', label: 'Tahun Ini', icon: 'calendar-clear-outline', color: '#5856D6' },
    { key: 'custom', label: 'Kustom', icon: 'options-outline', color: '#FF3B30' }
  ];

  const loadAnalytics = async (period, customRange = null) => {
    try {
      setLoading(true);
      console.log('📊 SalesAnalyticsScreen: Loading analytics for period:', period);
      
      const result = await getSalesAnalytics(user?.id, period, customRange);
      if (result.success) {
        setAnalytics(result.data);
        console.log('✅ SalesAnalyticsScreen: Analytics loaded:', result.data);
      } else {
        console.error('❌ SalesAnalyticsScreen: Error loading analytics:', result.error);
        Alert.alert('Error', 'Gagal memuat data analytics: ' + result.error);
      }

      // Load performance data (last 10 days)
      const perfResult = await getSalesPerformance(user?.id);
      if (perfResult.success) {
        setPerformanceData(perfResult.data);
      }

    } catch (error) {
      console.error('❌ SalesAnalyticsScreen: Exception loading analytics:', error);
      Alert.alert('Error', 'Terjadi kesalahan saat memuat data analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      if (selectedPeriod === 'custom' && customDateRange.startDate && customDateRange.endDate) {
        loadAnalytics(selectedPeriod, customDateRange);
      } else if (selectedPeriod !== 'custom') {
        loadAnalytics(selectedPeriod);
      }
    }
  }, [user?.id, selectedPeriod, customDateRange]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  const formatNumber = (number) => {
    return new Intl.NumberFormat('id-ID').format(number || 0);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const getPeriodLabel = (period) => {
    const periodObj = periods.find(p => p.key === period);
    return periodObj ? periodObj.label : 'Periode';
  };

  const getMainValue = () => {
    if (!analytics) return formatCurrency(0);
    return type === 'sales' ? formatCurrency(analytics.total) : formatCurrency(analytics.profit);
  };

  const getMainTitle = () => {
    return type === 'sales' ? 'Total Penjualan' : 'Total Profit';
  };

  const handlePeriodChange = (period) => {
    setSelectedPeriod(period);
    if (period === 'custom') {
      setShowDatePicker(true);
    }
  };

  const getDateRangeText = () => {
    if (selectedPeriod === 'custom' && customDateRange.startDate && customDateRange.endDate) {
      return `${formatDate(customDateRange.startDate)} - ${formatDate(customDateRange.endDate)}`;
    }
    return getPeriodLabel(selectedPeriod);
  };

  const PeriodButton = ({ period, isSelected, onPress }) => {
    const periodData = periods.find(p => p.key === period);
    return (
      <TouchableOpacity
        style={[
          styles.periodButton, 
          isSelected && [styles.periodButtonActive, { backgroundColor: periodData?.color || '#007AFF' }]
        ]}
        onPress={onPress}
      >
        <Ionicons 
          name={periodData?.icon || 'calendar-outline'} 
          size={18} 
          color={isSelected ? '#FFFFFF' : periodData?.color || '#007AFF'} 
        />
        <Text style={[
          styles.periodButtonText, 
          isSelected && styles.periodButtonTextActive,
          !isSelected && { color: periodData?.color || '#007AFF' }
        ]}>
          {periodData?.label || period}
        </Text>
      </TouchableOpacity>
    );
  };

  const StatCard = ({ title, value, subtitle, icon, color, percentage }) => (
    <View style={styles.statItem}>
      <View style={styles.statItemHeader}>
        <Ionicons name={icon} size={16} color={color} />
        <Text style={styles.statItemTitle}>{title}</Text>
      </View>
      <Text style={[styles.statItemValue, { color }]}>{value}</Text>
      {subtitle && <Text style={styles.statItemSubtitle}>{subtitle}</Text>}
      {percentage !== undefined && (
        <View style={styles.percentageContainer}>
          <Ionicons 
            name={percentage >= 0 ? 'trending-up' : 'trending-down'} 
            size={12} 
            color={percentage >= 0 ? '#34C759' : '#FF3B30'} 
          />
          <Text style={[
            styles.percentageText,
            { color: percentage >= 0 ? '#34C759' : '#FF3B30' }
          ]}>
            {Math.abs(percentage).toFixed(1)}%
          </Text>
        </View>
      )}
    </View>
  );

  const onDateChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
        setShowPicker(false);
    }
    
    if (selectedDate) {
      if (pickerMode === 'start') {
        setTempDateRange(prev => ({ ...prev, startDate: selectedDate }));
      } else {
        setTempDateRange(prev => ({ ...prev, endDate: selectedDate }));
      }
    }
  };

  const applyCustomDate = () => {
    setCustomDateRange(tempDateRange);
    setShowDatePicker(false);
  };

  const DatePickerModal = () => (
    <Modal
      visible={showDatePicker}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowDatePicker(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Pilih Rentang Tanggal</Text>
            <TouchableOpacity 
              onPress={() => setShowDatePicker(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color="#8E8E93" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.datePickerContent}>
             <View style={styles.dateInputsRow}>
                <TouchableOpacity 
                    style={styles.dateInput} 
                    onPress={() => {
                        setPickerMode('start');
                        setShowPicker(true);
                    }}
                >
                    <Text style={styles.dateLabel}>Mulai Dari</Text>
                    <Text style={styles.dateValue}>{formatDate(tempDateRange.startDate)}</Text>
                </TouchableOpacity>
                <Ionicons name="arrow-forward" size={20} color="#8E8E93" />
                <TouchableOpacity 
                    style={styles.dateInput}
                    onPress={() => {
                        setPickerMode('end');
                        setShowPicker(true);
                    }}
                >
                    <Text style={styles.dateLabel}>Sampai</Text>
                    <Text style={styles.dateValue}>{formatDate(tempDateRange.endDate)}</Text>
                </TouchableOpacity>
             </View>

            {showPicker && (
                <DateTimePicker
                    value={pickerMode === 'start' ? tempDateRange.startDate : tempDateRange.endDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={onDateChange}
                />
            )}
            
            <TouchableOpacity 
              style={[styles.modalButton, { marginTop: 20 }]}
              onPress={applyCustomDate}
            >
              <Text style={styles.modalButtonText}>Terapkan</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#000000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Analytics {type === 'sales' ? 'Penjualan' : 'Profit'}</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Memuat data analytics...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Analytics {type === 'sales' ? 'Penjualan' : 'Profit'}</Text>
        <TouchableOpacity onPress={() => loadAnalytics(selectedPeriod, selectedPeriod === 'custom' ? customDateRange : null)}>
          <Ionicons name="refresh" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Period Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Periode</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.periodContainer}>
            {periods.map((period) => (
              <PeriodButton
                key={period.key}
                period={period.key}
                isSelected={selectedPeriod === period.key}
                onPress={() => handlePeriodChange(period.key)}
              />
            ))}
          </ScrollView>
        </View>

        {analytics ? (
          <>
            {/* Main Statistics */}
            <View style={styles.section}>
              <View style={styles.mainStatCard}>
                <Text style={styles.mainStatTitle}>{getMainTitle()}</Text>
                <Text style={styles.mainStatSubtitle}>{getDateRangeText()}</Text>
                <Text style={styles.mainStatValue}>{getMainValue()}</Text>
                <Text style={styles.mainStatTransactions}>
                  {formatNumber(analytics.transactions)} transaksi
                </Text>
              </View>
            </View>

            {/* Detailed Statistics */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Detail Statistik</Text>
              
              <View style={styles.statsGrid}>
                <StatCard
                  title="Rata-rata"
                  value={formatCurrency(analytics.average)}
                  subtitle="per transaksi"
                  icon="calculator-outline"
                  color="#34C759"
                />
                <StatCard
                  title="Tertinggi"
                  value={formatCurrency(analytics.highest)}
                  subtitle="transaksi terbesar"
                  icon="trending-up-outline"
                  color="#FF9500"
                />
              </View>

              <View style={styles.statsGrid}>
                <StatCard
                  title="Terendah"
                  value={formatCurrency(analytics.lowest)}
                  subtitle="transaksi terkecil"
                  icon="trending-down-outline"
                  color="#FF3B30"
                />
                <StatCard
                  title="Total Transaksi"
                  value={formatNumber(analytics.transactions)}
                  subtitle="jumlah penjualan"
                  icon="receipt-outline"
                  color="#5856D6"
                />
              </View>

              {type === 'sales' && (
                <View style={styles.statsGrid}>
                  <StatCard
                    title="Total Profit"
                    value={formatCurrency(analytics.profit)}
                    subtitle="keuntungan bersih"
                    icon="cash-outline"
                    color="#32D74B"
                  />
                  <StatCard
                    title="Margin Profit"
                    value={analytics.total > 0 ? `${((analytics.profit / analytics.total) * 100).toFixed(1)}%` : '0%'}
                    subtitle="persentase profit"
                    icon="pie-chart-outline"
                    color="#007AFF"
                  />
                </View>
              )}
            </View>

            {/* Performance Insights */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Insight Performa</Text>
              <View style={styles.insightCard}>
                <View style={styles.insightItem}>
                  <Ionicons name="analytics-outline" size={20} color="#007AFF" />
                  <View style={styles.insightContent}>
                    <Text style={styles.insightTitle}>Performa {getPeriodLabel(selectedPeriod)}</Text>
                    <Text style={styles.insightText}>
                      {analytics.transactions > 0 
                        ? `Anda telah melakukan ${formatNumber(analytics.transactions)} transaksi dengan total ${getMainValue()}.`
                        : 'Belum ada transaksi pada periode ini.'
                      }
                    </Text>
                  </View>
                </View>
                
                {analytics.transactions > 0 && (
                  <View style={styles.insightItem}>
                    <Ionicons name="bulb-outline" size={20} color="#FF9500" />
                    <View style={styles.insightContent}>
                      <Text style={styles.insightTitle}>Rekomendasi</Text>
                      <Text style={styles.insightText}>
                        {analytics.average > 100000 
                          ? 'Performa penjualan sangat baik! Pertahankan strategi yang ada.'
                          : 'Coba tingkatkan nilai rata-rata transaksi dengan cross-selling atau upselling.'
                        }
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              {/* 10 Hari Terakhir */}
              <View style={[styles.insightCard, { marginTop: 12 }]}>
                 <Text style={[styles.insightTitle, { marginBottom: 12 }]}>10 Hari Terakhir</Text>
                 {performanceData.length > 0 ? (
                    performanceData.map((item, index) => (
                        <View key={index} style={{ 
                            flexDirection: 'row', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            paddingVertical: 12,
                            borderBottomWidth: index < performanceData.length - 1 ? 1 : 0,
                            borderBottomColor: '#F2F2F7'
                        }}>
                            <View>
                                <Text style={{ fontWeight: '500', fontSize: 14 }}>{item.dayName}, {item.fullDate}</Text>
                                <Text style={{ fontSize: 12, color: '#8E8E93', marginTop: 2 }}>{item.transactions} Transaksi</Text>
                            </View>
                            <Text style={{ 
                                fontWeight: '600', 
                                fontSize: 14,
                                color: type === 'sales' ? '#007AFF' : '#34C759' 
                            }}>
                                {formatCurrency(type === 'sales' ? item.totalSales : item.totalProfit)}
                            </Text>
                        </View>
                    ))
                 ) : (
                    <Text style={{ textAlign: 'center', color: '#8E8E93', marginVertical: 10 }}>Belum ada data</Text>
                 )}
              </View>
            </View>
          </>
        ) : (
          <View style={styles.section}>
            <View style={styles.emptyState}>
              <Ionicons name="analytics-outline" size={48} color="#8E8E93" />
              <Text style={styles.emptyStateTitle}>Tidak Ada Data</Text>
              <Text style={styles.emptyStateText}>
                Belum ada data {type === 'sales' ? 'penjualan' : 'profit'} untuk periode {getPeriodLabel(selectedPeriod).toLowerCase()}.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      <DatePickerModal />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 12,
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  periodContainer: {
    flexDirection: 'row',
  },
  periodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  periodButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  periodButtonText: {
    fontSize: 14,
    color: '#007AFF',
    marginLeft: 6,
    fontWeight: '500',
  },
  periodButtonTextActive: {
    color: '#FFFFFF',
  },
  mainStatCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  mainStatTitle: {
    fontSize: 16,
    color: '#8E8E93',
    marginBottom: 4,
  },
  mainStatSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 12,
  },
  mainStatValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 8,
  },
  mainStatTransactions: {
    fontSize: 14,
    color: '#8E8E93',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statItem: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 6,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statItemTitle: {
    fontSize: 12,
    color: '#8E8E93',
    marginLeft: 6,
    fontWeight: '500',
  },
  statItemValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  statItemSubtitle: {
    fontSize: 11,
    color: '#8E8E93',
    marginTop: 2,
  },
  percentageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  percentageText: {
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 2,
  },
  insightCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  insightContent: {
    flex: 1,
    marginLeft: 12,
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  insightText: {
    fontSize: 13,
    color: '#8E8E93',
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  closeButton: {
    padding: 4,
  },
  datePickerContent: {
    padding: 20,
  },
  dateInputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  dateInput: {
    flex: 1,
    padding: 12,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  dateLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 4,
  },
  dateValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  datePickerNote: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  modalButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginTop: 20,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});