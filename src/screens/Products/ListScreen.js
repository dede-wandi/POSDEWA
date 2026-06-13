import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, Alert, StyleSheet, Dimensions, RefreshControl, Image, ScrollView, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getProducts, deleteProduct, findProducts, getCategories, getBrands } from '../../services/products';
import { useAuth } from '../../context/AuthContext';
import { getSupabaseClient } from '../../services/supabase';
import { useToast } from '../../contexts/ToastContext';
import { formatIDR } from '../../utils/currency';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Radii, Spacing, Shadows } from '../../theme';

const { width } = Dimensions.get('window');

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

function PulsingCard({ children, onPress, style, type }) {
  const animatedValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: false,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, [animatedValue]);

  // Tentukan warna berdasarkan tipe bahaya / peringatan
  const targetBg = type === 'warning' ? '#FFF9E6' : '#FFF0F0'; // kuning/oranye vs merah
  const targetBorder = type === 'warning' ? 'rgba(255, 149, 0, 0.45)' : 'rgba(255, 59, 48, 0.45)';

  const backgroundColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [Colors.card, targetBg],
  });

  const borderColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [Colors.border, targetBorder],
  });

  return (
    <AnimatedTouchableOpacity
      onPress={onPress}
      style={[style, { backgroundColor, borderColor }]}
    >
      {children}
    </AnimatedTouchableOpacity>
  );
}

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
      }
    }
  };

  const load = async () => {
    try {
      const all = await getProducts(user?.id);
      setProducts(all || []);
      await loadMasterData();
    } catch (error) {
      setProducts([]);
    }
  };

  const onRefresh = async () => {
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
      try {
        const result = query.trim() ? await findProducts(user?.id, query) : await getProducts(user?.id);
        if (active) setProducts(result || []);
      } catch (error) {
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
        if (active) setProducts([]);
      } finally {
        // Bersihkan param agar tidak diproses berulang
        navigation.setParams({ pickedBarcode: null });
      }
    })();

    return () => { active = false; };
  }, [route?.params?.pickedBarcode]);

  // Realtime Auto Sync untuk sinkronisasi pembaruan produk dari Supabase secara instan
  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase || !user?.id) return;

    const channel = supabase
      .channel('products-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products',
          filter: `owner_id=eq.${user.id}`,
        },
        () => {
          load();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const filteredProducts = useMemo(() => {
    let result = products;
    if (selectedCategory) {
      result = result.filter(p => p.category_id === selectedCategory);
    }
    if (selectedBrand) {
      result = result.filter(p => p.brand_id === selectedBrand);
    }

    // Jika tidak mem-filter kategori spesifik (e.g. Semua Kategori dipilih), tampilkan normal tanpa header/pengelompokan
    // Urutkan berdasarkan item yang paling baru ditambahkan (created_at descending)
    if (!selectedCategory) {
      return [...result].sort((a, b) => {
        const dateA = a.created_at || '';
        const dateB = b.created_at || '';
        if (dateA && dateB) {
          return dateB.localeCompare(dateA);
        }
        return String(b.id || '').localeCompare(String(a.id || ''));
      });
    }

    // Urutkan: Brand secara alfabet, lalu Kategori secara alfabet, lalu harga terendah ke tertinggi
    const sorted = [...result].sort((a, b) => {
      const brandA = brands.find(br => br.id === a.brand_id)?.name || 'Tanpa Brand';
      const brandB = brands.find(br => br.id === b.brand_id)?.name || 'Tanpa Brand';
      
      const isAEmpty = brandA === 'Tanpa Brand';
      const isBEmpty = brandB === 'Tanpa Brand';
      
      if (isAEmpty && !isBEmpty) return 1;
      if (!isAEmpty && isBEmpty) return -1;
      
      const compBrand = brandA.localeCompare(brandB, undefined, { sensitivity: 'base' });
      if (compBrand !== 0) return compBrand;
      
      // Jika brand sama, urutkan berdasarkan kategori
      const catA = categories.find(c => c.id === a.category_id)?.name || 'Tanpa Kategori';
      const catB = categories.find(c => c.id === b.category_id)?.name || 'Tanpa Kategori';
      
      const isCatAEmpty = catA === 'Tanpa Kategori';
      const isCatBEmpty = catB === 'Tanpa Kategori';
      
      if (isCatAEmpty && !isCatBEmpty) return 1;
      if (!isCatAEmpty && isCatBEmpty) return -1;
      
      const compCat = catA.localeCompare(catB, undefined, { sensitivity: 'base' });
      if (compCat !== 0) return compCat;
      
      return (Number(a.price) || 0) - (Number(b.price) || 0);
    });

    if (isGrid) {
      return sorted;
    }

    // Untuk tampilan list, selipkan header brand - kategori
    const listWithHeaders = [];
    let lastBrandId = null;
    let lastCategoryId = null;

    sorted.forEach((product) => {
      if (product.brand_id !== lastBrandId || product.category_id !== lastCategoryId) {
        lastBrandId = product.brand_id;
        lastCategoryId = product.category_id;
        
        const brandName = brands.find(br => br.id === product.brand_id)?.name || 'Tanpa Brand';
        const categoryName = categories.find(c => c.id === product.category_id)?.name || 'Tanpa Kategori';
        
        listWithHeaders.push({
          id: `brand-header-${product.brand_id || 'none'}-${product.category_id || 'none'}`,
          isHeader: true,
          brandName: brandName,
          categoryName: categoryName,
        });
      }
      listWithHeaders.push(product);
    });

    return listWithHeaders;
  }, [products, selectedCategory, selectedBrand, brands, categories, isGrid]);

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
          if (item.isHeader) {
            return (
              <View style={styles.brandHeaderContainer}>
                <Ionicons name="pricetag" size={12} color={Colors.primary} style={{ marginRight: 6 }} />
                <Text style={styles.brandHeaderText}>{`${item.brandName} - ${item.categoryName}`}</Text>
              </View>
            );
          }

          const margin = Number(item.price || 0) - Number(item.costPrice || item.cost_price || 0);
          const marginPercentage = item.price ? ((margin / item.price) * 100).toFixed(1) : 0;
          const categoryName = categories.find(c => c.id === item.category_id)?.name;
          const brandName = brands.find(b => b.id === item.brand_id)?.name;
          
          const stock = Number(item.stock) || 0;
          let stockBadgeStyle = styles.stockBadgeNormal;
          let stockTextStyle = styles.stockTextNormal;
          let stockLabel = `Stok: ${stock}`;

          if (stock <= 0) {
            stockBadgeStyle = styles.stockBadgeHabis;
            stockTextStyle = styles.stockTextHabis;
            stockLabel = 'Habis';
          } else if (stock <= 5) {
            stockBadgeStyle = styles.stockBadgeSedikit;
            stockTextStyle = styles.stockTextSedikit;
            stockLabel = `Stok: ${stock}`;
          }

          const isPulsing = stock <= 5;
          const CardComponent = isPulsing ? PulsingCard : TouchableOpacity;
          const pulseType = stock <= 0 ? 'danger' : 'warning';

          if (isGrid) {
            return (
              <CardComponent 
                onPress={() => navigation.navigate('FormProduk', { id: item.id })} 
                style={styles.productCardGrid}
                type={pulseType}
              >
                {item.image_urls && item.image_urls.length > 0 && item.image_urls[0] ? (
                  <Image source={{ uri: item.image_urls[0] }} style={styles.productImageGrid} resizeMode="contain" />
                ) : (
                  <View style={[styles.productImageGrid, { backgroundColor: '#f9fafb', alignItems: 'center', justifyContent: 'center' }]}>
                    <Ionicons name="image-outline" size={24} color="#ccc" />
                  </View>
                )}
                <View style={styles.productInfoGrid}>
                  <Text style={styles.productNameGrid} numberOfLines={2}>{item.name}</Text>
                  
                  {!selectedCategory && (categoryName || brandName) && (
                    <Text style={styles.productCategoryGrid} numberOfLines={1}>
                       {[categoryName, brandName].filter(Boolean).join(' • ')}
                    </Text>
                  )}
                  
                  {/* Price & Stock Row */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                    <Text style={styles.productPriceGrid}>{formatIDR(item.price)}</Text>
                    <View style={stockBadgeStyle}>
                      <Text style={stockTextStyle}>{stockLabel}</Text>
                    </View>
                  </View>

                  <View style={styles.cardDivider} />
                  
                  {/* Cost & Profit Info */}
                  <View style={{ flexDirection: 'column', gap: 2 }}>
                    <Text style={styles.marginCostText}>Modal: {formatIDR(item.costPrice ?? item.cost_price ?? 0)}</Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={styles.marginProfitText}>Laba: {formatIDR(margin)}</Text>
                      <Text style={[styles.marginProfitText, { fontSize: 9, color: Colors.success, fontWeight: '700' }]}>
                        ({marginPercentage}%)
                      </Text>
                    </View>
                  </View>
                </View>
              </CardComponent>
            );
          }

          return (
            <CardComponent 
              onPress={() => navigation.navigate('FormProduk', { id: item.id })} 
              style={styles.productCard}
              type={pulseType}
            >
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
                  
                  {/* Mini Actions */}
                  <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                      <TouchableOpacity onPress={() => navigation.navigate('ProductReport', { productId: item.id, productName: item.name })}>
                         <Ionicons name="analytics-outline" size={16} color={Colors.info} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => confirmDelete(item.id)}>
                         <Ionicons name="trash-outline" size={16} color={Colors.danger} />
                      </TouchableOpacity>
                  </View>
                </View>

                {!selectedCategory && (categoryName || brandName) && (
                  <Text style={styles.productCategoryText} numberOfLines={1}>
                     {[categoryName, brandName].filter(Boolean).join(' • ')}
                  </Text>
                )}
                
                {/* Price & Stock Row */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                  <Text style={styles.productPriceText}>{formatIDR(item.price)}</Text>
                  <View style={stockBadgeStyle}>
                    <Text style={stockTextStyle}>{stockLabel}</Text>
                  </View>
                </View>

                <View style={styles.cardDivider} />

                {/* Cost, Margin & Barcode */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Text style={styles.marginCostText}>Modal: {formatIDR(item.costPrice ?? item.cost_price ?? 0)}</Text>
                    <Text style={styles.marginProfitText}>Laba: {formatIDR(margin)} ({marginPercentage}%)</Text>
                  </View>
                  {item.barcode ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name="barcode-outline" size={12} color={Colors.muted} style={{ marginRight: 2 }} />
                      <Text style={styles.infoText}>{item.barcode}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </CardComponent>
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
  listContainer: {
    padding: Spacing.lg,
    paddingBottom: 80,
  },
  productCard: {
    backgroundColor: Colors.card,
    borderRadius: Radii.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  productCategoryText: {
    fontSize: FontSize.xs,
    color: Colors.muted,
    marginBottom: 4,
  },
  infoText: {
    fontSize: FontSize.xs,
    color: Colors.muted,
  },
  productCardGrid: {
    backgroundColor: Colors.card,
    borderRadius: Radii.md,
    padding: Spacing.md,
    margin: 4,
    flex: 0.5,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  productImageGrid: {
    width: '100%',
    height: 100,
    borderRadius: Radii.sm,
    backgroundColor: Colors.lightBg,
    marginBottom: Spacing.sm,
  },
  productInfoGrid: {
    flex: 1,
  },
  productNameGrid: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  productPriceGrid: {
    fontSize: FontSize.bodyLg,
    fontWeight: FontWeight.extrabold,
    color: Colors.primary,
    marginBottom: 4,
  },
  productCategoryGrid: {
    fontSize: FontSize.xs,
    color: Colors.muted,
    marginBottom: 4,
  },
  productStockGrid: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.textSecondary,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radii.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  productImage: {
    width: 64,
    height: 64,
    borderRadius: Radii.sm,
    backgroundColor: Colors.lightBg,
    marginRight: Spacing.md,
  },
  productImagePlaceholder: {
    width: 64,
    height: 64,
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
    fontSize: FontSize.bodyLg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    flex: 1,
    marginRight: Spacing.sm,
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
  productPriceText: {
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
  cardDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: Spacing.sm,
  },
  marginCostText: {
    fontSize: FontSize.xs,
    color: Colors.muted,
  },
  marginProfitText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.success,
  },
  stockBadgeNormal: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radii.xs,
    borderWidth: 1,
    borderColor: 'rgba(3, 172, 14, 0.1)',
  },
  stockTextNormal: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.primary,
  },
  stockBadgeSedikit: {
    backgroundColor: Colors.warningLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radii.xs,
    borderWidth: 1,
    borderColor: 'rgba(255, 149, 0, 0.15)',
  },
  stockTextSedikit: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.warning,
  },
  stockBadgeHabis: {
    backgroundColor: Colors.dangerLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radii.xs,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.15)',
  },
  stockTextHabis: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
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
  brandHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.lightBg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radii.sm,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  brandHeaderText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
    letterSpacing: 0.5,
  },
});

