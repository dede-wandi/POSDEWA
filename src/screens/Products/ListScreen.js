import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, Alert, StyleSheet, Dimensions, RefreshControl, Image, ScrollView } from 'react-native';
import { getProducts, deleteProduct, findProducts, getCategories, getBrands } from '../../services/products';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { formatIDR } from '../../utils/currency';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme';

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
    <View style={styles.container}>
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
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.muted,
  },
  searchSection: {
    padding: 16,
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
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 12,
    height: 48,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.text,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    margin: 16,
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  warningIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  warningText: {
    flex: 1,
    color: '#856404',
    fontSize: 14,
    lineHeight: 20,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  productCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  productImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 10,
    backgroundColor: '#f5f5f5',
  },
  productName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
    marginRight: 8,
  },
  infoText: {
    fontSize: 11,
    color: Colors.muted,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  inlineIcon: {
    marginRight: 6,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  emptyButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  viewToggleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  viewToggleButton: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    marginLeft: 6,
  },
  viewToggleButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  productCardGrid: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 8,
    marginBottom: 12,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    width: (width - 16 * 2 - 8) / 2,
  },
  productImageGrid: {
    width: '100%',
    height: 140,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#f5f5f5',
  },
  productInfoGrid: {
    paddingHorizontal: 4,
  },
  productNameGrid: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
    height: 40, // Fixed height for 2 lines
  },
  productPriceGrid: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.success,
    marginBottom: 2,
  },
  productStockGrid: {
    fontSize: 12,
    color: Colors.muted,
  },
  productCategoryGrid: {
    fontSize: 11,
    color: Colors.muted,
    marginBottom: 2,
  },
  productCategoryText: {
    fontSize: 12,
    color: Colors.muted,
    marginBottom: 4,
  },
  filterChip: {
    paddingHorizontal: 12,
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
    fontSize: 12,
    color: Colors.text,
  },
  filterChipTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
});
