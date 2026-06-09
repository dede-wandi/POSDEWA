import React, { useState, useEffect, useContext } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatIDR } from '../../utils/currency';
import { AuthContext } from '../../context/AuthContext';
import { getInvoiceSettings } from '../../services/invoiceSettingsSupabase';
import { useToast } from '../../contexts/ToastContext';
import { Colors, Spacing, Radii, Shadows, Typography } from '../../theme';

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
    
    Alert.alert(
      '✅ Print Berhasil',
      'Invoice telah dikirim ke printer (simulasi).\n\nPada implementasi nyata, ini akan mengirim data ke printer thermal atau printer lainnya.',
      [{ text: 'OK' }]
    );
  };

  const handleNewSale = () => {
    navigation.navigate('Penjualan', { clearCart: true });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.white,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: Colors.white,
    opacity: 0.9,
  },
  invoiceInfo: {
    backgroundColor: Colors.card,
    margin: 16,
    padding: 16,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.card,
  },
  invoiceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  invoiceLabel: {
    fontSize: 14,
    color: Colors.muted,
    fontWeight: '500',
  },
  invoiceValue: {
    fontSize: 14,
    color: Colors.darkText,
    fontWeight: 'bold',
  },
  itemsSection: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.darkText,
    marginBottom: 12,
  },
  itemsCard: {
    backgroundColor: Colors.card,
    borderRadius: Radii.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.card,
  },
  itemHeader: {
    flexDirection: 'row',
    paddingVertical: 8,
  },
  itemHeaderText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.muted,
    textTransform: 'uppercase',
  },
  itemDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.darkText,
  },
  itemBarcode: {
    fontSize: 12,
    color: Colors.muted,
    marginTop: 2,
  },
  itemToken: {
    fontSize: 12,
    color: Colors.secondary,
    marginTop: 2,
    fontStyle: 'italic',
  },
  itemText: {
    fontSize: 14,
    color: Colors.text,
  },
  summarySection: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  summaryCard: {
    backgroundColor: Colors.card,
    borderRadius: Radii.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.card,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: Colors.muted,
  },
  summaryValue: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500',
  },
  summaryLabelTotal: {
    fontSize: 16,
    color: Colors.darkText,
    fontWeight: 'bold',
  },
  summaryValueTotal: {
    fontSize: 18,
    color: Colors.primary,
    fontWeight: 'bold',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: 8,
  },
  actionsSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  printButton: {
    backgroundColor: Colors.secondary,
    paddingVertical: 16,
    borderRadius: Radii.lg,
    alignItems: 'center',
    marginBottom: 12,
  },
  printButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  newSaleButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: Radii.lg,
    alignItems: 'center',
  },
  newSaleButtonText: {
    color: Colors.white,
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
    color: Colors.darkText,
    marginBottom: 4,
  },
  footerSubtext: {
    fontSize: 12,
    color: Colors.muted,
    textAlign: 'center',
  },
});
