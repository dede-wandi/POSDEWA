import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { listProducts } from '../services/productsSupabase';
import { addStock } from '../services/stockSupabase';
import { getWallets, addWalletTransaction } from '../services/walletSupabase';
import { Colors } from '../theme';
import { formatIDR } from '../utils/currency';

export default function InjectVoucherScreen({ navigation }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  
  const [products, setProducts] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [qty, setQty] = useState('1');
  const [inputCostPrice, setInputCostPrice] = useState('');
  const [note, setNote] = useState('');
  const [selectedWalletId, setSelectedWalletId] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadData();
  }, [user?.id]);

  const loadData = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [fetchedProducts, fetchedWallets] = await Promise.all([
        listProducts(user.id),
        getWallets(user.id)
      ]);
      
      const vouchers = (fetchedProducts || []).filter(p => 
        (p.name && p.name.toLowerCase().includes('voucher')) || 
        (p.category_id && p.category_name && p.category_name.toLowerCase().includes('voucher'))
      );
      setProducts(vouchers);

      if (fetchedWallets.data) {
        setWallets(fetchedWallets.data);
      }
    } catch (err) {
      showToast('Gagal memuat data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openInjectModal = (product) => {
    if (product.has_variants) {
      Alert.alert('Info', 'Voucher dengan varian belum didukung untuk inject langsung. Silakan update stok via menu Manajemen Stok.');
      return;
    }
    setSelectedProduct(product);
    setQty('1');
    setInputCostPrice(product.cost_price ? product.cost_price.toString() : '');
    setNote('');
    setModalVisible(true);
  };

  const handleProcessInject = async () => {
    if (!selectedProduct) return;
    const injectQty = parseInt(qty, 10);
    const parsedCost = parseInt(inputCostPrice.replace(/[^0-9]/g, ''), 10);
    const singleCost = isNaN(parsedCost) ? 0 : parsedCost;

    if (isNaN(injectQty) || injectQty <= 0) {
      showToast('Jumlah harus lebih dari 0', 'error');
      return;
    }
    if (!selectedWalletId) {
      showToast('Pilih sumber dana (Channel) untuk pembayaran', 'error');
      return;
    }

    const totalCost = injectQty * singleCost;
    const selectedWallet = wallets.find(w => w.id === selectedWalletId);

    if (selectedWallet.balance < totalCost) {
      showToast(`Saldo ${selectedWallet.name} tidak cukup! Saldo: ${formatIDR(selectedWallet.balance)}, Butuh: ${formatIDR(totalCost)}`, 'error');
      return;
    }

    const customNoteText = note.trim() ? ` - Catatan: ${note.trim()}` : '';

    setIsProcessing(true);
    try {
      // 1. Mutasi saldo berkurang (pembelian modal)
      if (totalCost > 0) {
        await addWalletTransaction({
          wallet_id: selectedWalletId,
          type: 'OUT',
          amount: totalCost,
          reference_type: 'PURCHASE',
          reference_id: null,
          description: `Inject dari ${selectedWallet.name}: ${injectQty}x ${selectedProduct.name}${customNoteText}`
        });
      }

      // 2. Tambah stok produk
      const res = await addStock(
        selectedProduct.id, 
        injectQty, 
        'Inject Voucher', 
        `Inject voucher dari ${selectedWallet.name} (HPP: ${formatIDR(singleCost)})${customNoteText}`
      );

      if (!res.success) {
        throw new Error(res.error || 'Gagal update stok voucher');
      }

      showToast('Inject Voucher Berhasil!', 'success');
      setModalVisible(false);
      loadData(); // refresh data
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const renderProductItem = ({ item }) => (
    <TouchableOpacity style={styles.card} onPress={() => openInjectModal(item)}>
      <View style={{ flex: 1 }}>
        <Text style={styles.productName}>{item.name}</Text>
        <Text style={styles.stockText}>Stok saat ini: {item.stock || 0}</Text>
      </View>
      <View style={styles.injectButton}>
        <Ionicons name="add-circle" size={32} color={Colors.primary} />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Inject Voucher</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#94A3B8" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Cari voucher..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#94A3B8" />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={Colors.primary} />
      ) : products.length === 0 ? (
        <View style={{ padding: 20, alignItems: 'center', marginTop: 40 }}>
          <Ionicons name="receipt-outline" size={60} color="#CBD5E1" />
          <Text style={{ marginTop: 10, color: '#64748B' }}>Tidak ada produk dengan nama 'Voucher'</Text>
        </View>
      ) : (
        <FlatList
          data={products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))}
          keyExtractor={item => item.id}
          renderItem={renderProductItem}
          contentContainerStyle={{ padding: 16 }}
        />
      )}

      {/* Modal Inject */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Detail Inject</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            {selectedProduct && (
              <>
                <Text style={styles.modalProductName}>{selectedProduct.name}</Text>
                
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Jumlah Inject (Qty)</Text>
                  <TextInput
                    style={styles.input}
                    value={qty}
                    onChangeText={setQty}
                    keyboardType="numeric"
                    placeholder="Contoh: 10"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Harga Modal Satuan (HPP)</Text>
                  <TextInput
                    style={styles.input}
                    value={inputCostPrice}
                    onChangeText={(text) => {
                      const num = text.replace(/[^0-9]/g, '');
                      setInputCostPrice(num);
                    }}
                    keyboardType="numeric"
                    placeholder="Contoh: 50000"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Total Modal Keseluruhan</Text>
                  <Text style={styles.totalModalText}>
                    {formatIDR((parseInt(qty, 10) || 0) * (parseInt(inputCostPrice, 10) || 0))}
                  </Text>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Sumber Dana (Pilih Saldo yang Terpotong)</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {wallets.filter(w => w.type !== 'PROFIT' && !w.name.toLowerCase().includes('profit')).map(w => (
                      <TouchableOpacity
                        key={w.id}
                        onPress={() => setSelectedWalletId(w.id)}
                        style={[
                          styles.walletOption,
                          selectedWalletId === w.id && styles.walletOptionActive
                        ]}
                      >
                        <Text style={[
                          styles.walletOptionText,
                          selectedWalletId === w.id && styles.walletOptionTextActive
                        ]}>
                          {w.name}
                        </Text>
                        <Text style={[
                          styles.walletOptionBalance,
                          selectedWalletId === w.id && styles.walletOptionTextActive
                        ]}>
                          {formatIDR(w.balance)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Catatan (Opsional)</Text>
                  <TextInput
                    style={styles.input}
                    value={note}
                    onChangeText={setNote}
                    placeholder="Contoh: SN 12345 / Promo"
                  />
                </View>

                {(() => {
                  const currentQty = parseInt(qty, 10) || 0;
                  const currentCost = parseInt(inputCostPrice, 10) || 0;
                  const currentTotalCost = currentQty * currentCost;
                  const selWallet = wallets.find(w => w.id === selectedWalletId);
                  
                  const hasWallet = !!selWallet;
                  const isInsufficient = hasWallet && selWallet.balance < currentTotalCost;
                  const isDisabled = isProcessing || currentTotalCost <= 0 || !hasWallet || isInsufficient;

                  return (
                    <TouchableOpacity 
                      style={[
                        styles.processBtn, 
                        isDisabled && { opacity: 0.5, backgroundColor: isInsufficient ? '#EF4444' : '#94A3B8' }
                      ]} 
                      onPress={handleProcessInject}
                      disabled={isDisabled}
                    >
                      {isProcessing ? (
                        <ActivityIndicator color="#FFF" />
                      ) : (
                        <Text style={styles.processBtnText}>
                          {isInsufficient ? 'Saldo Tidak Cukup' : !hasWallet ? 'Pilih Sumber Dana' : 'Proses Inject'}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })()}
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9'
  },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1E293B' },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF',
    margin: 16, marginBottom: 0, paddingHorizontal: 12, borderRadius: 10,
    borderWidth: 1, borderColor: '#E2E8F0', height: 44
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: '#1E293B', height: '100%' },
  card: {
    backgroundColor: '#FFF', borderRadius: 12, padding: 16, marginBottom: 12,
    flexDirection: 'row', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2
  },
  productName: { fontSize: 15, fontWeight: '600', color: '#1E293B' },
  stockText: { fontSize: 13, color: '#64748B', marginTop: 4 },
  priceLabel: { fontSize: 11, color: '#94A3B8', marginBottom: 2 },
  priceValue: { fontSize: 13, fontWeight: '700', color: '#0EA5E9' },
  costValue: { fontSize: 13, fontWeight: '700', color: '#F59E0B' },
  injectButton: { padding: 8 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1E293B' },
  modalProductName: { fontSize: 16, fontWeight: '600', color: '#334155', marginBottom: 16 },
  
  formGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#64748B', marginBottom: 8 },
  input: {
    backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0',
    borderRadius: 10, padding: 12, fontSize: 16, color: '#1E293B'
  },
  totalModalText: { fontSize: 20, fontWeight: '800', color: '#F59E0B' },
  
  walletOption: {
    padding: 12, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10,
    backgroundColor: '#F8FAFC', width: '48%', alignItems: 'center'
  },
  walletOptionActive: {
    borderColor: Colors.primary, backgroundColor: '#EEF2FF'
  },
  walletOptionText: { fontSize: 13, fontWeight: '600', color: '#475569' },
  walletOptionBalance: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  walletOptionTextActive: { color: Colors.primary },
  
  processBtn: {
    backgroundColor: Colors.primary, padding: 16, borderRadius: 12,
    alignItems: 'center', marginTop: 10
  },
  processBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' }
});
