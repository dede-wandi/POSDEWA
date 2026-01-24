import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  FlatList,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { 
  getPaymentChannels, 
  createPaymentChannel, 
  updatePaymentChannel, 
  deletePaymentChannel,
  getFinanceTransactions,
  adjustChannelBalance
} from '../services/financeSupabase';
import { formatDate } from '../utils/helpers';

export default function FinanceScreen({ navigation }) {
  const { user } = useAuth();
  const [paymentChannels, setPaymentChannels] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('channels'); // 'channels' or 'transactions'
  
  // Date filter states
  const [showDateFilterModal, setShowDateFilterModal] = useState(false);
  const [dateFilter, setDateFilter] = useState('all'); // 'all', 'today', 'week', 'month', 'year', 'custom'
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  
  // Modal states
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showAdjustBalanceModal, setShowAdjustBalanceModal] = useState(false);
  const [editingChannel, setEditingChannel] = useState(null);
  const [selectedChannel, setSelectedChannel] = useState(null);
  
  // Form states
  const [channelName, setChannelName] = useState('');
  const [channelType, setChannelType] = useState('digital');
  const [channelDescription, setChannelDescription] = useState('');
  const [initialBalance, setInitialBalance] = useState('');
  const [newBalance, setNewBalance] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [saving, setSaving] = useState(false);

  // Load data
  const loadChannels = async () => {
    try {
      const result = await getPaymentChannels();
      if (result.success) {
        setPaymentChannels(result.data);
      } else {
        console.error('Error loading channels:', result.error);
      }
    } catch (error) {
      console.error('Exception loading channels:', error);
    }
  };

  const loadTransactions = async (channelId) => {
    if (!channelId) return;
    
    try {
      const result = await getFinanceTransactions(channelId);
      if (result.success) {
        setTransactions(result.data);
      } else {
        console.error('Error loading transactions:', result.error);
      }
    } catch (error) {
      console.error('Exception loading transactions:', error);
    }
  };

  const loadData = async () => {
    setLoading(true);
    await loadChannels();
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    if (selectedChannel) {
      await loadTransactions(selectedChannel.id);
    }
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  // Channel management functions
  const handleCreateChannel = () => {
    setEditingChannel(null);
    resetChannelForm();
    setShowChannelModal(true);
  };

  const handleEditChannel = (channel) => {
    setEditingChannel(channel);
    setChannelName(channel.name);
    setChannelType(channel.type);
    setChannelDescription(channel.description || '');
    setInitialBalance('');
    setShowChannelModal(true);
  };

  const handleDeleteChannel = (channel) => {
    Alert.alert(
      'Hapus Channel',
      `Apakah Anda yakin ingin menghapus channel "${channel.name}"?`,
      [
        { text: 'Batal', style: 'cancel' },
        { 
          text: 'Hapus', 
          style: 'destructive',
          onPress: () => deleteChannel(channel.id)
        }
      ]
    );
  };

  const handleAdjustBalance = (channel) => {
    setSelectedChannel(channel);
    setNewBalance(channel.balance.toString());
    setAdjustmentReason('');
    setShowAdjustBalanceModal(true);
  };

  const resetChannelForm = () => {
    setChannelName('');
    setChannelType('digital');
    setChannelDescription('');
    setInitialBalance('');
  };

  const submitChannel = async () => {
    if (!channelName.trim()) {
      showToast('Nama channel harus diisi', 'error');
      return;
    }

    setSaving(true);
    try {
      let result;
      
      if (editingChannel) {
        // Update existing channel
        result = await updatePaymentChannel(editingChannel.id, {
          name: channelName,
          type: channelType,
          description: channelDescription
        });
      } else {
        // Create new channel
        const balance = parseFloat(initialBalance) || 0;
        result = await createPaymentChannel({
          name: channelName,
          type: channelType,
          description: channelDescription,
          initialBalance: balance
        });
      }

      if (result.success) {
        showToast(editingChannel ? 'Channel berhasil diperbarui' : 'Channel berhasil dibuat', 'success');
        setShowChannelModal(false);
        resetChannelForm();
        loadChannels();
      } else {
        showToast(result.error || 'Gagal menyimpan channel', 'error');
      }
    } catch (error) {
      console.error('Error saving channel:', error);
      showToast('Terjadi kesalahan saat menyimpan channel', 'error');
    } finally {
      setSaving(false);
    }
  };

  const deleteChannel = async (channelId) => {
    try {
      const result = await deletePaymentChannel(channelId);
      if (result.success) {
        showToast('Channel berhasil dihapus', 'success');
        loadChannels();
      } else {
        showToast(result.error || 'Gagal menghapus channel', 'error');
      }
    } catch (error) {
      console.error('Error deleting channel:', error);
      showToast('Terjadi kesalahan saat menghapus channel', 'error');
    }
  };

  const submitBalanceAdjustment = async () => {
    if (!newBalance.trim() || !adjustmentReason.trim()) {
      showToast('Saldo baru dan alasan harus diisi', 'error');
      return;
    }

    const balance = parseFloat(newBalance);
    if (isNaN(balance) || balance < 0) {
      showToast('Saldo harus berupa angka positif', 'error');
      return;
    }

    setSaving(true);
    try {
      const result = await adjustChannelBalance(selectedChannel.id, balance, adjustmentReason);
      if (result.success) {
        showToast('Saldo berhasil disesuaikan', 'success');
        setShowAdjustBalanceModal(false);
        loadChannels();
        if (selectedChannel) {
          loadTransactions(selectedChannel.id);
        }
      } else {
        showToast(result.error || 'Gagal menyesuaikan saldo', 'error');
      }
    } catch (error) {
      console.error('Error adjusting balance:', error);
      showToast('Terjadi kesalahan saat menyesuaikan saldo', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Helper functions
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getChannelTypeIcon = (type) => {
    switch (type) {
      case 'cash': return 'cash';
      case 'bank': return 'card';
      case 'digital': return 'phone-portrait';
      default: return 'wallet';
    }
  };

  const getChannelTypeColor = (type) => {
    switch (type) {
      case 'cash': return '#34C759';
      case 'bank': return '#007AFF';
      case 'digital': return '#FF9500';
      default: return '#8E8E93';
    }
  };

  const getTransactionTypeIcon = (type) => {
    switch (type) {
      case 'income': return 'arrow-down';
      case 'expense': return 'arrow-up';
      case 'adjustment': return 'swap-horizontal';
      default: return 'help';
    }
  };

  const getTransactionTypeColor = (type) => {
    switch (type) {
      case 'income': return '#34C759';
      case 'expense': return '#FF3B30';
      case 'adjustment': return '#FF9500';
      default: return '#8E8E93';
    }
  };

  // Render components
  const ChannelItem = ({ item }) => (
    <View style={styles.channelItem}>
      <View style={styles.channelHeader}>
        <View style={styles.channelInfo}>
          <View style={styles.channelTitleRow}>
            <Ionicons 
              name={getChannelTypeIcon(item.type)} 
              size={24} 
              color={getChannelTypeColor(item.type)} 
            />
            <Text style={styles.channelName}>{item.name}</Text>
          </View>
          <Text style={styles.channelType}>{item.type.toUpperCase()}</Text>
          {item.description && (
            <Text style={styles.channelDescription}>{item.description}</Text>
          )}
        </View>
        <View style={styles.channelActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.editButton]}
            onPress={() => handleEditChannel(item)}
          >
            <Ionicons name="pencil" size={16} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => handleDeleteChannel(item)}
          >
            <Ionicons name="trash" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
      
      <View style={styles.channelBalance}>
        <Text style={styles.balanceLabel}>Saldo:</Text>
        <Text style={styles.balanceAmount}>{formatCurrency(item.balance)}</Text>
      </View>
      
      <View style={styles.channelFooter}>
        <TouchableOpacity
          style={styles.adjustButton}
          onPress={() => handleAdjustBalance(item)}
        >
          <Ionicons name="settings" size={16} color="#007AFF" />
          <Text style={styles.adjustButtonText}>Sesuaikan Saldo</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.historyButton}
          onPress={() => {
            setSelectedChannel(item);
            setActiveTab('transactions');
            loadTransactions(item.id);
          }}
        >
          <Ionicons name="time" size={16} color="#007AFF" />
          <Text style={styles.historyButtonText}>Riwayat</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const TransactionItem = ({ item }) => (
    <View style={styles.transactionItem}>
      <View style={styles.transactionHeader}>
        <View style={styles.transactionTypeContainer}>
          <Ionicons 
            name={getTransactionTypeIcon(item.type)} 
            size={20} 
            color={getTransactionTypeColor(item.type)} 
          />
          <Text style={[styles.transactionType, { color: getTransactionTypeColor(item.type) }]}>
            {item.type === 'income' ? 'Pemasukan' : 
             item.type === 'expense' ? 'Pengeluaran' : 'Penyesuaian'}
          </Text>
        </View>
        <Text style={styles.transactionDate}>
          {new Date(item.created_at).toLocaleDateString('id-ID')}
        </Text>
      </View>
      
      <Text style={styles.transactionDescription}>{item.description}</Text>
      
      <View style={styles.transactionAmounts}>
        <Text style={styles.transactionAmount}>
          {item.type === 'income' ? '+' : item.type === 'expense' ? '-' : '±'}
          {formatCurrency(item.amount)}
        </Text>
        <Text style={styles.transactionBalance}>
          Saldo: {formatCurrency(item.new_balance)}
        </Text>
      </View>
    </View>
  );

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

  const applyDateFilter = (transactionList) => {
    if (dateFilter === 'all') {
      return transactionList;
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    return transactionList.filter(transaction => {
      const transactionDate = new Date(transaction.created_at);
      
      switch (dateFilter) {
        case 'today':
          return transactionDate >= today;
        
        case 'week':
          const weekStart = new Date(today);
          weekStart.setDate(today.getDate() - today.getDay());
          return transactionDate >= weekStart;
        
        case 'month':
          const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
          return transactionDate >= monthStart;
        
        case 'year':
          const yearStart = new Date(today.getFullYear(), 0, 1);
          return transactionDate >= yearStart;
        
        case 'custom':
          if (customStartDate && customEndDate) {
            const startDate = new Date(customStartDate);
            const endDate = new Date(customEndDate);
            endDate.setHours(23, 59, 59, 999); // Include the entire end date
            return transactionDate >= startDate && transactionDate <= endDate;
          }
          return true;
        
        default:
          return true;
      }
    });
  };

  const handleDateFilterChange = (newFilter) => {
    setDateFilter(newFilter);
    if (newFilter !== 'custom') {
      setCustomStartDate('');
      setCustomEndDate('');
    }
  };

  const applyDateFilterAndClose = () => {
    const filtered = applyDateFilter(transactions);
    setFilteredTransactions(filtered);
    setShowDateFilterModal(false);
  };

  // Apply date filter when transactions or filter settings change
  useEffect(() => {
    if (transactions.length > 0) {
      const filtered = applyDateFilter(transactions);
      setFilteredTransactions(filtered);
    }
  }, [transactions, dateFilter, customStartDate, customEndDate]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Memuat data keuangan...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Keuangan</Text>
        <View style={styles.headerActions}>
          {activeTab === 'channels' && (
            <>
              <TouchableOpacity
                style={styles.historyReportButton}
                onPress={() => navigation.navigate('TransactionHistory')}
              >
                <Ionicons name="analytics" size={20} color="#007AFF" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.historyReportButton}
                onPress={() => navigation.navigate('TransactionReport')}
              >
                <Ionicons name="bar-chart" size={20} color="#007AFF" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.addButton}
                onPress={handleCreateChannel}
              >
                <Ionicons name="add" size={24} color="#007AFF" />
              </TouchableOpacity>
            </>
          )}
          {activeTab === 'transactions' && (
            <>
              <TouchableOpacity
                style={styles.filterButton}
                onPress={() => setShowDateFilterModal(true)}
              >
                <Ionicons name="filter" size={20} color="#007AFF" />
                <Text style={styles.filterButtonText}>{getDateFilterLabel()}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => {
                  setActiveTab('channels');
                  setSelectedChannel(null);
                  setTransactions([]);
                  setFilteredTransactions([]);
                }}
              >
                <Ionicons name="arrow-back" size={24} color="#007AFF" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'channels' && styles.activeTab]}
          onPress={() => {
            setActiveTab('channels');
            setSelectedChannel(null);
            setTransactions([]);
            setFilteredTransactions([]);
          }}
        >
          <Text style={[styles.tabText, activeTab === 'channels' && styles.activeTabText]}>
            Channel Pembayaran
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'transactions' && styles.activeTab]}
          onPress={() => setActiveTab('transactions')}
          disabled={!selectedChannel}
        >
          <Text style={[
            styles.tabText, 
            activeTab === 'transactions' && styles.activeTabText,
            !selectedChannel && styles.disabledTabText
          ]}>
            Riwayat Transaksi
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {activeTab === 'channels' ? (
          paymentChannels.length > 0 ? (
            <FlatList
              data={paymentChannels}
              renderItem={({ item }) => <ChannelItem item={item} />}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="wallet-outline" size={64} color="#C7C7CC" />
              <Text style={styles.emptyStateTitle}>Belum Ada Channel Pembayaran</Text>
              <Text style={styles.emptyStateText}>
                Tambahkan channel pembayaran untuk mengelola keuangan Anda
              </Text>
              <TouchableOpacity
                style={styles.emptyStateButton}
                onPress={handleCreateChannel}
              >
                <Text style={styles.emptyStateButtonText}>Tambah Channel</Text>
              </TouchableOpacity>
            </View>
          )
        ) : (
          <View>
            {selectedChannel && (
              <View style={styles.selectedChannelInfo}>
                <Text style={styles.selectedChannelName}>{selectedChannel.name}</Text>
                <Text style={styles.selectedChannelBalance}>
                  Saldo: {formatCurrency(selectedChannel.balance)}
                </Text>
              </View>
            )}
            
            {/* Filter Info */}
            {activeTab === 'transactions' && dateFilter !== 'all' && (
              <View style={styles.filterInfo}>
                <Text style={styles.filterInfoText}>
                  Filter: {getDateFilterLabel()} ({filteredTransactions.length} transaksi)
                </Text>
              </View>
            )}
            
            {filteredTransactions.length > 0 ? (
              <FlatList
                data={filteredTransactions}
                renderItem={({ item }) => <TransactionItem item={item} />}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                showsVerticalScrollIndicator={false}
              />
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="receipt-outline" size={64} color="#C7C7CC" />
                <Text style={styles.emptyStateTitle}>
                  {dateFilter !== 'all' ? 'Tidak Ada Transaksi' : 'Belum Ada Transaksi'}
                </Text>
                <Text style={styles.emptyStateText}>
                  {dateFilter !== 'all' 
                    ? 'Tidak ada transaksi yang sesuai dengan filter tanggal yang dipilih'
                    : 'Transaksi akan muncul di sini setelah Anda melakukan penjualan atau penyesuaian saldo'
                  }
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Channel Modal */}
      <Modal
        visible={showChannelModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => {
              setShowChannelModal(false);
              resetChannelForm();
            }}>
              <Text style={styles.modalCancelText}>Batal</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingChannel ? 'Edit Channel' : 'Tambah Channel'}
            </Text>
            <TouchableOpacity 
              onPress={submitChannel}
              disabled={!channelName.trim() || saving}
            >
              <Text style={[
                styles.modalSaveText,
                (!channelName.trim() || saving) && styles.disabledText
              ]}>
                {saving ? 'Menyimpan...' : 'Simpan'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nama Channel *</Text>
              <TextInput
                style={styles.textInput}
                value={channelName}
                onChangeText={setChannelName}
                placeholder="Contoh: Channel Digipos"
                autoFocus
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Tipe Channel</Text>
              <View style={styles.typeContainer}>
                {[
                  { key: 'cash', label: 'Tunai', icon: 'cash' },
                  { key: 'digital', label: 'Digital', icon: 'phone-portrait' },
                  { key: 'bank', label: 'Bank', icon: 'card' }
                ].map((type) => (
                  <TouchableOpacity
                    key={type.key}
                    style={[
                      styles.typeButton,
                      channelType === type.key && styles.activeTypeButton
                    ]}
                    onPress={() => setChannelType(type.key)}
                  >
                    <Ionicons 
                      name={type.icon} 
                      size={20} 
                      color={channelType === type.key ? '#FFFFFF' : '#007AFF'} 
                    />
                    <Text style={[
                      styles.typeButtonText,
                      channelType === type.key && styles.activeTypeButtonText
                    ]}>
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {!editingChannel && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Saldo Awal</Text>
                <TextInput
                  style={styles.textInput}
                  value={initialBalance}
                  onChangeText={setInitialBalance}
                  placeholder="0"
                  keyboardType="numeric"
                />
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Deskripsi</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={channelDescription}
                onChangeText={setChannelDescription}
                placeholder="Deskripsi channel (opsional)"
                multiline
                numberOfLines={3}
              />
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Balance Adjustment Modal */}
      <Modal
        visible={showAdjustBalanceModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAdjustBalanceModal(false)}>
              <Text style={styles.modalCancelText}>Batal</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Sesuaikan Saldo</Text>
            <TouchableOpacity 
              onPress={submitBalanceAdjustment}
              disabled={!newBalance.trim() || !adjustmentReason.trim() || saving}
            >
              <Text style={[
                styles.modalSaveText,
                (!newBalance.trim() || !adjustmentReason.trim() || saving) && styles.disabledText
              ]}>
                {saving ? 'Menyimpan...' : 'Sesuaikan'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {selectedChannel && (
              <View style={styles.selectedChannelInfo}>
                <Text style={styles.selectedChannelName}>{selectedChannel.name}</Text>
                <Text style={styles.selectedChannelBalance}>
                  Saldo saat ini: {formatCurrency(selectedChannel.balance)}
                </Text>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Saldo Baru *</Text>
              <TextInput
                style={styles.textInput}
                value={newBalance}
                onChangeText={setNewBalance}
                placeholder="Masukkan saldo baru"
                keyboardType="numeric"
                autoFocus
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Alasan Penyesuaian *</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={adjustmentReason}
                onChangeText={setAdjustmentReason}
                placeholder="Alasan penyesuaian saldo"
                multiline
                numberOfLines={3}
              />
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

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
                  <TextInput
                    style={styles.textInput}
                    value={customStartDate}
                    onChangeText={setCustomStartDate}
                    placeholder="YYYY-MM-DD"
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Tanggal Akhir</Text>
                  <TextInput
                    style={styles.textInput}
                    value={customEndDate}
                    onChangeText={setCustomEndDate}
                    placeholder="YYYY-MM-DD"
                  />
                </View>
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
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historyReportButton: {
    padding: 8,
  },
  addButton: {
    padding: 8,
  },
  backButton: {
    padding: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 16,
    color: '#8E8E93',
  },
  activeTabText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  disabledTabText: {
    color: '#C7C7CC',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  channelItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  channelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  channelInfo: {
    flex: 1,
  },
  channelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  channelName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginLeft: 8,
  },
  channelType: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
    marginBottom: 4,
  },
  channelDescription: {
    fontSize: 14,
    color: '#8E8E93',
  },
  channelActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: '#007AFF',
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
  },
  channelBalance: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  balanceLabel: {
    fontSize: 16,
    color: '#8E8E93',
  },
  balanceAmount: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  channelFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  adjustButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
  },
  adjustButtonText: {
    fontSize: 14,
    color: '#007AFF',
    marginLeft: 4,
  },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
  },
  historyButtonText: {
    fontSize: 14,
    color: '#007AFF',
    marginLeft: 4,
  },
  transactionItem: {
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
    color: '#000000',
  },
  transactionBalance: {
    fontSize: 14,
    color: '#8E8E93',
  },
  selectedChannelInfo: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  selectedChannelName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  selectedChannelBalance: {
    fontSize: 14,
    color: '#8E8E93',
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
    marginBottom: 24,
    paddingHorizontal: 40,
  },
  emptyStateButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyStateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
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
  disabledText: {
    color: '#C7C7CC',
  },
  modalContent: {
    flex: 1,
    padding: 20,
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
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  typeContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
  },
  activeTypeButton: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    marginLeft: 6,
  },
  activeTypeButtonText: {
    color: '#FFFFFF',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    marginRight: 8,
  },
  filterButtonText: {
    fontSize: 14,
    color: '#007AFF',
    marginLeft: 4,
    fontWeight: '500',
  },
  filterInfo: {
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  filterInfoText: {
    fontSize: 14,
    color: '#1976D2',
    fontWeight: '500',
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
});