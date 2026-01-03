import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, Alert, StyleSheet, Dimensions, RefreshControl } from 'react-native';
import { findByBarcodeOrName } from '../../services/products';
import { formatIDR } from '../../utils/currency';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme';

const { width } = Dimensions.get('window');

export default function ProductListScreen({ navigation, route }) {
  const { user } = useAuth();
  const { cart = [] } = route.params || {};
  const [localCart, setLocalCart] = useState(cart);
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isGrid, setIsGrid] = useState(false);

  const loadProducts = async () => {
    console.log('🔄 ProductListScreen: Loading products for user:', user?.id, 'query:', query);
    try {
      const searchQuery = query.trim();
      const result = await findByBarcodeOrName(user?.id, searchQuery);
      console.log('✅ ProductListScreen: Products loaded:', result?.length || 0, 'items');
      setProducts(result || []);
    } catch (error) {
      console.error('❌ ProductListScreen: Error loading products:', error);
      setProducts([]);
    }
  };

  const onRefresh = async () => {
    console.log('🔄 ProductListScreen: Manual refresh triggered');
    setRefreshing(true);
    await loadProducts();
    setRefreshing(false);
  };

  // Debounce search to avoid too many API calls
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadProducts();
    }, 300); // Wait 300ms after user stops typing

    return () => clearTimeout(timeoutId);
  }, [query, user]);

  const addToCart = (product) => {
    if (product.stock <= 0) {
      Alert.alert('Stok Habis', 'Produk ini tidak memiliki stok');
      return;
    }

    const existingItem = localCart.find(item => item.productId === product.id);
    const currentQtyInCart = existingItem ? existingItem.qty : 0;
    
    // Validasi: tidak boleh melebihi stock yang tersedia
    if (currentQtyInCart >= product.stock) {
      Alert.alert('Stok Tidak Cukup', `Stok tersedia: ${product.stock}, sudah ada ${currentQtyInCart} di keranjang`);
      return;
    }

    let newCart;
    
    if (existingItem) {
      newCart = localCart.map(item =>
        item.productId === product.id
          ? { ...item, qty: item.qty + 1 }
          : item
      );
    } else {
      newCart = [...localCart, {
        productId: product.id,
        name: product.name,
        barcode: product.barcode,
        price: product.price,
        costPrice: product.cost_price || product.costPrice || 0,
        qty: 1,
        maxStock: product.stock
      }];
    }

    // Update local cart state
    setLocalCart(newCart);
    
    console.log('✅ Product added to cart:', product.name, 'New cart size:', newCart.length);
    Alert.alert('Berhasil', `${product.name} ditambahkan ke keranjang`);
  };

  // Hitung total quantity di cart
  const getTotalCartQuantity = () => {
    return localCart.reduce((total, item) => total + item.qty, 0);
  };

  const goBackToSales = () => {
    // Kirim cart yang sudah diupdate kembali ke SalesScreen
    navigation.navigate('Penjualan', { updatedCart: localCart });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={goBackToSales}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="arrow-back" size={18} color={Colors.primary} style={{ marginRight: 6 }} />
            <Text style={styles.backButtonText}>Kembali</Text>
          </View>
        </TouchableOpacity>
        <View style={styles.cartBadge}>
          <Text style={styles.cartBadgeText}>{getTotalCartQuantity()}</Text>
        </View>
      </View>

      {/* Search Section */}
      <View style={styles.searchSection}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={16} color={Colors.muted} style={styles.searchIcon} />
          <TextInput
            placeholder="Cari nama produk atau barcode..."
            value={query}
            onChangeText={setQuery}
            style={styles.searchInput}
            placeholderTextColor={Colors.muted}
          />
        </View>
      </View>

      {/* Products List */}
      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
        renderItem={({ item }) => {
          const inCart = localCart.find(cartItem => cartItem.productId === item.id);
          const qtyInCart = inCart ? inCart.qty : 0;
          const availableStock = item.stock - qtyInCart;
          
          return (
            <View style={styles.productCard}>
              <View style={styles.productInfo}>
                <Text style={styles.productName}>{item.name}</Text>
                <Text style={styles.productBarcode}>
                  <Ionicons name="barcode" size={14} color={Colors.muted} style={{ marginRight: 6 }} />
                  {item.barcode || 'Tanpa barcode'}
                </Text>
                <View style={styles.productPrices}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="pricetag" size={14} color={Colors.muted} style={{ marginRight: 6 }} />
                    <Text style={styles.productPrice}>{formatIDR(item.price)}</Text>
                  </View>
                  <Text style={styles.productStock}>
                    Stok: {item.stock} {qtyInCart > 0 && `(${qtyInCart} di keranjang)`}
                  </Text>
                </View>
              </View>
              <TouchableOpacity 
                style={[
                  styles.addButton, 
                  availableStock <= 0 && styles.addButtonDisabled
                ]} 
                onPress={() => addToCart(item)}
                disabled={availableStock <= 0}
              >
                <Text style={[
                  styles.addButtonText,
                  availableStock <= 0 && styles.addButtonTextDisabled
                ]}>
                  {availableStock <= 0 ? 'Habis' : 'Tambah'}
                </Text>
              </TouchableOpacity>
            </View>
          );
        }}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Ionicons name="cube" size={48} color={Colors.muted} style={styles.emptyIcon} />
            <Text style={styles.emptyTitle}>Tidak ada produk</Text>
            <Text style={styles.emptySubtitle}>
              {query.trim() ? 'Coba kata kunci lain' : 'Belum ada produk tersedia'}
            </Text>
          </View>
        )}
      />

      {/* Bottom Action */}
      {localCart.length > 0 && (
        <View style={styles.bottomAction}>
          <TouchableOpacity style={styles.proceedButton} onPress={goBackToSales}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="cart" size={18} color="#ffffff" style={{ marginRight: 8 }} />
              <Text style={styles.proceedButtonText}>
                Lanjut ke Pembayaran ({getTotalCartQuantity()} item)
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      )}
    </View>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: Colors.background,
    borderRadius: 8,
  },
  backButtonText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '500',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  cartBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  cartBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  searchSection: {
    padding: 16,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
    color: Colors.muted,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
  },
  listContainer: {
    padding: 16,
  },
  productCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 2,
  },
  productBarcode: {
    fontSize: 12,
    color: Colors.muted,
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  productPrices: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  productPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.success,
  },
  productStock: {
    fontSize: 12,
    color: Colors.muted,
  },
  addButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 8,
  },
  addButtonDisabled: {
    backgroundColor: Colors.border,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  addButtonTextDisabled: {
    color: Colors.muted,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.muted,
    textAlign: 'center',
  },
  bottomAction: {
    padding: 16,
    backgroundColor: Colors.card,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  proceedButton: {
    backgroundColor: Colors.success,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  proceedButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  viewToggle: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: Colors.background,
  },
  productCardGrid: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    minHeight: 140,
    justifyContent: 'space-between',
    maxWidth: '48%', // Ensure 2 columns fit with gap
  },
  productInfoGrid: {
    marginBottom: 8,
  },
  productNameGrid: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
    height: 40,
  },
  productPriceGrid: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.success,
    marginBottom: 2,
  },
  productStockGrid: {
    fontSize: 10,
    color: Colors.muted,
  },
  addButtonGrid: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: Colors.primary,
    borderRadius: 20,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBadgeGrid: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: Colors.warning,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    zIndex: 1,
  },
  qtyBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
});