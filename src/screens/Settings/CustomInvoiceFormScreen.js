import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, Switch, StyleSheet, Alert, Platform, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme';
import { createCustomInvoice, updateCustomInvoice } from '../../services/customInvoiceSupabase';
import { useToast } from '../../contexts/ToastContext';
import { formatIDR } from '../../utils/currency';
import { printCustomInvoice, detectPairedPrinters, connectBluetoothPrinter } from '../../utils/invoicePrint';
import { useAuth } from '../../context/AuthContext';
import { getItemAsync } from '../../utils/storage';

export default function CustomInvoiceFormScreen({ navigation, route }) {
  const { invoice } = route.params || {};
  const isEdit = !!invoice;
  const { showToast } = useToast();
  const { user } = useAuth();

  // Basic Info
  const [title, setTitle] = useState(invoice?.title || '');
  const [customerName, setCustomerName] = useState(invoice?.customer_name || '');
  const [transactionDate, setTransactionDate] = useState(new Date(invoice?.created_at || Date.now()));
  
  // Custom Key-Value Details
  const [details, setDetails] = useState(invoice?.details || []);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteContent, setPasteContent] = useState('');

  // Printer Management
  const [showPrinterModal, setShowPrinterModal] = useState(false);
  const [pairedPrinters, setPairedPrinters] = useState([]);
  const [scanningPrinters, setScanningPrinters] = useState(false);

  // Settings
  const [paperSize, setPaperSize] = useState(invoice?.paper_size || '58mm');
  const [headerContent, setHeaderContent] = useState(invoice?.header_content || '');
  const [footerContent, setFooterContent] = useState(invoice?.footer_content || '');
  const [showLogo, setShowLogo] = useState(invoice?.show_logo ?? true);
  
  // Items
  const [items, setItems] = useState(invoice?.items || []);
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);
  
  // Collapsible sections
  const [showSettings, setShowSettings] = useState(false);

  const totalAmount = useMemo(() => {
    return items.reduce((sum, item) => sum + (Number(item.qty) * Number(item.price)), 0);
  }, [items]);

  const handleAddItem = () => {
    setItems([...items, { id: Date.now(), name: '', qty: '1', price: '0' }]);
  };

  const handleRemoveItem = (index) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    setItems(newItems);
  };

  const handleUpdateItem = (index, field, value) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  // Details Management
  const handleAddDetail = () => {
    setDetails([...details, { key: '', value: '' }]);
  };

  const handleRemoveDetail = (index) => {
    const newDetails = [...details];
    newDetails.splice(index, 1);
    setDetails(newDetails);
  };

  const handleUpdateDetail = (index, field, value) => {
    const newDetails = [...details];
    newDetails[index] = { ...newDetails[index], [field]: value };
    setDetails(newDetails);
  };

  const handleSmartPaste = () => {
    if (!pasteContent.trim()) {
      setShowPasteModal(false);
      return;
    }

    const lines = pasteContent.split('\n');
    const newDetails = [...details];

    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;

      if (trimmed.includes(':')) {
        const parts = trimmed.split(':');
        const key = parts[0].trim();
        const value = parts.slice(1).join(':').trim();
        if (key) {
          newDetails.push({ key, value });
        }
      } else {
        // Fallback: If no colon, add whole line as Key
        // User can manually move part to value if needed
        newDetails.push({ key: trimmed, value: '' });
      }
    });

    setDetails(newDetails);
    setPasteContent('');
    setShowPasteModal(false);
    showToast('Berhasil memproses teks', 'success');
  };

  const handleSave = async () => {
    if (!title.trim()) {
      showToast('Judul/Nama Transaksi harus diisi', 'error');
      return;
    }

    if (items.length === 0 && details.length === 0) {
      showToast('Minimal harus ada Item atau Detail Transaksi', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title,
        customer_name: customerName,
        paper_size: paperSize,
        header_content: headerContent,
        footer_content: footerContent,
        show_logo: showLogo,
        items: items.map(i => ({
          name: i.name,
          qty: Number(i.qty),
          price: Number(i.price),
          total: Number(i.qty) * Number(i.price)
        })),
        details: details.filter(d => d.key), // Save details even if value is empty
        total_amount: totalAmount,
        updated_at: new Date().toISOString(),
        user_id: user?.id
      };

      if (isEdit) {
        await updateCustomInvoice(invoice.id, payload);
        showToast('Transaksi berhasil diperbarui', 'success');
      } else {
        await createCustomInvoice(payload);
        showToast('Transaksi berhasil disimpan', 'success');
      }
      navigation.goBack();
    } catch (error) {
      console.error('Error saving invoice:', error);
      showToast('Gagal menyimpan transaksi', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = async () => {
    if (items.length === 0 && details.length === 0) {
      showToast('Data transaksi (Item atau Detail) masih kosong', 'error');
      return;
    }

    if (Platform.OS !== 'web') {
      const printerAddress = await getItemAsync('printer.address');
      if (!printerAddress) {
        Alert.alert(
          'Printer Belum Terhubung',
          'Apakah Anda ingin mencari dan menghubungkan printer Bluetooth?',
          [
            { text: 'Batal', style: 'cancel', onPress: () => processPrint() },
            { text: 'Cari Printer', onPress: () => openPrinterModal() }
          ]
        );
        return;
      }
    }

    processPrint();
  };

  const processPrint = async () => {
    showToast('Memproses cetakan...', 'info');
    setPrinting(true);
    try {
      const invoiceData = {
        title,
        customer_name: customerName,
        paper_size: paperSize,
        header_content: headerContent,
        footer_content: footerContent,
        show_logo: showLogo,
        items: items.map(i => ({
          name: i.name,
          qty: Number(i.qty),
          price: Number(i.price),
          total: Number(i.qty) * Number(i.price)
        })),
        details: details.filter(d => d.key),
        total_amount: totalAmount,
        created_at: transactionDate.toISOString()
      };

      const result = await printCustomInvoice(invoiceData, user?.id);
      
      if (result.success) {
        showToast('Perintah cetak dikirim', 'success');
      } else {
        Alert.alert('Gagal Mencetak', result.error || 'Terjadi kesalahan saat mencetak');
      }
    } catch (error) {
      console.error('Print error:', error);
      Alert.alert('Error', 'Gagal memproses cetakan');
    } finally {
      setPrinting(false);
    }
  };

  const openPrinterModal = async () => {
    setShowPrinterModal(true);
    scanPrinters();
  };

  const scanPrinters = async () => {
    setScanningPrinters(true);
    try {
      const printers = await detectPairedPrinters();
      setPairedPrinters(printers);
      if (printers.length === 0) {
        showToast('Tidak ada printer terdeteksi. Pastikan Bluetooth nyala.', 'info');
      }
    } catch (e) {
      showToast('Gagal memindai printer', 'error');
    } finally {
      setScanningPrinters(false);
    }
  };

  const handleConnectPrinter = async (printer) => {
    showToast(`Menghubungkan ke ${printer.name || 'Printer'}...`, 'info');
    const result = await connectBluetoothPrinter(printer.address);
    if (result.success) {
      showToast('Printer terhubung!', 'success');
      setShowPrinterModal(false);
      // Auto print setelah connect agar user tidak perlu klik print lagi
      setTimeout(() => {
        processPrint();
      }, 500);
    } else {
      showToast(result.error || 'Gagal terhubung ke printer', 'error');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEdit ? 'Edit Transaksi' : 'Transaksi Baru'}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={openPrinterModal} style={[styles.actionButton, { marginRight: 8 }]}>
            <Ionicons name="bluetooth" size={24} color={Colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handlePrint} disabled={printing} style={styles.actionButton}>
            <Ionicons name="print" size={24} color={printing ? '#CCC' : Colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSave} disabled={saving} style={[styles.actionButton, styles.saveButton]}>
            <Text style={styles.saveButtonText}>{saving ? '...' : 'Simpan'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Info Utama */}
        <View style={styles.card}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Judul Transaksi</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Misal: Pembayaran Listrik, Jasa Servis, dll"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nama Pelanggan (Opsional)</Text>
            <TextInput
              style={styles.input}
              value={customerName}
              onChangeText={setCustomerName}
              placeholder="Nama pelanggan..."
            />
          </View>
        </View>

        {/* Detail Tambahan (Key-Value) */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Detail Tambahan</Text>
            <View style={{ flexDirection: 'row' }}>
              <TouchableOpacity onPress={() => setShowPasteModal(true)} style={[styles.addItemButton, { marginRight: 8, backgroundColor: '#4A90E2' }]}>
                <Ionicons name="clipboard-outline" size={20} color="#FFF" />
                <Text style={styles.addItemText}> Paste</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleAddDetail} style={styles.addItemButton}>
                <Ionicons name="add" size={20} color="#FFF" />
                <Text style={styles.addItemText}>Tambah Info</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={styles.helperText}>Contoh: Bank Tujuan, No. Referensi, Jatuh Tempo, dll.</Text>

          {details.map((detail, index) => (
            <View key={index} style={styles.itemRow}>
               <View style={styles.itemHeader}>
                <Text style={styles.itemNumber}>#{index + 1}</Text>
                <TouchableOpacity onPress={() => handleRemoveDetail(index)} style={styles.removeButton}>
                  <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.itemMetaRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <TextInput
                    style={styles.input}
                    value={detail.key}
                    onChangeText={(text) => handleUpdateDetail(index, 'key', text)}
                    placeholder="Label (mis: Bank)"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <TextInput
                    style={styles.input}
                    value={detail.value}
                    onChangeText={(text) => handleUpdateDetail(index, 'value', text)}
                    placeholder="Isi (mis: BCA)"
                  />
                </View>
              </View>
              {index < details.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
          
          {details.length === 0 && (
            <Text style={styles.emptyText}>Belum ada detail tambahan.</Text>
          )}
        </View>

        {/* Daftar Item */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Item Transaksi</Text>
            <TouchableOpacity onPress={handleAddItem} style={styles.addItemButton}>
              <Ionicons name="add" size={20} color="#FFF" />
              <Text style={styles.addItemText}>Tambah Item</Text>
            </TouchableOpacity>
          </View>

          {items.map((item, index) => (
            <View key={item.id || index} style={styles.itemRow}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemNumber}>#{index + 1}</Text>
                <TouchableOpacity onPress={() => handleRemoveItem(index)} style={styles.removeButton}>
                  <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                </TouchableOpacity>
              </View>
              
              <TextInput
                style={[styles.input, styles.itemInput]}
                value={item.name}
                onChangeText={(text) => handleUpdateItem(index, 'name', text)}
                placeholder="Nama Item / Jasa"
              />
              
              <View style={styles.itemMetaRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.labelSmall}>Qty</Text>
                  <TextInput
                    style={styles.input}
                    value={String(item.qty)}
                    onChangeText={(text) => handleUpdateItem(index, 'qty', text.replace(/[^0-9]/g, ''))}
                    keyboardType="numeric"
                    placeholder="1"
                  />
                </View>
                <View style={{ flex: 2 }}>
                  <Text style={styles.labelSmall}>Harga Satuan</Text>
                  <TextInput
                    style={styles.input}
                    value={String(item.price)}
                    onChangeText={(text) => handleUpdateItem(index, 'price', text.replace(/[^0-9]/g, ''))}
                    keyboardType="numeric"
                    placeholder="0"
                  />
                </View>
              </View>
              
              <View style={styles.itemTotalRow}>
                <Text style={styles.itemTotalLabel}>Subtotal:</Text>
                <Text style={styles.itemTotalValue}>
                  {formatIDR(Number(item.qty) * Number(item.price))}
                </Text>
              </View>
              
              {index < items.length - 1 && <View style={styles.divider} />}
            </View>
          ))}

          {items.length === 0 && (
            <Text style={styles.emptyText}>Belum ada item ditambahkan.</Text>
          )}

          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>TOTAL:</Text>
            <Text style={styles.grandTotalValue}>{formatIDR(totalAmount)}</Text>
          </View>
        </View>

        {/* Pengaturan Struk (Collapsible) */}
        <TouchableOpacity 
          style={styles.settingsHeader} 
          onPress={() => setShowSettings(!showSettings)}
        >
          <Text style={styles.settingsTitle}>Pengaturan Struk</Text>
          <Ionicons name={showSettings ? "chevron-up" : "chevron-down"} size={20} color="#666" />
        </TouchableOpacity>

        {showSettings && (
          <View style={styles.card}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Header (Atas)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={headerContent}
                onChangeText={setHeaderContent}
                placeholder="Teks kop surat / header..."
                multiline
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Footer (Bawah)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={footerContent}
                onChangeText={setFooterContent}
                placeholder="Ucapan terima kasih..."
                multiline
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Ukuran Kertas</Text>
              <View style={styles.paperSizeContainer}>
                {['58mm', '80mm'].map((size) => (
                  <TouchableOpacity
                    key={size}
                    style={[styles.paperSizeOption, paperSize === size && styles.paperSizeSelected]}
                    onPress={() => setPaperSize(size)}
                  >
                    <Text style={[styles.paperSizeText, paperSize === size && styles.paperSizeTextSelected]}>{size}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        )}
      </ScrollView>
      <Modal
        visible={showPrinterModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPrinterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pilih Printer Bluetooth</Text>
              <TouchableOpacity onPress={() => setShowPrinterModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.modalHelper}>
              Pastikan printer menyala dan sudah di-pairing di pengaturan HP.
            </Text>

            <View style={{ maxHeight: 300 }}>
              <ScrollView>
                {scanningPrinters ? (
                  <Text style={{ textAlign: 'center', padding: 20, color: '#666' }}>Memindai printer...</Text>
                ) : pairedPrinters.length > 0 ? (
                  pairedPrinters.map((printer, index) => (
                    <TouchableOpacity 
                      key={index} 
                      style={styles.printerItem}
                      onPress={() => handleConnectPrinter(printer)}
                    >
                      <Ionicons name="print-outline" size={24} color={Colors.primary} />
                      <View style={{ marginLeft: 12 }}>
                        <Text style={styles.printerName}>{printer.name || 'Unknown Printer'}</Text>
                        <Text style={styles.printerAddress}>{printer.address}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color="#CCC" style={{ marginLeft: 'auto' }} />
                    </TouchableOpacity>
                  ))
                ) : (
                  <View style={{ alignItems: 'center', padding: 20 }}>
                    <Text style={{ color: '#666', marginBottom: 10 }}>Tidak ada printer ditemukan</Text>
                    <TouchableOpacity onPress={scanPrinters} style={styles.retryButton}>
                      <Text style={styles.retryButtonText}>Coba Lagi</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showPasteModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPasteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Paste Data Transaksi</Text>
              <TouchableOpacity onPress={() => setShowPasteModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalHelper}>
              Tempel teks transaksi di sini.
            </Text>
            <Text style={[styles.modalHelper, { fontSize: 12, marginTop: -8 }]}>
              Tips: Gunakan ":" (titik dua) untuk memisahkan Label dan Isi.
              Contoh: "Bank : BCA"
            </Text>
            <TextInput
              style={[styles.input, styles.pasteInput]}
              value={pasteContent}
              onChangeText={setPasteContent}
              placeholder="Paste teks di sini..."
              multiline
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setPasteContent('')} style={styles.clearButton}>
                <Text style={styles.clearButtonText}>Bersihkan</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSmartPaste} style={styles.processButton}>
                <Text style={styles.processButtonText}>Proses</Text>
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
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFF',
    elevation: 2,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    flex: 1,
    marginLeft: 16,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    marginLeft: 12,
    padding: 8,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  saveButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    elevation: 1,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 6,
  },
  labelSmall: {
    fontSize: 12,
    color: '#777',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    color: Colors.text,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
  },
  addItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  addItemText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    elevation: 5,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalHelper: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  printerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  printerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  printerAddress: {
    fontSize: 12,
    color: '#888',
  },
  retryButton: {
    backgroundColor: '#EEE',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#333',
    fontWeight: '500',
  },
  pasteInput: {
    height: 200,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  clearButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CCC',
  },
  clearButtonText: {
    color: '#666',
    fontWeight: '600',
  },
  processButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  processButtonText: {
    color: '#FFF',
    fontWeight: '600',
  },
  itemRow: {
    marginBottom: 16,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemNumber: {
    fontWeight: 'bold',
    color: '#999',
  },
  removeButton: {
    padding: 4,
  },
  itemInput: {
    marginBottom: 8,
  },
  itemMetaRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  itemTotalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  itemTotalLabel: {
    marginRight: 8,
    color: '#666',
  },
  itemTotalValue: {
    fontWeight: 'bold',
    color: Colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: '#EEE',
    marginVertical: 12,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    fontStyle: 'italic',
    padding: 16,
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  grandTotalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  grandTotalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  settingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFF',
    borderRadius: 8,
    marginBottom: 8,
  },
  settingsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
  },
  paperSizeContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  paperSizeOption: {
    flex: 1,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    alignItems: 'center',
  },
  paperSizeSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  paperSizeText: {
    fontSize: 14,
    color: '#555',
  },
  paperSizeTextSelected: {
    color: '#FFF',
    fontWeight: 'bold',
  },
});
