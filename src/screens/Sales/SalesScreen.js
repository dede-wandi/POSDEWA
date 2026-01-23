import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, Alert, StyleSheet, Dimensions, RefreshControl, Modal, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme';
import { findByBarcodeOrName, findByBarcodeExact, getProducts } from '../../services/products';
import { formatIDR } from '../../utils/currency';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../contexts/ToastContext';

const { width } = Dimensions.get('window');

export default function SalesScreen({ navigation, route }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [cart, setCart] = useState([]); // Each item: { id, name, price, costPrice, qty, lineTotal, tokenCode? }
  const [refreshing, setRefreshing] = useState(false);
  const [productLayout, setProductLayout] = useState('grid');
  
  // Token modal states
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [tokenCode, setTokenCode] = useState('');

  const total = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.lineTotal, 0);
  }, [cart]);

  const profit = useMemo(() => {
    return cart.reduce((sum, item) => {
      const unitCost = item?.costPrice ?? item?.cost ?? 0;
      return sum + ((item.price - unitCost) * item.qty);
    }, 0);
  }, [cart]);

  const loadInitialProducts = async () => {
    try {
      if (!user?.id) return;
      setRefreshing(true);
      const products = await getProducts(user.id);
      console.log('📦 SalesScreen: Loaded products:', products?.length);
      setAllProducts(products || []);
      setResults(products || []);
    } catch (error) {
      console.error('Error loading products:', error);
      showToast('Gagal memuat produk', 'error');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      loadInitialProducts();
    }
  }, [user?.id]);

  const handleSearch = async () => {
    if (!query.trim()) {
      setResults(allProducts);
      return;
    }

    try {
      const searchResults = await findByBarcodeOrName(user?.id, query.trim());
      setResults(searchResults || []);
    } catch (error) {
      console.error('Search error:', error);
      showToast('Gagal mencari produk', 'error');
      setResults([]);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      handleSearch();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query]);

  useEffect(() => {
    let active = true;

    const searchByBarcode = async () => {
      if (query.trim() && /^\d+$/.test(query.trim())) {
        try {
          const exactMatch = await findByBarcodeExact(user?.id, query.trim());
          if (active && exactMatch) {
            addToCart(exactMatch);
            setQuery('');
            setResults([]);
          }
        } catch (error) {
          console.error('Barcode search error:', error);
        }
      }
    };

    const timeoutId = setTimeout(searchByBarcode, 1000);
    return () => { 
      active = false;
      clearTimeout(timeoutId);
    };
  }, [query]);

  // Handle updated cart from ProductListScreen
  useEffect(() => {
    if (route.params?.updatedCart) {
      console.log('📦 SalesScreen: Received updated cart from ProductListScreen:', route.params.updatedCart);
      
      // Convert ProductListScreen cart format to SalesScreen cart format
      const convertedCart = route.params.updatedCart.map(item => ({
        id: item.productId,
        name: item.name,
        price: item.price,
        costPrice: item.costPrice || 0,
        qty: item.qty,
        lineTotal: item.price * item.qty,
        tokenCode: item.tokenCode || null
      }));
      
      setCart(convertedCart);
      
      // Clear the params to prevent re-processing
      navigation.setParams({ updatedCart: null });
    }
  }, [route.params?.updatedCart]);

  // Integrasi barcode: tangkap barcode dari layar Scan
  useEffect(() => {
    const scanned = route?.params?.scannedBarcode;
    if (!scanned) return;

    let active = true;
    (async () => {
      try {
        const exactMatch = await findByBarcodeExact(user?.id, String(scanned).trim());
        if (!active) return;
        if (exactMatch) {
          addToCart(exactMatch);
          setQuery('');
          setResults([]);
        } else {
          showToast('Produk tidak ditemukan', 'error');
          setQuery(String(scanned));
          await handleSearch();
        }
      } catch (error) {
        console.error('Scan handling error:', error);
        showToast('Terjadi kesalahan saat memproses barcode', 'error');
      } finally {
        // Kosongkan param agar tidak berulang
        navigation.setParams({ scannedBarcode: null });
      }
    })();

    return () => { active = false; };
  }, [route?.params?.scannedBarcode]);

  const isTokenProduct = (productName) => {
    const tokenKeywords = ['token', 'listrik', 'pln', 'pulsa'];
    return tokenKeywords.some(keyword => 
      productName.toLowerCase().includes(keyword.toLowerCase())
    );
  };

  const addToCart = (product) => {
    if (product.stock <= 0) {
      showToast('Stok habis, tidak bisa menambahkan produk', 'error');
      return;
    }

    // Check if this is a token/electricity product
    if (isTokenProduct(product.name)) {
      setSelectedProduct(product);
      setTokenCode('');
      setShowTokenModal(true);
      return;
    }

    // For non-token products, add directly
    addProductToCart(product);
  };

  const addProductToCart = (product, tokenCode = null) => {
    const existingItem = cart.find(item => item.id === product.id);
    
    if (existingItem) {
      if (existingItem.qty >= product.stock) {
        showToast(`Stok tidak cukup. Sisa stok hanya ${product.stock}`, 'error');
        return;
      }
      setCart(cart.map(item =>
        item.id === product.id
          ? { ...item, qty: item.qty + 1, lineTotal: (item.qty + 1) * item.price }
          : item
      ));
    } else {
      const newItem = {
        id: product.id,
        name: product.name,
        price: product.price,
        costPrice: product.cost_price || product.costPrice || product.cost || 0,
        qty: 1,
        lineTotal: product.price,
        tokenCode: tokenCode,
        stock: product.stock // Store stock for validation
      };
      setCart([...cart, newItem]);
    }
  };

  const handleTokenSubmit = () => {
    if (!tokenCode.trim()) {
      showToast('Kode token harus diisi', 'error');
      return;
    }

    addProductToCart(selectedProduct, tokenCode.trim());
    setShowTokenModal(false);
    setSelectedProduct(null);
    setTokenCode('');
  };

  const updateQuantity = (id, newQty) => {
    if (newQty <= 0) {
      removeFromCart(id);
      return;
    }

    const item = cart.find(i => i.id === id);
    if (item && item.stock !== undefined && newQty > item.stock) {
      showToast(`Stok tidak cukup. Sisa stok hanya ${item.stock}`, 'error');
      return;
    }

    setCart(cart.map(item =>
      item.id === id
        ? { ...item, qty: newQty, lineTotal: newQty * item.price }
        : item
    ));
  };

  const removeFromCart = (id) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const onRefresh = () => {
    setRefreshing(true);
    if (query.trim()) {
      handleSearch().finally(() => setRefreshing(false));
    } else {
      loadInitialProducts().finally(() => setRefreshing(false));
    }
  };

  const navigateToPayment = () => {
    if (cart.length === 0) {
      showToast('Keranjang kosong, silakan tambah produk', 'error');
      return;
    }

    navigation.navigate('Payment', {
      cart,
      total,
      profit
    });
  };

  return (
    <View style={styles.container}>
      {/* Search Section */}
      <View style={styles.searchSection}>
        <View style={styles.searchRow}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={18} color={Colors.muted} style={styles.searchIcon} />
            <TextInput
              placeholder="Cari produk..."
              value={query}
              onChangeText={setQuery}
              style={styles.searchInput}
              placeholderTextColor={Colors.muted}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
          </View>
          <View style={styles.toggleGroup}>
            <TouchableOpacity
              style={[styles.toggleButton, productLayout === 'list' && styles.toggleButtonActive]}
              onPress={() => setProductLayout('list')}
            >
              <Ionicons name="list" size={16} color={productLayout === 'list' ? '#fff' : Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleButton, productLayout === 'grid' && styles.toggleButtonActive]}
              onPress={() => setProductLayout('grid')}
            >
              <Ionicons name="grid" size={16} color={productLayout === 'grid' ? '#fff' : Colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Product List */}
      <View style={styles.resultsSection}>
          <Text style={styles.sectionTitle}>{query.trim() ? 'Hasil Pencarian' : 'Daftar Produk'}</Text>
          <FlatList
            data={results}
            key={productLayout} // Force re-render when layout changes
            numColumns={productLayout === 'grid' ? 2 : 1}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[Colors.primary]}
                tintColor={Colors.primary}
              />
            }
            renderItem={({ item }) => {
              if (productLayout === 'grid') {
                return (
                  <View style={styles.resultCardGrid}>
                    {item.image_urls && item.image_urls[0] ? (
                      <Image source={{ uri: item.image_urls[0] }} style={styles.resultImageGrid} />
                    ) : (
                      <View style={[styles.resultImageGrid, { backgroundColor: Colors.background }]} />
                    )}
                    <View style={styles.resultInfoGrid}>
                      <View>
                        <Text style={styles.resultNameGrid} numberOfLines={2}>{item.name}</Text>
                        <Text style={styles.resultPrice}>{formatIDR(item.price)}</Text>
                        <Text style={styles.resultStock}>Stok: {item.stock}</Text>
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.addButtonGrid,
                          item.stock <= 0 && styles.addButtonDisabled
                        ]}
                        onPress={() => addToCart(item)}
                        disabled={item.stock <= 0}
                      >
                        {item.stock <= 0 ? (
                          <Text style={[styles.addButtonText, styles.addButtonTextDisabled]}>Habis</Text>
                        ) : (
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="add" size={14} color="#ffffff" style={{ marginRight: 6 }} />
                            <Text style={styles.addButtonText}>Tambah</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }

              return (
                <View style={styles.resultCard}>
                  {item.image_urls && item.image_urls[0] ? (
                    <Image source={{ uri: item.image_urls[0] }} style={{ width: 56, height: 56, borderRadius: 8, marginRight: 12, backgroundColor: Colors.background }} />
                  ) : (
                    <View style={{ width: 56, height: 56, borderRadius: 8, marginRight: 12, backgroundColor: Colors.background }} />
                  )}
                  <View style={styles.resultInfo}>
                    <Text style={styles.resultName}>{item.name}</Text>
                    <View style={styles.resultBarcodeRow}>
                      <Ionicons name="barcode" size={12} color={Colors.muted} style={{ marginRight: 6 }} />
                      <Text style={styles.resultBarcode}>
                        {item.barcode || 'Tanpa barcode'}
                      </Text>
                    </View>
                    <Text style={styles.resultPrice}>{formatIDR(item.price)}</Text>
                    <Text style={styles.resultStock}>Stok: {item.stock}</Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.addButton,
                      item.stock <= 0 && styles.addButtonDisabled
                    ]}
                    onPress={() => addToCart(item)}
                    disabled={item.stock <= 0}
                  >
                    {item.stock <= 0 ? (
                      <Text style={[styles.addButtonText, styles.addButtonTextDisabled]}>Habis</Text>
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="add" size={14} color="#ffffff" style={{ marginRight: 6 }} />
                        <Text style={styles.addButtonText}>Tambah</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              );
            }}
          />
        </View>

      {/* Cart Section */}
      {cart.length > 0 && (
        <View style={styles.cartSection}>
          <Text style={styles.sectionTitle}>Keranjang Belanja</Text>
          <FlatList
            data={cart}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <View style={styles.cartItem}>
                <View style={styles.cartItemInfo}>
                  <Text style={styles.cartItemName}>{item.name}</Text>
                  {item.tokenCode && (
                    <Text style={styles.cartItemToken}>Token: {item.tokenCode}</Text>
                  )}
                  <Text style={styles.cartItemPrice}>
                    {item.qty}x {formatIDR(item.price)} = {formatIDR(item.lineTotal)}
                  </Text>
                </View>
                <View style={styles.cartItemActions}>
                  <TouchableOpacity
                    style={styles.quantityButton}
                    onPress={() => updateQuantity(item.id, item.qty - 1)}
                  >
                    <Ionicons name="remove" size={16} color="#ffffff" />
                  </TouchableOpacity>
                  <Text style={styles.quantityText}>{item.qty}</Text>
                  <TouchableOpacity
                    style={styles.quantityButton}
                    onPress={() => updateQuantity(item.id, item.qty + 1)}
                  >
                    <Ionicons name="add" size={16} color="#ffffff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => removeFromCart(item.id)}
                  >
                    <Ionicons name="trash-outline" size={16} color="#ffffff" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        </View>
      )}

      {/* Summary and Checkout */}
      {cart.length > 0 && (
        <View style={styles.summarySection}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Penjualan</Text>
              <Text style={styles.summaryTotal}>{formatIDR(total)}</Text>
            </View>
            <TouchableOpacity style={styles.checkoutButton} onPress={navigateToPayment}>
              <View style={styles.checkoutContent}>
                <Ionicons name="card-outline" size={18} color="#ffffff" style={{ marginRight: 8 }} />
                <Text style={styles.checkoutButtonText}>Lanjut ke Pembayaran</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Token Input Modal */}
      <Modal
        visible={showTokenModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowTokenModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Input Kode Token</Text>
            <Text style={styles.modalSubtitle}>
              Produk: {selectedProduct?.name}
            </Text>
            
            <TextInput
              style={styles.tokenInput}
              placeholder="Masukkan kode token..."
              value={tokenCode}
              onChangeText={setTokenCode}
              multiline={true}
              numberOfLines={3}
              placeholderTextColor={Colors.muted}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalCancelButton} 
                onPress={() => setShowTokenModal(false)}
              >
                <Text style={styles.modalCancelText}>Batal</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.modalSubmitButton} 
                onPress={handleTokenSubmit}
              >
                <Text style={styles.modalSubmitText}>Tambah ke Keranjang</Text>
              </TouchableOpacity>
            </View>
          </View>
      </View>
      </Modal>

      {/* Tombol Scan mengambang untuk langsung scan dan tambah ke keranjang */}
      <TouchableOpacity
        style={{
          position: 'absolute',
          right: 16,
          bottom: 24,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: Colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 6,
          elevation: 6,
        }}
        onPress={() => navigation.navigate('Scan', { mode: 'sale' })}
      >
        <Ionicons name="scan" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.card,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    textAlign: 'center',
  },
  searchSection: {
    backgroundColor: Colors.card,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    flex: 1,
  },
  searchIcon: {
    fontSize: 18,
    marginRight: 12,
    color: Colors.muted,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
  },
  toggleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleButton: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginLeft: 8,
  },
  toggleButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  resultsSection: {
    flex: 1,
    backgroundColor: Colors.card,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  resultCard: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  resultCardGrid: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 8,
    padding: 8,
    margin: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    width: (width - 60) / 2, // 2 column with safe padding calculation
  },
  resultImageGrid: {
    width: '100%',
    height: 100,
    borderRadius: 6,
    marginBottom: 8,
  },
  resultInfoGrid: {
    flex: 1,
    justifyContent: 'space-between',
  },
  resultNameGrid: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
    height: 36, // limit to 2 lines height roughly
  },
  addButtonGrid: {
    backgroundColor: Colors.primary,
    paddingVertical: 6,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  resultBarcode: {
    fontSize: 12,
    color: Colors.muted,
    marginBottom: 2,
  },
  resultPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.success,
    marginBottom: 2,
  },
  resultStock: {
    fontSize: 12,
    color: Colors.muted,
  },
  addButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 60,
  },
  addButtonDisabled: {
    backgroundColor: Colors.muted,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  addButtonTextDisabled: {
    color: '#ffffff',
  },
  viewAllButton: {
    backgroundColor: Colors.success,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 12,
    alignItems: 'center',
  },
  viewAllButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewAllButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  // auxiliary row style for barcode + icon
  resultBarcodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  cartSection: {
    flex: 1,
    backgroundColor: Colors.card,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  cartItem: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cartItemInfo: {
    flex: 1,
  },
  cartItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  cartItemToken: {
    fontSize: 12,
    color: Colors.primary,
    marginBottom: 4,
    fontStyle: 'italic',
  },
  cartItemPrice: {
    fontSize: 14,
    color: Colors.muted,
  },
  cartItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityButton: {
    backgroundColor: Colors.primary,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  quantityText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginHorizontal: 12,
    minWidth: 28,
    textAlign: 'center',
  },
  removeButton: {
    backgroundColor: Colors.danger,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summarySection: {
    backgroundColor: Colors.card,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  summaryCard: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  summaryTotal: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.success,
  },
  checkoutButton: {
    backgroundColor: Colors.success,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  checkoutButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  checkoutContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 20,
    width: width * 0.9,
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: Colors.muted,
    textAlign: 'center',
    marginBottom: 16,
  },
  tokenInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: Colors.text,
    backgroundColor: Colors.background,
    marginBottom: 16,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: Colors.muted,
    paddingVertical: 12,
    borderRadius: 8,
    marginRight: 8,
  },
  modalCancelText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalSubmitButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    marginLeft: 8,
  },
  modalSubmitText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
