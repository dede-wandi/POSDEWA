import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getFinanceTransactions, getPaymentChannels } from '../services/financeSupabase';
import { formatCurrency, formatDate } from '../utils/helpers';
import { useToast } from '../contexts/ToastContext';

const TransactionHistoryScreen = ({ navigation }) => {
  const [transactions, setTransactions] = useState([]);
  const [paymentChannels, setPaymentChannels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [dateFilter, setDateFilter] = useState('all'); // 'all', 'today', 'week', 'month', 'year', 'custom'
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  useEffect(() => {
    loadPaymentChannels();
  }, []);

  useEffect(() => {
    if (selectedChannel) {
      loadTransactions();
    }
  }, [selectedChannel, dateFilter, customStartDate, customEndDate]);

  const loadPaymentChannels = async () => {
    try {
      const result = await getPaymentChannels();
      if (result.success) {
        setPaymentChannels(result.data);
        if (result.data.length > 0) {
          setSelectedChannel(result.data[0]);
        }
      } else {
        showToast(result.error, 'error');
      }
    } catch (error) {
      showToast('Gagal memuat channel pembayaran', 'error');
    }
  };

  const loadTransactions = async () => {
    if (!selectedChannel) return;

    setLoading(true);
    try {
      const result = await getFinanceTransactions(selectedChannel.id, 1000);
      if (result.success) {
        let filteredTransactions = result.data;

        // Apply date filter
        if (dateFilter !== 'all') {
          const now = new Date();
          let startDate, endDate;

          switch (dateFilter) {
            case 'today':
              startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
              endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
              break;
            case 'week':
              const weekStart = new Date(now);
              weekStart.setDate(now.getDate() - now.getDay());
              startDate = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate());
              endDate = new Date(startDate);
              endDate.setDate(startDate.getDate() + 7);
              break;
            case 'month':
              startDate = new Date(now.getFullYear(), now.getMonth(), 1);
              endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
              break;
            case 'year':
              startDate = new Date(now.getFullYear(), 0, 1);
              endDate = new Date(now.getFullYear() + 1, 0, 1);
              break;
            case 'custom':
              if (customStartDate && customEndDate) {
                startDate = new Date(customStartDate);
                endDate = new Date(customEndDate);
                endDate.setDate(endDate.getDate() + 1); // Include end date
              }
              break;
          }

          if (startDate && endDate) {
            filteredTransactions = result.data.filter(transaction => {
              const transactionDate = new Date(transaction.created_at);
              return transactionDate >= startDate && transactionDate < endDate;
            });
          }
        }

        setTransactions(filteredTransactions);
      } else {
        showToast(result.error, 'error');
      }
    } catch (error) {
      showToast('Gagal memuat riwayat transaksi', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getTransactionStats = () => {
    const income = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    
    const expense = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const totalTransactions = transactions.length;

    return { income, expense, totalTransactions, netIncome: income - expense };
  };

  const getMostFrequentTransactionTypes = () => {
    const typeCount = {};
    transactions.forEach(transaction => {
      const key = `${transaction.type}-${transaction.description}`;
      typeCount[key] = (typeCount[key] || 0) + 1;
    });

    return Object.entries(typeCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([key, count]) => {
        const [type, description] = key.split('-');
        return { type, description, count };
      });
  };

  const renderTransactionItem = ({ item }) => (
    <View style={styles.transactionItem}>
      <View style={styles.transactionHeader}>
        <View style={styles.transactionTypeContainer}>
          <Ionicons
            name={item.type === 'income' ? 'arrow-down-circle' : 'arrow-up-circle'}
            size={20}
            color={item.type === 'income' ? '#34C759' : '#FF3B30'}
          />
          <Text style={[styles.transactionType, { 
            color: item.type === 'income' ? '#34C759' : '#FF3B30' 
          }]}>
            {item.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}
          </Text>
        </View>
        <Text style={styles.transactionDate}>
          {formatDate(item.created_at)}
        </Text>
      </View>
      
      <Text style={styles.transactionDescription}>{item.description}</Text>
      
      <View style={styles.transactionAmounts}>
        <Text style={[styles.transactionAmount, {
          color: item.type === 'income' ? '#34C759' : '#FF3B30'
        }]}>
          {item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount)}
        </Text>
        <Text style={styles.transactionBalance}>
          Saldo: {formatCurrency(item.new_balance)}
        </Text>
      </View>
    </View>
  );

  const renderFrequentTransaction = ({ item }) => (
    <View style={styles.frequentTransactionItem}>
      <View style={styles.frequentTransactionInfo}>
        <Text style={styles.frequentTransactionType}>
          {item.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}
        </Text>
        <Text style={styles.frequentTransactionDescription}>{item.description}</Text>
      </View>
      <View style={styles.frequentTransactionCount}>
        <Text style={styles.frequentTransactionCountText}>{item.count}x</Text>
      </View>
    </View>
  );

  const stats = getTransactionStats();
  const frequentTransactions = getMostFrequentTransactionTypes();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.title}>Riwayat Transaksi</Text>
        <TouchableOpacity onPress={() => setFilterModalVisible(true)}>
          <Ionicons name="filter" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Channel Selector */}
        <View style={styles.channelSelector}>
          <Text style={styles.sectionTitle}>Channel Pembayaran</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {paymentChannels.map((channel) => (
              <TouchableOpacity
                key={channel.id}
                style={[
                  styles.channelButton,
                  selectedChannel?.id === channel.id && styles.selectedChannelButton
                ]}
                onPress={() => setSelectedChannel(channel)}
              >
                <Text style={[
                  styles.channelButtonText,
                  selectedChannel?.id === channel.id && styles.selectedChannelButtonText
                ]}>
                  {channel.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Statistics */}
        <View style={styles.statsContainer}>
          <Text style={styles.sectionTitle}>Ringkasan</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Total Transaksi</Text>
              <Text style={styles.statValue}>{stats.totalTransactions}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Pemasukan</Text>
              <Text style={[styles.statValue, { color: '#34C759' }]}>
                {formatCurrency(stats.income)}
              </Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Pengeluaran</Text>
              <Text style={[styles.statValue, { color: '#FF3B30' }]}>
                {formatCurrency(stats.expense)}
              </Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Net Income</Text>
              <Text style={[styles.statValue, { 
                color: stats.netIncome >= 0 ? '#34C759' : '#FF3B30' 
              }]}>
                {formatCurrency(stats.netIncome)}
              </Text>
            </View>
          </View>
        </View>

        {/* Most Frequent Transactions */}
        {frequentTransactions.length > 0 && (
          <View style={styles.frequentContainer}>
            <Text style={styles.sectionTitle}>Transaksi Terbanyak</Text>
            <FlatList
              data={frequentTransactions}
              renderItem={renderFrequentTransaction}
              keyExtractor={(item, index) => index.toString()}
              scrollEnabled={false}
            />
          </View>
        )}

        {/* Transaction List */}
        <View style={styles.transactionsContainer}>
          <Text style={styles.sectionTitle}>
            Riwayat Transaksi ({transactions.length})
          </Text>
          {loading ? (
            <Text style={styles.loadingText}>Memuat...</Text>
          ) : transactions.length > 0 ? (
            <FlatList
              data={transactions}
              renderItem={renderTransactionItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
          ) : (
            <Text style={styles.emptyText}>Tidak ada transaksi</Text>
          )}
        </View>
      </ScrollView>

      {/* Filter Modal */}
      <Modal
        visible={filterModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter Tanggal</Text>
              <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>

            <View style={styles.filterOptions}>
              {[
                { key: 'all', label: 'Semua' },
                { key: 'today', label: 'Hari Ini' },
                { key: 'week', label: 'Minggu Ini' },
                { key: 'month', label: 'Bulan Ini' },
                { key: 'year', label: 'Tahun Ini' },
                { key: 'custom', label: 'Custom' },
              ].map((option) => (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.filterOption,
                    dateFilter === option.key && styles.selectedFilterOption
                  ]}
                  onPress={() => setDateFilter(option.key)}
                >
                  <Text style={[
                    styles.filterOptionText,
                    dateFilter === option.key && styles.selectedFilterOptionText
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {dateFilter === 'custom' && (
              <View style={styles.customDateContainer}>
                <Text style={styles.customDateLabel}>Tanggal Mulai (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.customDateInput}
                  value={customStartDate}
                  onChangeText={setCustomStartDate}
                  placeholder="2024-01-01"
                />
                <Text style={styles.customDateLabel}>Tanggal Akhir (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.customDateInput}
                  value={customEndDate}
                  onChangeText={setCustomEndDate}
                  placeholder="2024-12-31"
                />
              </View>
            )}

            <TouchableOpacity
              style={styles.applyFilterButton}
              onPress={() => setFilterModalVisible(false)}
            >
              <Text style={styles.applyFilterButtonText}>Terapkan Filter</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  channelSelector: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  channelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  selectedChannelButton: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  channelButtonText: {
    fontSize: 14,
    color: '#000000',
  },
  selectedChannelButtonText: {
    color: '#FFFFFF',
  },
  statsContainer: {
    marginBottom: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  statLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  frequentContainer: {
    marginBottom: 20,
  },
  frequentTransactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  frequentTransactionInfo: {
    flex: 1,
  },
  frequentTransactionType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  frequentTransactionDescription: {
    fontSize: 12,
    color: '#8E8E93',
  },
  frequentTransactionCount: {
    backgroundColor: '#F2F2F7',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  frequentTransactionCountText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
  },
  transactionsContainer: {
    marginBottom: 20,
  },
  transactionItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  transactionTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  transactionType: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  transactionDate: {
    fontSize: 12,
    color: '#8E8E93',
  },
  transactionDescription: {
    fontSize: 14,
    color: '#000000',
    marginBottom: 8,
  },
  transactionAmounts: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  transactionBalance: {
    fontSize: 14,
    color: '#8E8E93',
  },
  loadingText: {
    textAlign: 'center',
    color: '#8E8E93',
    fontSize: 14,
    marginTop: 20,
  },
  emptyText: {
    textAlign: 'center',
    color: '#8E8E93',
    fontSize: 14,
    marginTop: 20,
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
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  filterOptions: {
    marginBottom: 20,
  },
  filterOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    marginBottom: 8,
  },
  selectedFilterOption: {
    backgroundColor: '#007AFF',
  },
  filterOptionText: {
    fontSize: 16,
    color: '#000000',
  },
  selectedFilterOptionText: {
    color: '#FFFFFF',
  },
  customDateContainer: {
    marginBottom: 20,
  },
  customDateLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  customDateInput: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 12,
  },
  applyFilterButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  applyFilterButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default TransactionHistoryScreen;