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
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { useAuth } from '../context/AuthContext';
import { getSalesAnalytics, getSalesPerformance } from '../services/salesSupabase';

// Setup Indonesian Locale for Calendar
LocaleConfig.locales['id'] = {
  monthNames: [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ],
  monthNamesShort: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],
  dayNames: ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'],
  dayNamesShort: ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'],
  today: 'Hari ini'
};
LocaleConfig.defaultLocale = 'id';

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
  
  // Chart Date Range (defaults to last 10 days)
  const defaultChartStart = new Date();
  defaultChartStart.setDate(defaultChartStart.getDate() - 10);
  const [chartDateRange, setChartDateRange] = useState({
    startDate: defaultChartStart,
    endDate: new Date()
  });
  const [datePickerTarget, setDatePickerTarget] = useState('global'); // 'global' or 'chart'

  // Date Picker State
  const [markedDates, setMarkedDates] = useState({});
  const [tempDateRange, setTempDateRange] = useState({
    startDate: new Date(),
    endDate: new Date()
  });

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

    } catch (error) {
      console.error('❌ SalesAnalyticsScreen: Exception loading analytics:', error);
      Alert.alert('Error', 'Terjadi kesalahan saat memuat data analytics');
    } finally {
      setLoading(false);
    }
  };

  const loadPerformanceData = async (start, end) => {
    try {
      const perfResult = await getSalesPerformance(user?.id, start, end);
      if (perfResult.success) {
        setPerformanceData(perfResult.data);
      }
    } catch (error) {
        console.error('❌ SalesAnalyticsScreen: Error loading performance:', error);
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

  useEffect(() => {
      if (user?.id) {
          loadPerformanceData(chartDateRange.startDate, chartDateRange.endDate);
      }
  }, [user?.id, chartDateRange]);

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
      // Initialize temp range with current custom range or today
      const start = customDateRange.startDate || new Date();
      const end = customDateRange.endDate || new Date();
      
      // Initial marking
      updateMarkedDates(start, end);
      setTempDateRange({
        startDate: start,
        endDate: end
      });
      
      setDatePickerTarget('global');
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

  const onDayPress = (day) => {
    const selectedDate = new Date(day.timestamp);
    
    // Logic for range selection
    if (!tempDateRange.startDate || (tempDateRange.startDate && tempDateRange.endDate)) {
      // Start new selection
      setTempDateRange({
        startDate: selectedDate,
        endDate: null
      });
      updateMarkedDates(selectedDate, null);
    } else if (tempDateRange.startDate && !tempDateRange.endDate) {
      // Complete selection
      let start = tempDateRange.startDate;
      let end = selectedDate;
      
      // Swap if end is before start
      if (end < start) {
        const temp = start;
        start = end;
        end = temp;
      }
      
      setTempDateRange({
        startDate: start,
        endDate: end
      });
      updateMarkedDates(start, end);
    }
  };

  const updateMarkedDates = (start, end) => {
    const marked = {};
    
    if (start) {
      const startStr = start.toISOString().split('T')[0];
      marked[startStr] = { startingDay: true, color: '#007AFF', textColor: 'white' };
      
      if (end) {
        const endStr = end.toISOString().split('T')[0];
        let curr = new Date(start);
        curr.setDate(curr.getDate() + 1);
        
        while (curr < end) {
          const dateStr = curr.toISOString().split('T')[0];
          marked[dateStr] = { color: '#70d7c7', textColor: 'white' }; // lighter color for range
          curr.setDate(curr.getDate() + 1);
        }
        
        marked[endStr] = { endingDay: true, color: '#007AFF', textColor: 'white' };
        
        // Handle single day range
        if (startStr === endStr) {
           marked[startStr] = { startingDay: true, endingDay: true, color: '#007AFF', textColor: 'white' };
        }
      } else {
         marked[startStr] = { startingDay: true, endingDay: true, color: '#007AFF', textColor: 'white' };
      }
    }
    setMarkedDates(marked);
  };

  const applyCustomDate = () => {
    if (tempDateRange.startDate && tempDateRange.endDate) {
        if (datePickerTarget === 'chart') {
            setChartDateRange({
                startDate: tempDateRange.startDate,
                endDate: tempDateRange.endDate
            });
        } else {
            setCustomDateRange(tempDateRange);
            // Also update selected period to custom if we are in global mode
            if (selectedPeriod !== 'custom') {
                setSelectedPeriod('custom');
            }
        }
        setShowDatePicker(false);
    } else {
        Alert.alert('Pilih Tanggal', 'Silakan pilih tanggal mulai dan selesai.');
    }
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
                <View style={styles.dateInput}>
                    <Text style={styles.dateLabel}>Mulai Dari</Text>
                    <Text style={styles.dateValue}>
                        {tempDateRange.startDate ? formatDate(tempDateRange.startDate) : '-'}
                    </Text>
                </View>
                <Ionicons name="arrow-forward" size={20} color="#8E8E93" />
                <View style={styles.dateInput}>
                    <Text style={styles.dateLabel}>Sampai</Text>
                    <Text style={styles.dateValue}>
                        {tempDateRange.endDate ? formatDate(tempDateRange.endDate) : '-'}
                    </Text>
                </View>
             </View>

            <Calendar
                markingType={'period'}
                markedDates={markedDates}
                onDayPress={onDayPress}
                theme={{
                  todayTextColor: '#007AFF',
                  arrowColor: '#007AFF',
                  selectedDayBackgroundColor: '#007AFF',
                  selectedDayTextColor: '#ffffff',
                }}
            />
            
            <TouchableOpacity 
              style={[
                  styles.modalButton, 
                  { marginTop: 20 },
                  (!tempDateRange.startDate || !tempDateRange.endDate) && { backgroundColor: '#ccc' }
              ]}
              onPress={applyCustomDate}
              disabled={!tempDateRange.startDate || !tempDateRange.endDate}
            >
              <Text style={styles.modalButtonText}>Terapkan Filter</Text>
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

              {/* Performance List */}
              <View style={[styles.insightCard, { marginTop: 12 }]}>
                 <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <Text style={styles.insightTitle}>
                        {chartDateRange.startDate && chartDateRange.endDate 
                            ? `${formatDate(chartDateRange.startDate)} - ${formatDate(chartDateRange.endDate)}`
                            : 'Riwayat Performa'}
                    </Text>
                    <TouchableOpacity onPress={() => {
                        // Initialize temp range with current chart range
                        const start = chartDateRange.startDate || new Date();
                        const end = chartDateRange.endDate || new Date();
                        
                        updateMarkedDates(start, end);
                        setTempDateRange({ startDate: start, endDate: end });
                        setDatePickerTarget('chart');
                        setShowDatePicker(true);
                    }}>
                        <Ionicons name="calendar-outline" size={20} color="#007AFF" />
                    </TouchableOpacity>
                 </View>
                 
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
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                                    <Text style={{ fontSize: 12, color: '#8E8E93', marginRight: 6 }}>{item.transactions} Transaksi</Text>
                                    {/* Trend Indicator */}
                                    {item.trend !== 'stable' && (
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <Ionicons 
                                                name={item.trend === 'up' ? 'arrow-up' : 'arrow-down'} 
                                                size={10} 
                                                color={item.trend === 'up' ? '#34C759' : '#FF3B30'} 
                                            />
                                            <Text style={{ 
                                                fontSize: 10, 
                                                color: item.trend === 'up' ? '#34C759' : '#FF3B30',
                                                marginLeft: 2
                                            }}>
                                                {Math.abs(item.growth).toFixed(1)}%
                                            </Text>
                                        </View>
                                    )}
                                </View>
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