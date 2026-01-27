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
import { getPaymentChannels, processPayment } from '../../services/financeSupabase';
import { Colors } from '../../theme';

export default function PaymentScreen({ navigation, route }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { cart = [], total = 0, profit = 0 } = route.params || {};
  
  // Payment states
  const [cashAmount, setCashAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('cash');
  const [selectedChannel, setSelectedChannel] = useState(null);
  
  // Channel states
  const [paymentChannels, setPaymentChannels] = useState([]);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [showChannelModal, setShowChannelModal] = useState(false);

  const cashValue = parseFloat(cashAmount) || 0;
  const change = selectedPaymentMethod === 'cash' ? cashValue - total : 0;

  // Load payment channels
  const loadPaymentChannels = async () => {
    try {
      const result = await getPaymentChannels();
      if (result.success) {
        setPaymentChannels(result.data);
        // Auto-select cash channel if available
        const cashChannel = result.data.find(channel => channel.type === 'cash');
        if (cashChannel && !selectedChannel) {
          setSelectedChannel(cashChannel);
        }
      } else {
        console.error('Error loading payment channels:', result.error);
      }
    } catch (error) {
      console.error('Exception loading payment channels:', error);
    } finally {
      setLoadingChannels(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadPaymentChannels();
    }, [])
  );

  const quickAmounts = [
    Math.ceil(total / 1000) * 1000, // Round up to nearest thousand
    Math.ceil(total / 5000) * 5000, // Round up to nearest 5k
    Math.ceil(total / 10000) * 10000, // Round up to nearest 10k
    Math.ceil(total / 50000) * 50000, // Round up to nearest 50k
  ].filter((amount, index, arr) => arr.indexOf(amount) === index && amount > total);

  const handlePaymentMethodChange = (method) => {
    setSelectedPaymentMethod(method);
    if (method === 'cash') {
      const cashChannel = paymentChannels.find(channel => channel.type === 'cash');
      setSelectedChannel(cashChannel);
    } else {
      setSelectedChannel(null);
      setShowChannelModal(true);
    }
  };

  const handleChannelSelect = (channel) => {
    setSelectedChannel(channel);
    setShowChannelModal(false);
  };

  const validatePayment = () => {
    if (!selectedChannel) {
      showToast('Pilih channel pembayaran terlebih dahulu', 'error');
      return false;
    }

    if (selectedPaymentMethod === 'cash') {
      if (cashValue < total) {
        showToast(`Jumlah uang tidak mencukupi. Kurang: ${formatIDR(total - cashValue)}`, 'error');
        return false;
      }
    } else {
      // For non-cash payments, check channel balance
      if (selectedChannel.balance < total) {
        showToast(`Saldo channel ${selectedChannel.name} tidak mencukupi. Saldo: ${formatIDR(selectedChannel.balance)}`, 'error');
        return false;
      }
    }

    return true;
  };

  const processPaymentTransaction = async () => {
    if (!validatePayment()) return;

    setIsProcessing(true);

    try {
      console.log('💰 PaymentScreen: Processing payment');
      console.log('💰 PaymentScreen: Cart items:', cart);
      console.log('💰 PaymentScreen: Total:', total, 'Profit:', profit);
      console.log('💰 PaymentScreen: Payment method:', selectedPaymentMethod);
      console.log('💰 PaymentScreen: Selected channel:', selectedChannel);

      // 1. Create sale record
      const saleData = {
        user_id: user?.id,
        total: total,
        profit: profit,
        payment_method: selectedPaymentMethod,
        payment_channel_id: selectedChannel?.id,
        cash_amount: selectedPaymentMethod === 'cash' ? cashValue : total,
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

      console.log('💾 PaymentScreen: Creating sale with data:', saleData);
      const saleResult = await createSale(saleData);
      
      if (!saleResult.success) {
        throw new Error(saleResult.error || 'Gagal menyimpan transaksi');
      }

      console.log('✅ PaymentScreen: Sale created successfully:', saleResult.data);

      // 2. Process payment through finance system
      if (selectedChannel) {
        console.log('💳 PaymentScreen: Processing payment through finance system');
        const paymentResult = await processPayment(
          selectedChannel.id,
          total,
          saleResult.data.id
        );

        if (!paymentResult.success) {
          console.log('⚠️ PaymentScreen: Payment processing failed:', paymentResult.error);
          // Don't fail the transaction, just warn
          showToast('Transaksi berhasil, tetapi ada masalah dengan pencatatan keuangan', 'warning');
        } else {
          console.log('✅ PaymentScreen: Payment processed successfully');
        }
      }

      // 3. Adjust stock
      console.log('📦 PaymentScreen: Adjusting stock for cart items');
      const cartForStock = cart.map(item => ({
        productId: item.id, // Fixed: use 'id' instead of 'productId'
        qty: item.qty
      }));
      const stockResult = await adjustStockOnSale(user?.id, cartForStock);
      
      if (!stockResult.success) {
        console.log('⚠️ PaymentScreen: Stock adjustment failed:', stockResult.error);
        // Don't fail the transaction, just warn
        showToast('Transaksi berhasil, tetapi ada masalah dengan pengurangan stok', 'warning');
      } else {
        console.log('✅ PaymentScreen: Stock adjusted successfully');
      }

      // 4. Show success and navigate to invoice
      console.log('🧾 PaymentScreen: Navigating to Invoice screen');
      
      // Ensure all navigation parameters are valid
      const navigationParams = {
        saleData: saleResult?.data || saleResult || {},
        cart: cart || [],
        total: total || 0,
        cashAmount: selectedPaymentMethod === 'cash' ? cashValue : total,
        change: change || 0,
        paymentMethod: selectedPaymentMethod || 'cash',
        paymentChannel: selectedChannel || null
      };
      
      console.log('🧾 PaymentScreen: Navigation params:', navigationParams);
      
      navigation.navigate('Invoice', navigationParams);

    } catch (error) {
      console.error('❌ PaymentScreen: Payment processing error:', error);
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

  // Component definition for ChannelItem - Fixed React.memo usage
  const ChannelItem = React.memo(({ item, onSelect }) => {
    return (
      <TouchableOpacity
        style={[
          styles.channelItem,
          selectedChannel?.id === item.id && styles.selectedChannelItem
        ]}
        onPress={() => onSelect(item)}
      >
        <View style={styles.channelItemHeader}>
          <View style={styles.channelItemInfo}>
            <View style={styles.channelItemTitleRow}>
              <Ionicons 
                name={getChannelTypeIcon(item.type)} 
                size={20} 
                color={getChannelTypeColor(item.type)} 
              />
              <Text style={styles.channelItemName}>{item.name}</Text>
            </View>
            <Text style={styles.channelItemType}>{item.type.toUpperCase()}</Text>
          </View>
          <View style={styles.channelItemBalance}>
            <Text style={styles.channelItemBalanceLabel}>Saldo:</Text>
            <Text style={styles.channelItemBalanceAmount}>{formatIDR(item.balance)}</Text>
          </View>
        </View>
        {selectedChannel?.id === item.id && (
          <View style={styles.selectedIndicator}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
          </View>
        )}
      </TouchableOpacity>
    );
  });

  if (loadingChannels) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Memuat channel pembayaran...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.container}>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ringkasan Pesanan</Text>
          {cart.map((item, index) => (
            <View
              key={index}
              style={[
                styles.summaryRow,
                { borderBottomWidth: 1, borderBottomColor: Colors.border, paddingBottom: 8, marginBottom: 8 }
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.summaryValue, { marginBottom: 4 }]}>{item.name}</Text>
                <Text style={styles.summaryLabel}>{item.qty} x {formatIDR(item.price)}</Text>
              </View>
              <Text style={styles.summaryValue}>{formatIDR(item.price * item.qty)}</Text>
            </View>
          ))}
          <View style={[styles.summaryRow, { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.border }]}>
            <Text style={[styles.summaryLabel, { fontWeight: 'bold', color: Colors.text }]}>Total Bayar:</Text>
            <Text style={[styles.summaryValue, { fontSize: 16, fontWeight: 'bold', color: Colors.primary }]}>{formatIDR(total)}</Text>
          </View>
        </View>

        {/* Payment Method Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Metode Pembayaran</Text>
          <View style={styles.paymentMethods}>
            <TouchableOpacity
              style={[
                styles.paymentMethodButton,
                selectedPaymentMethod === 'cash' && styles.selectedPaymentMethod
              ]}
              onPress={() => handlePaymentMethodChange('cash')}
            >
              <Ionicons name="cash" size={24} color={selectedPaymentMethod === 'cash' ? '#fff' : '#007AFF'} />
              <Text style={[
                styles.paymentMethodText,
                selectedPaymentMethod === 'cash' && styles.selectedPaymentMethodText
              ]}>Tunai</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.paymentMethodButton,
                selectedPaymentMethod === 'non-cash' && styles.selectedPaymentMethod
              ]}
              onPress={() => handlePaymentMethodChange('non-cash')}
            >
              <Ionicons name="card" size={24} color={selectedPaymentMethod === 'non-cash' ? '#fff' : '#007AFF'} />
              <Text style={[
                styles.paymentMethodText,
                selectedPaymentMethod === 'non-cash' && styles.selectedPaymentMethodText
              ]}>Non-Tunai</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Selected Payment Channel */}
        {selectedChannel && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Channel Pembayaran</Text>
            <TouchableOpacity
              style={styles.selectedChannelContainer}
              onPress={() => setShowChannelModal(true)}
            >
              <View style={styles.selectedChannelInfo}>
                <Ionicons 
                  name={getChannelTypeIcon(selectedChannel.type)} 
                  size={24} 
                  color={getChannelTypeColor(selectedChannel.type)} 
                />
                <View style={styles.selectedChannelDetails}>
                  <Text style={styles.selectedChannelName}>{selectedChannel.name}</Text>
                  <Text style={styles.selectedChannelBalance}>Saldo: {formatIDR(selectedChannel.balance)}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
            </TouchableOpacity>
          </View>
        )}

        {/* Cash Payment Input */}
        {selectedPaymentMethod === 'cash' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Jumlah Uang Tunai</Text>
            <TextInput
              style={styles.cashInput}
              value={cashAmount}
              onChangeText={setCashAmount}
              placeholder="Masukkan jumlah uang"
              keyboardType="numeric"
            />

            {/* Uang Pas Button */}
            <TouchableOpacity
              style={[styles.quickAmountButton, { width: '100%', marginTop: 10, backgroundColor: Colors.primary }]}
              onPress={() => setCashAmount(total.toString())}
            >
              <Text style={[styles.quickAmountText, { color: '#fff' }]}>Uang Pas ({formatIDR(total)})</Text>
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
        )}

        {/* Process Payment Button */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[
              styles.processButton,
              (!selectedChannel || isProcessing || (selectedPaymentMethod === 'cash' && cashValue < total)) && styles.disabledButton
            ]}
            onPress={processPaymentTransaction}
            disabled={!selectedChannel || isProcessing || (selectedPaymentMethod === 'cash' && cashValue < total)}
          >
            {isProcessing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.processButtonText}>
                {selectedPaymentMethod === 'cash' ? 'Proses Pembayaran Tunai' : 'Proses Pembayaran Non-Tunai'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Payment Channel Selection Modal */}
      <Modal
        visible={showChannelModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowChannelModal(false)}>
              <Text style={styles.modalCancelButton}>Batal</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Pilih Channel Pembayaran</Text>
            <View style={{ width: 50 }} />
          </View>
          
          <FlatList
            data={paymentChannels.filter(channel => 
              selectedPaymentMethod === 'cash' ? channel.type === 'cash' : channel.type !== 'cash'
            )}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ChannelItem item={item} onSelect={handleChannelSelect} />
            )}
            contentContainerStyle={styles.channelList}
            showsVerticalScrollIndicator={false}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
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
    marginTop: 10,
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
    color: Colors.text,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: Colors.muted,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
  paymentMethods: {
    flexDirection: 'row',
    gap: 15,
  },
  paymentMethodButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.primary,
    backgroundColor: Colors.card,
  },
  selectedPaymentMethod: {
    backgroundColor: Colors.primary,
  },
  paymentMethodText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '500',
    color: Colors.primary,
  },
  selectedPaymentMethodText: {
    color: '#fff',
  },
  selectedChannelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    paddingHorizontal: 15,
    backgroundColor: Colors.background,
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
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
  },
  selectedChannelBalance: {
    fontSize: 14,
    color: Colors.muted,
    marginTop: 2,
  },
  cashInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: Colors.card,
  },
  quickAmounts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 15,
  },
  quickAmountButton: {
    flex: 1,
    minWidth: '45%',
    paddingVertical: 10,
    paddingHorizontal: 15,
    backgroundColor: Colors.background,
    borderRadius: 8,
    alignItems: 'center',
  },
  quickAmountText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500',
  },
  changeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  changeLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
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
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  disabledButton: {
    backgroundColor: Colors.muted,
  },
  processButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
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
  },
  modalCancelButton: {
    fontSize: 16,
    color: Colors.primary,
  },
  channelList: {
    padding: 20,
  },
  channelItem: {
    backgroundColor: Colors.card,
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  selectedChannelItem: {
    borderColor: Colors.primary,
    backgroundColor: Colors.background,
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
    marginBottom: 5,
  },
  channelItemName: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 10,
    color: Colors.text,
  },
  channelItemType: {
    fontSize: 12,
    color: Colors.muted,
    textTransform: 'uppercase',
  },
  channelItemBalance: {
    alignItems: 'flex-end',
  },
  channelItemBalanceLabel: {
    fontSize: 12,
    color: Colors.muted,
  },
  channelItemBalanceAmount: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
  selectedIndicator: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
});
