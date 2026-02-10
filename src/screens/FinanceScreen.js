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
  ActivityIndicator,
  Switch
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { 
  getPersonalAccounts, 
  createPersonalAccount, 
  updatePersonalAccount, 
  deletePersonalAccount,
  getPersonalTransactions,
  recordPersonalTransaction,
  updatePersonalTransaction,
  deletePersonalTransaction
} from '../services/financeSupabase';
import { formatCurrency } from '../utils/currency';
import { Colors, Spacing, Shadows, Radii } from '../theme';

export default function FinanceScreen({ navigation }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  
  const [activeTab, setActiveTab] = useState('transactions'); // 'transactions', 'channels'
  const [channels, setChannels] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal States
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showChannelModal, setShowChannelModal] = useState(false);

  // Form States
  const [trxType, setTrxType] = useState('expense'); // 'income', 'expense'
  const [trxAmount, setTrxAmount] = useState('');
  const [trxCategory, setTrxCategory] = useState('');
  const [trxDescription, setTrxDescription] = useState('');
  const [trxChannelId, setTrxChannelId] = useState(null);
  
  const [channelName, setChannelName] = useState('');
  const [channelType, setChannelType] = useState('digital');
  const [channelDescription, setChannelDescription] = useState('');
  const [initialBalance, setInitialBalance] = useState('');
  const [editingChannel, setEditingChannel] = useState(null);
  
  const [saving, setSaving] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());

  // Helper: Format number with thousand separator
  const formatNumberInput = (value) => {
    if (!value) return '';
    const cleanValue = String(value).replace(/\D/g, '');
    return cleanValue.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  const parseNumberInput = (formattedValue) => {
    if (!formattedValue) return '';
    return formattedValue.replace(/\./g, '');
  };

  // Date Helpers
  const getStartOfMonth = (date) => {
    const d = new Date(date.getFullYear(), date.getMonth(), 1);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  };

  const getEndOfMonth = (date) => {
    const d = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    d.setHours(23, 59, 59, 999);
    return d.toISOString();
  };

  const changeMonth = (delta) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + delta);
    setCurrentDate(newDate);
  };

  // Render Header with Month Selector and Summary
  const renderHeader = () => {
    const monthYear = currentDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    
    // Calculate Monthly Summary
    const totalIncome = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0);
      
    const totalExpense = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const balance = totalIncome - totalExpense;

    return (
      <View style={styles.headerContainer}>
        {/* Month Selector */}
        <View style={styles.monthSelector}>
          <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.monthNavBtn}>
            <Ionicons name="chevron-back" size={24} color={Colors.primary} />
          </TouchableOpacity>
          <Text style={styles.monthTitle}>{monthYear}</Text>
          <TouchableOpacity onPress={() => changeMonth(1)} style={styles.monthNavBtn}>
            <Ionicons name="chevron-forward" size={24} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Monthly Summary */}
        {activeTab === 'transactions' && (
          <View style={styles.summaryContainer}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Pemasukan</Text>
              <Text style={[styles.summaryValue, { color: '#4CAF50' }]}>{formatCurrency(totalIncome)}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Pengeluaran</Text>
              <Text style={[styles.summaryValue, { color: '#F44336' }]}>{formatCurrency(totalExpense)}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Selisih</Text>
              <Text style={[styles.summaryValue, { color: balance >= 0 ? '#4CAF50' : '#F44336' }]}>
                {formatCurrency(balance)}
              </Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  const loadData = async () => {
    setLoading(true);
    await Promise.all([loadChannels(), loadTransactions()]);
    setLoading(false);
  };

  const loadChannels = async () => {
    const result = await getPersonalAccounts();
    if (result.success) {
      setChannels(result.data);
      // Set default channel for transaction form if not set
      if (!trxChannelId && result.data.length > 0) {
        setTrxChannelId(result.data[0].id);
      }
    }
  };

  const loadTransactions = async () => {
    const startDate = getStartOfMonth(currentDate);
    const endDate = getEndOfMonth(currentDate);
    
    // Get all transactions for the month (limit set high to catch all)
    const result = await getPersonalTransactions(null, 2000, startDate, endDate);
    if (result.success) {
      setTransactions(result.data);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadChannels(), loadTransactions()]);
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [currentDate])
  );

  // --- Transaction Handlers ---
  
  const handleAddTransaction = () => {
    setEditingTransaction(null);
    setTrxType('expense');
    setTrxAmount('');
    setTrxCategory('');
    setTrxDescription('');
    // Keep last used channel or default
    if (!trxChannelId && channels.length > 0) {
      setTrxChannelId(channels[0].id);
    }
    setShowTransactionModal(true);
  };

  const handleEditTransaction = (trx) => {
    setEditingTransaction(trx);
    setTrxType(trx.type);
    setTrxAmount(formatNumberInput(trx.amount));
    setTrxCategory(trx.category);
    setTrxDescription(trx.description || '');
    setTrxChannelId(trx.account_id);
    setShowTransactionModal(true);
  };

  const handleDeleteTransaction = (trx) => {
    Alert.alert(
      'Hapus Transaksi',
      'Yakin ingin menghapus transaksi ini? Saldo akan dikembalikan.',
      [
        { text: 'Batal', style: 'cancel' },
        { 
          text: 'Hapus', 
          style: 'destructive', 
          onPress: async () => {
            setLoading(true);
            const res = await deletePersonalTransaction(trx.id);
            setLoading(false);
            
            if (res.success) {
              showToast('Transaksi dihapus', 'success');
              onRefresh();
            } else {
              showToast(res.error || 'Gagal menghapus', 'error');
            }
          }
        }
      ]
    );
  };

  const submitTransaction = async () => {
    const rawAmount = parseNumberInput(trxAmount);
    
    if (!rawAmount || !trxChannelId || !trxCategory) {
      showToast('Mohon lengkapi jumlah, kategori, dan rekening', 'error');
      return;
    }

    setSaving(true);
    
    let result;
    if (editingTransaction) {
      result = await updatePersonalTransaction(editingTransaction.id, {
        account_id: trxChannelId,
        type: trxType,
        amount: rawAmount,
        category: trxCategory,
        description: trxDescription
      });
    } else {
      result = await recordPersonalTransaction({
        account_id: trxChannelId,
        type: trxType,
        amount: rawAmount,
        category: trxCategory,
        description: trxDescription
      });
    }

    setSaving(false);
    
    if (result.success) {
      showToast(editingTransaction ? 'Transaksi diperbarui' : 'Transaksi berhasil dicatat', 'success');
      setShowTransactionModal(false);
      onRefresh();
    } else {
      showToast(result.error || 'Gagal menyimpan transaksi', 'error');
    }
  };

  // --- Channel Handlers ---

  const handleAddChannel = () => {
    setEditingChannel(null);
    setChannelName('');
    setChannelType('digital');
    setChannelDescription('');
    setInitialBalance('');
    setShowChannelModal(true);
  };

  const handleEditChannel = (channel) => {
    setEditingChannel(channel);
    setChannelName(channel.name);
    setChannelType(channel.type);
    setChannelDescription(channel.description || '');
    setInitialBalance(formatNumberInput(channel.balance));
    setShowChannelModal(true);
  };

  const handleDeleteChannel = (channel) => {
    Alert.alert('Hapus Rekening', `Yakin ingin menghapus ${channel.name}?`, [
      { text: 'Batal', style: 'cancel' },
      { 
        text: 'Hapus', 
        style: 'destructive', 
        onPress: async () => {
          const res = await deletePersonalAccount(channel.id);
          if (res.success) {
            showToast('Rekening dihapus', 'success');
            loadChannels();
          } else {
            showToast(res.error, 'error');
          }
        }
      }
    ]);
  };

  const submitChannel = async () => {
    if (!channelName) {
      showToast('Nama rekening harus diisi', 'error');
      return;
    }

    setSaving(true);
    let result;
    if (editingChannel) {
      result = await updatePersonalAccount(editingChannel.id, {
        name: channelName,
        type: channelType,
        description: channelDescription,
        balance: parseNumberInput(initialBalance)
      });
    } else {
      result = await createPersonalAccount({
        name: channelName,
        type: channelType,
        description: channelDescription,
        initialBalance: parseFloat(parseNumberInput(initialBalance)) || 0
      });
    }
    setSaving(false);

    if (result.success) {
      showToast('Rekening berhasil disimpan', 'success');
      setShowChannelModal(false);
      loadChannels();
    } else {
      showToast(result.error, 'error');
    }
  };

  // --- Renderers ---

  const renderTransactionItem = ({ item }) => (
    <View style={styles.trxItemWrapper}>
      <TouchableOpacity 
        style={styles.trxContent}
        onPress={() => handleEditTransaction(item)}
      >
        <View style={[styles.trxIcon, { backgroundColor: item.type === 'income' ? '#E8F5E9' : '#FFEBEE' }]}>
          <Ionicons 
            name={item.type === 'income' ? 'arrow-down' : 'arrow-up'} 
            size={20} 
            color={item.type === 'income' ? '#4CAF50' : '#F44336'} 
          />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.trxCategory}>{item.category}</Text>
          <Text style={styles.trxDesc} numberOfLines={1}>
            {item.description || item.personal_accounts?.name || '-'}
          </Text>
          <Text style={styles.trxDate}>
            {new Date(item.transaction_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
        <Text style={[styles.trxAmount, { color: item.type === 'income' ? '#4CAF50' : '#F44336' }]}>
          {item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount)}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.deleteAction}
        onPress={() => handleDeleteTransaction(item)}
      >
        <Ionicons name="trash-outline" size={20} color="#FF5252" />
      </TouchableOpacity>
    </View>
  );

  const renderChannelItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.channelItem}
      onPress={() => handleEditChannel(item)}
      onLongPress={() => handleDeleteChannel(item)}
    >
      <View style={[styles.channelIcon, { backgroundColor: item.type === 'cash' ? '#FFF3E0' : '#E3F2FD' }]}>
        <Ionicons 
          name={item.type === 'cash' ? 'cash' : 'card'} 
          size={24} 
          color={item.type === 'cash' ? '#FF9800' : '#2196F3'} 
        />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={styles.channelName}>{item.name}</Text>
        <Text style={styles.channelDesc}>{item.description || item.type}</Text>
      </View>
      <Text style={styles.channelBalance}>{formatCurrency(item.balance)}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      {renderHeader()}
      
      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'transactions' && styles.activeTab]}
          onPress={() => setActiveTab('transactions')}
        >
          <Text style={[styles.tabText, activeTab === 'transactions' && styles.activeTabText]}>Transaksi</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'channels' && styles.activeTab]}
          onPress={() => setActiveTab('channels')}
        >
          <Text style={[styles.tabText, activeTab === 'channels' && styles.activeTabText]}>Rekening</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 20 }} />
      ) : (
        <>
          {activeTab === 'transactions' ? (
            <FlatList
              data={transactions}
              renderItem={renderTransactionItem}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.listContent}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Ionicons name="receipt-outline" size={48} color="#ccc" />
                  <Text style={styles.emptyText}>Belum ada transaksi</Text>
                </View>
              }
            />
          ) : (
            <FlatList
              data={channels}
              renderItem={renderChannelItem}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.listContent}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Ionicons name="wallet-outline" size={48} color="#ccc" />
                  <Text style={styles.emptyText}>Belum ada rekening</Text>
                </View>
              }
            />
          )}
        </>
      )}

      {/* FAB */}
      <TouchableOpacity 
        style={styles.fab}
        onPress={activeTab === 'transactions' ? handleAddTransaction : handleAddChannel}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Add Transaction Modal */}
      <Modal visible={showTransactionModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingTransaction ? 'Edit Transaksi' : 'Catat Transaksi'}</Text>
              <TouchableOpacity onPress={() => setShowTransactionModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody}>
              {/* Type Switch */}
              <View style={styles.typeSelector}>
                <TouchableOpacity 
                  style={[styles.typeBtn, trxType === 'expense' && styles.expenseBtn]}
                  onPress={() => setTrxType('expense')}
                >
                  <Text style={[styles.typeText, trxType === 'expense' && { color: '#fff' }]}>Pengeluaran</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.typeBtn, trxType === 'income' && styles.incomeBtn]}
                  onPress={() => setTrxType('income')}
                >
                  <Text style={[styles.typeText, trxType === 'income' && { color: '#fff' }]}>Pemasukan</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Jumlah (Rp)</Text>
              <TextInput
                style={styles.input}
                value={trxAmount}
                onChangeText={(text) => setTrxAmount(formatNumberInput(text))}
                keyboardType="numeric"
                placeholder="0"
              />

              <Text style={styles.label}>Rekening</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipContainer}>
                {channels.map(ch => (
                  <TouchableOpacity
                    key={ch.id}
                    style={[styles.chip, trxChannelId === ch.id && styles.activeChip]}
                    onPress={() => setTrxChannelId(ch.id)}
                  >
                    <Text style={[styles.chipText, trxChannelId === ch.id && styles.activeChipText]}>{ch.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.label}>Kategori</Text>
              <View style={styles.categoryChips}>
                {['Penjualan', 'Gaji', 'Listrik', 'Sewa', 'Lainnya'].map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.smallChip, trxCategory === cat && styles.activeSmallChip]}
                    onPress={() => setTrxCategory(cat)}
                  >
                    <Text style={[styles.smallChipText, trxCategory === cat && styles.activeSmallChipText]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={[styles.input, { marginTop: 8 }]}
                value={trxCategory}
                onChangeText={setTrxCategory}
                placeholder="Ketik kategori lain..."
              />

              <Text style={styles.label}>Deskripsi (Opsional)</Text>
              <TextInput
                style={styles.input}
                value={trxDescription}
                onChangeText={setTrxDescription}
                placeholder="Catatan..."
              />

              <TouchableOpacity 
                style={[styles.submitBtn, saving && styles.disabledBtn]}
                onPress={submitTransaction}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Simpan</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Add Channel Modal */}
      <Modal visible={showChannelModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingChannel ? 'Edit Rekening' : 'Tambah Rekening'}</Text>
              <TouchableOpacity onPress={() => setShowChannelModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalBody}>
              <Text style={styles.label}>Nama Rekening</Text>
              <TextInput
                style={styles.input}
                value={channelName}
                onChangeText={setChannelName}
                placeholder="Contoh: BCA, Kasir Utama"
              />

              <Text style={styles.label}>Tipe</Text>
              <View style={styles.row}>
                <TouchableOpacity 
                  style={[styles.radioBtn, channelType === 'digital' && styles.radioActive]}
                  onPress={() => setChannelType('digital')}
                >
                  <Text style={channelType === 'digital' ? styles.radioTextActive : styles.radioText}>Digital/Bank</Text>
                </TouchableOpacity>
                <View style={{ width: 10 }} />
                <TouchableOpacity 
                  style={[styles.radioBtn, channelType === 'cash' && styles.radioActive]}
                  onPress={() => setChannelType('cash')}
                >
                  <Text style={channelType === 'cash' ? styles.radioTextActive : styles.radioText}>Tunai</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Saldo {editingChannel ? 'Saat Ini' : 'Awal'}</Text>
              <TextInput
                style={styles.input}
                value={initialBalance}
                onChangeText={(text) => setInitialBalance(formatNumberInput(text))}
                keyboardType="numeric"
                placeholder="0"
              />

              <TouchableOpacity 
                style={[styles.submitBtn, saving && styles.disabledBtn]}
                onPress={submitChannel}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Simpan</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  headerContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 16,
    ...Shadows.sm,
    zIndex: 10,
  },
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  monthNavBtn: {
    padding: 8,
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginTop: 4,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  summaryDivider: {
    width: 1,
    backgroundColor: '#E0E0E0',
    height: 30,
    alignSelf: 'center',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 4,
    margin: 16,
    borderRadius: 12,
    ...Shadows.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontWeight: '600',
    color: '#666',
  },
  activeTabText: {
    color: '#fff',
  },
  listContent: {
    padding: 16,
    paddingBottom: 80,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyText: {
    color: '#999',
    marginTop: 10,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.md,
  },
  
  // Transaction Item
  trxItemWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginBottom: 10,
    borderRadius: 12,
    ...Shadows.sm,
    overflow: 'hidden',
  },
  trxContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  deleteAction: {
    width: 50,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    borderLeftWidth: 1,
    borderLeftColor: '#FFCDD2',
  },
  trxIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trxCategory: {
    fontWeight: '600',
    color: '#333',
  },
  trxDesc: {
    fontSize: 12,
    color: '#777',
    marginTop: 2,
  },
  trxDate: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
  },
  trxAmount: {
    fontWeight: '700',
  },

  // Channel Item
  channelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 10,
    borderRadius: 12,
    ...Shadows.sm,
  },
  channelIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  channelName: {
    fontWeight: '600',
    fontSize: 16,
    color: '#333',
  },
  channelDesc: {
    fontSize: 12,
    color: '#777',
  },
  channelBalance: {
    fontWeight: '700',
    fontSize: 16,
    color: Colors.primary,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalBody: {
    padding: 20,
  },
  label: {
    fontWeight: '600',
    color: '#444',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#F5F7FA',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    fontSize: 16,
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 20,
  },
  disabledBtn: {
    opacity: 0.7,
  },
  submitBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },

  // Type Selector
  typeSelector: {
    flexDirection: 'row',
    backgroundColor: '#F5F7FA',
    padding: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  expenseBtn: {
    backgroundColor: '#F44336',
  },
  incomeBtn: {
    backgroundColor: '#4CAF50',
  },
  typeText: {
    fontWeight: '600',
    color: '#666',
  },

  // Chips
  chipContainer: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
    marginRight: 8,
  },
  activeChip: {
    backgroundColor: Colors.primary,
  },
  chipText: {
    color: '#555',
  },
  activeChipText: {
    color: '#fff',
  },
  categoryChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  smallChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
    marginRight: 8,
    marginBottom: 8,
  },
  activeSmallChip: {
    backgroundColor: Colors.secondary,
  },
  smallChipText: {
    fontSize: 12,
    color: '#555',
  },
  activeSmallChipText: {
    color: '#fff',
  },
  row: {
    flexDirection: 'row',
  },
  radioBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  radioActive: {
    borderColor: Colors.primary,
    backgroundColor: '#E3F2FD',
  },
  radioText: {
    color: '#666',
  },
  radioTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
});
