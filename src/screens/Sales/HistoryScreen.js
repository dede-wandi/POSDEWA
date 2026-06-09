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
import { Colors, Shadows, FontSize, FontWeight, Radii, Spacing } from '../../theme';
import { Calendar } from 'react-native-calendars';
import { formatIDR } from '../../utils/currency';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getSalesHistory, getSaleById, deleteSale } from '../../services/salesSupabase';
import { printInvoiceToPDF, shareInvoicePDF, printToSelectedPrinter, printToBluetoothPrinter } from '../../utils/invoicePrint';

export default function HistoryScreen({ navigation }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [sales, setSales] = useState([]);
  const [filteredSales, setFilteredSales] = useState([]);
  const [topItems, setTopItems] = useState([]);
  const [showAllTopItems, setShowAllTopItems] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPeriod, setFilterPeriod] = useState('today'); // all, today, yesterday, week, month, year, custom
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
    setLoading(true);
    try {
      const result = await getSalesHistory(user?.id);
      setSales(result || []);
    } catch (error) {
      showToast('Gagal memuat riwayat penjualan', 'error');
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

    // Filter by search query (invoice/id/nama item)
    if (searchQuery) {
      const q = String(searchQuery).toLowerCase();
      filtered = filtered.filter(sale => {
        const matchInvoice = (sale.no_invoice && sale.no_invoice.toLowerCase().includes(q)) ||
          (sale.id || '').toLowerCase().includes(q);
        const matchItems = (sale.items || []).some(it =>
          (it.product_name || '').toLowerCase().includes(q)
        );
        return matchInvoice || matchItems;
      });
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

    const itemMap = {};
    filtered.forEach(sale => {
      (sale.items || []).forEach(it => {
        const key = it.product_name;
        if (!itemMap[key]) {
          itemMap[key] = { name: it.product_name, totalQty: 0, transactionCount: 0 };
        }
        itemMap[key].totalQty += Number(it.qty) || 0;
        itemMap[key].transactionCount += 1;
      });
    });
    const top = Object.values(itemMap)
      .sort((a, b) => b.totalQty - a.totalQty)
      .slice(0, 5);
    setTopItems(top);
  };

  const showSaleDetail = async (saleId) => {
    try {
      const saleDetail = await getSaleById(saleId);
      if (saleDetail) {
        setSelectedSale(saleDetail);
        setShowDetailModal(true);
      } else {
        showToast('Detail penjualan tidak ditemukan', 'error');
      }
    } catch (error) {
      showToast('Gagal memuat detail penjualan', 'error');
    }
  };

  // Print invoice function
  const printInvoice = async (sale) => {
    try {
      
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
      showToast('Terjadi kesalahan saat mencetak invoice', 'error');
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
              showToast(`Invoice ${receiptSize} berhasil disimpan sebagai PDF`, 'success');
            } else {
              showToast(result.error || 'Gagal menyimpan PDF', 'error');
            }
          }
        },
        {
          text: '🖨️ Print ke Printer',
          onPress: async () => {
            const result = await printToSelectedPrinter(sale, user?.id, receiptSize);
            if (!result.success) {
              showToast(result.error || 'Gagal mencetak. Pilih printer di Pengaturan Invoice.', 'error');
            } else {
              showToast('Invoice dikirim ke printer', 'success');
            }
          }
        },
        {
          text: '📤 Share PDF',
          onPress: async () => {
            const result = await shareInvoicePDF(sale, user?.id, receiptSize);
            if (!result.success) {
              showToast(result.error || 'Gagal share PDF', 'error');
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
      showToast('Silakan pilih tanggal mulai dan selesai', 'error');
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
        </View>
      </View>
      
      <View style={styles.saleDetails}>
        <View style={styles.itemInfo}>
          <View style={styles.itemCountContainer}>
            {(() => {
              const items = item.items || [];
              if (items.length === 0) return <Text style={styles.itemCount}>0 Items</Text>;
              
              if (items.length === 1) {
                 const it = items[0];
                 const itemProfit = typeof it.line_profit === 'number'
                   ? it.line_profit
                   : ((Number(it.price) - Number(it.cost_price || 0)) * Number(it.qty || 0));
                 const profitFallback = typeof item.profit === 'number' ? item.profit : itemProfit;
                 return (
                    <View>
                      <Text style={styles.itemCount}>
                        1 Item : {it.qty}x {it.product_name} {formatIDR(it.price)}
                      </Text>
                      <Text style={[styles.itemCount, { color: '#28a745', marginTop: 2 }]}>
                        Profit: {formatIDR(profitFallback)}
                      </Text>
                    </View>
                 );
              }

              return (
                 <View>
                    <Text style={styles.itemCount}>{items.length} Items :</Text>
                    {items.slice(0, 3).map((prod, idx) => {
                       const profit = typeof prod.line_profit === 'number'
                         ? prod.line_profit
                         : ((Number(prod.price) - Number(prod.cost_price || 0)) * Number(prod.qty || 0));
                       return (
                         <View key={idx} style={{ marginLeft: 8, marginTop: 2 }}>
                           <Text style={styles.itemCount}>
                             - {prod.qty}x {prod.product_name} {formatIDR(prod.price)}
                           </Text>
                           <Text style={[styles.itemCount, { color: '#28a745' }]}>
                             Profit: {formatIDR(profit)}
                           </Text>
                         </View>
                       );
                    })}
                    {items.length > 3 && (
                       <Text style={[styles.itemCount, { marginLeft: 8, marginTop: 2 }]}>
                          ... dan {items.length - 3} lainnya
                       </Text>
                    )}
                 </View>
              );
            })()}
          </View>
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
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
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
        ListHeaderComponent={() => (
          topItems.length > 0 ? (
            <View style={[styles.saleCard, { marginHorizontal: 0, marginTop: 0 }]}>
              <Text style={styles.sectionTitle}>Insight Performa</Text>
              {topItems.slice(0, showAllTopItems ? 5 : 3).map((it, idx) => (
                <View key={`${it.name}-${idx}`} style={styles.insightItemRow}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={styles.insightItemName}>{it.name}</Text>
                    <Text style={styles.insightItemInfo}>{it.totalQty}x dibeli • {it.transactionCount} transaksi</Text>
                  </View>
                  <Ionicons name="trending-up" size={20} color="#28a745" />
                </View>
              ))}
              {topItems.length > 3 && (
                <TouchableOpacity style={[styles.insightMoreButton, { marginTop: 8 }]} onPress={() => setShowAllTopItems(prev => !prev)}>
                  <Text style={styles.insightMoreText}>{showAllTopItems ? 'Hide' : 'More+'}</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null
        )}
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

              <View style={[styles.detailSection, { flexDirection: 'column', alignItems: 'flex-start' }]}>
                <Text style={[styles.detailLabel, { marginBottom: 8 }]}>Items:</Text>
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
              </View>

              <TouchableOpacity
                style={styles.modalPrintButton}
                onPress={async () => {
                  try {
                    if (Platform.OS === 'web') {
                      const result = await printToSelectedPrinter(selectedSale, user?.id, '58mm');
                      if (!result.success) {
                        showToast(result.error || 'Gagal membuka dialog print di browser', 'error');
                      }
                      return;
                    }
                    const resultBt = await printToBluetoothPrinter(selectedSale, '58mm');
                    if (!resultBt.success) {
                      const result = await printToSelectedPrinter(selectedSale, user?.id, '58mm');
                      if (!result.success) {
                        showToast(result.error || 'Gagal mencetak invoice', 'error');
                      } else {
                        showToast('Invoice dikirim ke printer', 'success');
                      }
                    } else {
                      showToast('Invoice dicetak ke printer bluetooth', 'success');
                    }
                  } catch (e) {
                    const result = await printToSelectedPrinter(selectedSale, user?.id, '58mm');
                    if (!result.success) {
                      showToast(result.error || 'Gagal mencetak invoice', 'error');
                    }
                  }
                }}
              >
                <Text style={styles.modalPrintButtonText}>🖨️ Cetak Invoice</Text>
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
    backgroundColor: Colors.background,
  },
  sectionTitle: {
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.bold,
    color: Colors.darkText,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: 14,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: Radii.pill,
    backgroundColor: Colors.lightBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
    color: Colors.darkText,
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
  },
  insightSection: {
    backgroundColor: Colors.card,
    borderRadius: Radii.lg,
    padding: Spacing.lg,
    marginHorizontal: Spacing.lg,
    marginBottom: 12,
    ...Shadows.card,
  },
  insightItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  insightItemName: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: Colors.darkText,
  },
  insightItemInfo: {
    fontSize: FontSize.caption,
    color: Colors.muted,
    marginTop: 4,
  },
  insightMoreButton: {
    marginTop: Spacing.sm,
    alignSelf: 'flex-start',
    backgroundColor: Colors.lightBg,
    borderRadius: Radii.sm,
    paddingHorizontal: 14,
    paddingVertical: 6
  },
  insightMoreText: {
    color: Colors.primary,
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
  },
  searchSection: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.lightBg,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    height: 42,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchIcon: {
    fontSize: FontSize.body,
    marginRight: Spacing.sm,
    color: Colors.muted,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.body,
    color: Colors.text,
  },
  filterSection: {
    backgroundColor: Colors.card,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
  },
  filterButton: {
    paddingHorizontal: 14,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.pill,
    backgroundColor: Colors.lightBg,
    marginRight: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterButtonText: {
    fontSize: FontSize.caption,
    color: Colors.muted,
    fontWeight: FontWeight.medium,
  },
  filterButtonTextActive: {
    color: Colors.white,
    fontWeight: FontWeight.semibold,
  },
  listContainer: {
    padding: Spacing.lg,
    paddingBottom: 80,
  },
  saleCard: {
    backgroundColor: Colors.card,
    borderRadius: Radii.lg,
    padding: Spacing.lg,
    marginBottom: 12,
    ...Shadows.card,
    borderWidth: 1,
    borderColor: Colors.borderLight,
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
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    color: Colors.darkText,
    marginBottom: 4,
  },
  saleDate: {
    fontSize: FontSize.caption,
    color: Colors.muted,
  },
  totalContainer: {
    alignItems: 'flex-end',
  },
  saleTotal: {
    fontSize: FontSize.bodyLg,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  saleDetails: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: 12,
  },
  itemInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemCountContainer: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radii.sm,
    flex: 1,
  },
  itemCount: {
    fontSize: FontSize.caption,
    color: Colors.text,
    fontWeight: FontWeight.medium,
  },
  paymentMethodContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: Spacing.sm,
  },
  paymentMethod: {
    fontSize: FontSize.caption,
    color: Colors.muted,
    fontWeight: FontWeight.medium,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
    color: Colors.darkText,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: FontSize.body,
    color: Colors.muted,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
    color: Colors.darkText,
  },
  closeButton: {
    padding: Spacing.sm,
  },
  closeButtonText: {
    fontSize: 24,
    color: Colors.muted,
  },
  modalContent: {
    padding: Spacing.lg,
  },
  detailSection: {
    backgroundColor: Colors.card,
    borderRadius: Radii.md,
    padding: Spacing.lg,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...Shadows.card,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  detailLabel: {
    fontSize: FontSize.body,
    color: Colors.muted,
  },
  detailValue: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: Colors.darkText,
    maxWidth: '60%',
    textAlign: 'right',
  },
  itemDetail: {
    width: '100%',
    flexDirection: 'column',
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  itemName: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: Colors.darkText,
    marginBottom: 4,
  },
  totalSection: {
    backgroundColor: Colors.card,
    borderRadius: Radii.md,
    padding: Spacing.lg,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xxl,
    ...Shadows.card,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  totalLabel: {
    fontSize: FontSize.subtitle,
    color: Colors.muted,
    fontWeight: FontWeight.medium,
  },
  totalValue: {
    fontSize: FontSize.h3,
    fontWeight: FontWeight.extrabold,
    color: Colors.primary,
  },
  modalPrintButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radii.md,
    padding: Spacing.lg,
    alignItems: 'center',
    marginBottom: 12,
    ...Shadows.card,
  },
  modalPrintButtonText: {
    color: Colors.white,
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.bold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  datePickerContainer: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    paddingBottom: 30,
    minHeight: 300,
  },
  datePickerContent: {
    padding: Spacing.xl,
  },
  dateInputsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  dateInput: {
    flex: 1,
    alignItems: 'center',
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.sm,
  },
  dateLabel: {
    fontSize: FontSize.caption,
    color: Colors.muted,
    marginBottom: 4,
  },
  dateValue: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: Colors.primary,
  },
  modalButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radii.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalButtonText: {
    color: Colors.white,
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.semibold,
  }
});
