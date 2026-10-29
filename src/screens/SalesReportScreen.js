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
  ScrollView,
  RefreshControl,
  Clipboard,
  TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { getSalesHistoryByRange, deleteSaleItem, deleteSale } from '../services/salesSupabase';
import { Colors } from '../theme';

export default function SalesReportScreen({ navigation }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [sales, setSales] = useState([]);
  const [flattenedItems, setFlattenedItems] = useState([]);
  const [filteredSalesList, setFilteredSalesList] = useState([]);
  
  const [selectedSale, setSelectedSale] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  
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
  const [collapsedSales, setCollapsedSales] = useState({});
  const [searchQuery, setSearchQuery] = useState('');

  const toggleSaleCollapse = (saleId) => {
    setCollapsedSales(prev => ({
      ...prev,
      [saleId]: !prev[saleId]
    }));
  };

  const copyToClipboard = async (text, label = 'Nama produk') => {
    if (!text) return;
    try {
      if (Platform.OS === 'web') {
        if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
        } else if (typeof document !== 'undefined') {
          const el = document.createElement('textarea');
          el.value = text;
          document.body.appendChild(el);
          el.select();
          document.execCommand('copy');
          document.body.removeChild(el);
        }
      } else {
        if (Clipboard && Clipboard.setString) {
          Clipboard.setString(text);
        } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
          await navigator.clipboard.writeText(text);
        }
      }
      showToast(`${label} disalin`, 'success');
    } catch (err) {
      showToast(`Gagal menyalin ${label}`, 'error');
    }
  };

  const copyProductItem = async (item) => {
    if (!item) return;
    const name = item.product_name || '';
    const modal = Number(item.cost_price || 0);
    const jual = Number(item.price || 0);
    const barcode = item.barcode ? `\nBarcode: ${item.barcode}` : '';

    const textToCopy = `Nama: ${name}\nModal: ${modal}\nJual: ${jual}${barcode}`;
    await copyToClipboard(textToCopy, `Data "${name}" (Nama, Modal, Jual)`);
  };

  // Column Visibility State
  const [visibleColumns, setVisibleColumns] = useState({
    no: true,
    date: true,
    invoice: false,
    product: true,
    qty: true,
    capitalPrice: false,
    price: true,
    profit: true,
    action: false
  });
  const [showColumnModal, setShowColumnModal] = useState(false);
  const [tempVisibleColumns, setTempVisibleColumns] = useState({...visibleColumns});

  useEffect(() => {
    loadDataForCurrentFilter();
  }, [filterType, customRange, selectedYear, selectedMonth]);

  // Setiap kali data berhasil diload atau kata kunci dicari, hitung ulang totals & flatten items
  useEffect(() => {
    processData();
  }, [sales, searchQuery]);


  // Hitung range tanggal berdasarkan filter yang dipilih
  const getDateRangeForFilter = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (filterType === 'today') {
      return {
        start: new Date(today),
        end: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
      };
    } else if (filterType === 'yesterday') {
      const y = new Date(today);
      y.setDate(today.getDate() - 1);
      return { start: y, end: new Date(today) };
    } else if (filterType === 'thisMonth') {
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: new Date(now.getFullYear(), now.getMonth() + 1, 1)
      };
    } else if (filterType === 'month') {
      return {
        start: new Date(selectedYear, selectedMonth, 1),
        end: new Date(selectedYear, selectedMonth + 1, 1)
      };
    } else if (filterType === 'year') {
      return {
        start: new Date(selectedYear, 0, 1),
        end: new Date(selectedYear + 1, 0, 1)
      };
    } else if (filterType === 'custom' && customRange.startDate) {
      const [sy, sm, sd] = customRange.startDate.split('-').map(Number);
      const start = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
      let end;
      if (customRange.endDate) {
        const [ey, em, ed] = customRange.endDate.split('-').map(Number);
        end = new Date(ey, em - 1, ed);
        end.setDate(end.getDate() + 1);
      } else {
        end = new Date(sy, sm - 1, sd);
        end.setDate(end.getDate() + 1);
      }
      return { start, end };
    }
    return { start: null, end: null };
  };

  // Load data langsung dari Supabase dengan filter tanggal
  const loadDataForCurrentFilter = async () => {
    if (filterType === 'custom' && !customRange.startDate) {
      // Belum pilih tanggal, kosongkan saja
      setSales([]);
      setFlattenedItems([]);
      setFilteredSalesList([]);
      setFilteredTotals({ total: 0, profit: 0 });
      return;
    }

    setLoading(true);
    try {
      const { start, end } = getDateRangeForFilter();
      const data = await getSalesHistoryByRange(user?.id, start, end);
      setSales(data || []);
    } catch (error) {
      showToast('Gagal memuat data laporan', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadData = loadDataForCurrentFilter; // Alias untuk kompabilitas

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const { start, end } = getDateRangeForFilter();
      const data = await getSalesHistoryByRange(user?.id, start, end);
      setSales(data || []);
    } catch (error) {
      showToast('Gagal memuat data laporan', 'error');
    } finally {
      setRefreshing(false);
    }
  };

  // Helper to calculate profit — consistent with HistoryScreen logic
  // Handles legacy data where line_profit may be 0 or null
  const calculateSaleProfit = (sale) => {
    const items = sale.items || sale.sale_items || [];
    if (items.length > 0) {
      return items.reduce((sum, item) => {
        // Prefer stored line_profit if valid, otherwise recalculate from price & cost_price
        const profit = (typeof item.line_profit === 'number' && item.line_profit !== 0)
          ? item.line_profit
          : ((Number(item.price) - Number(item.cost_price || 0)) * Number(item.qty || 1));
        return sum + profit;
      }, 0);
    }
    // No items — fallback to header profit
    return Number(sale.profit) || 0;
  };

  const processData = () => {
    let filteredSales = [...sales];

    // Filter pencarian jika user mengetik kata kunci
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filteredSales = filteredSales.filter(sale => {
        const matchInvoice = (sale.no_invoice || '').toLowerCase().includes(q) ||
          (sale.id || '').toLowerCase().includes(q);
        const matchCustomer = (sale.customer_name || '').toLowerCase().includes(q);
        const saleItems = sale.items || sale.sale_items || [];
        const matchItems = saleItems.some(it =>
          (it.product_name || '').toLowerCase().includes(q) ||
          (it.barcode || '').toLowerCase().includes(q)
        );
        return matchInvoice || matchCustomer || matchItems;
      });
    }

    // Jika filter year, hitung ringkasan per bulan
    if (filterType === 'year') {
      const months = Array(12).fill(0).map((_, i) => ({
        monthIndex: i,
        monthName: new Date(selectedYear, i, 1).toLocaleDateString('id-ID', { month: 'long' }),
        totalSales: 0,
        totalProfit: 0
      }));

      filteredSales.forEach(sale => {
        const m = new Date(sale.created_at).getMonth();
        months[m].totalSales += (sale.total || 0);
        months[m].totalProfit += calculateSaleProfit(sale);
      });

      setMonthlyData(months);
    }

    // Hitung total keseluruhan
    let calcTotal = 0;
    let calcProfit = 0;
    filteredSales.forEach(sale => {
      calcTotal += (sale.total || 0);
      calcProfit += calculateSaleProfit(sale);
    });
    setFilteredTotals({ total: calcTotal, profit: calcProfit });

    // Flatten ke item-item, dengan fallback profit untuk data lama
    let items = [];
    filteredSales.forEach(sale => {
      const saleItems = sale.items || sale.sale_items || [];
      if (saleItems.length > 0) {
        saleItems.forEach(item => {
          if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            const invoiceMatches = (sale.no_invoice || '').toLowerCase().includes(q);
            const itemMatches = (item.product_name || '').toLowerCase().includes(q) ||
              (item.barcode || '').toLowerCase().includes(q);
            if (!invoiceMatches && !itemMatches) {
              return;
            }
          }

          const displayedProfit = (typeof item.line_profit === 'number' && item.line_profit !== 0)
            ? item.line_profit
            : ((Number(item.price) - Number(item.cost_price || 0)) * Number(item.qty || 1));

          items.push({
            ...item,
            line_profit: displayedProfit,
            created_at: sale.created_at,
            original_sale: sale
          });
        });
      }
    });

    items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    filteredSales.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    setFlattenedItems(items);
    setFilteredSalesList(filteredSales);
  };


  const exportToExcel = async () => {
    if (flattenedItems.length === 0) {
      showToast('Tidak ada data untuk diekspor', 'info');
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
        showToast('Fitur sharing tidak tersedia di perangkat ini', 'info');
        return;
      }

      await Sharing.shareAsync(uri, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: 'Download Laporan Penjualan',
        UTI: 'com.microsoft.excel.xlsx'
      });

    } catch (error) {
      showToast('Gagal mengekspor data: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = async (item) => {
    
    if (!item.id) {
      showToast('ID item tidak valid', 'error');
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
            setLoading(true);
            try {
              const result = await deleteSaleItem(item.id);
              
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
                              showToast('Gagal menghapus transaksi: ' + saleResult.error, 'error');
                            }
                          } catch (err) {
                            showToast(err.message, 'error');
                          } finally {
                            setLoading(false);
                          }
                        }
                      }
                    ]
                  );
                } else {
                  showToast('Gagal menghapus item: ' + (result.error || 'Unknown error'), 'error');
                }
              }
            } catch (error) {
              showToast('Terjadi kesalahan saat menghapus: ' + error.message, 'error');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleDeleteSale = async (saleId) => {
    Alert.alert(
      'Hapus Transaksi',
      'Apakah Anda yakin ingin menghapus SELURUH transaksi (Invoice) ini? Semua item di dalamnya akan ikut terhapus.',
      [
        { text: 'Batal', style: 'cancel' },
        { 
          text: 'Hapus Transaksi', 
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const result = await deleteSale(saleId);
              if (result.success) {
                showToast('Transaksi berhasil dihapus', 'success');
                setTimeout(async () => {
                  await loadData();
                }, 500);
              } else {
                showToast('Gagal menghapus transaksi: ' + result.error, 'error');
              }
            } catch (err) {
              showToast(err.message, 'error');
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

  // Use filteredTotals for footer — these are correctly calculated via calculateSaleProfit()
  // which handles all fallback cases (line_profit → (price-cost_price)*qty → sale.profit)
  const totalSales = filteredTotals.total;
  const totalProfit = filteredTotals.profit;
  
  const resetFilters = () => {
    setFilterType('today');
    setCustomRange({ startDate: null, endDate: null });
    setMarkedDates({});
    setSearchQuery('');
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
          contentContainerStyle={{ paddingBottom: 130 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[Colors.primary]}
              tintColor={Colors.primary}
            />
          }
        />
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.tableHeader}>
      {visibleColumns.no && <Text style={[styles.headerCell, { width: 30 }]}>No</Text>}
      {visibleColumns.date && <Text style={[styles.headerCell, { width: 65 }]}>Tanggal</Text>}
      {visibleColumns.invoice && <Text style={[styles.headerCell, { width: 95 }]}>No. Inv</Text>}
      {visibleColumns.product && <Text style={[styles.headerCell, { flex: 1 }]}>Nama Produk / Invoice</Text>}
      {visibleColumns.qty && <Text style={[styles.headerCell, { width: 35, textAlign: 'center' }]}>Qty</Text>}
      {visibleColumns.capitalPrice && <Text style={[styles.headerCell, { width: 75, textAlign: 'right' }]}>Modal</Text>}
      {visibleColumns.price && <Text style={[styles.headerCell, { width: 75, textAlign: 'right' }]}>Harga</Text>}
      {visibleColumns.profit && <Text style={[styles.headerCell, { width: 75, textAlign: 'right' }]}>Profit</Text>}
      {visibleColumns.action && isSelectMode && (
        <Text style={[styles.headerCell, { width: 40, textAlign: 'center' }]}>Act</Text>
      )}
    </View>
  );

  const renderItem = ({ item: sale, index }) => {
    const saleItems = sale.items || sale.sale_items || [];
    const totalQtyInSale = saleItems.reduce((sum, it) => sum + (it.qty || 0), 0);
    const totalCostInSale = saleItems.reduce((sum, it) => sum + ((it.cost_price || 0) * (it.qty || 1)), 0);
    const isCollapsed = searchQuery.trim() ? false : !!collapsedSales[sale.id];

    return (
      <View style={styles.transactionGroup}>
        {/* Transaction Parent Row */}
        <TouchableOpacity 
          style={styles.parentRow}
          onPress={() => {
            setSelectedSale(sale);
            setShowDetailModal(true);
          }}
          activeOpacity={0.7}
        >
          {visibleColumns.no && <Text style={[styles.cell, { width: 30, fontWeight: '700' }]}>{index + 1}</Text>}
          {visibleColumns.date && <Text style={[styles.cell, { width: 65, fontSize: 10, fontWeight: '600' }]}>{formatDateStr(sale.created_at)}</Text>}
          
          {visibleColumns.invoice && (
            <Text style={[styles.cell, { width: 95, fontSize: 10, fontWeight: '700', color: Colors.primary }]} numberOfLines={1}>
              {sale.no_invoice || `TRX-${sale.id.slice(-6).toUpperCase()}`}
            </Text>
          )}

          {visibleColumns.product && (
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
              {!visibleColumns.invoice && (
                <Ionicons name="receipt-outline" size={12} color={Colors.primary} style={{ marginRight: 4 }} />
              )}
              <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.darkText, flexShrink: 1 }} numberOfLines={1}>
                {!visibleColumns.invoice ? (sale.no_invoice || `TRX-${sale.id.slice(-6).toUpperCase()}`) : ''}
                <Text style={{ fontSize: 10, fontWeight: 'normal', color: Colors.muted }}>
                  {!visibleColumns.invoice ? ` (${saleItems.length} item)` : `${saleItems.length} item terjual`}
                </Text>
              </Text>
              <TouchableOpacity 
                onPress={(e) => {
                  e?.stopPropagation?.();
                  toggleSaleCollapse(sale.id);
                }}
                style={{ padding: 4, marginLeft: 2 }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons 
                  name={isCollapsed ? "chevron-forward" : "chevron-down"} 
                  size={14} 
                  color={Colors.primary} 
                />
              </TouchableOpacity>
            </View>
          )}

          {visibleColumns.qty && (
            <Text style={[styles.cell, { width: 35, textAlign: 'center', fontWeight: '700', fontSize: 11 }]}>
              {totalQtyInSale}
            </Text>
          )}
          
          {visibleColumns.capitalPrice && (
            <Text style={[styles.cell, { width: 75, textAlign: 'right', fontSize: 10, color: Colors.muted }]}>
              {formatCurrency(totalCostInSale)}
            </Text>
          )}

          {visibleColumns.price && (
            <Text style={[styles.cell, { width: 75, textAlign: 'right', fontSize: 11, fontWeight: '700', color: Colors.darkText }]}>
              {formatCurrency(sale.total)}
            </Text>
          )}

          {visibleColumns.profit && (
            <Text style={[styles.cell, { width: 75, textAlign: 'right', fontSize: 11, fontWeight: '700', color: Colors.primary }]}>
              {formatCurrency(calculateSaleProfit(sale))}
            </Text>
          )}

          {visibleColumns.action && isSelectMode && (
            <View style={[styles.cell, { width: 40, alignItems: 'center', justifyContent: 'center' }]}>
              <TouchableOpacity 
                onPress={(e) => {
                  e?.stopPropagation?.();
                  handleDeleteSale(sale.id);
                }}
                style={styles.deleteButton}
              >
                <Ionicons name="trash-outline" size={18} color={Colors.danger} />
              </TouchableOpacity>
            </View>
          )}
        </TouchableOpacity>

        {/* Transaction Child Items (Produk yang Terjual) */}
        {!isCollapsed && saleItems.length > 0 && (
          <View style={styles.childRowsContainer}>
            {saleItems.map((item, itemIdx) => {
              const itemProfit = (typeof item.line_profit === 'number' && item.line_profit !== 0)
                ? item.line_profit
                : ((Number(item.price) - Number(item.cost_price || 0)) * Number(item.qty || 1));

              return (
                <View key={`${item.id || itemIdx}-${itemIdx}`} style={styles.childRow}>
                  {visibleColumns.no && <View style={{ width: 30 }} />}
                  {visibleColumns.date && <View style={{ width: 65 }} />}
                  {visibleColumns.invoice && <View style={{ width: 95 }} />}
                  
                  {visibleColumns.product && (
                    <TouchableOpacity 
                      style={{ flex: 1, paddingLeft: 8, paddingRight: 4 }}
                      onPress={() => copyProductItem(item)}
                      onLongPress={() => copyProductItem(item)}
                      activeOpacity={0.6}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={[styles.childProductName, { flexShrink: 1 }]} numberOfLines={2} selectable={true}>
                          ↳ {item.product_name}
                        </Text>
                        <Ionicons name="copy-outline" size={11} color="#94A3B8" style={{ marginLeft: 4 }} />
                      </View>
                      {item.barcode ? <Text style={styles.childProductBarcode} selectable={true}>{item.barcode}</Text> : null}
                    </TouchableOpacity>
                  )}

                  {visibleColumns.qty && (
                    <Text style={[styles.cell, { width: 35, textAlign: 'center', color: Colors.text, fontSize: 11 }]}>
                      {item.qty || 1}
                    </Text>
                  )}

                  {visibleColumns.capitalPrice && (
                    <Text style={[styles.cell, { width: 75, textAlign: 'right', color: Colors.muted, fontSize: 10 }]}>
                      {formatCurrency((item.cost_price || 0) * (item.qty || 1))}
                    </Text>
                  )}

                  {visibleColumns.price && (
                    <Text style={[styles.cell, { width: 75, textAlign: 'right', color: Colors.darkText, fontSize: 11 }]}>
                      {formatCurrency(item.line_total)}
                    </Text>
                  )}

                  {visibleColumns.profit && (
                    <Text style={[styles.cell, { width: 75, textAlign: 'right', color: itemProfit >= 0 ? '#10B981' : '#EF4444', fontSize: 11, fontWeight: '600' }]}>
                      {formatCurrency(itemProfit)}
                    </Text>
                  )}

                  {visibleColumns.action && isSelectMode && (
                    <View style={[styles.cell, { width: 40, alignItems: 'center', justifyContent: 'center' }]}>
                      <TouchableOpacity 
                        onPress={() => handleDeleteItem(item)}
                        style={styles.deleteButton}
                      >
                        <Ionicons name="close-circle-outline" size={16} color={Colors.danger} />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </View>
    );
  };

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
            style={[styles.exportButton, { backgroundColor: Colors.secondary, marginRight: 8 }]} 
            onPress={openColumnModal}
          >
            <Ionicons name="options" size={20} color={Colors.white} />
            <Text style={styles.exportButtonText}>Atur Kolom</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.exportButton} 
            onPress={exportToExcel}
          >
            <Ionicons name="download" size={20} color={Colors.white} />
            <Text style={styles.exportButtonText}>Excel</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={{ display: 'none' }}
          />
        </View>
      </View>

      {/* Search Input */}
      <View style={styles.searchSection}>
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={17} color={Colors.muted} style={{ marginRight: 8 }} />
          <TextInput
            placeholder="Cari produk, barcode, no. invoice..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
            placeholderTextColor={Colors.muted}
            clearButtonMode="while-editing"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
              <Ionicons name="close-circle" size={18} color={Colors.muted} />
            </TouchableOpacity>
          ) : null}
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
              style={[styles.filterBtn, { backgroundColor: Colors.dangerLight, borderColor: Colors.danger }]}
              onPress={resetFilters}
            >
              <Text style={[styles.filterText, { color: Colors.danger }]}>Reset</Text>
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
            data={filteredSalesList}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 130 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[Colors.primary]}
                tintColor={Colors.primary}
              />
            }
          />
        </View>
      )}

      {/* Footer Summary */}
      <View style={styles.footer}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total Item Terjual (Qty):</Text>
          <Text style={styles.summaryValue}>
             {filterType === 'year' 
               ? '-' 
               : `${flattenedItems.reduce((sum, item) => sum + (item.qty || 0), 0)} Pcs`}
          </Text>
        </View>
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
                <Text style={[styles.modalBtnText, { color: Colors.white }]}>Terapkan</Text>
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
                    selectedYear === year ? styles.confirmBtn : { backgroundColor: Colors.borderLight },
                    { marginBottom: 8, width: '100%' }
                  ]}
                  onPress={() => {
                    setSelectedYear(year);
                    setShowYearPicker(false);
                  }}
                >
                  <Text style={[
                    styles.modalBtnText, 
                    selectedYear === year ? { color: Colors.white } : { color: Colors.text }
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
                      backgroundColor: selectedMonth === month ? Colors.primary : Colors.borderLight
                    }
                  ]}
                  onPress={() => {
                    setSelectedMonth(month);
                    setShowMonthPicker(false);
                  }}
                >
                  <Text style={{ color: selectedMonth === month ? Colors.white : Colors.text }}>
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
                  qty: 'Quantity (Qty)',
                  capitalPrice: 'Harga Modal',
                  price: 'Harga',
                  profit: 'Profit',
                  action: 'Action'
                };
                if (key === 'action' && !isSelectMode) return null;
                return (
                  <TouchableOpacity 
                    key={key} 
                    style={{flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.borderLight}}
                    onPress={() => toggleColumn(key)}
                  >
                    <Ionicons 
                      name={tempVisibleColumns[key] ? "checkbox" : "square-outline"} 
                      size={24} 
                      color={Colors.primary} 
                    />
                    <Text style={{marginLeft: 12, fontSize: 16, color: Colors.text}}>{labels[key]}</Text>
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
                <Text style={[styles.modalBtnText, {color: Colors.white}]}>Simpan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Transaction Detail Modal */}
      <Modal visible={showDetailModal} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { maxHeight: '80%', padding: 0 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.borderLight }}>
              <Text style={[styles.modalTitle, { marginBottom: 0 }]}>Detail Transaksi</Text>
              <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                <Ionicons name="close" size={24} color={Colors.darkText} />
              </TouchableOpacity>
            </View>
            
            {selectedSale && (
              <ScrollView style={{ padding: 20 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, borderStyle: 'dashed' }}>
                  <TouchableOpacity onPress={() => copyToClipboard(selectedSale.no_invoice, 'No. Invoice')}>
                    <Text style={{ fontSize: 11, color: Colors.muted, marginBottom: 2 }}>No. Invoice (ketuk untuk salin)</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.darkText }} selectable={true}>
                        {selectedSale.no_invoice || `TRX-${selectedSale.id.slice(-6).toUpperCase()}`}
                      </Text>
                      <Ionicons name="copy-outline" size={12} color={Colors.primary} style={{ marginLeft: 4 }} />
                    </View>
                  </TouchableOpacity>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 11, color: Colors.muted, marginBottom: 2 }}>Tanggal</Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.darkText }}>
                      {new Date(selectedSale.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                    </Text>
                  </View>
                </View>
                
                {(selectedSale.items || selectedSale.sale_items || []).map((item, idx) => (
                  <TouchableOpacity 
                    key={idx} 
                    style={{ marginBottom: 12 }}
                    onPress={() => copyProductItem(item)}
                    activeOpacity={0.7}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingRight: 8 }}>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: Colors.darkText, flexShrink: 1 }} selectable={true}>
                          {item.product_name}
                        </Text>
                        <Ionicons name="copy-outline" size={13} color={Colors.primary} style={{ marginLeft: 6 }} />
                      </View>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.darkText }}>{formatCurrency(item.line_total)}</Text>
                    </View>
                    <Text style={{ fontSize: 11, color: Colors.muted, marginTop: 2 }}>
                      {item.qty || 1} x {formatCurrency(item.price)}
                    </Text>
                  </TouchableOpacity>
                ))}

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: Colors.borderLight, borderStyle: 'dashed', marginBottom: 30 }}>
                  <Text style={{ fontSize: 16, fontWeight: 'bold', color: Colors.darkText }}>Total</Text>
                  <Text style={{ fontSize: 16, fontWeight: 'bold', color: Colors.primary }}>{formatCurrency(selectedSale.total)}</Text>
                </View>
              </ScrollView>
            )}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    zIndex: 10,
    elevation: 4,
    backgroundColor: Colors.card,
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
    backgroundColor: Colors.primary,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginRight: 8,
  },
  exportButtonText: {
    color: Colors.white,
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
    color: Colors.white,
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 2,
    backgroundColor: Colors.lightBg,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.text,
    paddingVertical: 4,
  },
  filterContainer: {
    flexDirection: 'row',
    padding: 10,
    paddingHorizontal: 16,
    backgroundColor: Colors.lightBg,
  },
  filterBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 8,
    backgroundColor: Colors.card,
  },
  activeFilterBtn: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterText: {
    color: Colors.muted,
    fontSize: 12,
  },
  activeFilterText: {
    color: Colors.white,
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
    backgroundColor: Colors.borderLight,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  headerCell: {
    fontWeight: 'bold',
    fontSize: 12,
    color: Colors.darkText,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    alignItems: 'center',
  },
  cell: {
    fontSize: 12,
    color: Colors.text,
  },
  deleteButton: {
    padding: 4,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.card,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    elevation: 10,
    shadowColor: Colors.black,
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
    color: Colors.darkText,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.darkText,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
    color: Colors.darkText,
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
    backgroundColor: Colors.borderLight,
  },
  confirmBtn: {
    backgroundColor: Colors.primary,
  },
  modalBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.text,
  },
  transactionGroup: {
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingVertical: 4,
  },
  parentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  childRowsContainer: {
    paddingVertical: 2,
    backgroundColor: '#FAFCFF',
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
    marginLeft: 6,
    marginRight: 6,
    marginTop: 2,
    marginBottom: 4,
  },
  childRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  childProductName: {
    fontSize: 11,
    color: '#334155',
    fontWeight: '600',
  },
  childProductBarcode: {
    fontSize: 9,
    color: '#94A3B8',
    marginLeft: 10,
    marginTop: 1,
  },
});
