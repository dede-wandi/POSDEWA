import React, { useState, useEffect, useCallback, useLayoutEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, ScrollView, Modal, FlatList, ActivityIndicator, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { formatIDR } from '../../utils/currency';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { adjustStockOnSale } from '../../services/productsSupabase';
import { createSale } from '../../services/sales';
import { sendWhatsAppNotification } from '../../services/whatsappService';
import { getWallets, addWalletTransaction } from '../../services/walletSupabase';
import { Colors, Spacing, Radii, Shadows, Typography } from '../../theme';

export default function PaymentScreen({ navigation, route }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { cart = [], total = 0, profit = 0 } = route.params || {};
  
  // Payment states
  const formatNumberWithDots = (num) => num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const [cashAmount, setCashAmount] = useState(total ? formatNumberWithDots(total) : '');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Wallet States
  const [wallets, setWallets] = useState([]);
  const [selectedWalletId, setSelectedWalletId] = useState(null); // Dompet tujuan uang masuk
  const [digitalWalletId, setDigitalWalletId] = useState(null); // Dompet sumber HPP dipotong (jika ada barang digital)

  useEffect(() => {
    const fetchWallets = async () => {
      if (!user?.id) return;
      const { data } = await getWallets(user.id);
      if (data && data.length > 0) {
        setWallets(data);
        const isTarikTunai = cart.some(item => (item.name || '').toLowerCase().includes('tarik tunai'));
        const cashWallet = data.find(w => w.type === 'CASH');
        const digitalWallet = data.find(w => w.type !== 'CASH' && w.type !== 'PROFIT');

        if (isTarikTunai) {
          setSelectedWalletId(digitalWallet ? digitalWallet.id : data[0].id);
          setDigitalWalletId(cashWallet ? cashWallet.id : null);
        } else {
          setSelectedWalletId(cashWallet ? cashWallet.id : data[0].id);
          setDigitalWalletId(null);
        }
      }
    };
    fetchWallets();
  }, [user?.id]);

  // Semua wallet bisa jadi channel pemrosesan (sumber modal → OUT)

  // Total modal (HPP) seluruh item di cart — ini yang dipotong dari platform (QGROW/Digipos)
  const totalCartCost = cart.reduce((sum, item) => sum + (item.costPrice || 0) * item.qty, 0);

  const cashValue = parseFloat(cashAmount.replace(/\./g, '')) || 0;
  const change = cashValue - total;

  const handleCashAmountChange = (text) => {
    const numericOnly = text.replace(/[^0-9]/g, '');
    if (!numericOnly) {
      setCashAmount('');
      return;
    }
    const formatted = parseInt(numericOnly, 10).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    setCashAmount(formatted);
  };

  const quickAmounts = [
    Math.ceil(total / 1000) * 1000, // Round up to nearest thousand
    Math.ceil(total / 5000) * 5000, // Round up to nearest 5k
    Math.ceil(total / 10000) * 10000, // Round up to nearest 10k
    Math.ceil(total / 50000) * 50000, // Round up to nearest 50k
  ].filter((amount, index, arr) => arr.indexOf(amount) === index && amount > total);

  const validatePayment = () => {
    if (cashValue < total) {
      showToast(`Jumlah uang tidak mencukupi. Kurang: ${formatIDR(total - cashValue)}`, 'error');
      return false;
    }
    return true;
  };

  const processPaymentTransaction = async () => {
    if (!validatePayment()) return;

    setIsProcessing(true);

    try {

      // 1. Create sale record
      const saleData = {
        user_id: user?.id,
        total: total,
        profit: profit,
        payment_method: 'cash',
        payment_channel_id: null,
        cash_amount: cashValue,
        change_amount: change,
        items: cart.map(item => ({
          product_name: item.name,
          barcode: item.barcode || '',
          qty: item.qty,
          price: item.price,
          cost_price: item.costPrice || 0,
          line_total: item.price * item.qty,
          line_profit: (item.price - (item.costPrice || 0)) * item.qty,
          token_code: item.tokenCode || null
        }))
      };

      const saleResult = await createSale(saleData);
      
      if (!saleResult.success) {
        throw new Error(saleResult.error || 'Gagal menyimpan transaksi');
      }
      
      // 2. INTEGRASI WALLET: Catat uang masuk (Pendapatan) sesuai dompet terpilih
      if (selectedWalletId) {
        const selectedWallet = wallets.find(w => w.id === selectedWalletId);
        await addWalletTransaction({
          wallet_id: selectedWalletId,
          type: 'IN',
          amount: total, // Uang yang diterima pelanggan
          reference_type: 'SALE',
          reference_id: saleResult.data?.sale?.id || null,
          description: `Penjualan #${saleResult.data?.sale?.no_invoice || ''} via ${selectedWallet?.name || 'Kas'}`
        });
      }

      // 2b. INTEGRASI WALLET: Potong saldo platform (QGROW/Digipos) sebesar total HPP
      if (digitalWalletId && totalCartCost > 0) {
        const digitalWallet = wallets.find(w => w.id === digitalWalletId);
        await addWalletTransaction({
          wallet_id: digitalWalletId,
          type: 'OUT',
          amount: totalCartCost,
          reference_type: 'PURCHASE',
          reference_id: saleResult.data?.sale?.id || null,
          description: `Modal trx #${saleResult.data?.sale?.no_invoice || ''} via ${digitalWallet?.name || 'Platform'}`
        });
      }

      // 3. Adjust stock
      const cartForStock = cart.map(item => {
        let pId = item.originalProductId || item.id;
        if (!item.originalProductId && item.id.length > 36) {
          pId = item.id.substring(0, 36);
        }
        return {
          productId: pId,
          qty: item.qty,
          variantName: item.variantName
        };
      });
      const stockResult = await adjustStockOnSale(user?.id, cartForStock);
      
      if (!stockResult.success) {
        // Don't fail the transaction, just warn
        showToast('Transaksi berhasil, tetapi ada masalah dengan pengurangan stok', 'warning');
      } else {
      }

      // 4. Send WhatsApp Notification (Background process)
      sendWhatsAppNotification(saleData, saleData.items).then(res => {
        if (res && (res.message_status === 'Success' || res.status === true)) {
          showToast('Notifikasi WhatsApp terkirim!', 'success');
        } else if (res) {
          showToast('WA gagal/lewati: ' + (res.message || JSON.stringify(res)), 'warning');
        }
      }).catch(err => {
        showToast('Gagal mengirim WA: ' + err.message, 'error');
      });

      // 5. Show success and navigate to invoice
      
      const selectedWallet = wallets.find(w => w.id === selectedWalletId);
      const navigationParams = {
        saleData: saleResult?.data || saleResult || {},
        cart: cart || [],
        total: total || 0,
        cashAmount: cashValue,
        change: change || 0,
        paymentMethod: selectedWallet?.type === 'CASH' ? 'cash' : selectedWallet?.type === 'BANK' ? 'bank_transfer' : 'digital',
        paymentChannel: selectedWallet?.name || null
      };
      
      
      navigation.navigate('Invoice', navigationParams);

    } catch (error) {
      showToast(error.message || 'Gagal memproses pembayaran', 'error');
    } finally {
      setIsProcessing(false);
    }
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
      case 'cash': return Colors.success;
      case 'bank': return Colors.primary;
      case 'digital': return Colors.warning;
      default: return Colors.muted;
    }
  };

  // Helper untuk warna & ikon berdasarkan tipe dompet
  const getWalletStyle = (type) => {
    switch(type) {
      case 'CASH': return { icon: 'cash', color: '#16a34a', bg: '#f0fdf4', label: 'Tunai' };
      case 'BANK': return { icon: 'card', color: '#2563eb', bg: '#eff6ff', label: 'Transfer' };
      case 'APP_BALANCE': return { icon: 'phone-portrait', color: '#d97706', bg: '#fffbeb', label: 'E-Wallet / Aplikasi' };
      default: return { icon: 'wallet', color: '#6b7280', bg: '#f9fafb', label: 'Lainnya' };
    }
  };

  const selectedWallet = wallets.find(w => w.id === selectedWalletId);
  const selectedWalletStyle = selectedWallet ? getWalletStyle(selectedWallet.type) : null;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 32 }}>

        {/* === HEADER TOTAL === */}
        <View style={styles.headerCard}>
          <Text style={styles.headerCardLabel}>Total Pembayaran</Text>
          <Text style={styles.headerCardAmount}>{formatIDR(total)}</Text>
          <View style={styles.headerCardItems}>
            {cart.map((item, i) => (
              <View key={i} style={styles.headerCartRow}>
                <Text style={styles.headerCartName} numberOfLines={1}>{item.name} ×{item.qty}</Text>
                <Text style={styles.headerCartPrice}>{formatIDR(item.price * item.qty)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* === UANG MASUK (PEMBAYARAN PELANGGAN) - KHUSUS TARIK TUNAI / TRANSFER === */}
        {wallets.length > 0 && cart.some(item => {
          const n = (item.name || '').toLowerCase();
          return n.includes('tarik tunai') || n.includes('transfer');
        }) && (
          <View style={[styles.card, { borderColor: '#16a34a', borderWidth: 1.5, marginBottom: 16 }]}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="enter" size={18} color="#16a34a" />
              <Text style={[styles.cardTitle, { color: '#14532d' }]}>Tujuan Uang Masuk</Text>
            </View>
            <Text style={styles.cardSubtitle}>
              Pilih dompet tempat pelanggan membayar (Contoh: Laci Kasir atau Seabank)
            </Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
              <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 4, paddingBottom: 4 }}>
                {wallets.filter(w => {
                  if (w.type === 'PROFIT' || (w.name || '').toLowerCase().includes('profit')) return false;
                  const isTarikTunai = cart.some(i => (i.name||'').toLowerCase().includes('tarik tunai'));
                  const isTransfer = cart.some(i => (i.name||'').toLowerCase().includes('transfer'));
                  
                  if (isTarikTunai || isTransfer) {
                    if (isTarikTunai && w.type === 'CASH') return false;
                    if (w.type === 'APP_BALANCE' && !(w.name || '').toLowerCase().includes('dana')) return false;
                  }
                  return true;
                }).map(w => {
                  const ws = getWalletStyle(w.type);
                  const isActive = selectedWalletId === w.id;
                  return (
                    <TouchableOpacity
                      key={w.id}
                      style={[
                        { 
                          flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, 
                          borderWidth: 1.5, borderColor: isActive ? '#16a34a' : '#E2E8F0',
                          backgroundColor: isActive ? '#f0fdf4' : '#FFF', minWidth: 130
                        }
                      ]}
                      onPress={() => setSelectedWalletId(w.id)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name={ws.icon} size={20} color={isActive ? '#16a34a' : '#64748b'} />
                      <View style={{ marginLeft: 8 }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: isActive ? '#16a34a' : '#334155' }}>
                          {w.type === 'CASH' 
                            ? `${w.name}${cart.some(i => (i.name||'').toLowerCase().includes('tarik tunai')) ? ' / Tarik Tunai' : cart.some(i => (i.name||'').toLowerCase().includes('transfer')) ? ' / Terima Tunai' : ''}` 
                            : w.name}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        )}

        {/* === CHANNEL PEMROSESAN === */}
        {wallets.length > 0 && (
          <View style={[styles.card, { borderColor: '#f59e0b', borderWidth: 1.5 }]}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="swap-vertical" size={18} color="#d97706" />
              <Text style={[styles.cardTitle, { color: '#92400e' }]}>Channel Pemrosesan</Text>
            </View>
            <Text style={styles.cardSubtitle}>
              {digitalWalletId
                ? `HPP ${formatIDR(totalCartCost)} dipotong dari channel → Laci Kasir bertambah`
                : 'Pilih channel jika ada biaya modal. Kosongkan untuk produk fisik biasa.'}
            </Text>

            <View style={styles.walletGrid}>
              {/* Opsi: Tidak ada / Skip */}
            {!cart.some(i => (i.name||'').toLowerCase().includes('tarik tunai')) && (
              <TouchableOpacity
                style={[
                  styles.walletCard,
                  !digitalWalletId && { borderColor: '#64748b', backgroundColor: '#f1f5f9' }
                ]}
                onPress={() => setDigitalWalletId(null)}
                activeOpacity={0.8}
              >
              <View style={[styles.walletCardIcon, { backgroundColor: !digitalWalletId ? '#64748b' : '#F1F5F9' }]}>
                <Ionicons name="close-circle" size={20} color={!digitalWalletId ? '#FFF' : '#94a3b8'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.walletCardName, !digitalWalletId && { color: '#334155' }]}>Tidak ada / Produk Fisik</Text>
                <Text style={styles.walletCardBalance}>Laci kasir saja yang bertambah</Text>
              </View>
              {!digitalWalletId && <View style={[styles.inBadge, { backgroundColor: '#64748b' }]}><Text style={styles.inBadgeText}>SKIP</Text></View>}
              </TouchableOpacity>
            )}

            {wallets.filter(w => {
              if (w.type === 'PROFIT' || (w.name || '').toLowerCase().includes('profit')) return false;
              const isTarikTunai = cart.some(i => (i.name||'').toLowerCase().includes('tarik tunai'));
              const isTransfer = cart.some(i => (i.name||'').toLowerCase().includes('transfer'));
              
              if (isTarikTunai && w.type !== 'CASH') return false;
              if (isTransfer && w.type === 'APP_BALANCE' && !(w.name || '').toLowerCase().includes('dana')) return false;
              
              return true;
            }).map(w => {
              const ws = getWalletStyle(w.type);
              const isActive = digitalWalletId === w.id;
              return (
                <TouchableOpacity
                  key={w.id}
                  style={[styles.walletCard, isActive && { borderColor: ws.color, backgroundColor: ws.bg }]}
                  onPress={() => setDigitalWalletId(w.id)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.walletCardIcon, { backgroundColor: isActive ? ws.color : '#F1F5F9' }]}>
                    <Ionicons name={ws.icon} size={20} color={isActive ? '#FFF' : ws.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.walletCardName, isActive && { color: ws.color }]}>
                      {w.type === 'CASH' 
                        ? `${w.name}${cart.some(i => (i.name||'').toLowerCase().includes('tarik tunai')) ? ' / Tarik Tunai' : cart.some(i => (i.name||'').toLowerCase().includes('transfer')) ? ' / Terima Tunai' : ''}` 
                        : w.name}
                    </Text>
                    <Text style={styles.walletCardBalance}>{formatIDR(w.balance)}</Text>
                  </View>
                  {isActive && <View style={[styles.inBadge, { backgroundColor: '#dc2626' }]}><Text style={styles.inBadgeText}>-HPP</Text></View>}
                </TouchableOpacity>
              );
            })}
            </View>
          </View>
        )}

        {/* === JUMLAH YANG DIBAYAR === */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="cash" size={18} color={Colors.primary} />
            <Text style={styles.cardTitle}>Jumlah Diterima</Text>
          </View>

          <TextInput
            style={styles.cashInput}
            value={cashAmount}
            onChangeText={handleCashAmountChange}
            placeholder={formatIDR(total)}
            placeholderTextColor={Colors.placeholder}
            keyboardType="numeric"
          />

          {/* Uang Pas */}
          <TouchableOpacity
            style={[styles.quickAmountButton, { backgroundColor: Colors.primary, borderColor: Colors.primary, marginTop: 10 }]}
            onPress={() => setCashAmount(formatNumberWithDots(total))}
          >
            <Text style={[styles.quickAmountText, { color: '#FFF' }]}>Uang Pas  {formatIDR(total)}</Text>
          </TouchableOpacity>

          {/* Quick Amounts */}
          {quickAmounts.length > 0 && (
            <View style={styles.quickAmounts}>
              {quickAmounts.slice(0, 4).map((amount) => (
                <TouchableOpacity
                  key={amount}
                  style={styles.quickAmountButton}
                  onPress={() => setCashAmount(formatNumberWithDots(amount))}
                >
                  <Text style={styles.quickAmountText}>{formatIDR(amount)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Kembalian */}
          {cashValue >= total && (
            <View style={[styles.changeContainer, { backgroundColor: change > 0 ? '#f0fdf4' : '#f0f9ff' }]}>
              <Text style={styles.changeLabel}>Kembalian</Text>
              <Text style={[styles.changeAmount, { color: change >= 0 ? '#16a34a' : '#dc2626' }]}>
                {formatIDR(Math.abs(change))}
              </Text>
            </View>
          )}
        </View>

        {/* Hapus section lama Sumber Modal karena sudah digabung di atas */}



        {/* === TOMBOL BAYAR === */}
        <View style={{ marginHorizontal: 16, marginTop: 8 }}>
          <TouchableOpacity
            style={[
              styles.processButton,
              { backgroundColor: selectedWalletStyle?.color || Colors.primary },
              (isProcessing || cashValue < total) && styles.disabledButton
            ]}
            onPress={processPaymentTransaction}
            disabled={isProcessing || cashValue < total}
          >
            {isProcessing ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <View style={{ alignItems: 'center', gap: 2 }}>
                <Text style={styles.processButtonText}>
                  Konfirmasi Pembayaran
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>
                  {formatIDR(total)} via {selectedWallet?.name || '—'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },

  inBadge: {
    backgroundColor: '#16a34a',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  inBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // Header total atas
  headerCard: {
    backgroundColor: Colors.primary,
    margin: 16,
    marginBottom: 24, // Added more spacing here
    borderRadius: 16,
    padding: 20,
  },
  headerCardLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 4,
  },
  headerCardAmount: {
    color: '#FFF',
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  headerCardItems: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
    paddingTop: 10,
    gap: 4,
  },
  headerCartRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerCartName: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    flex: 1,
    marginRight: 8,
  },
  headerCartPrice: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },

  // Card umum
  card: {
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 14,
  },

  // Grid dompet
  walletGrid: {
    gap: 8,
  },
  walletCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FAFAFA',
  },
  walletCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  walletCardName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  walletCardBalance: {
    fontSize: 12,
    color: '#94A3B8',
  },

  // Input jumlah
  cashInput: {
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
    letterSpacing: -0.5,
  },
  quickAmounts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  quickAmountButton: {
    flex: 1,
    minWidth: '45%',
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickAmountText: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '600',
  },
  changeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    borderRadius: 10,
    padding: 12,
  },
  changeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  changeAmount: {
    fontSize: 20,
    fontWeight: '800',
  },

  // Ringkasan akhir
  summaryFinalCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    backgroundColor: '#FFF',
  },
  summaryFinalLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  summaryFinalValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  summaryFinalBalance: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },

  // Tombol proses
  processButton: {
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 60,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  disabledButton: {
    backgroundColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
  },
  processButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },

  // Legacy (jaga kompatibilitas)
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 16, color: Colors.muted },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { fontSize: 12, color: Colors.muted },
  walletBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, marginRight: 8, backgroundColor: '#FFF' },
  walletBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  walletBtnText: { marginLeft: 6, fontWeight: '600', color: Colors.text },
  positiveChange: { color: Colors.success },
  negativeChange: { color: Colors.danger },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.darkText },
  section: { backgroundColor: Colors.card, marginHorizontal: 16, marginTop: 12, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: Colors.border },
});
