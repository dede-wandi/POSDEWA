import React, { useEffect, useState, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Image,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme';
import { listPublicProductsPublic } from '../../services/publicProductsSupabase';
import { useCart } from '../../contexts/CartContext';

const { width } = Dimensions.get('window');

export default function PublicListScreen({ navigation }) {
  const { addToCart, updateQuantity, items, cartCount } = useCart();
  const [products, setProducts] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [brandOptions, setBrandOptions] = useState([]);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [selectedBrandId, setSelectedBrandId] = useState(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [priceSort, setPriceSort] = useState('none'); // none | asc | desc
  const [showFilters, setShowFilters] = useState(false);

  const load = async () => {
    const result = await listPublicProductsPublic();
    if (result.success) {
      const data = result.data || [];
      setAllProducts(data);
      setProducts(data);
      const brandMap = new Map();
      const categoryMap = new Map();
      data.forEach((p) => {
        if (p.brand?.id && !brandMap.has(p.brand.id)) {
          brandMap.set(p.brand.id, p.brand.name);
        }
        if (p.category?.id && !categoryMap.has(p.category.id)) {
          categoryMap.set(p.category.id, p.category.name);
        }
      });
      setBrandOptions(Array.from(brandMap, ([id, name]) => ({ id, name })));
      setCategoryOptions(Array.from(categoryMap, ([id, name]) => ({ id, name })));
    } else {
      setProducts([]);
      setAllProducts([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Auth')}
            style={{ paddingHorizontal: 8, marginRight: 4 }}
          >
            <Ionicons name="person-circle-outline" size={26} color={Colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('Cart')}
            style={{ paddingHorizontal: 8, marginRight: 4 }}
          >
            <View>
              <Ionicons name="cart-outline" size={24} color={Colors.primary} />
              {cartCount > 0 && (
                <View style={{
                  position: 'absolute',
                  top: -4,
                  right: -4,
                  backgroundColor: Colors.danger || 'red',
                  minWidth: 16,
                  height: 16,
                  borderRadius: 8,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: '#fff',
                }}>
                  <Text style={{ color: '#fff', fontSize: 9, fontWeight: 'bold' }}>{cartCount}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onRefresh}
            style={{ paddingHorizontal: 8 }}
          >
            <Ionicons name="refresh" size={24} color={Colors.primary} />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, onRefresh, cartCount]);

  useEffect(() => {
    let data = [...allProducts];
    if (selectedBrandId) {
      data = data.filter((p) => p.brand?.id === selectedBrandId);
    }
    if (selectedCategoryId) {
      data = data.filter((p) => p.category?.id === selectedCategoryId);
    }
    if (priceSort === 'asc') {
      data = data.slice().sort((a, b) => (Number(a.price || 0) - Number(b.price || 0)));
    } else if (priceSort === 'desc') {
      data = data.slice().sort((a, b) => (Number(b.price || 0) - Number(a.price || 0)));
    }
    setProducts(data);
  }, [allProducts, selectedBrandId, selectedCategoryId, priceSort]);

  const renderItem = ({ item }) => {
    const firstImage = Array.isArray(item.image_urls) && item.image_urls.length > 0 ? item.image_urls[0] : null;
    const cartItem = items.find((i) => i.product.id === item.id);
    const quantity = cartItem ? cartItem.quantity : 0;

    return (
      <TouchableOpacity 
        style={styles.card}
        activeOpacity={0.9}
        onPress={() => navigation.navigate('PublicProductDetail', { id: item.id, product: item })}
      >
        <View style={styles.imageWrapper}>
          {firstImage ? (
            <Image source={{ uri: firstImage }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="image-outline" size={32} color={Colors.muted} />
            </View>
          )}
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
          
          <View style={styles.priceRow}>
            <Text style={styles.price}>Rp {Number(item.price || 0).toLocaleString('id-ID')}</Text>
          </View>

          {quantity > 0 ? (
            <View style={styles.qtyControlRow}>
              <TouchableOpacity
                style={styles.qtyBtnMini}
                onPress={() => updateQuantity(item.id, quantity - 1)}
              >
                <Ionicons name="remove" size={16} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.qtyTextMini}>{quantity}</Text>
              <TouchableOpacity
                style={styles.qtyBtnMini}
                onPress={() => updateQuantity(item.id, quantity + 1)}
              >
                <Ionicons name="add" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.addToCartButton}
              onPress={() => addToCart(item)}
            >
              <Ionicons name="add-circle-outline" size={18} color="#fff" style={{ marginRight: 4 }} />
              <Text style={styles.addToCartText}>Tambah</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.stock}>Stok: {Number(item.stock ?? 0)}</Text>
          
          <View style={styles.metaRow}>
           <View style={styles.ratingContainer}>
             <Ionicons name="star" size={10} color="#FFD700" />
             <Text style={styles.ratingText}>5.0</Text>
              <Text style={styles.soldText}> • Terjual 1000+</Text>
            </View>
          </View>

          {item.category?.name && (
             <Text style={styles.shopLocation} numberOfLines={1}>{item.category.name}</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Memuat produk...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.filterBar}>
        <TouchableOpacity
          style={styles.filterToggle}
          onPress={() => setShowFilters((prev) => !prev)}
        >
          <Ionicons name="options-outline" size={16} color={Colors.primary} />
          <Text style={styles.filterToggleText}>Filter</Text>
        </TouchableOpacity>
        <View style={[styles.filterSummary, { marginLeft: 'auto', marginRight: 8 }]}>
          {selectedBrandId && <Text style={styles.filterSummaryText}>Brand</Text>}
          {selectedCategoryId && <Text style={styles.filterSummaryText}>Kategori</Text>}
          {priceSort !== 'none' && (
            <Text style={styles.filterSummaryText}>
              {priceSort === 'asc' ? 'Termurah' : 'Termahal'}
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={[styles.resetButton, { marginLeft: 'auto' }]}
          onPress={() => {
            setSelectedBrandId(null);
            setSelectedCategoryId(null);
            setPriceSort('none');
          }}
        >
          <Ionicons name="refresh" size={14} color="#fff" />
          <Text style={styles.resetButtonText}>Reset</Text>
        </TouchableOpacity>
      </View>
      {showFilters && (
        <View style={styles.filterPanel}>
          <Text style={styles.filterLabel}>Brand</Text>
          <View style={styles.filterChipsRow}>
            <TouchableOpacity
              style={[
                styles.filterChip,
                !selectedBrandId && styles.filterChipActive,
              ]}
              onPress={() => setSelectedBrandId(null)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  !selectedBrandId && styles.filterChipTextActive,
                ]}
              >
                Semua
              </Text>
            </TouchableOpacity>
            {brandOptions.map((b) => (
              <TouchableOpacity
                key={b.id}
                style={[
                  styles.filterChip,
                  selectedBrandId === b.id && styles.filterChipActive,
                ]}
                onPress={() =>
                  setSelectedBrandId((prev) => (prev === b.id ? null : b.id))
                }
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selectedBrandId === b.id && styles.filterChipTextActive,
                  ]}
                >
                  {b.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.filterLabel}>Kategori</Text>
          <View style={styles.filterChipsRow}>
            <TouchableOpacity
              style={[
                styles.filterChip,
                !selectedCategoryId && styles.filterChipActive,
              ]}
              onPress={() => setSelectedCategoryId(null)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  !selectedCategoryId && styles.filterChipTextActive,
                ]}
              >
                Semua
              </Text>
            </TouchableOpacity>
            {categoryOptions.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[
                  styles.filterChip,
                  selectedCategoryId === c.id && styles.filterChipActive,
                ]}
                onPress={() =>
                  setSelectedCategoryId((prev) => (prev === c.id ? null : c.id))
                }
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selectedCategoryId === c.id && styles.filterChipTextActive,
                  ]}
                >
                  {c.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.filterLabel}>Harga</Text>
          <View style={styles.filterChipsRow}>
            <TouchableOpacity
              style={[
                styles.filterChip,
                priceSort === 'none' && styles.filterChipActive,
              ]}
              onPress={() => setPriceSort('none')}
            >
              <Text
                style={[
                  styles.filterChipText,
                  priceSort === 'none' && styles.filterChipTextActive,
                ]}
              >
                Default
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterChip,
                priceSort === 'asc' && styles.filterChipActive,
              ]}
              onPress={() => setPriceSort('asc')}
            >
              <Text
                style={[
                  styles.filterChipText,
                  priceSort === 'asc' && styles.filterChipTextActive,
                ]}
              >
                Termurah
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterChip,
                priceSort === 'desc' && styles.filterChipActive,
              ]}
              onPress={() => setPriceSort('desc')}
            >
              <Text
                style={[
                  styles.filterChipText,
                  priceSort === 'desc' && styles.filterChipTextActive,
                ]}
              >
                Termahal
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        numColumns={2}
        contentContainerStyle={products.length === 0 ? styles.emptyContainer : styles.listContainer}
        columnWrapperStyle={styles.columnWrapper}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContent}>
            <Ionicons name="cube-outline" size={40} color={Colors.muted} />
            <Text style={styles.emptyTitle}>Belum ada produk</Text>
            <Text style={styles.emptySubtitle}>Produk akan muncul di sini jika sudah diaktifkan oleh admin.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const CARD_GAP = 12;
const CARD_HORIZONTAL_PADDING = 16;
const cardWidth = (width - CARD_HORIZONTAL_PADDING * 2 - CARD_GAP) / 2;

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
    paddingVertical: 14,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
  },
  headerIconButton: {
    padding: 6,
    borderRadius: 16,
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: '#fff',
  },
  filterToggleText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.danger,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  filterSummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 4,
  },
  filterSummaryText: {
    fontSize: 11,
    color: Colors.muted,
  },
  filterPanel: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.muted,
    marginBottom: 6,
    marginTop: 4,
  },
  filterChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#fff',
  },
  filterChipActive: {
    borderColor: Colors.primary,
    backgroundColor: '#ffe5ef',
  },
  filterChipText: {
    fontSize: 11,
    color: Colors.text,
  },
  filterChipTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: Colors.muted,
  },
  listContainer: {
    paddingHorizontal: CARD_HORIZONTAL_PADDING,
    paddingVertical: 16,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: CARD_GAP,
  },
  card: {
    width: cardWidth,
    backgroundColor: Colors.card,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  imageWrapper: {
    width: '100%',
    height: cardWidth,
    backgroundColor: '#f2f2f7',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  title: {
    fontSize: 14,
    color: '#2e2e2e',
    marginBottom: 4,
    lineHeight: 18,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  price: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#E91E63',
  },
  qtyControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f2f2f7',
    borderRadius: 8,
    padding: 4,
    marginBottom: 8,
  },
  qtyBtnMini: {
    backgroundColor: Colors.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyTextMini: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.text,
    marginHorizontal: 10,
  },
  addToCartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 8,
  },
  addToCartText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  iconCartButton: {
    backgroundColor: Colors.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  stock: {
    fontSize: 11,
    color: '#555',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 10,
    color: '#555',
    marginLeft: 2,
  },
  soldText: {
    fontSize: 10,
    color: '#999',
  },
  shopLocation: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
  },
  emptyContainer: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingVertical: 40,
  },
  emptyContent: {
    alignItems: 'center',
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  emptySubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: Colors.muted,
    textAlign: 'center',
  },
});
