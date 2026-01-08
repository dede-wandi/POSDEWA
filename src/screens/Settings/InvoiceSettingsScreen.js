import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  Alert,
  Switch,
  ActivityIndicator,
  Platform,
  Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { getInvoiceSettings, updateInvoiceSettings, resetInvoiceSettings } from '../../services/invoiceSettingsSupabase';
import { detectPairedPrinters, connectBluetoothPrinter, checkPrinterConnection, testBluetoothPrint, testWebPrint } from '../../utils/invoicePrint';
import * as Print from 'expo-print';
import { getItemAsync, setItemAsync, deleteItemAsync } from '../../utils/storage';

export default function InvoiceSettingsScreen({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    business_name: '',
    business_address: '',
    business_phone: '',
    business_email: '',
    header_text: '',
    footer_text: '',
    logo_url: '',
    show_logo: true,
    show_business_info: true,
    show_header_text: true,
    show_footer_text: true
  });
  const [selectedPrinter, setSelectedPrinter] = useState({ name: '', url: '' });
  const [pairedPrinters, setPairedPrinters] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [checkingConn, setCheckingConn] = useState(false);
  const [selectPrompt, setSelectPrompt] = useState('');
  const isWeb = Platform.OS === 'web';

  useEffect(() => {
    loadSettings();
    (async () => {
      const name = await getItemAsync('printer.name');
      const url = await getItemAsync('printer.url');
      setSelectedPrinter({ name: name || '', url: url || '' });
      await refreshConnectionStatus();
    })();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      if (user?.id) {
        const result = await getInvoiceSettings(user.id);
        if (result.success && result.data) {
          setSettings({
            business_name: result.data.business_name || '',
            business_address: result.data.business_address || '',
            business_phone: result.data.business_phone || '',
            business_email: result.data.business_email || '',
            header_text: result.data.header_text || '',
            footer_text: result.data.footer_text || '',
            logo_url: result.data.header_logo_url || '',
            show_logo: result.data.show_header_logo || false,
            show_business_info: result.data.show_business_info !== false,
            show_header_text: true,
            show_footer_text: result.data.show_footer_text !== false
          });
        } else {
          console.error('Failed to load invoice settings:', result.error);
          Alert.alert('Error', result.error || 'Gagal memuat pengaturan invoice');
        }
      }
    } catch (error) {
      console.error('Error loading invoice settings:', error);
      Alert.alert('Error', 'Gagal memuat pengaturan invoice');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      if (user?.id) {
        // Map screen settings to database fields
        const dbSettings = {
          business_name: settings.business_name,
          business_address: settings.business_address,
          business_phone: settings.business_phone,
          business_email: settings.business_email,
          header_text: settings.header_text,
          footer_text: settings.footer_text,
          header_logo_url: settings.logo_url,
          show_header_logo: settings.show_logo,
          show_business_info: settings.show_business_info,
          show_footer_text: settings.show_footer_text
        };
        
        const result = await updateInvoiceSettings(user.id, dbSettings);
        if (result.success) {
          Alert.alert('Berhasil', 'Pengaturan invoice berhasil disimpan');
        } else {
          console.error('Failed to save invoice settings:', result.error);
          Alert.alert('Error', result.error || 'Gagal menyimpan pengaturan invoice');
        }
      }
    } catch (error) {
      console.error('Error saving invoice settings:', error);
      Alert.alert('Error', 'Gagal menyimpan pengaturan invoice');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    Alert.alert(
      'Reset Pengaturan',
      'Apakah Anda yakin ingin mereset pengaturan ke default?',
      [
        { text: 'Batal', style: 'cancel' },
        { 
          text: 'Reset', 
          style: 'destructive',
          onPress: async () => {
            try {
              setSaving(true);
              if (user?.id) {
                const defaultSettings = await resetInvoiceSettings(user.id);
                setSettings(defaultSettings);
                Alert.alert('Berhasil', 'Pengaturan berhasil direset');
              }
            } catch (error) {
              console.error('Error resetting invoice settings:', error);
              Alert.alert('Error', 'Gagal mereset pengaturan');
            } finally {
              setSaving(false);
            }
          }
        }
      ]
    );
  };

  const updateSetting = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };
  
  const selectPrinter = async () => {
    if (isWeb) {
      Alert.alert('Info', 'Di Web, pemilihan printer dilakukan melalui dialog print browser saat Anda mencetak invoice.');
      return;
    }
    setScanning(true);
    const list = await detectPairedPrinters();
    setPairedPrinters(list);
    setScanning(false);
    if (list.length === 0) {
      setSelectPrompt('');
      try {
        await Linking.openSettings();
      } catch (e) {
        try {
          await Linking.openURL('app-settings:');
        } catch {}
      }
      Alert.alert('Info', 'Buka pengaturan Bluetooth dan sambungkan printer dulu.');
    } else {
      setSelectPrompt('Silakan pilih perangkat dari daftar di bawah untuk digunakan mencetak.');
    }
  };
  
  const clearPrinter = async () => {
    await deleteItemAsync('printer.name');
    await deleteItemAsync('printer.url');
    setSelectedPrinter({ name: '', url: '' });
    Alert.alert('Selesai', 'Pilihan printer dihapus');
  };
  
  const detectPrinters = async () => {
    if (isWeb) {
      setPairedPrinters([]);
      setScanning(false);
      Alert.alert('Info', 'Deteksi Bluetooth tidak tersedia di mode Web. Gunakan dialog print browser saat mencetak.');
      return;
    }
    setScanning(true);
    const list = await detectPairedPrinters();
    setPairedPrinters(list);
    setScanning(false);
    if (list.length === 0) {
      Alert.alert('Info', 'Tidak ada printer bluetooth yang terdeteksi');
    }
  };
  
  const refreshConnectionStatus = async () => {
    setCheckingConn(true);
    const status = await checkPrinterConnection();
    setIsConnected(!!status.connected);
    setCheckingConn(false);
  };
  
  const connectPrinterBluetooth = async (device) => {
    const result = await connectBluetoothPrinter(device.address);
    if (result.success) {
      await setItemAsync('printer.name', device.name || device.device || '');
      await setItemAsync('printer.address', device.address);
      setSelectedPrinter({ name: device.name || device.device || '', url: '' });
      setIsConnected(true);
      Alert.alert('Berhasil', `Terhubung ke ${device.name || device.device}`);
    } else {
      Alert.alert('Error', result.error || 'Gagal menghubungkan printer');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Pengaturan Invoice</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Memuat pengaturan...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pengaturan Invoice</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          {/* Business Information Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🏢 Informasi Bisnis</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nama Bisnis</Text>
              <TextInput
                style={styles.textInput}
                value={settings.business_name}
                onChangeText={(text) => updateSetting('business_name', text)}
                placeholder="Masukkan nama bisnis"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Alamat Bisnis</Text>
              <TextInput
                style={[styles.textInput, styles.multilineInput]}
                value={settings.business_address}
                onChangeText={(text) => updateSetting('business_address', text)}
                placeholder="Masukkan alamat bisnis"
                placeholderTextColor="#999"
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nomor Telepon</Text>
              <TextInput
                style={styles.textInput}
                value={settings.business_phone}
                onChangeText={(text) => updateSetting('business_phone', text)}
                placeholder="Masukkan nomor telepon"
                placeholderTextColor="#999"
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email Bisnis</Text>
              <TextInput
                style={styles.textInput}
                value={settings.business_email}
                onChangeText={(text) => updateSetting('business_email', text)}
                placeholder="Masukkan email bisnis"
                placeholderTextColor="#999"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* Header & Footer Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📝 Header & Footer</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Teks Header</Text>
              <TextInput
                style={[styles.textInput, styles.multilineInput]}
                value={settings.header_text}
                onChangeText={(text) => updateSetting('header_text', text)}
                placeholder="Teks yang akan muncul di bagian atas invoice"
                placeholderTextColor="#999"
                multiline
                numberOfLines={2}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Teks Footer</Text>
              <TextInput
                style={[styles.textInput, styles.multilineInput]}
                value={settings.footer_text}
                onChangeText={(text) => updateSetting('footer_text', text)}
                placeholder="Teks yang akan muncul di bagian bawah invoice"
                placeholderTextColor="#999"
                multiline
                numberOfLines={2}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>URL Logo</Text>
              <TextInput
                style={styles.textInput}
                value={settings.logo_url}
                onChangeText={(text) => updateSetting('logo_url', text)}
                placeholder="https://example.com/logo.png"
                placeholderTextColor="#999"
                keyboardType="url"
                autoCapitalize="none"
              />
            </View>
          </View>
          
          {/* Printer Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{isWeb ? '🖨️ Pengaturan Cetak Browser' : '🖨️ Printer Bluetooth'}</Text>
            {!isWeb ? (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Printer Terpilih</Text>
                  <Text style={styles.selectedPrinterText}>{selectedPrinter.name || 'Belum dipilih'}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={{ fontSize: 14, color: isConnected ? '#28a745' : '#FF3B30' }}>
                    {isConnected ? '✅ Terhubung' : '❌ Tidak Terhubung'}
                  </Text>
                  <TouchableOpacity onPress={refreshConnectionStatus} style={{ marginLeft: 10 }}>
                    <Text style={{ color: '#007AFF' }}>{checkingConn ? 'Memeriksa…' : 'Periksa Koneksi'}</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity style={styles.saveButton} onPress={selectPrinter}>
                    <Text style={styles.saveButtonText}>Pilih Printer</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.resetButton, { marginLeft: 10 }]} onPress={clearPrinter}>
                    <Text style={styles.resetButtonText}>Hapus Pilihan</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ marginTop: 12 }}>
                  <TouchableOpacity style={styles.saveButton} onPress={detectPrinters}>
                    <Text style={styles.saveButtonText}>{scanning ? 'Mencari…' : 'Deteksi Printer Bluetooth'}</Text>
                  </TouchableOpacity>
                  {selectPrompt ? (
                    <Text style={{ marginTop: 8, color: '#6c757d' }}>{selectPrompt}</Text>
                  ) : null}
                  <TouchableOpacity style={[styles.saveButton, { marginTop: 8 }]} onPress={selectPrinter}>
                    <Text style={styles.saveButtonText}>Pilih Printer</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.saveButton, { marginTop: 8 }]} onPress={async () => {
                    const res = await testBluetoothPrint('58mm');
                    if (res.success) {
                      Alert.alert('Berhasil', 'Uji cetak 58mm berhasil dikirim ke printer');
                    } else {
                      Alert.alert('Error', res.error || 'Gagal uji cetak. Pastikan printer terhubung.');
                    }
                  }}>
                    <Text style={styles.saveButtonText}>Uji Cetak 58mm</Text>
                  </TouchableOpacity>
                  {pairedPrinters.map((dev, idx) => (
                    <View key={`${dev.address}-${idx}`} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
                      <Text style={{ flex: 1 }}>{(dev.name || dev.device || 'Printer') + ' (' + dev.address + ')'}</Text>
                      <TouchableOpacity style={[styles.saveButton, { paddingHorizontal: 10 }]} onPress={() => connectPrinterBluetooth(dev)}>
                        <Text style={styles.saveButtonText}>Hubungkan</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Cara Cetak</Text>
                  <Text style={styles.selectedPrinterText}>Gunakan dialog print browser saat mencetak invoice.</Text>
                </View>
                <TouchableOpacity style={styles.saveButton} onPress={async () => {
                  const res = await testWebPrint('58mm');
                  if (res.success) {
                    Alert.alert('Berhasil', 'Dialog print browser dibuka untuk uji cetak 58mm');
                  } else {
                    Alert.alert('Error', res.error || 'Gagal membuka dialog print di browser');
                  }
                }}>
                  <Text style={styles.saveButtonText}>Uji Cetak via Browser (58mm)</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Display Options Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>👁️ Opsi Tampilan</Text>
            
            <View style={styles.switchGroup}>
              <Text style={styles.switchLabel}>Tampilkan Logo</Text>
              <Switch
                value={settings.show_logo}
                onValueChange={(value) => updateSetting('show_logo', value)}
                trackColor={{ false: '#E5E5EA', true: '#007AFF' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.switchGroup}>
              <Text style={styles.switchLabel}>Tampilkan Info Bisnis</Text>
              <Switch
                value={settings.show_business_info}
                onValueChange={(value) => updateSetting('show_business_info', value)}
                trackColor={{ false: '#E5E5EA', true: '#007AFF' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.switchGroup}>
              <Text style={styles.switchLabel}>Tampilkan Header Text</Text>
              <Switch
                value={settings.show_header_text}
                onValueChange={(value) => updateSetting('show_header_text', value)}
                trackColor={{ false: '#E5E5EA', true: '#007AFF' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.switchGroup}>
              <Text style={styles.switchLabel}>Tampilkan Footer Text</Text>
              <Switch
                value={settings.show_footer_text}
                onValueChange={(value) => updateSetting('show_footer_text', value)}
                trackColor={{ false: '#E5E5EA', true: '#007AFF' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionSection}>
            <TouchableOpacity 
              style={[styles.saveButton, saving && styles.disabledButton]} 
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>💾 Simpan Pengaturan</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.resetButton, saving && styles.disabledButton]} 
              onPress={handleReset}
              disabled={saving}
            >
              <Text style={styles.resetButtonText}>🔄 Reset ke Default</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
  placeholder: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 16,
  },
  selectedPrinterText: {
    fontSize: 14,
    color: '#333',
    marginTop: 6
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#000',
    backgroundColor: '#FFFFFF',
  },
  multilineInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  switchGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  switchLabel: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  actionSection: {
    marginTop: 20,
  },
  saveButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resetButton: {
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  resetButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledButton: {
    opacity: 0.6,
  },
});
