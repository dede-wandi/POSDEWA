import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { getSalesHistory, deleteSaleItem, deleteSale } from '../services/salesSupabase';
import { Colors } from '../theme';

export default function SalesReportScreen({ navigation }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [sales, setSales] = useState([]);
  const [flattenedItems, setFlattenedItems] = useState([]);
  
  // Filter state
  const [filterType, setFilterType] = useState('today'); // 'today', 'yesterday', 'thisMonth', 'custom', 'month', 'year'
  const [showCalendar, setShowCalendar] = useState(false);
  const [customRange, setCustomRange] = useState({ startDate: null, endDate: null });
  const [markedDates, setMarkedDates] = useState({});
  
  // Year/Month Picker State
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [monthlyData, setMonthlyData] = useState([]);

  // Selection mode
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [filteredTotals, setFilteredTotals] = useState({ total: 0, profit: 0 });

  // Column Visibility State
  const [visibleColumns, setVisibleColumns] = useState({
    no: true,
    date: true,
    invoice: false,
    product: true,
    capitalPrice: false,
    price: true,
    profit: true,
    action: false
  });
  const [showColumnModal, setShowColumnModal] = useState(false);
  const [tempVisibleColumns, setTempVisibleColumns] = useState({...visibleColumns});

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    processData();
  }, [sales, filterType, customRange, selectedYear, selectedMonth]);

  const loadData = async () => {
    setLoading(true);
    try {
      const salesData = await getSalesHistory(user?.id);
      setSales(salesData || []);
    } catch (error) {
      console.error('Error loading sales report:', error);
    } finally {
      setLoading(false);
    }
  };

  const processData = () => {
    console.log('🔄 Processing data with filter:', filterType, customRange);
    
    let filteredSales = [...sales];
    const now = new Date();
    // Reset time to start of day for accurate comparison
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Helper to calculate profit matching HistoryScreen logic
    const calculateSaleProfit = (sale) => {
      const items = sale.items || sale.sale_items || [];
      if (items.length > 0) {
        const itemsProfit = items.reduce((sum, item) => {
          let profit = typeof item.line_profit === 'number'
             ? item.line_profit
             : ((Number(item.price) - Number(item.cost_price || 0)) * Number(item.qty || 0));
          return sum + profit;
        }, 0);

        return itemsProfit;
      }
      // No items - try header profit or 0
      return sale.profit || 0;
    };

    if (filterType === 'today') {
      filteredSales = filteredSales.filter(s => {
        const d = new Date(s.created_at);
        return d >= today;
      });
    } else if (filterType === 'yesterday') {
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      
      const startYesterday = new Date(yesterday);
      startYesterday.setHours(0, 0, 0, 0);
      
      const endYesterday = new Date(yesterday);
      endYesterday.setHours(23, 59, 59, 999);
      
      filteredSales = filteredSales.filter(s => {
        const d = new Date(s.created_at);
        return d >= startYesterday && d <= endYesterday;
      });
    } else if (filterType === 'thisMonth') {
      const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      startMonth.setHours(0, 0, 0, 0);
      
      // End of month is start of next month
      const endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      endMonth.setHours(0, 0, 0, 0);

      console.log(`📅 Filtering This Month: ${startMonth.toLocaleString()} - ${endMonth.toLocaleString()}`);

      filteredSales = filteredSales.filter(s => {
        const d = new Date(s.created_at);
        return d >= startMonth && d < endMonth;
      });
    } else if (filterType === 'month') {
      const startMonth = new Date(selectedYear, selectedMonth, 1);
      startMonth.setHours(0, 0, 0, 0);
      
      const endMonth = new Date(selectedYear, selectedMonth + 1, 1);
      endMonth.setHours(0, 0, 0, 0);
      
      console.log(`📅 Filtering Month: ${startMonth.toLocaleString()} - ${endMonth.toLocaleString()}`);

      filteredSales = filteredSales.filter(s => {
        const d = new Date(s.created_at);
        return d >= startMonth && d < endMonth;
      });
    } else if (filterType === 'year') {
      const startYear = new Date(selectedYear, 0, 1);
      startYear.setHours(0, 0, 0, 0);
      
      const endYear = new Date(selectedYear + 1, 0, 1);
      endYear.setHours(0, 0, 0, 0);
      
      console.log(`📅 Filtering Year: ${startYear.getFullYear()}`);
      
      filteredSales = filteredSales.filter(s => {
        const d = new Date(s.created_at);
        return d >= startYear && d < endYear;
      });
      
      // Calculate monthly summary
      const months = Array(12).fill(0).map((_, i) => ({
        monthIndex: i,
        monthName: new Date(selectedYear, i, 1).toLocaleDateString('id-ID', { month: 'long' }),
        totalSales: 0,
        totalProfit: 0
      }));
      
      filteredSales.forEach(sale => {
        const d = new Date(sale.created_at);
        const m = d.getMonth();
        
        // Calculate profit with fallback
        const saleProfit = calculateSaleProfit(sale);

        months[m].totalSales += (sale.total || 0);
        months[m].totalProfit += saleProfit;
      });
      
      setMonthlyData(months);
    } else if (filterType === 'custom') {
      if (customRange.startDate) {
        // Parse dates strictly as local YYYY-MM-DD
        const [sy, sm, sd] = customRange.startDate.split('-').map(Number);
        const start = new Date(sy, sm - 1, sd, 0, 0, 0, 0); // Start of day 00:00:00
        
        let end;
        if (customRange.endDate) {
          const [ey, em, ed] = customRange.endDate.split('-').map(Number);
          // Use next day 00:00:00 as upper bound (exclusive) to match Analytics
          end = new Date(ey, em - 1, ed);
          end.setDate(end.getDate() + 1);
          end.setHours(0, 0, 0, 0);
        } else {
          // Single day selection: next day 00:00:00
          end = new Date(sy, sm - 1, sd);
          end.setDate(end.getDate() + 1);
          end.setHours(0, 0, 0, 0);
        }
        
        console.log(`📅 Filtering Custom: ${start.toLocaleString()} - ${end.toLocaleString()}`);

        filteredSales = filteredSales.filter(s => {
          const d = new Date(s.created_at);
          // Check if valid date
          if (isNaN(d.getTime())) return false;
          // Use >= start and < end for strict consistency
          return d >= start && d < end;
        });
      } else {
        // If custom is selected but no date provided yet, show empty list
        filteredSales = [];
      }
    }

    console.log(`✅ Filtered ${filteredSales.length} sales from ${sales.length} total`);

    // Calculate Totals with Fallback
    let calcTotal = 0;
    let calcProfit = 0;
    filteredSales.forEach(sale => {
      calcTotal += (sale.total || 0);
      calcProfit += calculateSaleProfit(sale);
    });
    setFilteredTotals({ total: calcTotal, profit: calcProfit });

    // Flatten to items
    let items = [];
    filteredSales.forEach(sale => {
      const saleItems = sale.items || sale.sale_items || [];
      if (saleItems.length > 0) {
        saleItems.forEach(item => {
          let displayedProfit = item.line_profit || 0;
          
          // Correction logic for display
          // Removed legacy correction logic to sync with HistoryScreen
          
          items.push({
            ...item,
            line_profit: displayedProfit,
            created_at: sale.created_at,
            original_sale: sale
          });
        });
      }
    });

    // Sort by date descending
    items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    setFlattenedItems(items);
  };

  const exportToExcel = async () => {
    if (flattenedItems.length === 0) {
      Alert.alert('Data Kosong', 'Tidak ada data untuk diekspor');
      return;
    }

    setLoading(true);
    try {
      // Prepare data
      const dataToExport = flattenedItems.map((item, index) => ({
        'No': index + 1,
        'Tanggal': formatDateStr(item.created_at),
        'Nama Produk': item.product_name,
        'Qty': item.qty,
        'Harga Satuan': item.price,
        'Total Harga': item.line_total,
        'Profit': item.line_profit,
      }));

      // Add summary row at the bottom
      dataToExport.push({
        'No': '',
        'Tanggal': '',
        'Nama Produk': 'TOTAL',
        'Qty': '',
        'Harga Satuan': '',
        'Total Harga': totalSales,
        'Profit': totalProfit,
      });
      
      const fileName = `Laporan_Penjualan_${new Date().getTime()}.xlsx`;

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Laporan Penjualan");

      if (Platform.OS === 'web') {
        XLSX.writeFile(wb, fileName);
        setLoading(false);
        return;
      }

      const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      // Use cacheDirectory for temporary files to be shared
      const uri = FileSystem.cacheDirectory + fileName;

      await FileSystem.writeAsStringAsync(uri, wbout, {
        encoding: FileSystem.EncodingType.Base64
      });

      // Check if sharing is available
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Info', 'Fitur sharing tidak tersedia di perangkat ini');
        return;
      }

      await Sharing.shareAsync(uri, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: 'Download Laporan Penjualan',
        UTI: 'com.microsoft.excel.xlsx'
      });

    } catch (error) {
      console.error('Export Error:', error);
      Alert.alert('Error', 'Gagal mengekspor data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = async (item) => {
    console.log('🗑️ Request to delete item:', item.id, item.product_name);
    
    if (!item.id) {
      Alert.alert('Error', 'ID item tidak valid');
      return;
    }

    Alert.alert(
      'Hapus Item',
      `Apakah Anda yakin ingin menghapus "${item.product_name}" dari riwayat?`,
      [
        { text: 'Batal', style: 'cancel' },
        { 
          text: 'Hapus', 
          style: 'destructive',
          onPress: async () => {
            console.log('🗑️ User confirmed delete');
            setLoading(true);
            try {
              const result = await deleteSaleItem(item.id);
              console.log('🗑️ Delete result:', result);
              
              if (result.success) {
                // Show toast immediately
                showToast('Item berhasil dihapus', 'success');
                
                // Small delay to ensure toast is visible before reload (which might be heavy)
                setTimeout(async () => {
                  await loadData();
                }, 500);
              } else {
                // Check if it's the RLS multi-item issue
                if (result.reason === 'rls_multi_item') {
                  Alert.alert(
                    'Hapus Item Gagal',
                    'Tidak dapat menghapus item ini karena izin database terbatas (Row Level Security). Apakah Anda ingin menghapus SELURUH transaksi (Invoice) ini?',
                    [
                      { text: 'Batal', style: 'cancel' },
                      { 
                        text: 'Hapus Transaksi', 
                        style: 'destructive',
                        onPress: async () => {
                          setLoading(true);
                          try {
                            const saleResult = await deleteSale(result.sale_id);
                            if (saleResult.success) {
                              showToast('Transaksi berhasil dihapus', 'success');
                              setTimeout(async () => {
                                await loadData();
                              }, 500);
                            } else {
                              Alert.alert('Gagal', 'Gagal menghapus transaksi: ' + saleResult.error);
                            }
                          } catch (err) {
                            Alert.alert('Error', err.message);
                          } finally {
                            setLoading(false);
                          }
                        }
                      }
                    ]
                  );
                } else {
                  Alert.alert('Gagal', 'Gagal menghapus item: ' + (result.error || 'Unknown error'));
                }
              }
            } catch (error) {
              console.error('❌ Error in handleDeleteItem:', error);
              Alert.alert('Error', 'Terjadi kesalahan saat menghapus: ' + error.message);
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const onDayPress = (day) => {
    if (!customRange.startDate || (customRange.startDate && customRange.endDate)) {
      setCustomRange({ startDate: day.dateString, endDate: null });
      setMarkedDates({
        [day.dateString]: { startingDay: true, color: Colors.primary, textColor: 'white' }
      });
    } else {
      const start = customRange.startDate;
      const end = day.dateString;
      
      // Ensure start is before end
      if (new Date(start) > new Date(end)) {
        setCustomRange({ startDate: end, endDate: null });
        setMarkedDates({
          [end]: { startingDay: true, color: Colors.primary, textColor: 'white' }
        });
        return;
      }

      setCustomRange({ startDate: start, endDate: end });
      
      // Mark range
      let range = {};
      let curr = new Date(start);
      const last = new Date(end);
      while (curr <= last) {
        const dateStr = curr.toISOString().split('T')[0];
        if (dateStr === start) {
          range[dateStr] = { startingDay: true, color: Colors.primary, textColor: 'white' };
        } else if (dateStr === end) {
          range[dateStr] = { endingDay: true, color: Colors.primary, textColor: 'white' };
        } else {
          range[dateStr] = { color: Colors.primary, textColor: 'white', marked: true };
        }
        curr.setDate(curr.getDate() + 1);
      }
      setMarkedDates(range);
    }
  };

  const formatCurrency = (amount) => {
    return 'Rp ' + Number(amount || 0).toLocaleString('id-ID');
  };

  const formatDateStr = (dateString) => {
    const d = new Date(dateString);
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`; // Simple format
  };

  const totalSales = flattenedItems.reduce((sum, item) => sum + (item.line_total || 0), 0);
  const totalProfit = flattenedItems.reduce((sum, item) => sum + (item.line_profit || 0), 0);
  // We now use filteredTotals for the footer to support legacy data fallback
  
  const resetFilters = () => {
    setFilterType('today');
    setCustomRange({ startDate: null, endDate: null });
    setMarkedDates({});
  };

  const openColumnModal = () => {
    setTempVisibleColumns({...visibleColumns});
    setShowColumnModal(true);
  };

  const toggleColumn = (key) => {
    setTempVisibleColumns(prev => ({...prev, [key]: !prev[key]}));
  };

  const saveColumns = () => {
    setVisibleColumns(tempVisibleColumns);
    setShowColumnModal(false);
  };

  const renderYearlyContent = () => {
    return (
      <View style={styles.tableContainer}>
        {/* Year Header */}
        <View style={styles.tableHeader}>
           <Text style={[styles.headerCell, { width: 40 }]}>No</Text>
           <Text style={[styles.headerCell, { flex: 1 }]}>Bulan</Text>
           <Text style={[styles.headerCell, { width: 120, textAlign: 'right' }]}>Total Penjualan</Text>
           <Text style={[styles.headerCell, { width: 120, textAlign: 'right' }]}>Total Profit</Text>
        </View>
        <FlatList
          data={monthlyData}
          keyExtractor={(item) => `month-${item.monthIndex}`}
          renderItem={({ item, index }) => (
            <View style={styles.row}>
              <Text style={[styles.cell, { width: 40 }]}>{index + 1}</Text>
              <Text style={[styles.cell, { flex: 1 }]}>{item.monthName}</Text>
              <Text style={[styles.cell, { width: 120, textAlign: 'right' }]}>{formatCurrency(item.totalSales)}</Text>
              <Text style={[styles.cell, { width: 120, textAlign: 'right', color: item.totalProfit >= 0 ? 'green' : 'red' }]}>
                {formatCurrency(item.totalProfit)}
              </Text>
            </View>
          )}
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.tableHeader}>
      {visibleColumns.no && <Text style={[styles.headerCell, { width: 30 }]}>No</Text>}
      {visibleColumns.date && <Text style={[styles.headerCell, { width: 65 }]}>Tanggal</Text>}
      {visibleColumns.invoice && <Text style={[styles.headerCell, { width: 105, marginRight: 8 }]}>No. Inv</Text>}
      {visibleColumns.product && <Text style={[styles.headerCell, { flex: 1 }]}>Nama Produk</Text>}
      {visibleColumns.price && <Text style={[styles.headerCell, { width: 75, textAlign: 'right' }]}>Harga</Text>}
      {visibleColumns.profit && <Text style={[styles.headerCell, { width: 75, textAlign: 'right' }]}>Profit</Text>}
      {visibleColumns.action && isSelectMode && (
        <Text style={[styles.headerCell, { width: 40, textAlign: 'center' }]}>Act</Text>
      )}
    </View>
  );

  const renderItem = ({ item, index }) => (
    <View style={styles.row}>
      {visibleColumns.no && <Text style={[styles.cell, { width: 30 }]}>{index + 1}</Text>}
      {visibleColumns.date && <Text style={[styles.cell, { width: 65, fontSize: 10 }]}>{formatDateStr(item.created_at)}</Text>}
      {visibleColumns.invoice && <Text style={[styles.cell, { width: 105, fontSize: 9, marginRight: 8, color: '#555' }]}>
        {item.original_sale?.no_invoice || '-'}
      </Text>}
      {visibleColumns.product && <Text style={[styles.cell, { flex: 1 }]}>{item.product_name} {item.qty > 1 ? `(${item.qty}x)` : ''}</Text>}
      {visibleColumns.price && <Text style={[styles.cell, { width: 75, textAlign: 'right', fontSize: 10 }]}>{formatCurrency(item.line_total)}</Text>}
      {visibleColumns.profit && <Text style={[styles.cell, { width: 75, textAlign: 'right', fontSize: 10, color: item.line_profit >= 0 ? 'green' : 'red' }]}>
        {formatCurrency(item.line_profit)}
      </Text>}
      {visibleColumns.action && isSelectMode && (
        <View style={[styles.cell, { width: 40, alignItems: 'center', justifyContent: 'center' }]}>
          <TouchableOpacity 
            onPress={() => handleDeleteItem(item)}
            style={styles.deleteButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="trash-outline" size={20} color={Colors.danger || '#F44336'} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>Report Penjualan</Text>
        </View>
        
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity 
            style={[styles.exportButton, { backgroundColor: '#607D8B', marginRight: 8 }]} 
            onPress={openColumnModal}
          >
            <Ionicons name="options" size={20} color="#fff" />
            <Text style={styles.exportButtonText}>Atur Kolom</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.exportButton} 
            onPress={exportToExcel}
          >
            <Ionicons name="download" size={20} color="#fff" />
            <Text style={styles.exportButtonText}>Excel</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.selectButton, isSelectMode && styles.selectButtonActive]} 
            onPress={() => setIsSelectMode(!isSelectMode)}
          >
            <Text style={[styles.selectButtonText, isSelectMode && styles.selectButtonTextActive]}>
              {isSelectMode ? 'Selesai' : 'Select'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity 
            style={[styles.filterBtn, filterType === 'today' && styles.activeFilterBtn]}
            onPress={() => setFilterType('today')}
          >
            <Text style={[styles.filterText, filterType === 'today' && styles.activeFilterText]}>Hari Ini</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.filterBtn, filterType === 'yesterday' && styles.activeFilterBtn]}
            onPress={() => setFilterType('yesterday')}
          >
            <Text style={[styles.filterText, filterType === 'yesterday' && styles.activeFilterText]}>Kemarin</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.filterBtn, filterType === 'thisMonth' && styles.activeFilterBtn]}
            onPress={() => setFilterType('thisMonth')}
          >
            <Text style={[styles.filterText, filterType === 'thisMonth' && styles.activeFilterText]}>Bulan Ini</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.filterBtn, filterType === 'month' && styles.activeFilterBtn]}
            onPress={() => {
              setFilterType('month');
              setShowMonthPicker(true);
            }}
          >
            <Text style={[styles.filterText, filterType === 'month' && styles.activeFilterText]}>
               {filterType === 'month' 
                 ? `${new Date(selectedYear, selectedMonth, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}` 
                 : 'Pilih Bulan'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.filterBtn, filterType === 'year' && styles.activeFilterBtn]}
            onPress={() => {
              setFilterType('year');
              setShowYearPicker(true);
            }}
          >
            <Text style={[styles.filterText, filterType === 'year' && styles.activeFilterText]}>
               {filterType === 'year' ? `${selectedYear}` : 'Pilih Tahun'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.filterBtn, filterType === 'custom' && styles.activeFilterBtn]}
            onPress={() => {
              setFilterType('custom');
              setShowCalendar(true);
            }}
          >
            <Text style={[styles.filterText, filterType === 'custom' && styles.activeFilterText]}>
              {customRange.startDate 
                ? `${formatDateStr(customRange.startDate)}${customRange.endDate ? ' - ' + formatDateStr(customRange.endDate) : ''}`
                : 'Custom Tanggal'}
            </Text>
          </TouchableOpacity>
          
          {(filterType !== 'today') && (
            <TouchableOpacity 
              style={[styles.filterBtn, { backgroundColor: '#FFEBEE', borderColor: '#FFCDD2' }]}
              onPress={resetFilters}
            >
              <Text style={[styles.filterText, { color: '#D32F2F' }]}>Reset</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : filterType === 'year' ? (
        renderYearlyContent()
      ) : (
        <View style={styles.tableContainer}>
          {renderHeader()}
          <FlatList
            data={flattenedItems}
            renderItem={renderItem}
            keyExtractor={(item, index) => `${item.id}-${index}`}
            contentContainerStyle={{ paddingBottom: 100 }}
          />
        </View>
      )}

      {/* Footer Summary */}
      <View style={styles.footer}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total Harga Penjualan:</Text>
          <Text style={styles.summaryValue}>
             {filterType === 'year' 
               ? formatCurrency(monthlyData.reduce((sum, m) => sum + m.totalSales, 0)) 
               : formatCurrency(filteredTotals.total)}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total Profit:</Text>
          <Text style={[styles.summaryValue, { color: 'green' }]}>
             {filterType === 'year'
               ? formatCurrency(monthlyData.reduce((sum, m) => sum + m.totalProfit, 0))
               : formatCurrency(filteredTotals.profit)}
          </Text>
        </View>
      </View>

      {/* Calendar Modal */}
      <Modal visible={showCalendar} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Pilih Rentang Tanggal</Text>
            <Calendar
              markingType={'period'}
              markedDates={markedDates}
              onDayPress={onDayPress}
              theme={{
                selectedDayBackgroundColor: Colors.primary,
                todayTextColor: Colors.primary,
                arrowColor: Colors.primary,
              }}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.cancelBtn]} 
                onPress={() => setShowCalendar(false)}
              >
                <Text style={styles.modalBtnText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.confirmBtn]} 
                onPress={() => {
                  if (customRange.startDate) {
                    setShowCalendar(false);
                  } else {
                    Alert.alert('Info', 'Silakan pilih minimal tanggal mulai');
                  }
                }}
              >
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Terapkan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Year Picker Modal */}
      <Modal visible={showYearPicker} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Pilih Tahun</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                <TouchableOpacity
                  key={year}
                  style={[
                    styles.modalBtn, 
                    selectedYear === year ? styles.confirmBtn : { backgroundColor: '#f0f0f0' },
                    { marginBottom: 8, width: '100%' }
                  ]}
                  onPress={() => {
                    setSelectedYear(year);
                    setShowYearPicker(false);
                  }}
                >
                  <Text style={[
                    styles.modalBtnText, 
                    selectedYear === year ? { color: '#fff' } : { color: '#333' }
                  ]}>{year}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity 
              style={[styles.modalBtn, styles.cancelBtn, { marginTop: 10 }]} 
              onPress={() => setShowYearPicker(false)}
            >
              <Text style={styles.modalBtnText}>Batal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Month Picker Modal */}
      <Modal visible={showMonthPicker} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Pilih Bulan & Tahun</Text>
            
            {/* Year Selector in Month Picker */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 15, alignItems: 'center' }}>
              <TouchableOpacity onPress={() => setSelectedYear(selectedYear - 1)} style={{ padding: 10 }}>
                 <Ionicons name="chevron-back" size={24} color={Colors.primary} />
              </TouchableOpacity>
              <Text style={{ fontSize: 18, fontWeight: 'bold', marginHorizontal: 20 }}>{selectedYear}</Text>
              <TouchableOpacity onPress={() => setSelectedYear(selectedYear + 1)} style={{ padding: 10 }}>
                 <Ionicons name="chevron-forward" size={24} color={Colors.primary} />
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
              {Array.from({ length: 12 }, (_, i) => i).map(month => (
                <TouchableOpacity
                  key={month}
                  style={[
                    { 
                      width: '30%', 
                      padding: 10, 
                      marginBottom: 10, 
                      borderRadius: 8,
                      alignItems: 'center',
                      backgroundColor: selectedMonth === month ? Colors.primary : '#f0f0f0'
                    }
                  ]}
                  onPress={() => {
                    setSelectedMonth(month);
                    setShowMonthPicker(false);
                  }}
                >
                  <Text style={{ color: selectedMonth === month ? '#fff' : '#333' }}>
                    {new Date(2024, month, 1).toLocaleDateString('id-ID', { month: 'short' })}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity 
              style={[styles.modalBtn, styles.cancelBtn, { marginTop: 10 }]} 
              onPress={() => setShowMonthPicker(false)}
            >
              <Text style={styles.modalBtnText}>Batal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      {/* Column Settings Modal */}
      <Modal visible={showColumnModal} animationType="fade" transparent>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Atur Tampilan Kolom</Text>
            <ScrollView style={{maxHeight: 300}}>
              {Object.keys(visibleColumns).map((key) => {
                const labels = {
                  no: 'No',
                  date: 'Tanggal',
                  invoice: 'No. Invoice',
                  product: 'Nama Produk',
                  capitalPrice: 'Harga Modal',
                  price: 'Harga',
                  profit: 'Profit',
                  action: 'Action'
                };
                if (key === 'action' && !isSelectMode) return null;
                return (
                  <TouchableOpacity 
                    key={key} 
                    style={{flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee'}}
                    onPress={() => toggleColumn(key)}
                  >
                    <Ionicons 
                      name={tempVisibleColumns[key] ? "checkbox" : "square-outline"} 
                      size={24} 
                      color={Colors.primary} 
                    />
                    <Text style={{marginLeft: 12, fontSize: 16, color: '#333'}}>{labels[key]}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.cancelBtn]} 
                onPress={() => setShowColumnModal(false)}
              >
                <Text style={styles.modalBtnText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.confirmBtn]} 
                onPress={saveColumns}
              >
                <Text style={[styles.modalBtnText, {color: '#fff'}]}>Simpan</Text>
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
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    zIndex: 10,
    elevation: 4,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  backButton: {
    marginRight: 16,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginRight: 8,
  },
  exportButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  selectButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  selectButtonActive: {
    backgroundColor: Colors.primary,
  },
  selectButtonText: {
    color: Colors.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  selectButtonTextActive: {
    color: '#fff',
  },
  filterContainer: {
    flexDirection: 'row',
    padding: 10,
    paddingHorizontal: 16,
    backgroundColor: '#f9f9f9',
  },
  filterBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    marginRight: 8,
    backgroundColor: '#fff',
  },
  activeFilterBtn: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterText: {
    color: '#666',
    fontSize: 12,
  },
  activeFilterText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tableContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: '#f0f0f0',
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  headerCell: {
    fontWeight: 'bold',
    fontSize: 12,
    color: '#333',
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    alignItems: 'center',
  },
  cell: {
    fontSize: 12,
    color: '#333',
  },
  deleteButton: {
    padding: 4,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#ccc',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelBtn: {
    backgroundColor: '#eee',
  },
  confirmBtn: {
    backgroundColor: Colors.primary,
  },
  modalBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
});
