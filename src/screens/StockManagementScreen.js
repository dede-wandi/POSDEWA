import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  FlatList,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { listProducts } from '../services/productsSupabase';
import { addStock, getStockHistory, adjustStock } from '../services/stockSupabase';
import { formatDate } from '../utils/helpers';

export default function StockManagementScreen({ navigation }) {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [stockHistory, setStockHistory] = useState([]);
  const [filteredStockHistory, setFilteredStockHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('products'); // 'products' or 'history'
  
  // Date filter states
  const [showDateFilterModal, setShowDateFilterModal] = useState(false);
  const [dateFilter, setDateFilter] = useState('all'); // 'all', 'today', 'week', 'month', 'year', 'custom'
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  
  // Modal states
  const [showAddStockModal, setShowAddStockModal] = useState(false);
  const [showAdjustStockModal, setShowAdjustStockModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [stockQuantity, setStockQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [adjustmentType, setAdjustmentType] = useState('set'); // 'set', 'add', 'subtract'
  const [newStockValue, setNewStockValue] = useState('');
  const [addingStock, setAddingStock] = useState(false);

  // Date filter functions
  const getDateFilterLabel = () => {
    switch (dateFilter) {
      case 'today': return 'Hari Ini';
      case 'week': return 'Minggu Ini';
      case 'month': return 'Bulan Ini';
      case 'year': return 'Tahun Ini';
      case 'custom': return 'Custom';
      default: return 'Semua';
    }
  };

  const applyDateFilter = (history) => {
    if (dateFilter === 'all') {
      return history;
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return history.filter(item => {
      const itemDate = new Date(item.created_at);
      const itemDateOnly = new Date(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate());

      switch (dateFilter) {
        case 'today':
          return itemDateOnly.getTime() === today.getTime();
        
        case 'week':
          const weekStart = new Date(today);
          weekStart.setDate(today.getDate() - today.getDay());
          return itemDateOnly >= weekStart && itemDateOnly <= today;
        
        case 'month':
          const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
          return itemDateOnly >= monthStart && itemDateOnly <= today;
        
        case 'year':
          const yearStart = new Date(today.getFullYear(), 0, 1);
          return itemDateOnly >= yearStart && itemDateOnly <= today;
        
        case 'custom':
          if (!customStartDate || !customEndDate) return true;
          const startDate = new Date(customStartDate);
          const endDate = new Date(customEndDate);
          const startDateOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
          const endDateOnly = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
          return itemDateOnly >= startDateOnly && itemDateOnly <= endDateOnly;
        
        default:
          return true;
      }
    });
  };

  const handleDateFilterChange = (newFilter) => {
    setDateFilter(newFilter);
    if (newFilter !== 'custom') {
      setCustomStartDate('');
      setCustomEndDate('');
    }
  };

  const applyDateFilterAndClose = () => {
    const filtered = applyDateFilter(stockHistory);
    setFilteredStockHistory(filtered);
    setShowDateFilterModal(false);
  };

  const loadProducts = async () => {
    try {
      console.log('📦 StockManagementScreen: Loading products...');
      const products = await listProducts(user?.id);
      // Sort by stock (low stock first)
      const sortedProducts = products.sort((a, b) => a.stock - b.stock);
      setProducts(sortedProducts);
    } catch (error) {
      console.log('❌ StockManagementScreen: Exception loading products:', error);
      Alert.alert('Error', 'Terjadi kesalahan saat memuat produk');
    }
  };

  const loadStockHistory = async () => {
    try {
      console.log('📦 StockManagementScreen: Loading stock history...');
      const result = await getStockHistory(null, 100);
      if (result.success) {
        setStockHistory(result.data);
        const filtered = applyDateFilter(result.data);
        setFilteredStockHistory(filtered);
      } else {
        console.log('❌ StockManagementScreen: Error loading stock history:', result.error);
        Alert.alert('Error', 'Gagal memuat riwayat stock: ' + result.error);
      }
    } catch (error) {
      console.log('❌ StockManagementScreen: Exception loading stock history:', error);
      Alert.alert('Error', 'Terjadi kesalahan saat memuat riwayat stock');
    }
  };

  // Apply date filter when stockHistory or dateFilter changes
  useEffect(() => {
    const filtered = applyDateFilter(stockHistory);
    setFilteredStockHistory(filtered);
  }, [stockHistory, dateFilter, customStartDate, customEndDate]);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([loadProducts(), loadStockHistory()]);
    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [user?.id])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleAddStock = async () => {
    if (!selectedProduct || !stockQuantity || isNaN(stockQuantity) || parseInt(stockQuantity) <= 0) {
      Alert.alert('Error', 'Masukkan jumlah stock yang valid');
      return;
    }

    setAddingStock(true);
    try {
      const result = await addStock(
        selectedProduct.id,
        parseInt(stockQuantity),
        stockReason || 'Penambahan stock manual',
        stockNotes
      );

      if (result.success) {
        Alert.alert('Berhasil', 'Stock berhasil ditambahkan');
        setShowAddStockModal(false);
        setSelectedProduct(null);
        setStockQuantity('');
        setStockReason('');
        setStockNotes('');
        loadData(); // Refresh data
      } else {
        Alert.alert('Error', 'Gagal menambah stock: ' + result.error);
      }
    } catch (error) {
      console.log('❌ StockManagementScreen: Exception adding stock:', error);
      Alert.alert('Error', 'Terjadi kesalahan saat menambah stock');
    } finally {
      setAddingStock(false);
    }
  };

  const handleAdjustStock = (product) => {
    setSelectedProduct(product);
    setNewStockValue(product.stock.toString());
    setAdjustmentType('set');
    setReason('');
    setNotes('');
    setShowAdjustStockModal(true);
  };

  const submitStockAdjustment = async () => {
    if (!selectedProduct || !newStockValue.trim()) {
      Alert.alert('Error', 'Mohon isi nilai stock yang baru');
      return;
    }

    if (!reason.trim()) {
      Alert.alert('Error', 'Mohon isi alasan penyesuaian stock');
      return;
    }

    const inputValue = parseInt(newStockValue);
    if (isNaN(inputValue) || inputValue < 0) {
      Alert.alert('Error', 'Nilai stock harus berupa angka positif');
      return;
    }

    // Calculate the final stock value based on adjustment type
    let finalStock;
    switch (adjustmentType) {
      case 'add':
        finalStock = selectedProduct.stock + inputValue;
        break;
      case 'subtract':
        finalStock = Math.max(0, selectedProduct.stock - inputValue);
        break;
      case 'set':
      default:
        finalStock = inputValue;
        break;
    }

    try {
      const result = await adjustStock(
        selectedProduct.id,
        finalStock,
        reason,
        notes || undefined
      );

      if (result.success) {
        Alert.alert('Berhasil', 'Stock berhasil disesuaikan');
        setShowAdjustStockModal(false);
        resetAdjustmentForm();
        loadProducts();
        if (activeTab === 'history') {
          loadHistory();
        }
      } else {
        Alert.alert('Error', result.error || 'Gagal menyesuaikan stock');
      }
    } catch (error) {
      console.error('Error adjusting stock:', error);
      Alert.alert('Error', 'Terjadi kesalahan saat menyesuaikan stock');
    }
  };

  const resetAdjustmentForm = () => {
    setSelectedProduct(null);
    setNewStockValue('');
    setAdjustmentType('set');
    setReason('');
    setNotes('');
  };

  const submitAddStock = async () => {
    if (!selectedProduct || !stockQuantity.trim()) {
      Alert.alert('Error', 'Mohon isi jumlah stock yang akan ditambahkan');
      return;
    }

    if (!reason.trim()) {
      Alert.alert('Error', 'Mohon isi alasan penambahan stock');
      return;
    }

    const quantity = parseInt(stockQuantity);
    if (isNaN(quantity) || quantity <= 0) {
      Alert.alert('Error', 'Jumlah stock harus berupa angka positif');
      return;
    }

    setAddingStock(true);
    try {
      const result = await addStock(
        selectedProduct.id,
        quantity,
        reason,
        notes || undefined
      );

      if (result.success) {
        Alert.alert('Berhasil', 'Stock berhasil ditambahkan');
        setShowAddStockModal(false);
        resetAddStockForm();
        loadProducts();
        if (activeTab === 'history') {
          loadHistory();
        }
      } else {
        Alert.alert('Error', result.error || 'Gagal menambahkan stock');
      }
    } catch (error) {
      console.error('Error adding stock:', error);
      Alert.alert('Error', 'Terjadi kesalahan saat menambahkan stock');
    } finally {
      setAddingStock(false);
    }
  };

  const resetAddStockForm = () => {
    setSelectedProduct(null);
    setStockQuantity('');
    setReason('');
    setNotes('');
  };

  const calculatePreviewStock = () => {
    if (!selectedProduct || !newStockValue.trim()) return selectedProduct?.stock || 0;
    
    const inputValue = parseInt(newStockValue);
    if (isNaN(inputValue)) return selectedProduct?.stock || 0;

    switch (adjustmentType) {
      case 'add':
        return selectedProduct.stock + inputValue;
      case 'subtract':
        return Math.max(0, selectedProduct.stock - inputValue);
      case 'set':
      default:
        return inputValue;
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStockStatusColor = (stock) => {
    if (stock <= 5) return '#FF3B30';
    if (stock <= 20) return '#FF9500';
    return '#34C759';
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'addition': return 'add-circle';
      case 'reduction': return 'remove-circle';
      case 'adjustment': return 'settings';
      default: return 'help-circle';
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'addition': return '#34C759';
      case 'reduction': return '#FF3B30';
      case 'adjustment': return '#007AFF';
      default: return '#8E8E93';
    }
  };

  const getTypeText = (type) => {
    switch (type) {
      case 'addition': return 'Penambahan';
      case 'reduction': return 'Pengurangan';
      case 'adjustment': return 'Penyesuaian';
      default: return 'Lainnya';
    }
  };

  const ProductItem = ({ item }) => (
    <View style={styles.productItem}>
      <View style={styles.productInfo}>
        <Text style={styles.productName}>{item.name}</Text>
        <Text style={styles.productBarcode}>{item.barcode}</Text>
        <View style={styles.stockInfo}>
          <Text style={[styles.stockText, { color: getStockStatusColor(item.stock) }]}>
            Stock: {item.stock}
          </Text>
          {item.stock <= 5 && (
            <View style={styles.lowStockBadge}>
              <Text style={styles.lowStockText}>Stock Menipis</Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.productActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.addButton]}
          onPress={() => {
            setSelectedProduct(item);
            setShowAddStockModal(true);
          }}
        >
          <Ionicons name="add" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.adjustButton]}
          onPress={() => handleAdjustStock(item)}
        >
          <Ionicons name="settings" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const HistoryItem = ({ item }) => (
    <View style={styles.historyItem}>
      <View style={styles.historyHeader}>
        <View style={styles.historyTypeContainer}>
          <Ionicons 
            name={getTypeIcon(item.type)} 
            size={20} 
            color={getTypeColor(item.type)} 
          />
          <Text style={[styles.historyType, { color: getTypeColor(item.type) }]}>
            {getTypeText(item.type)}
          </Text>
        </View>
        <Text style={styles.historyDate}>{formatDate(item.created_at)}</Text>
      </View>
      
      <Text style={styles.historyProduct}>{item.products?.name || 'Produk tidak ditemukan'}</Text>
      
      <View style={styles.historyDetails}>
        <Text style={styles.historyQuantity}>
          {item.type === 'reduction' ? '-' : '+'}{item.quantity}
        </Text>
        <Text style={styles.historyStock}>
          {item.previous_stock} → {item.new_stock}
        </Text>
      </View>
      
      {item.reason && (
        <Text style={styles.historyReason}>{item.reason}</Text>
      )}
      
      {item.notes && (
        <Text style={styles.historyNotes}>{item.notes}</Text>
      )}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Memuat data stock...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Kelola Stock</Text>
        {activeTab === 'history' ? (
          <TouchableOpacity 
            style={styles.dateFilterButton}
            onPress={() => setShowDateFilterModal(true)}
          >
            <Ionicons name="calendar-outline" size={24} color="#007AFF" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 24 }} />
        )}
      </View>

      {/* Date Filter Info for History Tab */}
      {activeTab === 'history' && (
        <View style={styles.filterInfo}>
          <Text style={styles.filterInfoText}>
            Filter: {getDateFilterLabel()} ({filteredStockHistory.length} item)
          </Text>
        </View>
      )}

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'products' && styles.activeTab]}
          onPress={() => setActiveTab('products')}
        >
          <Text style={[styles.tabText, activeTab === 'products' && styles.activeTabText]}>
            Produk
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'history' && styles.activeTab]}
          onPress={() => setActiveTab('history')}
        >
          <Text style={[styles.tabText, activeTab === 'history' && styles.activeTabText]}>
            Riwayat
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {activeTab === 'products' ? (
          <View style={styles.productsContainer}>
            {products.length > 0 ? (
              products.map((product) => (
                <ProductItem key={product.id} item={product} />
              ))
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="cube-outline" size={48} color="#C7C7CC" />
                <Text style={styles.emptyStateText}>Belum ada produk</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.historyContainer}>
            {filteredStockHistory.length > 0 ? (
              filteredStockHistory.map((history) => (
                <HistoryItem key={history.id} item={history} />
              ))
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="time-outline" size={48} color="#C7C7CC" />
                <Text style={styles.emptyStateText}>
                  {stockHistory.length === 0 ? 'Belum ada riwayat stock' : 'Tidak ada riwayat untuk filter ini'}
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Add Stock Modal */}
      <Modal
        visible={showAddStockModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAddStockModal(false)}>
              <Text style={styles.modalCancelText}>Batal</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Tambah Stock</Text>
            <TouchableOpacity 
              onPress={submitAddStock}
              disabled={addingStock || !stockQuantity.trim() || !reason.trim()}
            >
              <Text style={[
                styles.modalSaveText,
                (addingStock || !stockQuantity.trim() || !reason.trim()) && styles.disabledText
              ]}>
                {addingStock ? 'Menyimpan...' : 'Simpan'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {selectedProduct && (
              <View style={styles.selectedProductInfo}>
                <Text style={styles.selectedProductName}>{selectedProduct.name}</Text>
                <Text style={styles.selectedProductStock}>Stock saat ini: {selectedProduct.stock}</Text>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Jumlah Tambahan *</Text>
              <TextInput
                style={styles.textInput}
                value={stockQuantity}
                onChangeText={setStockQuantity}
                placeholder="Masukkan jumlah stock yang ditambahkan"
                keyboardType="numeric"
                autoFocus
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Alasan *</Text>
              <TextInput
                style={styles.textInput}
                value={reason}
                onChangeText={setReason}
                placeholder="Alasan penambahan stock"
                multiline
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Catatan</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Catatan tambahan (opsional)"
                multiline
                numberOfLines={3}
              />
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Stock Adjustment Modal */}
      <Modal
        visible={showAdjustStockModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => {
              setShowAdjustStockModal(false);
              resetAdjustmentForm();
            }}>
              <Text style={styles.modalCancelText}>Batal</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Penyesuaian Stock</Text>
            <TouchableOpacity 
              onPress={submitStockAdjustment}
              disabled={!newStockValue.trim() || !reason.trim()}
            >
              <Text style={[
                styles.modalSaveText,
                (!newStockValue.trim() || !reason.trim()) && styles.disabledText
              ]}>
                Sesuaikan
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {selectedProduct && (
              <View style={styles.selectedProductInfo}>
                <Text style={styles.selectedProductName}>{selectedProduct.name}</Text>
                <Text style={styles.selectedProductStock}>Stock saat ini: {selectedProduct.stock}</Text>
                <Text style={styles.previewStock}>
                  Stock setelah penyesuaian: {calculatePreviewStock()}
                </Text>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Tipe Penyesuaian</Text>
              <View style={styles.adjustmentTypeContainer}>
                <TouchableOpacity
                  style={[
                    styles.adjustmentTypeButton,
                    adjustmentType === 'set' && styles.activeAdjustmentType
                  ]}
                  onPress={() => {
                    setAdjustmentType('set');
                    setNewStockValue(selectedProduct?.stock.toString() || '');
                  }}
                >
                  <Ionicons 
                    name="create-outline" 
                    size={16} 
                    color={adjustmentType === 'set' ? '#FFFFFF' : '#007AFF'} 
                  />
                  <Text style={[
                    styles.adjustmentTypeText,
                    adjustmentType === 'set' && styles.activeAdjustmentTypeText
                  ]}>
                    Set Nilai
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.adjustmentTypeButton,
                    adjustmentType === 'add' && styles.activeAdjustmentType
                  ]}
                  onPress={() => {
                    setAdjustmentType('add');
                    setNewStockValue('');
                  }}
                >
                  <Ionicons 
                    name="add-circle-outline" 
                    size={16} 
                    color={adjustmentType === 'add' ? '#FFFFFF' : '#34C759'} 
                  />
                  <Text style={[
                    styles.adjustmentTypeText,
                    adjustmentType === 'add' && styles.activeAdjustmentTypeText
                  ]}>
                    Tambah
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.adjustmentTypeButton,
                    adjustmentType === 'subtract' && styles.activeAdjustmentType
                  ]}
                  onPress={() => {
                    setAdjustmentType('subtract');
                    setNewStockValue('');
                  }}
                >
                  <Ionicons 
                    name="remove-circle-outline" 
                    size={16} 
                    color={adjustmentType === 'subtract' ? '#FFFFFF' : '#FF3B30'} 
                  />
                  <Text style={[
                    styles.adjustmentTypeText,
                    adjustmentType === 'subtract' && styles.activeAdjustmentTypeText
                  ]}>
                    Kurangi
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                {adjustmentType === 'set' ? 'Stock Baru *' : 
                 adjustmentType === 'add' ? 'Jumlah Penambahan *' : 
                 'Jumlah Pengurangan *'}
              </Text>
              <TextInput
                style={styles.textInput}
                value={newStockValue}
                onChangeText={setNewStockValue}
                placeholder={
                  adjustmentType === 'set' ? 'Masukkan nilai stock baru' :
                  adjustmentType === 'add' ? 'Masukkan jumlah yang ditambahkan' :
                  'Masukkan jumlah yang dikurangi'
                }
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Alasan Penyesuaian *</Text>
              <TextInput
                style={styles.textInput}
                value={reason}
                onChangeText={setReason}
                placeholder="Alasan penyesuaian stock"
                multiline
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Catatan</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Catatan tambahan (opsional)"
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Preview Section */}
            <View style={styles.previewSection}>
              <Text style={styles.previewTitle}>Preview Perubahan</Text>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Stock Saat Ini:</Text>
                <Text style={styles.previewValue}>{selectedProduct?.stock || 0}</Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Stock Setelah Penyesuaian:</Text>
                <Text style={[
                  styles.previewValue,
                  { color: calculatePreviewStock() !== selectedProduct?.stock ? '#007AFF' : '#8E8E93' }
                ]}>
                  {calculatePreviewStock()}
                </Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Selisih:</Text>
                <Text style={[
                  styles.previewValue,
                  { 
                    color: calculatePreviewStock() > (selectedProduct?.stock || 0) ? '#34C759' : 
                           calculatePreviewStock() < (selectedProduct?.stock || 0) ? '#FF3B30' : '#8E8E93'
                  }
                ]}>
                  {calculatePreviewStock() > (selectedProduct?.stock || 0) ? '+' : ''}
                  {calculatePreviewStock() - (selectedProduct?.stock || 0)}
                </Text>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Date Filter Modal */}
      <Modal
        visible={showDateFilterModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowDateFilterModal(false)}>
              <Text style={styles.modalCancelText}>Batal</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Filter Tanggal</Text>
            <TouchableOpacity onPress={applyDateFilterAndClose}>
              <Text style={styles.modalSaveText}>Terapkan</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Pilih Periode</Text>
              
              {['all', 'today', 'week', 'month', 'year', 'custom'].map((filter) => (
                <TouchableOpacity
                  key={filter}
                  style={[
                    styles.filterOption,
                    dateFilter === filter && styles.activeFilterOption
                  ]}
                  onPress={() => handleDateFilterChange(filter)}
                >
                  <Text style={[
                    styles.filterOptionText,
                    dateFilter === filter && styles.activeFilterOptionText
                  ]}>
                    {filter === 'all' && 'Semua'}
                    {filter === 'today' && 'Hari Ini'}
                    {filter === 'week' && 'Minggu Ini'}
                    {filter === 'month' && 'Bulan Ini'}
                    {filter === 'year' && 'Tahun Ini'}
                    {filter === 'custom' && 'Custom'}
                  </Text>
                  {dateFilter === filter && (
                    <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {dateFilter === 'custom' && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Tanggal Custom</Text>
                <View style={styles.dateInputContainer}>
                  <View style={styles.dateInputGroup}>
                    <Text style={styles.dateInputLabel}>Dari</Text>
                    <TextInput
                      style={styles.textInput}
                      value={customStartDate}
                      onChangeText={setCustomStartDate}
                      placeholder="YYYY-MM-DD"
                    />
                  </View>
                  <View style={styles.dateInputGroup}>
                    <Text style={styles.dateInputLabel}>Sampai</Text>
                    <TextInput
                      style={styles.textInput}
                      value={customEndDate}
                      onChangeText={setCustomEndDate}
                      placeholder="YYYY-MM-DD"
                    />
                  </View>
                </View>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  productsContainer: {
    padding: 20,
  },
  historyContainer: {
    padding: 20,
  },
  productItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  productBarcode: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 8,
  },
  stockInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stockText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  dateFilterButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
  },
  filterInfo: {
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  filterInfoText: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  activeFilterOption: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  filterOptionText: {
    fontSize: 16,
    color: '#000000',
    fontWeight: '500',
  },
  activeFilterOptionText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  dateInputContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  dateInputGroup: {
    flex: 1,
  },
  dateInputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  modalCancelText: {
    fontSize: 16,
    color: '#FF3B30',
    fontWeight: '500',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  modalSaveText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  historyItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  historyTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyType: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  historyDate: {
    fontSize: 12,
    color: '#8E8E93',
  },
  historyProduct: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  historyDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  historyQuantity: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  historyStock: {
    fontSize: 14,
    color: '#8E8E93',
  },
  historyReason: {
    fontSize: 14,
    color: '#000000',
    marginBottom: 4,
  },
  historyNotes: {
    fontSize: 12,
    color: '#8E8E93',
    fontStyle: 'italic',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 12,
    textAlign: 'center',
  },
  productActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  addButton: {
    backgroundColor: '#34C759',
  },
  adjustButton: {
    backgroundColor: '#007AFF',
  },
  lowStockBadge: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  lowStockText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  adjustmentTypeContainer: {
    flexDirection: 'row',
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  adjustmentTypeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  activeAdjustmentType: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  adjustmentTypeText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },
  activeAdjustmentTypeText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 16,
  },
  previewSection: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#BBDEFB',
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976D2',
    marginBottom: 12,
    textAlign: 'center',
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingVertical: 4,
  },
  previewLabel: {
    fontSize: 14,
    color: '#424242',
    fontWeight: '500',
  },
  previewValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976D2',
  },
  disabledText: {
    color: '#8E8E93',
  },
  selectedProductInfo: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  selectedProductName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
  },
  selectedProductStock: {
    fontSize: 15,
    color: '#666666',
    marginBottom: 6,
    fontWeight: '500',
  },
  previewStock: {
    fontSize: 15,
    color: '#007AFF',
    fontWeight: '700',
    backgroundColor: '#F0F8FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  inputGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1.5,
    borderColor: '#E5E5EA',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    color: '#000000',
  },
  modalContent: {
    flex: 1,
    padding: 24,
  },
});