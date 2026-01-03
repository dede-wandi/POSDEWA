import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  Alert, 
  StyleSheet, 
  TextInput,
  Modal,
  ScrollView,
  RefreshControl,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';
import { formatIDR } from '../../utils/currency';
import { useAuth } from '../../context/AuthContext';
import { getSalesHistory, getSaleById } from '../../services/salesSupabase';
import { printInvoiceToPDF, shareInvoicePDF, shareToWhatsApp } from '../../utils/invoicePrint';

export default function HistoryScreen({ navigation }) {
  const { user } = useAuth();
  const [sales, setSales] = useState([]);
  const [filteredSales, setFilteredSales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPeriod, setFilterPeriod] = useState('all'); // all, today, yesterday, week, month, year, custom
  const [selectedSale, setSelectedSale] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Custom Date Picker State
  const [customDateRange, setCustomDateRange] = useState({
    startDate: new Date(),
    endDate: new Date()
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [markedDates, setMarkedDates] = useState({});
  const [tempDateRange, setTempDateRange] = useState({
    startDate: null,
    endDate: null
  });

  useEffect(() => {
    loadSalesHistory();
  }, []);

  useEffect(() => {
    filterSales();
  }, [sales, searchQuery, filterPeriod, customDateRange]);

  const loadSalesHistory = async () => {
    console.log('🔄 HistoryScreen: Loading sales history for user:', user?.id);
    setLoading(true);
    try {
      const result = await getSalesHistory(user?.id);
      console.log('✅ HistoryScreen: Sales history loaded:', result?.length || 0, 'items');
      setSales(result || []);
    } catch (error) {
      console.error('❌ HistoryScreen: Error loading sales history:', error);
      Alert.alert('Error', 'Gagal memuat riwayat penjualan');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSalesHistory();
    setRefreshing(false);
  };

  const filterSales = () => {
    let filtered = [...sales];

    // Filter by search query (sale ID)
    if (searchQuery) {
      filtered = filtered.filter(sale => 
        (sale.no_invoice && sale.no_invoice.toLowerCase().includes(searchQuery.toLowerCase())) ||
        sale.id?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by period
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (filterPeriod) {
      case 'today':
        filtered = filtered.filter(sale => {
          const saleDate = new Date(sale.created_at);
          return saleDate >= today;
        });
        break;
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        const endYesterday = new Date(yesterday);
        endYesterday.setHours(23, 59, 59, 999);
        
        filtered = filtered.filter(sale => {
          const saleDate = new Date(sale.created_at);
          return saleDate >= yesterday && saleDate <= endYesterday;
        });
        break;
      case 'week':
        const weekAgo = new Date(today);
        weekAgo.setDate(today.getDate() - 7);
        filtered = filtered.filter(sale => {
          const saleDate = new Date(sale.created_at);
          return saleDate >= weekAgo;
        });
        break;
      case 'month':
        const monthAgo = new Date(today);
        monthAgo.setMonth(today.getMonth() - 1);
        filtered = filtered.filter(sale => {
          const saleDate = new Date(sale.created_at);
          return saleDate >= monthAgo;
        });
        break;
      case 'year':
        const yearAgo = new Date(today);
        yearAgo.setFullYear(today.getFullYear() - 1);
        filtered = filtered.filter(sale => {
          const saleDate = new Date(sale.created_at);
          return saleDate >= yearAgo;
        });
        break;
      case 'custom':
        if (customDateRange.startDate && customDateRange.endDate) {
          const start = new Date(customDateRange.startDate);
          start.setHours(0, 0, 0, 0);
          const end = new Date(customDateRange.endDate);
          end.setHours(23, 59, 59, 999);
          
          filtered = filtered.filter(sale => {
            const saleDate = new Date(sale.created_at);
            return saleDate >= start && saleDate <= end;
          });
        }
        break;
      default:
        // 'all' - no additional filtering
        break;
    }

    // Sort by date (newest first)
    filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    setFilteredSales(filtered);
  };

  const showSaleDetail = async (saleId) => {
    try {
      console.log('🔍 HistoryScreen: Loading sale detail for ID:', saleId);
      const saleDetail = await getSaleById(saleId);
      if (saleDetail) {
        setSelectedSale(saleDetail);
        setShowDetailModal(true);
      } else {
        Alert.alert('Error', 'Detail penjualan tidak ditemukan');
      }
    } catch (error) {
      console.error('❌ HistoryScreen: Error loading sale detail:', error);
      Alert.alert('Error', 'Gagal memuat detail penjualan');
    }
  };

  // Print invoice function
  const printInvoice = async (sale) => {
    try {
      console.log('🖨️ HistoryScreen: Printing invoice for sale:', sale.id);
      
      // First, ask for receipt size
      Alert.alert(
        'Pilih Ukuran Struk',
        'Pilih ukuran struk thermal:',
        [
          {
            text: 'Batal',
            style: 'cancel'
          },
          {
            text: '📄 58mm',
            onPress: () => showPrintOptions(sale, '58mm')
          },
          {
            text: '📄 80mm',
            onPress: () => showPrintOptions(sale, '80mm')
          }
        ],
        { cancelable: true }
      );
    } catch (error) {
      console.error('❌ HistoryScreen: Error in printInvoice:', error);
      Alert.alert('Error', 'Terjadi kesalahan saat mencetak invoice');
    }
  };

  // Show print options with selected receipt size
  const showPrintOptions = (sale, receiptSize) => {
    Alert.alert(
      `Cetak Invoice (${receiptSize})`,
      'Pilih cara untuk mencetak invoice:',
      [
        {
          text: 'Batal',
          style: 'cancel'
        },
        {
          text: '📄 Simpan PDF',
          onPress: async () => {
            const result = await printInvoiceToPDF(sale, user?.id, receiptSize);
            if (result.success) {
              Alert.alert('Berhasil', `Invoice ${receiptSize} berhasil disimpan sebagai PDF`);
            } else {
              Alert.alert('Error', result.error || 'Gagal menyimpan PDF');
            }
          }
        },
        {
          text: '📤 Share PDF',
          onPress: async () => {
            const result = await shareInvoicePDF(sale, user?.id, receiptSize);
            if (!result.success) {
              Alert.alert('Error', result.error || 'Gagal share PDF');
            }
          }
        },
        {
          text: '📱 Share ke WhatsApp',
          onPress: async () => {
            const result = await shareToWhatsApp(sale, user?.id, receiptSize);
            if (!result.success) {
              Alert.alert('Error', result.error || 'Gagal share ke WhatsApp');
            }
          }
        }
      ],
      { cancelable: true }
    );
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDateOnly = (date) => {
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const onDayPress = (day) => {
    const selectedDate = new Date(day.timestamp);
    
    // Logic for range selection
    if (!tempDateRange.startDate || (tempDateRange.startDate && tempDateRange.endDate)) {
      // Start new selection
      setTempDateRange({
        startDate: selectedDate,
        endDate: null
      });
      updateMarkedDates(selectedDate, null);
    } else if (tempDateRange.startDate && !tempDateRange.endDate) {
      // Complete selection
      let start = tempDateRange.startDate;
      let end = selectedDate;
      
      // Swap if end is before start
      if (end < start) {
        const temp = start;
        start = end;
        end = temp;
      }
      
      setTempDateRange({
        startDate: start,
        endDate: end
      });
      updateMarkedDates(start, end);
    }
  };

  const updateMarkedDates = (start, end) => {
    const marked = {};
    
    if (start) {
      const startStr = start.toISOString().split('T')[0];
      marked[startStr] = { startingDay: true, color: '#007AFF', textColor: 'white' };
      
      if (end) {
        const endStr = end.toISOString().split('T')[0];
        let curr = new Date(start);
        curr.setDate(curr.getDate() + 1);
        
        while (curr < end) {
          const dateStr = curr.toISOString().split('T')[0];
          marked[dateStr] = { color: '#70d7c7', textColor: 'white' }; // lighter color for range
          curr.setDate(curr.getDate() + 1);
        }
        
        marked[endStr] = { endingDay: true, color: '#007AFF', textColor: 'white' };
        
        // Handle single day range
        if (startStr === endStr) {
           marked[startStr] = { startingDay: true, endingDay: true, color: '#007AFF', textColor: 'white' };
        }
      } else {
         marked[startStr] = { startingDay: true, endingDay: true, color: '#007AFF', textColor: 'white' };
      }
    }
    setMarkedDates(marked);
  };

  const applyCustomDate = () => {
    if (tempDateRange.startDate && tempDateRange.endDate) {
      setCustomDateRange(tempDateRange);
      setShowDatePicker(false);
      setFilterPeriod('custom');
    } else {
      Alert.alert('Pilih Tanggal', 'Silakan pilih tanggal mulai dan selesai.');
    }
  };

  const renderFilterButton = (period, label) => (
    <TouchableOpacity
      style={[
        styles.filterButton,
        filterPeriod === period && styles.filterButtonActive
      ]}
      onPress={() => {
        if (period === 'custom') {
          // Initialize temp range with current custom range or today
          const start = customDateRange.startDate || new Date();
          const end = customDateRange.endDate || new Date();
          
          // Initial marking
          updateMarkedDates(start, end);
          setTempDateRange({
            startDate: start,
            endDate: end
          });
          
          setShowDatePicker(true);
        } else {
          setFilterPeriod(period);
        }
      }}
    >
      <Text style={[
        styles.filterButtonText,
        filterPeriod === period && styles.filterButtonTextActive
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderSaleItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.saleCard} 
      onPress={() => showSaleDetail(item.id)}
    >
      <View style={styles.saleHeader}>
        <View style={styles.invoiceInfo}>
          <Text style={styles.invoiceNumber}>
            {item.no_invoice || `#INV-${new Date(item.created_at).getFullYear()}${String(new Date(item.created_at).getMonth() + 1).padStart(2, '0')}${String(new Date(item.created_at).getDate()).padStart(2, '0')}-${String(item.id).slice(-4)}`}
          </Text>
          <Text style={styles.saleDate}>
            {new Date(item.created_at).toLocaleDateString('id-ID', {
              day: '2-digit',
              month: '2-digit', 
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </Text>
        </View>
        <View style={styles.totalContainer}>
          <Text style={styles.saleTotal}>{formatIDR(item.total)}</Text>
          <Text style={[styles.saleTotal, { fontSize: 12, color: '#34C759', marginTop: 4 }]}>
            Profit: {formatIDR(item.profit)}
          </Text>
        </View>
      </View>
      
      <View style={styles.saleDetails}>
        <View style={styles.itemInfo}>
          <View style={styles.itemCountContainer}>
            {(() => {
              const items = item.items || [];
              if (items.length === 0) return <Text style={styles.itemCount}>0 Items</Text>;
              
              if (items.length === 1) {
                 return (
                    <Text style={styles.itemCount}>
                       1 Items : {items[0].product_name} {formatIDR(items[0].price)}
                    </Text>
                 );
              }

              return (
                 <View>
                    <Text style={styles.itemCount}>{items.length} Items :</Text>
                    {items.slice(0, 3).map((prod, idx) => (
                       <Text key={idx} style={[styles.itemCount, { marginLeft: 8, marginTop: 2 }]}>
                          - {prod.product_name} {formatIDR(prod.price)}
                       </Text>
                    ))}
                    {items.length > 3 && (
                       <Text style={[styles.itemCount, { marginLeft: 8, marginTop: 2 }]}>
                          ... dan {items.length - 3} lainnya
                       </Text>
                    )}
                 </View>
              );
            })()}
          </View>
          {item.payment_method && (
            <View style={styles.paymentMethodContainer}>
              <Text style={styles.paymentMethod}>
                {item.payment_method}
                {item.payment_channel ? ` - ${item.payment_channel.name}` : ''}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Riwayat Penjualan</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Search */}
      <View style={styles.searchSection}>
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            placeholder="Cari nomor invoice atau ID transaksi..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
            placeholderTextColor="#999"
          />
        </View>
      </View>

      {/* Filter Buttons */}
      <View style={styles.filterSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.filterContainer}>
            {renderFilterButton('today', 'Hari Ini')}
            {renderFilterButton('yesterday', 'Kemarin')}
            {renderFilterButton('week', 'Minggu Ini')}
            {renderFilterButton('month', 'Bulan Ini')}
            {renderFilterButton('year', 'Tahun Ini')}
            {renderFilterButton('custom', 'Kustom')}
          </View>
        </ScrollView>
      </View>

      {/* Sales List */}
      <FlatList
        data={filteredSales}
        keyExtractor={(item) => item.id}
        renderItem={renderSaleItem}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#007AFF']}
            tintColor="#007AFF"
          />
        }
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>Tidak ada riwayat penjualan</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery.trim() || filterPeriod !== 'all' 
                ? 'Coba ubah filter atau kata kunci pencarian'
                : 'Belum ada transaksi penjualan'
              }
            </Text>
          </View>
        )}
      />

      {/* Detail Modal */}
      <Modal
        visible={showDetailModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDetailModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>📄 Detail Penjualan</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowDetailModal(false)}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {selectedSale && (
            <ScrollView style={styles.modalContent}>
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>No. Invoice:</Text>
                <Text style={styles.detailValue}>{selectedSale.no_invoice || selectedSale.id}</Text>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Tanggal:</Text>
                <Text style={styles.detailValue}>{formatDate(selectedSale.created_at)}</Text>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Metode Pembayaran:</Text>
                <Text style={styles.detailValue}>
                  {selectedSale.payment_method === 'cash' ? '💵 Tunai' : 
                   selectedSale.payment_method === 'digital' ? '💳 Digital' : 
                   selectedSale.payment_method === 'bank' ? '🏦 Transfer Bank' : 
                   '💵 Tunai'}
                </Text>
              </View>

              {selectedSale.payment_method === 'cash' && (
                <>
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Uang Diterima:</Text>
                    <Text style={styles.detailValue}>{formatIDR(selectedSale.cash_amount || selectedSale.total)}</Text>
                  </View>
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Kembalian:</Text>
                    <Text style={styles.detailValue}>{formatIDR(selectedSale.change_amount || 0)}</Text>
                  </View>
                </>
              )}

              {/* Show change amount for non-cash payments if exists */}
              {selectedSale.payment_method !== 'cash' && selectedSale.change_amount > 0 && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Kembalian:</Text>
                  <Text style={styles.detailValue}>{formatIDR(selectedSale.change_amount)}</Text>
                </View>
              )}

              {selectedSale.customer_name && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Nama Pelanggan:</Text>
                  <Text style={styles.detailValue}>{selectedSale.customer_name}</Text>
                </View>
              )}

              {selectedSale.payment_channel && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Channel Pembayaran:</Text>
                  <Text style={styles.detailValue}>{selectedSale.payment_channel.name}</Text>
                </View>
              )}

              {selectedSale.notes && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Catatan:</Text>
                  <Text style={styles.detailValue}>{selectedSale.notes}</Text>
                </View>
              )}

              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Items:</Text>
                {selectedSale.items?.map((item, index) => (
                  <View key={index} style={styles.itemDetail}>
                    <Text style={styles.itemName}>{item.product_name}</Text>
                    <Text style={styles.itemInfo}>
                      {item.qty} × {formatIDR(item.price)} = {formatIDR(item.line_total)}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={styles.totalSection}>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Total:</Text>
                  <Text style={styles.totalValue}>{formatIDR(selectedSale.total)}</Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Profit:</Text>
                  <Text style={styles.totalValue}>{formatIDR(selectedSale.profit)}</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.modalPrintButton}
                onPress={() => {
                  setShowDetailModal(false);
                  setTimeout(() => printInvoice(selectedSale), 300);
                }}
              >
                <Text style={styles.modalPrintButtonText}>🖨️ Cetak Invoice</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalPrintButton, { backgroundColor: '#28a745', marginTop: 10 }]}
                onPress={() => {
                   setShowDetailModal(false);
                   setTimeout(() => {
                     // Ask for receipt size first
                     Alert.alert(
                       'Pilih Ukuran Struk',
                       'Pilih ukuran struk thermal untuk WhatsApp:',
                       [
                         {
                           text: 'Batal',
                           style: 'cancel'
                         },
                         {
                           text: '📄 58mm',
                           onPress: async () => {
                             const result = await shareToWhatsApp(selectedSale, user?.id, '58mm');
                             if (!result.success) {
                               Alert.alert('Error', result.error || 'Gagal share ke WhatsApp');
                             }
                           }
                         },
                         {
                           text: '📄 80mm',
                           onPress: async () => {
                             const result = await shareToWhatsApp(selectedSale, user?.id, '80mm');
                             if (!result.success) {
                               Alert.alert('Error', result.error || 'Gagal share ke WhatsApp');
                             }
                           }
                         }
                       ],
                       { cancelable: true }
                     );
                   }, 300);
                 }}
              >
                <Text style={styles.modalPrintButtonText}>📱 Share ke WhatsApp</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* Date Picker Modal */}
      <Modal
        visible={showDatePicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.datePickerContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pilih Rentang Tanggal</Text>
              <TouchableOpacity 
                onPress={() => setShowDatePicker(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#8E8E93" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.datePickerContent}>
               <View style={styles.dateInputsRow}>
                  <View style={styles.dateInput}>
                      <Text style={styles.dateLabel}>Mulai Dari</Text>
                      <Text style={styles.dateValue}>
                        {tempDateRange.startDate ? formatDateOnly(tempDateRange.startDate) : '-'}
                      </Text>
                  </View>
                  <Ionicons name="arrow-forward" size={20} color="#8E8E93" />
                  <View style={styles.dateInput}>
                      <Text style={styles.dateLabel}>Sampai</Text>
                      <Text style={styles.dateValue}>
                        {tempDateRange.endDate ? formatDateOnly(tempDateRange.endDate) : '-'}
                      </Text>
                  </View>
               </View>

              <Calendar
                markingType={'period'}
                markedDates={markedDates}
                onDayPress={onDayPress}
                theme={{
                  todayTextColor: '#007AFF',
                  arrowColor: '#007AFF',
                  selectedDayBackgroundColor: '#007AFF',
                  selectedDayTextColor: '#ffffff',
                }}
              />
              
              <TouchableOpacity 
                style={[
                  styles.modalButton, 
                  { marginTop: 20 },
                  (!tempDateRange.startDate || !tempDateRange.endDate) && { backgroundColor: '#ccc' }
                ]}
                onPress={applyCustomDate}
                disabled={!tempDateRange.startDate || !tempDateRange.endDate}
              >
                <Text style={styles.modalButtonText}>Terapkan Filter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
    color: '#666',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  filterSection: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: '#007AFF',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#666',
  },
  filterButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  listContainer: {
    padding: 16,
    paddingBottom: 80,
  },
  saleCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  saleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  invoiceInfo: {
    flex: 1,
  },
  invoiceNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  saleDate: {
    fontSize: 12,
    color: '#6c757d',
  },
  totalContainer: {
    alignItems: 'flex-end',
  },
  saleTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  saleDetails: {
    borderTopWidth: 1,
    borderTopColor: '#f1f3f5',
    paddingTop: 12,
  },
  itemInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemCountContainer: {
    backgroundColor: '#e7f5ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  itemCount: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
  },
  paymentMethodContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentMethod: {
    fontSize: 12,
    color: '#6c757d',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 24,
    color: '#6c757d',
  },
  modalContent: {
    padding: 16,
  },
  detailSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6c757d',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    maxWidth: '60%',
    textAlign: 'right',
  },
  itemDetail: {
    width: '100%',
    flexDirection: 'column',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f3f5',
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  itemInfo: {
    fontSize: 12,
    color: '#6c757d',
  },
  totalSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 16,
    color: '#6c757d',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  modalPrintButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  modalPrintButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  datePickerContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 30,
    minHeight: 300,
  },
  datePickerContent: {
    padding: 20,
  },
  dateInputsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  dateInput: {
    flex: 1,
    alignItems: 'center',
    padding: 10,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 10,
  },
  dateLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 4,
  },
  dateValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  modalButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  }
});