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
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';
import { useAuth } from '../context/AuthContext';
import { getSalesHistory, deleteSaleItem } from '../services/salesSupabase';
import { Colors } from '../theme';

export default function SalesReportScreen({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [sales, setSales] = useState([]);
  const [flattenedItems, setFlattenedItems] = useState([]);
  
  // Filter state
  const [filterType, setFilterType] = useState('today'); // 'today', 'yesterday', 'custom'
  const [showCalendar, setShowCalendar] = useState(false);
  const [customRange, setCustomRange] = useState({ startDate: null, endDate: null });
  const [markedDates, setMarkedDates] = useState({});

  // Selection mode
  const [isSelectMode, setIsSelectMode] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    processData();
  }, [sales, filterType, customRange]);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getSalesHistory(user?.id);
      setSales(data || []);
    } catch (error) {
      console.error('Error loading sales report:', error);
    } finally {
      setLoading(false);
    }
  };

  const processData = () => {
    let filteredSales = [...sales];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (filterType === 'today') {
      filteredSales = filteredSales.filter(s => {
        const d = new Date(s.created_at);
        return d >= today;
      });
    } else if (filterType === 'yesterday') {
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      const endYesterday = new Date(yesterday);
      endYesterday.setHours(23, 59, 59, 999);
      
      filteredSales = filteredSales.filter(s => {
        const d = new Date(s.created_at);
        return d >= yesterday && d <= endYesterday;
      });
    } else if (filterType === 'custom' && customRange.startDate && customRange.endDate) {
      const start = new Date(customRange.startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(customRange.endDate);
      end.setHours(23, 59, 59, 999);
      
      filteredSales = filteredSales.filter(s => {
        const d = new Date(s.created_at);
        return d >= start && d <= end;
      });
    }

    // Flatten to items
    let items = [];
    filteredSales.forEach(sale => {
      const saleItems = sale.items || sale.sale_items || [];
      if (saleItems.length > 0) {
        saleItems.forEach(item => {
          items.push({
            ...item,
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

  const handleDeleteItem = (item) => {
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
                // Refresh data
                await loadData();
              } else {
                Alert.alert('Gagal', 'Gagal menghapus item: ' + result.error);
              }
            } catch (error) {
              Alert.alert('Error', 'Terjadi kesalahan saat menghapus');
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

  const renderHeader = () => (
    <View style={styles.tableHeader}>
      <Text style={[styles.headerCell, { width: 40 }]}>No</Text>
      <Text style={[styles.headerCell, { width: 80 }]}>Tanggal</Text>
      <Text style={[styles.headerCell, { flex: 1 }]}>Nama Produk</Text>
      <Text style={[styles.headerCell, { width: 90, textAlign: 'right' }]}>Harga</Text>
      <Text style={[styles.headerCell, { width: 90, textAlign: 'right' }]}>Profit</Text>
      {isSelectMode && (
        <Text style={[styles.headerCell, { width: 60, textAlign: 'center' }]}>Action</Text>
      )}
    </View>
  );

  const renderItem = ({ item, index }) => (
    <View style={styles.row}>
      <Text style={[styles.cell, { width: 40 }]}>{index + 1}</Text>
      <Text style={[styles.cell, { width: 80 }]}>{formatDateStr(item.created_at)}</Text>
      <Text style={[styles.cell, { flex: 1 }]}>{item.product_name} {item.qty > 1 ? `(${item.qty}x)` : ''}</Text>
      <Text style={[styles.cell, { width: 90, textAlign: 'right' }]}>{formatCurrency(item.line_total)}</Text>
      <Text style={[styles.cell, { width: 90, textAlign: 'right', color: item.line_profit >= 0 ? 'green' : 'red' }]}>
        {formatCurrency(item.line_profit)}
      </Text>
      {isSelectMode && (
        <View style={[styles.cell, { width: 60, alignItems: 'center', justifyContent: 'center' }]}>
          <TouchableOpacity 
            onPress={() => handleDeleteItem(item)}
            style={styles.deleteButton}
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
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Report Penjualan</Text>
        </View>
        
        <TouchableOpacity 
          style={[styles.selectButton, isSelectMode && styles.selectButtonActive]} 
          onPress={() => setIsSelectMode(!isSelectMode)}
        >
          <Text style={[styles.selectButtonText, isSelectMode && styles.selectButtonTextActive]}>
            {isSelectMode ? 'Selesai' : 'Select'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <View style={styles.filterContainer}>
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
          style={[styles.filterBtn, filterType === 'custom' && styles.activeFilterBtn]}
          onPress={() => {
            setFilterType('custom');
            setShowCalendar(true);
          }}
        >
          <Text style={[styles.filterText, filterType === 'custom' && styles.activeFilterText]}>
            {customRange.startDate && customRange.endDate 
              ? `${formatDateStr(customRange.startDate)} - ${formatDateStr(customRange.endDate)}`
              : 'Custom Tanggal'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
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
          <Text style={styles.summaryValue}>{formatCurrency(totalSales)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total Profit:</Text>
          <Text style={[styles.summaryValue, { color: 'green' }]}>{formatCurrency(totalProfit)}</Text>
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
                  if (customRange.startDate && customRange.endDate) {
                    setShowCalendar(false);
                  } else {
                    alert('Silakan pilih tanggal mulai dan akhir');
                  }
                }}
              >
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Terapkan</Text>
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
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  backButton: {
    marginRight: 16,
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
