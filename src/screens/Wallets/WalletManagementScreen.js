import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme';
import { getWallets, deleteWallet, addWallet, transferBalance, addWalletTransaction, getWalletTransactions, getUnsyncedProfits, syncPendingProfits } from '../../services/walletSupabase';
import { useNavigation } from '@react-navigation/native';
import { formatCurrency } from '../../utils/currency';

import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../contexts/ToastContext';

// Custom Wallet Picker (tidak butuh package tambahan, bekerja di Web & Native)
const WalletPicker = ({ wallets, selectedId, onSelect, highlightColor = '#4F46E5' }) => (
  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
    {wallets.map(w => {
      const isActive = selectedId === w.id;
      return (
        <TouchableOpacity
          key={w.id}
          onPress={() => onSelect(w.id)}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 6,
            paddingHorizontal: 14, paddingVertical: 10,
            borderRadius: 10, borderWidth: 1.5,
            borderColor: isActive ? highlightColor : '#E2E8F0',
            backgroundColor: isActive ? highlightColor : '#F8FAFC',
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '600', color: isActive ? '#FFF' : '#475569' }}>
            {w.name}
          </Text>
          <Text style={{ fontSize: 11, color: isActive ? 'rgba(255,255,255,0.8)' : '#94A3B8' }}>
            {formatCurrency(w.balance)}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

export default function WalletManagementScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unsyncedProfits, setUnsyncedProfits] = useState([]);
  const [isSyncingProfit, setIsSyncingProfit] = useState(false);
  const [syncProfitModalVisible, setSyncProfitModalVisible] = useState(false);
  const [syncProfitData, setSyncProfitData] = useState({ totalProfit: 0, totalTrx: 0, cashWallet: null, profitWallet: null });

  // Form State
  const [modalVisible, setModalVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [walletName, setWalletName] = useState('');
  const [walletType, setWalletType] = useState('CASH');
  const [walletBalance, setWalletBalance] = useState('');

  // Mutation Form State
  const [mutationModalVisible, setMutationModalVisible] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [mutationFromWallet, setMutationFromWallet] = useState('');
  const [mutationToWallet, setMutationToWallet] = useState('');
  const [mutationAmount, setMutationAmount] = useState('');
  const [mutationAdminFee, setMutationAdminFee] = useState('');
  const [mutationDesc, setMutationDesc] = useState('');

  // Adjustment Form State
  const [adjModalVisible, setAdjModalVisible] = useState(false);
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [adjWalletId, setAdjWalletId] = useState('');
  const [adjType, setAdjType] = useState('IN');
  const [adjAmount, setAdjAmount] = useState('');
  const [adjDesc, setAdjDesc] = useState('');
  const [adjError, setAdjError] = useState('');

  // Settle Supplier Modal State
  const [settleModalVisible, setSettleModalVisible] = useState(false);
  const [isSettling, setIsSettling] = useState(false);
  const [settleTitipanWallet, setSettleTitipanWallet] = useState(null);
  const [settleCashWalletId, setSettleCashWalletId] = useState('');
  const [settleAmount, setSettleAmount] = useState('');

  const handleSettleSupplier = async () => {
    if (!settleCashWalletId) {
      showToast('Pilih laci kasir sumber dana', 'error');
      return;
    }
    const amount = Number(settleAmount.replace(/[^0-9]/g, '')) || 0;
    if (amount <= 0) {
      showToast('Nominal harus lebih dari 0', 'error');
      return;
    }

    Alert.alert(
      "Konfirmasi Pembayaran",
      `Anda yakin akan membayarkan uang sebesar Rp ${formatCurrency(amount)} ke supplier?\n\nSaldo Laci Kasir Anda akan dipotong.`,
      [
        { text: "Batal", style: "cancel" },
        { 
          text: "Ya, Bayar Sekarang", 
          style: "destructive",
          onPress: async () => {
            setIsSettling(true);
            
            // 1. Keluarkan uang dari Laci Kasir (Fisik)
            await addWalletTransaction({
              wallet_id: settleCashWalletId,
              type: 'OUT',
              amount: amount,
              reference_type: 'ADJUSTMENT',
              description: `Bayar supplier via ${settleTitipanWallet.name}`
            });

            // 2. Turunkan hutang di dompet Titipan
            await addWalletTransaction({
              wallet_id: settleTitipanWallet.id,
              type: 'OUT',
              amount: amount,
              reference_type: 'ADJUSTMENT',
              description: `Pencairan uang ke Supplier`
            });

            setIsSettling(false);
            showToast('Pembayaran ke supplier berhasil dicatat!', 'success');
            setSettleModalVisible(false);
            setSettleAmount('');
            fetchWallets();
          }
        }
      ]
    );
  };

  // History Modal State
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [historyData, setHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedWalletForHistory, setSelectedWalletForHistory] = useState(null);

  const handleViewHistory = async (wallet) => {
    setSelectedWalletForHistory(wallet);
    setHistoryModalVisible(true);
    setHistoryLoading(true);
    const { data, error } = await getWalletTransactions(wallet.id);
    if (data) {
      setHistoryData(data);
    } else {
      showToast('Gagal memuat riwayat', 'error');
    }
    setHistoryLoading(false);
  };

  useEffect(() => {
    if (user?.id) fetchWallets();
  }, [user?.id]);

  const fetchWallets = async () => {
    setLoading(true);
    const { data, error } = await getWallets(user?.id);
    if (data) setWallets(data);
    
    // Fetch unsynced profits
    const { data: profitData } = await getUnsyncedProfits(user?.id);
    if (profitData) setUnsyncedProfits(profitData);
    
    setLoading(false);
  };

  const handleManualSyncProfit = async () => {
    let cashWallet = wallets.find(w => w.type === 'CASH');
    if (!cashWallet) cashWallet = wallets.find(w => (w.name || '').toLowerCase().includes('kasir') || (w.name || '').toLowerCase().includes('laci'));
    
    let profitWallet = wallets.find(w => w.type === 'PROFIT');
    if (!profitWallet) profitWallet = wallets.find(w => (w.name || '').toLowerCase().includes('laba') || (w.name || '').toLowerCase().includes('profit'));

    if (!cashWallet || !profitWallet) {
      showToast('Dompet Kasir atau Laba tidak ditemukan!', 'error');
      return;
    }

    const totalProfit = unsyncedProfits.reduce((sum, item) => sum + Number(item.total_profit), 0);
    const totalTrx = unsyncedProfits.reduce((sum, item) => sum + Number(item.total_transaksi), 0);

    setSyncProfitData({
      totalProfit,
      totalTrx,
      cashWallet,
      profitWallet
    });
    setSyncProfitModalVisible(true);
  };

  const executeManualSyncProfit = async () => {
    setIsSyncingProfit(true);
    const { data, error } = await syncPendingProfits(
      user?.id, 
      syncProfitData.cashWallet.id, 
      syncProfitData.profitWallet.id
    );
    setIsSyncingProfit(false);
    setSyncProfitModalVisible(false);
    
    if (data?.success) {
      showToast(`Berhasil menarik Rp ${formatCurrency(data.synced_amount)}`, 'success');
      fetchWallets();
    } else {
      showToast(data?.message || error?.message || 'Gagal menarik profit', 'error');
    }
  };

  const handleSaveWallet = async () => {
    if (!walletName.trim()) {
      Alert.alert('Error', 'Nama kas/dompet tidak boleh kosong!');
      return;
    }

    setIsSubmitting(true);
    const numericBalance = Number(walletBalance.replace(/[^0-9]/g, '')) || 0;

    const { data, error } = await addWallet({
      user_id: user?.id,
      name: walletName,
      type: walletType,
      balance: numericBalance
    });

    setIsSubmitting(false);

    if (error) {
      Alert.alert('Gagal', 'Terjadi kesalahan saat menambahkan dompet.');
    } else {
      Alert.alert('Sukses', 'Dompet berhasil ditambahkan!');
      setModalVisible(false);
      setWalletName('');
      setWalletBalance('');
      fetchWallets();
    }
  };

  const handleSaveMutation = async () => {
    if (!mutationFromWallet || !mutationToWallet) {
      Alert.alert('Error', 'Silakan pilih dompet asal dan dompet tujuan.');
      return;
    }
    if (mutationFromWallet === mutationToWallet) {
      Alert.alert('Error', 'Dompet asal dan tujuan tidak boleh sama.');
      return;
    }

    const numAmount = Number(mutationAmount.replace(/[^0-9]/g, '')) || 0;
    const numAdminFee = Number(mutationAdminFee.replace(/[^0-9]/g, '')) || 0;

    if (numAmount <= 0) {
      Alert.alert('Error', 'Jumlah pindah saldo harus lebih dari 0.');
      return;
    }

    // Check balance
    const sourceWallet = wallets.find(w => w.id === mutationFromWallet);
    if (!sourceWallet || sourceWallet.balance < (numAmount + numAdminFee)) {
      Alert.alert('Gagal', 'Saldo dompet asal tidak mencukupi (termasuk biaya admin).');
      return;
    }

    setIsMutating(true);
    const { error } = await transferBalance({
      from_wallet_id: mutationFromWallet,
      to_wallet_id: mutationToWallet,
      amount: numAmount,
      admin_fee: numAdminFee,
      description: mutationDesc || 'Pindah Saldo'
    });
    setIsMutating(false);

    if (error) {
      showToast(`Gagal memproses mutasi: ${error.message || error}`, 'error');
    } else {
      showToast('Mutasi saldo berhasil!', 'success');
      setMutationModalVisible(false);
      setMutationAmount('');
      setMutationAdminFee('');
      setMutationDesc('');
      fetchWallets(); // Refresh balance
    }
  };

  const handleAdjustment = async () => {
    setAdjError('');
    if (!adjWalletId) {
      setAdjError('Pilih dompet yang ingin disesuaikan saldonya.');
      return;
    }
    const cleanAmount = parseInt(adjAmount.replace(/\D/g, '')) || 0;
    if (cleanAmount <= 0) {
      setAdjError('Masukkan nominal penyesuaian yang valid.');
      return;
    }
    if (!adjDesc.trim()) {
      setAdjError('Keterangan penyesuaian wajib diisi.');
      return;
    }

    setIsAdjusting(true);
    const { error } = await addWalletTransaction({
      wallet_id: adjWalletId,
      type: adjType,
      amount: cleanAmount,
      reference_type: 'ADJUSTMENT',
      description: adjDesc
    });

    setIsAdjusting(false);
    if (error) {
      console.error("Adjustment error: ", error);
      setAdjError(`Gagal menyesuaikan saldo: ${error.message || error}`);
    } else {
      showToast('Saldo berhasil disesuaikan.', 'success');
      setAdjModalVisible(false);
      setAdjWalletId('');
      setAdjAmount('');
      setAdjDesc('');
      setAdjError('');
      setAdjType('IN');
      fetchWallets();
    }
  };

  const getIconForType = (type) => {
    switch (type) {
      case 'CASH': return 'cash-outline';
      case 'BANK': return 'card-outline';
      case 'APP_BALANCE': return 'phone-portrait-outline';
      case 'PROFIT': return 'trending-up-outline';
      default: return 'wallet-outline';
    }
  };

  const calculateTotal = () => {
    return wallets.filter(w => {
      const wName = (w.name || '').toLowerCase();
      return w.type !== 'PROFIT' && !wName.includes('profit') && !wName.includes('supplier') && !wName.includes('titipan');
    }).reduce((sum, wallet) => sum + (Number(wallet.balance) || 0), 0);
  };

  const renderWalletItem = ({ item }) => (
    <View style={styles.walletCard}>
      <View style={styles.walletHeader}>
        <View style={styles.walletIconContainer}>
          <Ionicons name={getIconForType(item.type)} size={24} color={Colors.primary} />
        </View>
        <View style={styles.walletInfo}>
          <Text style={styles.walletName}>{item.name}</Text>
          <Text style={styles.walletType}>{item.type}</Text>
        </View>
        <TouchableOpacity 
          style={{ padding: 6, backgroundColor: '#EFF6FF', borderRadius: 8, marginLeft: 'auto' }} 
          onPress={() => handleViewHistory(item)}
        >
          <Ionicons name="time-outline" size={20} color="#3B82F6" />
        </TouchableOpacity>
      </View>
      <View style={styles.walletBalanceContainer}>
        <Text style={styles.walletBalanceLabel}>Total Saldo</Text>
        <Text style={styles.walletBalanceAmount}>{formatCurrency(item.balance)}</Text>
      </View>
      
      {/* Tombol khusus Titipan Supplier */}
      {((item.name || '').toLowerCase().includes('titipan') || (item.name || '').toLowerCase().includes('supplier')) && Number(item.balance) > 0 && (
        <TouchableOpacity 
          style={{ backgroundColor: '#16a34a', paddingVertical: 8, borderRadius: 8, marginTop: 12, alignItems: 'center' }}
          onPress={() => {
            setSettleTitipanWallet(item);
            setSettleAmount(item.balance.toString());
            const firstCash = wallets.find(w => w.type === 'CASH');
            if (firstCash) setSettleCashWalletId(firstCash.id);
            setSettleModalVisible(true);
          }}
        >
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>Selesaikan Hutang Supplier</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manajemen Kas & Saldo</Text>
        <TouchableOpacity onPress={fetchWallets} style={styles.refreshButton}>
          <Ionicons name="refresh" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      {/* Total Balance Card */}
      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>Total Saldo (Semua Kas)</Text>
        <Text style={styles.totalAmount}>{formatCurrency(calculateTotal())}</Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity style={styles.actionButton} onPress={() => {
          if (wallets.length < 2) {
            showToast('Anda membutuhkan minimal 2 dompet untuk mutasi.', 'info');
            return;
          }
          setMutationFromWallet(wallets[0].id);
          setMutationToWallet(wallets[1].id);
          setMutationModalVisible(true);
        }}>
          <Ionicons name="swap-horizontal" size={20} color="#FFF" />
          <Text style={styles.actionButtonText}>Mutasi</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#475569' }]} onPress={() => {
          if (wallets.length === 0) {
            showToast('Anda belum memiliki dompet.', 'info');
            return;
          }
          setAdjWalletId(wallets[0].id);
          setAdjModalVisible(true);
        }}>
          <Ionicons name="options" size={20} color="#FFF" />
          <Text style={styles.actionButtonText}>Sesuaikan</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#28a745' }]} onPress={() => setModalVisible(true)}>
          <Ionicons name="add" size={20} color="#FFF" />
          <Text style={styles.actionButtonText}>Tambah</Text>
        </TouchableOpacity>
      </View>

      {/* Unsynced Profit Section */}
      {unsyncedProfits && unsyncedProfits.length > 0 && (
        <View style={styles.profitAlertContainer}>
          <View style={styles.profitAlertHeader}>
            <Ionicons name="warning-outline" size={20} color="#f59e0b" />
            <Text style={styles.profitAlertTitle}>Profit Belum Ditarik</Text>
          </View>
          <Text style={styles.profitAlertDesc}>
            Anda memiliki profit yang belum disinkronkan ke Dompet Laba:
          </Text>
          {unsyncedProfits.map((item, index) => (
            <View key={index} style={styles.profitAlertItem}>
              <Text style={styles.profitAlertDate}>{item.tanggal}</Text>
              <View style={styles.profitAlertItemRight}>
                <Text style={styles.profitAlertTrx}>{item.total_transaksi} trx</Text>
                <Text style={styles.profitAlertAmount}>{formatCurrency(item.total_profit)}</Text>
              </View>
            </View>
          ))}
          <TouchableOpacity 
            style={[styles.profitAlertBtn, isSyncingProfit && { opacity: 0.7 }]} 
            onPress={handleManualSyncProfit}
            disabled={isSyncingProfit}
          >
            {isSyncingProfit ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="download-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.profitAlertBtnText}>Tarik Profit Sekarang</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Wallets List */}
      <View style={styles.listContainer}>
        <Text style={styles.sectionTitle}>Daftar Kas & Dompet Anda</Text>
        {loading ? (
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 20 }} />
        ) : (
          <FlatList
            data={wallets}
            keyExtractor={(item) => item.id}
            renderItem={renderWalletItem}
            contentContainerStyle={{ paddingBottom: 100 }}
            ListEmptyComponent={
              <Text style={styles.emptyText}>Belum ada data kas / saldo.</Text>
            }
          />
        )}
      </View>

      {/* Modal Tambah Dompet */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Tambah Kas/Dompet Baru</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Nama Kas / Dompet</Text>
              <TextInput
                style={styles.input}
                placeholder="Cth: Laci Kasir, BCA, Dana"
                value={walletName}
                onChangeText={setWalletName}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Jenis Kas</Text>
              <View style={styles.typeSelector}>
                {['CASH', 'BANK', 'APP_BALANCE', 'PROFIT'].map(type => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.typeButton, walletType === type && styles.typeButtonActive]}
                    onPress={() => setWalletType(type)}
                  >
                    <Text style={[styles.typeButtonText, walletType === type && styles.typeButtonTextActive]}>
                      {type === 'CASH' ? 'Tunai' : type === 'BANK' ? 'Bank' : type === 'PROFIT' ? 'Laba/Profit' : 'E-Wallet'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Saldo Awal</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                keyboardType="numeric"
                value={walletBalance}
                onChangeText={(val) => {
                  const num = val.replace(/[^0-9]/g, '');
                  setWalletBalance(num);
                }}
              />
              {walletBalance !== '' && (
                <Text style={{ marginTop: 4, color: Colors.primary, fontWeight: '600' }}>
                  {formatCurrency(Number(walletBalance))}
                </Text>
              )}
            </View>

            <TouchableOpacity
              style={[styles.submitButton, isSubmitting && { opacity: 0.7 }]}
              onPress={handleSaveWallet}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.submitButtonText}>Simpan Kas</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Mutasi / Pindah Saldo */}
      <Modal visible={mutationModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { minHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Mutasi / Pindah Saldo</Text>
              <TouchableOpacity onPress={() => setMutationModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Dari Dompet Asal</Text>
              <WalletPicker
                wallets={wallets}
                selectedId={mutationFromWallet}
                onSelect={setMutationFromWallet}
                highlightColor="#EF4444"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Ke Dompet Tujuan</Text>
              <WalletPicker
                wallets={wallets}
                selectedId={mutationToWallet}
                onSelect={setMutationToWallet}
                highlightColor="#16a34a"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Jumlah Pindah (Rp)</Text>
              <TextInput
                style={styles.input}
                placeholder="Cth: 100000"
                keyboardType="numeric"
                value={mutationAmount}
                onChangeText={(val) => setMutationAmount(val.replace(/[^0-9]/g, ''))}
              />
              {mutationAmount !== '' && (
                <Text style={{ marginTop: 4, color: Colors.primary, fontWeight: '600' }}>
                  {formatCurrency(Number(mutationAmount))}
                </Text>
              )}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Biaya Admin (Opsional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Cth: 2500"
                keyboardType="numeric"
                value={mutationAdminFee}
                onChangeText={(val) => setMutationAdminFee(val.replace(/[^0-9]/g, ''))}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Keterangan</Text>
              <TextInput
                style={styles.input}
                placeholder="Cth: Tarik tunai ke laci kasir"
                value={mutationDesc}
                onChangeText={setMutationDesc}
              />
            </View>

            <TouchableOpacity
              style={[styles.submitButton, isMutating && { opacity: 0.7 }]}
              onPress={handleSaveMutation}
              disabled={isMutating}
            >
              {isMutating ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.submitButtonText}>Proses Mutasi</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Penyesuaian Saldo */}
      <Modal visible={adjModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Penyesuaian Saldo Kas</Text>
              <TouchableOpacity onPress={() => { setAdjModalVisible(false); setAdjError(''); }}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {adjError ? (
              <View style={{ backgroundColor: '#FEE2E2', padding: 12, borderRadius: 8, marginBottom: 16 }}>
                <Text style={{ color: '#EF4444', fontSize: 13, fontWeight: '500' }}>{adjError}</Text>
              </View>
            ) : null}

            <View style={styles.formGroup}>
              <Text style={styles.label}>Pilih Dompet / Kas</Text>
              <WalletPicker 
                wallets={wallets} 
                selectedId={adjWalletId} 
                onSelect={setAdjWalletId} 
                highlightColor={Colors.primary}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Tipe Penyesuaian</Text>
              <View style={styles.typeSelector}>
                <TouchableOpacity
                  style={[styles.typeButton, adjType === 'IN' && { backgroundColor: Colors.success, borderColor: Colors.success }]}
                  onPress={() => setAdjType('IN')}
                >
                  <Text style={[styles.typeButtonText, adjType === 'IN' && { color: '#FFF' }]}>
                    Masuk (+ Saldo)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeButton, adjType === 'OUT' && { backgroundColor: Colors.danger, borderColor: Colors.danger }]}
                  onPress={() => setAdjType('OUT')}
                >
                  <Text style={[styles.typeButtonText, adjType === 'OUT' && { color: '#FFF' }]}>
                    Keluar (- Saldo)
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Nominal (Rp)</Text>
              <TextInput
                style={styles.input}
                placeholder="Cth: 50.000"
                keyboardType="numeric"
                value={adjAmount}
                onChangeText={(text) => {
                  const cleaned = text.replace(/\D/g, '');
                  if(cleaned) {
                    setAdjAmount(parseInt(cleaned).toLocaleString('id-ID'));
                  } else {
                    setAdjAmount('');
                  }
                }}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Keterangan / Alasan</Text>
              <TextInput
                style={[styles.input, { height: 70 }]}
                placeholder="Cth: Selisih kasir, Uang receh kembalian, dsb."
                value={adjDesc}
                onChangeText={setAdjDesc}
                multiline
              />
            </View>

            <View style={{ marginTop: 12 }}>
              <TouchableOpacity 
                style={[styles.submitButton, isAdjusting && { opacity: 0.7 }]} 
                onPress={handleAdjustment}
                disabled={isAdjusting}
              >
                {isAdjusting ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="checkmark" size={20} color="#FFF" />
                    <Text style={styles.submitButtonText}>Simpan Penyesuaian</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Riwayat Mutasi */}
      <Modal visible={historyModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { minHeight: '80%', maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Riwayat Mutasi</Text>
                <Text style={{ fontSize: 13, color: '#64748b' }}>{selectedWalletForHistory?.name}</Text>
              </View>
              <TouchableOpacity onPress={() => setHistoryModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {historyLoading ? (
              <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 20 }} />
            ) : historyData.length === 0 ? (
              <Text style={{ textAlign: 'center', color: '#94a3b8', marginTop: 20 }}>Belum ada riwayat mutasi.</Text>
            ) : (
              <FlatList
                data={historyData}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ gap: 10, paddingBottom: 20 }}
                renderItem={({ item }) => {
                  const isOut = item.type === 'OUT';
                  return (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' }}>
                      <View style={{ flex: 1, marginRight: 10 }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: '#1e293b' }}>
                          {item.description || (item.reference_type === 'TRANSFER' ? 'Transfer Saldo' : 'Mutasi')}
                        </Text>
                        <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                          {new Date(item.created_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 14, fontWeight: 'bold', color: isOut ? '#dc2626' : '#16a34a' }}>
                        {isOut ? '-' : '+'}{formatCurrency(item.amount)}
                      </Text>
                    </View>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Modal Settle Supplier */}
      <Modal visible={settleModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selesaikan Tagihan Supplier</Text>
              <TouchableOpacity onPress={() => setSettleModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <View style={{ backgroundColor: '#FEE2E2', padding: 12, borderRadius: 8, marginBottom: 16 }}>
              <Text style={{ color: '#991B1B', fontSize: 12 }}>
                Sistem akan memotong uang fisik dari laci kasir dan me-reset tagihan di dompet {settleTitipanWallet?.name} ini.
              </Text>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Ambil Uang Fisik Dari</Text>
              <WalletPicker
                wallets={wallets.filter(w => !((w.name || '').toLowerCase().includes('titipan') || (w.name || '').toLowerCase().includes('supplier')) && w.type !== 'PROFIT')}
                selectedId={settleCashWalletId}
                onSelect={setSettleCashWalletId}
                highlightColor="#16a34a"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Nominal Disetor ke Supplier (Rp)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={settleAmount}
                onChangeText={(val) => setSettleAmount(val.replace(/[^0-9]/g, ''))}
              />
              {settleAmount !== '' && (
                <Text style={{ marginTop: 4, color: Colors.primary, fontWeight: '600' }}>
                  {formatCurrency(Number(settleAmount))}
                </Text>
              )}
            </View>

            <TouchableOpacity
              style={[styles.submitButton, isSettling && { opacity: 0.7 }]}
              onPress={handleSettleSupplier}
              disabled={isSettling}
            >
              {isSettling ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.submitButtonText}>Konfirmasi Setor</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Konfirmasi Tarik Profit */}
      <Modal visible={syncProfitModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { minHeight: 'auto', paddingBottom: 30 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Konfirmasi Tarik Profit</Text>
              <TouchableOpacity onPress={() => setSyncProfitModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              <View style={{ backgroundColor: '#fef3c7', padding: 16, borderRadius: 50, marginBottom: 16 }}>
                <Ionicons name="swap-vertical" size={32} color="#d97706" />
              </View>
              <Text style={{ fontSize: 16, textAlign: 'center', color: '#4b5563', lineHeight: 24 }}>
                Anda akan memindahkan total profit sejumlah
              </Text>
              <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#16a34a', marginVertical: 8 }}>
                Rp {formatCurrency(syncProfitData.totalProfit)}
              </Text>
              <Text style={{ fontSize: 14, textAlign: 'center', color: '#6b7280' }}>
                Dari <Text style={{ fontWeight: 'bold', color: '#374151' }}>{syncProfitData.cashWallet?.name}</Text> ke <Text style={{ fontWeight: 'bold', color: '#374151' }}>{syncProfitData.profitWallet?.name}</Text>
              </Text>
            </View>

            <TouchableOpacity 
              style={[styles.submitButton, { backgroundColor: '#f59e0b' }]} 
              onPress={executeManualSyncProfit}
              disabled={isSyncingProfit}
            >
              {isSyncingProfit ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.submitButtonText}>Ya, Pindahkan Sekarang</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.submitButton, { backgroundColor: '#e5e7eb', marginTop: 10 }]} 
              onPress={() => setSyncProfitModalVisible(false)}
              disabled={isSyncingProfit}
            >
              <Text style={[styles.submitButtonText, { color: '#4b5563' }]}>Batal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
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
    padding: 16,
    paddingTop: 48,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  backButton: {
    padding: 8,
  },
  refreshButton: {
    padding: 8,
  },
  totalCard: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 16,
    padding: 16,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  totalLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  totalAmount: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  actionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    padding: 12,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  actionButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },
  listContainer: {
    flex: 1,
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    color: '#333',
  },
  walletCard: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  walletHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  walletIconContainer: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(79, 70, 229, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  walletInfo: {
    flex: 1,
  },
  walletName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
  },
  walletType: {
    fontSize: 11,
    color: Colors.muted,
    marginTop: 2,
  },
  walletBalanceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  walletBalanceLabel: {
    fontSize: 12,
    color: Colors.muted,
  },
  walletBalanceAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  emptyText: {
    textAlign: 'center',
    color: Colors.muted,
    marginTop: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    minHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#0F172A',
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  typeButtonActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  typeButtonTextActive: {
    color: '#3B82F6',
  },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
  },
  profitAlertContainer: {
    backgroundColor: '#fffbeb',
    borderColor: '#fcd34d',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  profitAlertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  profitAlertTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#92400e',
    marginLeft: 6,
  },
  profitAlertDesc: {
    fontSize: 13,
    color: '#92400e',
    marginBottom: 12,
  },
  profitAlertItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  profitAlertDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400e',
  },
  profitAlertItemRight: {
    alignItems: 'flex-end',
  },
  profitAlertTrx: {
    fontSize: 11,
    color: '#b45309',
  },
  profitAlertAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#92400e',
  },
  profitAlertBtn: {
    backgroundColor: '#f59e0b',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  profitAlertBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  }
});
