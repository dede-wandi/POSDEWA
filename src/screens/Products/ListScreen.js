import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, Alert, StyleSheet, Dimensions, RefreshControl, Image, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getProducts, deleteProduct, findProducts, getCategories, getBrands } from '../../services/products';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { formatIDR } from '../../utils/currency';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Radii, Spacing, Shadows } from '../../theme';

const { width } = Dimensions.get('window');

export default function ListScreen({ navigation, route }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [isGrid, setIsGrid] = useState(false);

  // Filter State
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedBrand, setSelectedBrand] = useState(null);

  const loadMasterData = async () => {
    if (user?.id) {
      try {
        const cats = await getCategories(user.id);
        setCategories(cats || []);
        const brs = await getBrands(user.id);
        setBrands(brs || []);
      } catch (e) {
        console.error('Error loading master data:', e);
      }
    }
  };

  const load = async () => {
    console.log('🔄 ListScreen: Loading products for user:', user?.id);
    try {
      const all = await getProducts(user?.id);
      setProducts(all || []);
      await loadMasterData();
    } catch (error) {
      console.error('❌ ListScreen: Error loading products:', error);
      setProducts([]);
    }
  };

  const onRefresh = async () => {
    console.log('🔄 ListScreen: Manual refresh triggered');
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [navigation, user]);

  useEffect(() => {
    let active = true;
    (async () => {
      console.log('🔍 ListScreen: Searching with query:', query, 'for user:', user?.id);
      console.log('🔍 ListScreen: User object in search:', user);
      try {
        const result = query.trim() ? await findProducts(user?.id, query) : await getProducts(user?.id);
        console.log('🔍 ListScreen: Search result:', result?.length || 0, 'items');
        console.log('🔍 ListScreen: Search result data:', result);
        if (active) setProducts(result || []);
      } catch (error) {
        console.error('❌ ListScreen: Error in search:', error);
        if (active) setProducts([]);
      }
    })();
    return () => { active = false; };
  }, [query, user]);

  // Tangkap barcode dari Scan (mode: pick) untuk digunakan sebagai query pencarian
  useEffect(() => {
    const picked = route?.params?.pickedBarcode;
    if (!picked) return;

    const code = String(picked).trim();
    setQuery(code);

    let active = true;
    (async () => {
      try {
        const result = await findProducts(user?.id, code);
        if (active) setProducts(result || []);
      } catch (error) {
        console.error('❌ ListScreen: Immediate search error after scan:', error);
        if (active) setProducts([]);
      } finally {
        // Bersihkan param agar tidak diproses berulang
        navigation.setParams({ pickedBarcode: null });
      }
    })();

    return () => { active = false; };
  }, [route?.params?.pickedBarcode]);

  const filteredProducts = useMemo(() => {
    let result = products;
    if (selectedCategory) {
      result = result.filter(p => p.category_id === selectedCategory);
    }
    if (selectedBrand) {
      result = result.filter(p => p.brand_id === selectedBrand);
    }
    return result;
  }, [products, selectedCategory, selectedBrand]);

  const confirmDelete = (id) => {
    const product = products.find(p => p.id === id);
    const productName = product?.name || 'produk ini';
    
    Alert.alert(
      '🗑️ Hapus Produk', 
      `Apakah Anda yakin ingin menghapus "${productName}"?\n\nTindakan ini tidak dapat dibatalkan.`, 
      [
        { 
          text: '❌ Batal', 
          style: 'cancel' 
        },
        { 
          text: '🗑️ Hapus', 
          style: 'destructive', 
          onPress: async () => { 
            try {
              await deleteProduct(user?.id, id); 
              showToast(`Produk "${productName}" telah dihapus`, 'success');
              load(); 
            } catch (error) {
              console.error('Delete error:', error);
              Alert.alert('Gagal', `Gagal menghapus produk: ${error.message}`);
            }
          } 
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Search and Actions Section */}
      <View style={styles.searchSection}>
        <View style={styles.searchRow}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={16} color={Colors.muted} style={styles.searchIcon} />
            <TextInput
              placeholder="Cari produk..."
              value={query}
              onChangeText={setQuery}
              style={styles.searchInput}
              placeholderTextColor={Colors.muted}
            />
            {Boolean(query) && (
              <TouchableOpacity
                onPress={() => setQuery('')}
                accessibilityRole="button"
                accessibilityLabel="Hapus pencarian"
                style={{ marginLeft: 8, padding: 6 }}
              >
                <Ionicons name="close-circle" size={18} color={Colors.muted} />
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.viewToggleGroup}>
            <TouchableOpacity
              onPress={() => navigation.navigate('Scan', { mode: 'pick', returnTo: 'DaftarProduk' })}
              style={{ 
                marginRight: 8, 
                backgroundColor: Colors.primary, 
                padding: 10, 
                borderRadius: 8,
                width: 38,
                height: 38,
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Ionicons name="scan" size={18} color="#fff" />
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={() => navigation.navigate('FormProduk')}
              style={{ 
                marginRight: 8, 
                backgroundColor: Colors.primary, 
                padding: 10, 
                borderRadius: 8,
                width: 38,
                height: 38,
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Ionicons name="add" size={18} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.viewToggleButton, styles.viewToggleButtonActive]}
              onPress={() => setIsGrid(!isGrid)}
            >
              <Ionicons name={isGrid ? 'grid' : 'list'} size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Filters */}
        <View style={{ marginTop: 12 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }} contentContainerStyle={{ gap: 8 }}>
            <TouchableOpacity
              style={[styles.filterChip, !selectedCategory && styles.filterChipActive]}
              onPress={() => setSelectedCategory(null)}
            >
              <Text style={[styles.filterChipText, !selectedCategory && styles.filterChipTextActive]}>Semua Kategori</Text>
            </TouchableOpacity>
            {categories.map(c => (
              <TouchableOpacity
                key={c.id}
                style={[styles.filterChip, selectedCategory === c.id && styles.filterChipActive]}
                onPress={() => setSelectedCategory(selectedCategory === c.id ? null : c.id)}
              >
                <Text style={[styles.filterChipText, selectedCategory === c.id && styles.filterChipTextActive]}>{c.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            <TouchableOpacity
              style={[styles.filterChip, !selectedBrand && styles.filterChipActive]}
              onPress={() => setSelectedBrand(null)}
            >
              <Text style={[styles.filterChipText, !selectedBrand && styles.filterChipTextActive]}>Semua Brand</Text>
            </TouchableOpacity>
            {brands.map(b => (
              <TouchableOpacity
                key={b.id}
                style={[styles.filterChip, selectedBrand === b.id && styles.filterChipActive]}
                onPress={() => setSelectedBrand(selectedBrand === b.id ? null : b.id)}
              >
                <Text style={[styles.filterChipText, selectedBrand === b.id && styles.filterChipTextActive]}>{b.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>

      {/* Status Message */}
      {!user && (
        <View style={styles.warningContainer}>
          <Text style={styles.warningIcon}>⚠️</Text>
          <Text style={styles.warningText}>
            Login untuk menyimpan ke cloud Supabase. Tanpa login, data tersimpan lokal di perangkat.
          </Text>
        </View>
      )}

      {/* Products List */}
      <FlatList
        data={filteredProducts}
        key={isGrid ? 'GRID' : 'LIST'}
        numColumns={isGrid ? 2 : 1}
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
          const margin = Number(item.price || 0) - Number(item.costPrice || item.cost_price || 0);
          const marginPercentage = item.price ? ((margin / item.price) * 100).toFixed(1) : 0;
          const categoryName = categories.find(c => c.id === item.category_id)?.name;
          const brandName = brands.find(b => b.id === item.brand_id)?.name;
          
          if (isGrid) {
            return (
              <TouchableOpacity 
                onPress={() => navigation.navigate('FormProduk', { id: item.id })} 
                style={styles.productCardGrid}
              >
                {item.image_urls && item.image_urls.length > 0 && item.image_urls[0] ? (
                  <Image source={{ uri: item.image_urls[0] }} style={styles.productImageGrid} resizeMode="contain" />
                ) : null}
                <View style={styles.productInfoGrid}>
                  <Text style={styles.productNameGrid} numberOfLines={2}>{item.name}</Text>
                  <Text style={styles.productPriceGrid}>{formatIDR(item.price)}</Text>
                  {(categoryName || brandName) && (
                    <Text style={styles.productCategoryGrid} numberOfLines={1}>
                       {[categoryName, brandName].filter(Boolean).join(' • ')}
                    </Text>
                  )}
                  <Text style={styles.productStockGrid}>Stok: {item.stock}</Text>
                </View>
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity 
              onPress={() => navigation.navigate('FormProduk', { id: item.id })} 
              style={styles.productCard}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {item.image_urls && item.image_urls.length > 0 && item.image_urls[0] ? (
                  <Image source={{ uri: item.image_urls[0] }} style={styles.productImage} resizeMode="cover" />
                ) : (
                  <View style={[styles.productImage, { backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center' }]}>
                    <Ionicons name="image-outline" size={20} color="#ccc" />
                  </View>
                )}
                
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
                    
                    {/* Mini Actions */}
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                        <TouchableOpacity onPress={() => navigation.navigate('ProductReport', { productId: item.id, productName: item.name })}>
                           <Ionicons name="analytics-outline" size={16} color={Colors.info} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => confirmDelete(item.id)}>
                           <Ionicons name="trash-outline" size={16} color={Colors.danger} />
                        </TouchableOpacity>
                    </View>
                  </View>

                  {(categoryName || brandName) && (
                    <Text style={styles.productCategoryText} numberOfLines={1}>
                       {[categoryName, brandName].filter(Boolean).join(' • ')}
                    </Text>
                  )}
                  
                  {/* Single Line Info */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
                    {item.barcode ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 10 }}>
                        <Ionicons name="barcode-outline" size={12} color={Colors.muted} style={{ marginRight: 2 }} />
                        <Text style={styles.infoText}>{item.barcode}</Text>
                      </View>
                    ) : null}
                    
                    <Text style={[styles.infoText, { color: Colors.success, fontWeight: '900', marginRight: 10 }]}>
                      {formatIDR(item.price)}
                    </Text>
                    
                    <Text style={[styles.infoText, { color: Colors.danger, marginRight: 10 }]}>
                      M: {formatIDR(item.costPrice ?? item.cost_price ?? 0)}
                    </Text>

                    <Text style={[styles.infoText, { color: Colors.success, marginRight: 10 }]}>
                      L: {formatIDR(margin)} ({marginPercentage}%)
                    </Text>
                    
                    <Text style={[styles.infoText, { color: Colors.primary }]}>
                      Stok: {item.stock}
                    </Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Ionicons name="cube" size={48} color={Colors.muted} style={styles.emptyIcon} />
            <Text style={styles.emptyTitle}>Belum ada produk</Text>
            <Text style={styles.emptySubtitle}>Tambah produk pertama Anda untuk memulai</Text>
            <TouchableOpacity 
              style={styles.emptyButton}
              onPress={() => navigation.navigate('FormProduk')}
            >
              <Text style={styles.emptyButtonText}>+ Tambah Produk</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  searchSection: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.lightBg,
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing.md,
    height: 40,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: Spacing.sm,
  },
  searchIcon: {
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.body,
    color: Colors.text,
  },
  viewToggleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewToggleButton: {
    width: 38,
    height: 38,
    borderRadius: Radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.border,
  },
  viewToggleButtonActive: {
    backgroundColor: Colors.primary,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radii.pill,
    backgroundColor: Colors.lightBg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: FontSize.sm,
    color: Colors.text,
    fontWeight: FontWeight.medium,
  },
  filterChipTextActive: {
    color: Colors.white,
    fontWeight: FontWeight.semibold,
  },
  listContent: {
    padding: Spacing.lg,
    paddingBottom: 80,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radii.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.card,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  productImage: {
    width: 52,
    height: 52,
    borderRadius: Radii.sm,
    backgroundColor: Colors.lightBg,
    marginRight: Spacing.md,
  },
  productImagePlaceholder: {
    width: 52,
    height: 52,
    borderRadius: Radii.sm,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  productInfo: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  productName: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  productCategory: {
    fontSize: FontSize.xs,
    color: Colors.muted,
    marginBottom: 4,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  productPrice: {
    fontSize: FontSize.bodyLg,
    fontWeight: FontWeight.extrabold,
    color: Colors.primary,
  },
  productBuyPrice: {
    fontSize: FontSize.xs,
    color: Colors.muted,
    textDecorationLine: 'line-through',
  },
  productBarcode: {
    fontSize: FontSize.xs,
    color: Colors.muted,
    marginTop: 2,
  },
  stockBadge: {
    backgroundColor: Colors.successLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radii.pill,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  stockBadgeLow: {
    backgroundColor: Colors.warningLight,
    borderColor: Colors.warning,
  },
  stockBadgeOut: {
    backgroundColor: Colors.dangerLight,
    borderColor: Colors.danger,
  },
  stockText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  stockTextLow: {
    color: Colors.warning,
  },
  stockTextOut: {
    color: Colors.danger,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  editButton: {
    padding: Spacing.sm,
    borderRadius: Radii.sm,
    backgroundColor: Colors.infoLight,
  },
  deleteButton: {
    padding: Spacing.sm,
    borderRadius: Radii.sm,
    backgroundColor: Colors.dangerLight,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyTitle: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  emptyText: {
    fontSize: FontSize.body,
    color: Colors.muted,
    textAlign: 'center',
    paddingHorizontal: 32,
    marginBottom: Spacing.xl,
  },
  emptyButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.md,
  },
  emptyButtonText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    color: Colors.white,
  },
});

