import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Dimensions,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext';
import { getTransactionReport } from '../services/financeSupabase';
import { getSalesAnalytics } from '../services/salesSupabase';
import { formatCurrency, formatDate } from '../utils/helpers';

const { width } = Dimensions.get('window');

export default function TransactionReportScreen({ navigation }) {
  const { user } = useAuth();
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Date filter states
  const [showDateFilterModal, setShowDateFilterModal] = useState(false);
  const [dateFilter, setDateFilter] = useState('month'); // 'all', 'today', 'week', 'month', 'year', 'custom'
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  
  // Summary data
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [topPaymentChannel, setTopPaymentChannel] = useState(null);
  const [salesTotal, setSalesTotal] = useState(0);
  const [salesProfit, setSalesProfit] = useState(0);
  const [salesTransactions, setSalesTransactions] = useState(0);

  // Date filter helper functions
  const getDateFilterLabel = () => {
    switch (dateFilter) {
      case 'today': return 'Hari Ini';
      case 'week': return 'Minggu Ini';
      case 'month': return 'Bulan Ini';
      case 'year': return 'Tahun Ini';
      case 'custom': return 'Custom';
      default: return 'Semua';
    }
  };

  const getDateRange = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (dateFilter) {
      case 'today':
        return { startDate: today, endDate: new Date() };
      
      case 'week':
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        return { startDate: weekStart, endDate: new Date() };
      
      case 'month':
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        return { startDate: monthStart, endDate: new Date() };
      
      case 'year':
        const yearStart = new Date(today.getFullYear(), 0, 1);
        return { startDate: yearStart, endDate: new Date() };
      
      case 'custom':
        if (customStartDate && customEndDate) {
          const startDate = new Date(customStartDate);
          const endDate = new Date(customEndDate);
          endDate.setHours(23, 59, 59, 999);
          return { startDate, endDate };
        }
        return null;
      
      default:
        return null;
    }
  };

  const handleDateFilterChange = (newFilter) => {
    setDateFilter(newFilter);
    if (newFilter !== 'custom') {
      setCustomStartDate('');
      setCustomEndDate('');
    }
  };

  const getFilterDescription = () => {
    const baseLabel = getDateFilterLabel();
    const range = getDateRange();
    if (!range || dateFilter === 'all') {
      return baseLabel;
    }
    return `${baseLabel} (${formatDate(range.startDate)} - ${formatDate(range.endDate)})`;
  };

  const applyDateFilterAndClose = () => {
    setShowDateFilterModal(false);
    if (dateFilter === 'custom' && (!customStartDate || !customEndDate)) {
      setReportData([]);
      setTotalTransactions(0);
      setTotalAmount(0);
      setTopPaymentChannel(null);
      setSalesTotal(0);
      setSalesProfit(0);
      setSalesTransactions(0);
      return;
    }
    loadReportData();
  };

  const loadReportData = async () => {
    try {
      setLoading(true);
      const dateRange = getDateRange();
      const data = await getTransactionReport(user.id, dateRange);
      
      setReportData(data.channelData || []);
      setTotalTransactions(data.totalTransactions || 0);
      setTotalAmount(data.totalAmount || 0);
      setTopPaymentChannel(data.topChannel || null);

      const salesPeriod = dateFilter === 'all' ? 'year' : dateFilter;
      const customRange = dateFilter === 'custom' && dateRange ? { startDate: dateRange.startDate, endDate: dateRange.endDate } : null;
      const analytics = await getSalesAnalytics(user.id, salesPeriod, customRange);
      if (analytics?.success && analytics.data) {
        setSalesTotal(analytics.data.total || 0);
        setSalesProfit(analytics.data.profit || 0);
        setSalesTransactions(analytics.data.transactions || 0);
      } else {
        setSalesTotal(0);
        setSalesProfit(0);
        setSalesTransactions(0);
      }
    } catch (error) {
      console.error('Error loading report data:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = async () => {
    if (reportData.length === 0) {
      alert('Tidak ada data untuk diekspor');
      return;
    }

    setLoading(true);
    try {
      // Prepare data
      const dataToExport = reportData.map((item, index) => ({
        'No': index + 1,
        'Channel': item.channel_name,
        'Tipe': item.channel_type,
        'Jumlah Transaksi': item.transaction_count,
        'Total Nominal': item.total_amount,
        'Persentase': getPercentage(item.total_amount) + '%'
      }));

      // Add summary
      dataToExport.push({});
      dataToExport.push({
        'Channel': 'TOTAL',
        'Jumlah Transaksi': totalTransactions,
        'Total Nominal': totalAmount
      });
      
      const fileName = `Laporan_Transaksi_${new Date().getTime()}.xlsx`;

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Laporan Transaksi");

      if (Platform.OS === 'web') {
        XLSX.writeFile(wb, fileName);
        setLoading(false);
        return;
      }

      const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      // Use cacheDirectory for temporary files
      const uri = FileSystem.cacheDirectory + fileName;

      await FileSystem.writeAsStringAsync(uri, wbout, {
        encoding: FileSystem.EncodingType.Base64
      });

      if (!(await Sharing.isAvailableAsync())) {
        alert('Fitur sharing tidak tersedia di perangkat ini');
        return;
      }

      await Sharing.shareAsync(uri, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: 'Download Laporan Transaksi',
        UTI: 'com.microsoft.excel.xlsx'
      });

    } catch (error) {
      console.error('Export Error:', error);
      alert('Gagal mengekspor data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadReportData();
    setRefreshing(false);
  };

  useEffect(() => {
    loadReportData();
  }, [dateFilter, customStartDate, customEndDate]);

  const getChannelIcon = (channelType) => {
    switch (channelType?.toLowerCase()) {
      case 'cash': return 'cash-outline';
      case 'digital': return 'card-outline';
      case 'bank': return 'business-outline';
      default: return 'wallet-outline';
    }
  };

  const getPercentage = (amount) => {
    if (totalAmount === 0) return 0;
    return ((amount / totalAmount) * 100).toFixed(1);
  };

  const ChannelReportItem = ({ item, index }) => (
    <View style={styles.reportItem}>
      <View style={styles.reportItemHeader}>
        <View style={styles.channelInfo}>
          <View style={styles.rankContainer}>
            <Text style={styles.rankText}>#{index + 1}</Text>
          </View>
          <View style={styles.channelIconContainer}>
            <Ionicons 
              name={getChannelIcon(item.channel_type)} 
              size={24} 
              color="#007AFF" 
            />
          </View>
          <View style={styles.channelDetails}>
            <Text style={styles.channelName}>{item.channel_name}</Text>
            <Text style={styles.channelType}>
              {item.channel_type === 'cash' ? 'Tunai' : 
               item.channel_type === 'digital' ? 'Digital' : 'Bank'}
            </Text>
          </View>
        </View>
      </View>
      
      <View style={styles.reportStats}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Transaksi</Text>
          <Text style={styles.statValue}>{item.transaction_count}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Total</Text>
          <Text style={styles.statValue}>{formatCurrency(item.total_amount)}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Persentase</Text>
          <Text style={styles.statValue}>{getPercentage(item.total_amount)}%</Text>
        </View>
      </View>
      
      <View style={styles.progressBarContainer}>
        <View 
          style={[
            styles.progressBar, 
            { width: `${getPercentage(item.total_amount)}%` }
          ]} 
        />
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Memuat laporan transaksi...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Laporan Transaksi</Text>
        <View style={{ flexDirection: 'row' }}>
          <TouchableOpacity
            style={[styles.filterButton, { marginRight: 8 }]}
            onPress={exportToExcel}
          >
            <Ionicons name="download" size={20} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowDateFilterModal(true)}
          >
            <Ionicons name="filter" size={20} color="#007AFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter Info */}
      <View style={styles.filterInfo}>
        <Text style={styles.filterInfoText}>
          Periode: {getFilterDescription()}
        </Text>
      </View>

      {/* Summary Cards */}
      <View style={styles.summaryContainer}>
        <View style={styles.summaryCard}>
          <Ionicons name="cash-outline" size={24} color="#34C759" />
          <Text style={styles.summaryValue}>{formatCurrency(salesTotal)}</Text>
          <Text style={styles.summaryLabel}>Total Penjualan</Text>
        </View>
        <View style={styles.summaryCard}>
          <Ionicons name="trending-up-outline" size={24} color="#FF9500" />
          <Text style={styles.summaryValue}>{formatCurrency(salesProfit)}</Text>
          <Text style={styles.summaryLabel}>Total Profit</Text>
        </View>
        <View style={styles.summaryCard}>
          <Ionicons name="receipt-outline" size={24} color="#007AFF" />
          <Text style={styles.summaryValue}>{salesTransactions}</Text>
          <Text style={styles.summaryLabel}>Jumlah Transaksi</Text>
        </View>
      </View>

      {/* Top Channel */}
      {topPaymentChannel && (
        <View style={styles.topChannelContainer}>
          <Text style={styles.sectionTitle}>Channel Terpopuler</Text>
          <View style={styles.topChannelCard}>
            <Ionicons 
              name={getChannelIcon(topPaymentChannel.channel_type)} 
              size={32} 
              color="#FF9500" 
            />
            <View style={styles.topChannelInfo}>
              <Text style={styles.topChannelName}>{topPaymentChannel.channel_name}</Text>
              <Text style={styles.topChannelStats}>
                {topPaymentChannel.transaction_count} transaksi • {formatCurrency(topPaymentChannel.total_amount)}
              </Text>
            </View>
            <View style={styles.crownContainer}>
              <Ionicons name="trophy" size={24} color="#FF9500" />
            </View>
          </View>
        </View>
      )}

      {/* Report List */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text style={styles.sectionTitle}>Analisis Payment Channel</Text>
        
        {reportData.length > 0 ? (
          reportData.map((item, index) => (
            <ChannelReportItem key={item.channel_id} item={item} index={index} />
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="analytics-outline" size={64} color="#C7C7CC" />
            <Text style={styles.emptyStateTitle}>Tidak Ada Data</Text>
            <Text style={styles.emptyStateText}>
              Tidak ada transaksi yang sesuai dengan filter tanggal yang dipilih
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Date Filter Modal */}
      <Modal
        visible={showDateFilterModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowDateFilterModal(false)}>
              <Text style={styles.modalCancelText}>Batal</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Filter Tanggal</Text>
            <TouchableOpacity onPress={applyDateFilterAndClose}>
              <Text style={styles.modalSaveText}>Terapkan</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.filterOptionsContainer}>
              {[
                { key: 'all', label: 'Semua' },
                { key: 'today', label: 'Hari Ini' },
                { key: 'week', label: 'Minggu Ini' },
                { key: 'month', label: 'Bulan Ini' },
                { key: 'year', label: 'Tahun Ini' },
                { key: 'custom', label: 'Custom' }
              ].map((option) => (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.filterOption,
                    dateFilter === option.key && styles.activeFilterOption
                  ]}
                  onPress={() => handleDateFilterChange(option.key)}
                >
                  <Text style={[
                    styles.filterOptionText,
                    dateFilter === option.key && styles.activeFilterOptionText
                  ]}>
                    {option.label}
                  </Text>
                  {dateFilter === option.key && (
                    <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {dateFilter === 'custom' && (
              <View style={styles.customDateContainer}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Tanggal Mulai</Text>
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => setShowStartPicker(true)}
                  >
                    <Ionicons name="calendar" size={18} color="#007AFF" />
                    <Text style={styles.dateButtonText}>
                      {customStartDate || 'Pilih tanggal mulai'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Tanggal Akhir</Text>
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => setShowEndPicker(true)}
                  >
                    <Ionicons name="calendar" size={18} color="#007AFF" />
                    <Text style={styles.dateButtonText}>
                      {customEndDate || 'Pilih tanggal akhir'}
                    </Text>
                  </TouchableOpacity>
                </View>
                {showStartPicker && (
                  <DateTimePicker
                    value={customStartDate ? new Date(customStartDate) : new Date()}
                    mode="date"
                    display="default"
                    onChange={(event, date) => {
                      setShowStartPicker(false);
                      if (date) {
                        const d = new Date(date);
                        const str = d.toISOString().slice(0, 10);
                        setCustomStartDate(str);
                      }
                    }}
                  />
                )}
                {showEndPicker && (
                  <DateTimePicker
                    value={customEndDate ? new Date(customEndDate) : new Date()}
                    mode="date"
                    display="default"
                    onChange={(event, date) => {
                      setShowEndPicker(false);
                      if (date) {
                        const d = new Date(date);
                        const str = d.toISOString().slice(0, 10);
                        setCustomEndDate(str);
                      }
                    }}
                  />
                )}
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
  },
  filterButton: {
    padding: 8,
  },
  filterInfo: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  filterInfoText: {
    fontSize: 14,
    color: '#1976D2',
    fontWeight: '500',
  },
  summaryContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginTop: 8,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
  },
  topChannelContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  topChannelCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  topChannelInfo: {
    flex: 1,
    marginLeft: 12,
  },
  topChannelName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  topChannelStats: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 4,
  },
  crownContainer: {
    marginLeft: 12,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  reportItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  reportItemHeader: {
    marginBottom: 12,
  },
  channelInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rankContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  channelIconContainer: {
    marginRight: 12,
  },
  channelDetails: {
    flex: 1,
  },
  channelName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  channelType: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  reportStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: '#F2F2F7',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  modalCancelText: {
    fontSize: 16,
    color: '#007AFF',
  },
  modalSaveText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  filterOptionsContainer: {
    marginBottom: 20,
  },
  filterOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  activeFilterOption: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  filterOptionText: {
    fontSize: 16,
    color: '#000000',
    fontWeight: '500',
  },
  activeFilterOptionText: {
    color: '#FFFFFF',
  },
  customDateContainer: {
    marginTop: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
});
