import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme';
import { getWallets, deleteWallet, addWallet, transferBalance, addWalletTransaction } from '../../services/walletSupabase';
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

  useEffect(() => {
    if (user?.id) fetchWallets();
  }, [user?.id]);

  const fetchWallets = async () => {
    setLoading(true);
    const { data, error } = await getWallets(user?.id);
    if (data) setWallets(data);
    setLoading(false);
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
    return wallets.reduce((sum, wallet) => sum + (Number(wallet.balance) || 0), 0);
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
      </View>
      <View style={styles.walletBalanceContainer}>
        <Text style={styles.walletBalanceLabel}>Total Saldo</Text>
        <Text style={styles.walletBalanceAmount}>{formatCurrency(item.balance)}</Text>
      </View>
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
  }
});
