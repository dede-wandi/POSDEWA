import React, { useState, useEffect, useContext } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { formatIDR } from '../../utils/currency';
import { AuthContext } from '../../context/AuthContext';
import { getInvoiceSettings } from '../../services/invoiceSettingsSupabase';

export default function InvoiceScreen({ navigation, route }) {
  const { user } = useContext(AuthContext);
  const [invoiceSettings, setInvoiceSettings] = useState(null);
  
  const { 
    saleData = {}, 
    cart = [], 
    total = 0, 
    cashAmount = 0, 
    change = 0,
    paymentMethod = 'cash',
    paymentChannel = null
  } = route.params || {};

  const currentDate = new Date();
  const invoiceNumber = `INV-${currentDate.getFullYear()}${String(currentDate.getMonth() + 1).padStart(2, '0')}${String(currentDate.getDate()).padStart(2, '0')}-${String(currentDate.getHours()).padStart(2, '0')}${String(currentDate.getMinutes()).padStart(2, '0')}`;

  // Load invoice settings
  useEffect(() => {
    const loadInvoiceSettings = async () => {
      if (user?.id) {
        const result = await getInvoiceSettings(user.id);
        if (result.success) {
          setInvoiceSettings(result.data);
        }
      }
    };
    
    loadInvoiceSettings();
  }, [user]);

  // Auto print when screen loads
  useEffect(() => {
    if (invoiceSettings !== null) {
      // Delay auto print to ensure UI is fully loaded
      const timer = setTimeout(() => {
        handleAutoPrint();
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [invoiceSettings]);

  const handlePrint = () => {
    const printContent = generatePrintContent();
    simulatePrint(printContent);
  };

  const handleAutoPrint = () => {
    const printContent = generatePrintContent();
    simulatePrint(printContent);
  };

  const generatePrintContent = () => {
    const divider = '================================';
    const smallDivider = '--------------------------------';
    
    // Use dynamic settings or fallback to defaults
    const businessName = invoiceSettings?.business_name || 'TOKO DEWA POS';
    const businessAddress = invoiceSettings?.business_address || '';
    const businessPhone = invoiceSettings?.business_phone || '';
    const footerText = invoiceSettings?.footer_text || 'Barang yang sudah dibeli tidak dapat dikembalikan';
    const showBusinessInfo = invoiceSettings?.show_business_info !== false;
    const showFooterText = invoiceSettings?.show_footer_text !== false;
    
    let content = `
${divider}
${showBusinessInfo ? `           ${businessName}` : '           INVOICE'}
${showBusinessInfo && businessAddress ? businessAddress : ''}
${showBusinessInfo && businessPhone ? businessPhone : ''}
${divider}
Invoice: ${invoiceNumber}
Tanggal: ${currentDate.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}
${smallDivider}
`;

    // Add items
    cart.forEach(item => {
      const itemTotal = item.price * item.qty;
      content += `${item.name}\n`;
      if (item.barcode) {
        content += `  ${item.barcode}\n`;
      }
      if (item.tokenCode) {
        content += `  🔑 Token: ${item.tokenCode}\n`;
      }
      content += `  ${item.qty} x ${formatIDR(item.price)} = ${formatIDR(itemTotal)}\n\n`;
    });

    content += `${smallDivider}
Subtotal: ${formatIDR(total)}
${divider}
TOTAL: ${formatIDR(total)}
Bayar: ${formatIDR(cashAmount)}
Kembalian: ${formatIDR(change)}
${divider}

${showFooterText ? `    ${footerText}` : '    Terima kasih atas kunjungan Anda!'}

${divider}
`;

    return content;
  };

  const showPrintPreview = (content) => {
    Alert.alert(
      '📄 Preview Invoice',
      content,
      [{ text: 'OK' }],
      { cancelable: true }
    );
  };

  const simulatePrint = (content) => {
    console.log('=== PRINT INVOICE ===');
    console.log(content);
    console.log('=== END PRINT ===');
    
    showToast('Invoice dikirim ke printer (simulasi)', 'success');
  };

  const handleNewSale = () => {
    navigation.navigate('Penjualan', { clearCart: true });
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🧾 Invoice</Text>
        <Text style={styles.headerSubtitle}>
          {invoiceSettings?.header_text || 'Transaksi Berhasil'}
        </Text>
      </View>

      {/* Invoice Info */}
      <View style={styles.invoiceInfo}>
        <View style={styles.invoiceRow}>
          <Text style={styles.invoiceLabel}>No. Invoice:</Text>
          <Text style={styles.invoiceValue}>{invoiceNumber}</Text>
        </View>
        <View style={styles.invoiceRow}>
          <Text style={styles.invoiceLabel}>Tanggal:</Text>
          <Text style={styles.invoiceValue}>
            {currentDate.toLocaleDateString('id-ID', {
              day: '2-digit',
              month: '2-digit', 
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </Text>
        </View>

        <View style={styles.invoiceRow}>
          <Text style={styles.invoiceLabel}>Metode Bayar:</Text>
          <Text style={styles.invoiceValue}>
            {paymentMethod === 'cash' ? 'Tunai' : 'Non-Tunai'}
          </Text>
        </View>
        {paymentChannel && (
          <View style={styles.invoiceRow}>
            <Text style={styles.invoiceLabel}>Channel:</Text>
            <Text style={styles.invoiceValue}>{paymentChannel.name}</Text>
          </View>
        )}
      </View>

      {/* Items */}
      <View style={styles.itemsSection}>
        <Text style={styles.sectionTitle}>📦 Detail Pembelian</Text>
        <View style={styles.itemsCard}>
          {/* Header */}
          <View style={styles.itemHeader}>
            <Text style={[styles.itemHeaderText, { flex: 2 }]}>Produk</Text>
            <Text style={[styles.itemHeaderText, { flex: 1, textAlign: 'center' }]}>Qty</Text>
            <Text style={[styles.itemHeaderText, { flex: 1, textAlign: 'right' }]}>Harga</Text>
            <Text style={[styles.itemHeaderText, { flex: 1, textAlign: 'right' }]}>Total</Text>
          </View>
          
          <View style={styles.itemDivider} />
          
          {/* Items */}
          {cart.map((item, index) => (
            <View key={index} style={styles.itemRow}>
              <View style={{ flex: 2 }}>
                <Text style={styles.itemName}>{item.name}</Text>
                {item.barcode && (
                  <Text style={styles.itemBarcode}>{item.barcode}</Text>
                )}
                {item.tokenCode && (
                  <Text style={styles.itemToken}>🔑 Token: {item.tokenCode}</Text>
                )}
              </View>
              <Text style={[styles.itemText, { flex: 1, textAlign: 'center' }]}>
                {item.qty}
              </Text>
              <Text style={[styles.itemText, { flex: 1, textAlign: 'right' }]}>
                {formatIDR(item.price)}
              </Text>
              <Text style={[styles.itemText, { flex: 1, textAlign: 'right' }]}>
                {formatIDR(item.price * item.qty)}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Summary */}
      <View style={styles.summarySection}>
        <Text style={styles.sectionTitle}>💰 Ringkasan Pembayaran</Text>
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal:</Text>
            <Text style={styles.summaryValue}>{formatIDR(total)}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabelTotal}>Total:</Text>
            <Text style={styles.summaryValueTotal}>{formatIDR(total)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Bayar ({paymentMethod === 'cash' ? 'Tunai' : paymentChannel?.name || 'Non-Tunai'}):</Text>
            <Text style={styles.summaryValue}>{formatIDR(cashAmount)}</Text>
          </View>
          {paymentMethod === 'cash' && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Kembalian:</Text>
              <Text style={styles.summaryValue}>{formatIDR(change)}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actionsSection}>
        <TouchableOpacity style={styles.printButton} onPress={handlePrint}>
          <Text style={styles.printButtonText}>🖨️ Print Invoice</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.newSaleButton} onPress={handleNewSale}>
          <Text style={styles.newSaleButtonText}>🛒 Transaksi Baru</Text>
        </TouchableOpacity>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {invoiceSettings?.footer_text || 'Terima kasih atas kunjungan Anda!'}
        </Text>
        <Text style={styles.footerSubtext}>Barang yang sudah dibeli tidak dapat dikembalikan</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    backgroundColor: '#28a745',
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.9,
  },
  invoiceInfo: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  invoiceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  invoiceLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  invoiceValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: 'bold',
  },
  itemsSection: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  itemsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  itemHeader: {
    flexDirection: 'row',
    paddingVertical: 8,
  },
  itemHeaderText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    textTransform: 'uppercase',
  },
  itemDivider: {
    height: 1,
    backgroundColor: '#e9ecef',
    marginVertical: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f8f9fa',
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  itemBarcode: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  itemToken: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 2,
    fontStyle: 'italic',
  },
  itemText: {
    fontSize: 14,
    color: '#333',
  },
  summarySection: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  summaryLabelTotal: {
    fontSize: 16,
    color: '#333',
    fontWeight: 'bold',
  },
  summaryValueTotal: {
    fontSize: 18,
    color: '#28a745',
    fontWeight: 'bold',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#e9ecef',
    marginVertical: 8,
  },
  actionsSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  printButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  printButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  newSaleButton: {
    backgroundColor: '#28a745',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  newSaleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  footerText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  footerSubtext: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
});