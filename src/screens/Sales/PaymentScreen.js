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
import { Colors, Spacing, Radii, Shadows, Typography } from '../../theme';

export default function PaymentScreen({ navigation, route }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { cart = [], total = 0, profit = 0 } = route.params || {};
  
  // Payment states
  const [cashAmount, setCashAmount] = useState(total ? total.toString() : '');
  const [isProcessing, setIsProcessing] = useState(false);

  const cashValue = parseFloat(cashAmount) || 0;
  const change = cashValue - total;

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

      // 3. Adjust stock
      const cartForStock = cart.map(item => ({
        productId: item.id, // Fixed: use 'id' instead of 'productId'
        qty: item.qty
      }));
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
      
      // Ensure all navigation parameters are valid
      const navigationParams = {
        saleData: saleResult?.data || saleResult || {},
        cart: cart || [],
        total: total || 0,
        cashAmount: cashValue,
        change: change || 0,
        paymentMethod: 'cash',
        paymentChannel: null
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

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.container}>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ringkasan Pesanan</Text>
          {cart.map((item, index) => (
            <View
              key={index}
              style={[
                styles.summaryRow,
                { borderBottomWidth: 1, borderBottomColor: Colors.borderLight, paddingBottom: 10, marginBottom: 10 }
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.darkText, marginBottom: 2 }}>{item.name}</Text>
                <Text style={styles.summaryLabel}>{item.qty} x {formatIDR(item.price)}</Text>
              </View>
              <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.darkText }}>{formatIDR(item.price * item.qty)}</Text>
            </View>
          ))}
          <View style={[styles.summaryRow, { marginTop: 4, paddingTop: 10, alignItems: 'center' }]}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.darkText }}>Total Bayar:</Text>
            <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.primary }}>{formatIDR(total)}</Text>
          </View>
        </View>

        {/* Cash Payment Input */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Jumlah Uang Tunai</Text>
            <TextInput
              style={styles.cashInput}
              value={cashAmount}
              onChangeText={setCashAmount}
              placeholder="Masukkan jumlah uang"
              placeholderTextColor={Colors.placeholder}
              keyboardType="numeric"
            />

            {/* Uang Pas Button */}
            <TouchableOpacity
              style={[styles.quickAmountButton, { width: '100%', marginTop: 12, backgroundColor: Colors.primary, borderColor: Colors.primary }]}
              onPress={() => setCashAmount(total.toString())}
            >
              <Text style={[styles.quickAmountText, { color: Colors.white }]}>Uang Pas ({formatIDR(total)})</Text>
            </TouchableOpacity>
            
            {/* Quick Amount Buttons */}
            {quickAmounts.length > 0 && (
              <View style={styles.quickAmounts}>
                {quickAmounts.slice(0, 4).map((amount) => (
                  <TouchableOpacity
                    key={amount}
                    style={styles.quickAmountButton}
                    onPress={() => setCashAmount(amount.toString())}
                  >
                    <Text style={styles.quickAmountText}>{formatIDR(amount)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Change Display */}
            {cashValue > 0 && (
              <View style={styles.changeContainer}>
                <Text style={styles.changeLabel}>Kembalian:</Text>
                <Text style={[
                  styles.changeAmount,
                  change < 0 ? styles.negativeChange : styles.positiveChange
                ]}>
                  {formatIDR(Math.abs(change))}
                </Text>
              </View>
            )}
          </View>

        {/* Process Payment Button */}
        <View style={[styles.section, { backgroundColor: 'transparent', borderWidth: 0, shadowOpacity: 0, elevation: 0, marginTop: 4, marginBottom: 20 }]}>
          <TouchableOpacity
            style={[
              styles.processButton,
              (isProcessing || cashValue < total) && styles.disabledButton
            ]}
            onPress={processPaymentTransaction}
            disabled={isProcessing || cashValue < total}
          >
            {isProcessing ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.processButtonText}>
                Proses Pembayaran Tunai
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.card,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: Colors.muted,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  section: {
    backgroundColor: Colors.card,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.card,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
    color: Colors.darkText,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontSize: 12,
    color: Colors.muted,
  },
  summaryValue: {
    fontSize: 14,
    color: Colors.text,
  },
  paymentMethods: {
    flexDirection: 'row',
    gap: 12,
  },
  paymentMethodButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  selectedPaymentMethod: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  paymentMethodText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.muted,
  },
  selectedPaymentMethodText: {
    color: Colors.primary,
  },
  selectedChannelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: Colors.lightBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  selectedChannelInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  selectedChannelDetails: {
    marginLeft: 12,
    flex: 1,
  },
  selectedChannelName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.darkText,
  },
  selectedChannelBalance: {
    fontSize: 13,
    color: Colors.muted,
    marginTop: 2,
  },
  cashInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: '600',
    color: Colors.darkText,
    backgroundColor: Colors.lightBg,
  },
  quickAmounts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  quickAmountButton: {
    flex: 1,
    minWidth: '45%',
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickAmountText: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '600',
  },
  changeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  changeLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.darkText,
  },
  changeAmount: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  positiveChange: {
    color: Colors.success,
  },
  negativeChange: {
    color: Colors.danger,
  },
  processButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    ...Shadows.card,
  },
  disabledButton: {
    backgroundColor: '#D1D5DB', // Light gray disabled state
  },
  processButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.darkText,
  },
  modalCancelButton: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '600',
  },
  channelList: {
    padding: 16,
  },
  channelItem: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  selectedChannelItem: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  channelItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  channelItemInfo: {
    flex: 1,
  },
  channelItemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  channelItemName: {
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
    color: Colors.darkText,
  },
  channelItemType: {
    fontSize: 11,
    color: Colors.muted,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  channelItemBalance: {
    alignItems: 'flex-end',
  },
  channelItemBalanceLabel: {
    fontSize: 11,
    color: Colors.muted,
  },
  channelItemBalanceAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.darkText,
  },
  selectedIndicator: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
});
