import React, { useEffect, useState, useMemo } from 'react';
import ConfirmModal from '../../components/ConfirmModal';
import { View, Text, TextInput, FlatList, TouchableOpacity, Alert, StyleSheet, Dimensions, RefreshControl, Image, ScrollView, Animated, Platform, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getProducts, deleteProduct, findProducts, getCategories, getBrands } from '../../services/products';
import { useAuth } from '../../context/AuthContext';
import { getSupabaseClient } from '../../services/supabase';
import { useToast } from '../../contexts/ToastContext';
import { formatIDR } from '../../utils/currency';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Radii, Spacing, Shadows } from '../../theme';
import { ProductEditableTable } from './components/table/ProductEditableTable';
import { sortProductsIntelligently } from '../../utils/productSorting';
import { isUnlimitedProduct } from '../../services/productTypeService';

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

function isFormatInvalid(name) {
  const nameStr = String(name || '');
  
  // Deteksi apakah produk ini memiliki kuota dan durasi (misal mengandung GB/MB dan Hari/HARI)
  const hasQuota = /\b\d+(?:\.\d+)?\s*(?:GB|MB|gb|mb|Gb|Mb)\b/i.test(nameStr);
  const hasDuration = /\b\d+\s*(?:HARI|hari|Hari)\b/i.test(nameStr);
  
  if (hasQuota && hasDuration) {
    // Format ketat: tidak boleh ada spasi antara angka dengan unitnya (GB/MB atau HARI/Hari/hari)
    // Contoh valid: "7GB + Lokal 28Hari Axis" atau "15GB 28HARI Axis"
    // Contoh invalid: "15 GB 28 Hari"
    const hasStrictQuota = /\b\d+(?:\.\d+)?(?:GB|MB|gb|mb|Gb|Mb)\b/.test(nameStr);
    const hasStrictDuration = /\b\d+(?:HARI|hari|Hari)\b/.test(nameStr);
    
    return !hasStrictQuota || !hasStrictDuration;
  }
  
  return false;
}

export default function ListScreen({ navigation, route }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const [viewMode, setViewMode] = useState(isDesktop ? 'table' : 'list'); // 'table' | 'list' | 'grid'
  const isGrid = viewMode === 'grid';
  const gridColumns = width >= 1024 ? 4 : (width >= 768 ? 3 : (width >= 600 ? 3 : 2));

  // Confirm Modal state
  const [confirmModal, setConfirmModal] = useState({ visible: false, id: null, name: '' });

  // Filter State
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedBrand, setSelectedBrand] = useState(null);

  // Dynamic filter chips logic (Cascading/Contextual Filters)
  const visibleCategories = useMemo(() => {
    if (!selectedBrand) return categories;
    const availableCategoryIds = new Set(
      products
        .filter(p => p.brand_id === selectedBrand)
        .map(p => p.category_id)
        .filter(Boolean)
    );
    return categories.filter(c => availableCategoryIds.has(c.id));
  }, [categories, products, selectedBrand]);

  const visibleBrands = useMemo(() => {
    if (!selectedCategory) return brands;
    const availableBrandIds = new Set(
      products
        .filter(p => selectedCategory === 'uncategorized'
          ? (!p.category_id || p.category_id === 'null' || p.category_id === 'none')
          : p.category_id === selectedCategory
        )
        .map(p => p.brand_id)
        .filter(Boolean)
    );
    return brands.filter(b => availableBrandIds.has(b.id));
  }, [brands, products, selectedCategory]);

  // Reset selected filters if they are no longer in the dynamic visible list
  useEffect(() => {
    if (selectedBrand) {
      const isAvailable = visibleBrands.some(b => b.id === selectedBrand);
      if (!isAvailable) {
        setSelectedBrand(null);
      }
    }
  }, [selectedBrand, visibleBrands]);

  useEffect(() => {
    if (selectedCategory) {
      if (selectedCategory === 'uncategorized') {
        if (selectedBrand) {
          const hasUncat = products.some(p => p.brand_id === selectedBrand && (!p.category_id || p.category_id === 'null' || p.category_id === 'none'));
          if (!hasUncat) {
            setSelectedCategory(null);
          }
        }
        return;
      }
      const isAvailable = visibleCategories.some(c => c.id === selectedCategory);
      if (!isAvailable) {
        setSelectedCategory(null);
      }
    }
  }, [selectedCategory, visibleCategories, selectedBrand, products]);

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

  const activeRequestRef = React.useRef(0);

  const load = async (searchQuery = query) => {
    const requestId = ++activeRequestRef.current;
    try {
      const all = searchQuery.trim() ? await findProducts(user?.id, searchQuery) : await getProducts(user?.id);
      if (requestId === activeRequestRef.current) {
        setProducts(all || []);
      }
      await loadMasterData();
    } catch (error) {
      if (requestId === activeRequestRef.current) {
        setProducts([]);
      }
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load(query);
    setRefreshing(false);
  };

  useEffect(() => {
    load(query);
    const unsub = navigation.addListener('focus', () => load(query));
    return unsub;
  }, [navigation, user, query]);

  // Tangkap barcode dari Scan (mode: pick) untuk digunakan sebagai query pencarian
  useEffect(() => {
    const picked = route?.params?.pickedBarcode;
    if (!picked) return;

    const code = String(picked).trim();
    setQuery(code);
    load(code);
    navigation.setParams({ pickedBarcode: null });
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

  const sortedRawProducts = useMemo(() => {
    let result = products;
    if (selectedCategory === 'uncategorized') {
      result = result.filter(p => !p.category_id || p.category_id === 'null' || p.category_id === 'none');
    } else if (selectedCategory) {
      result = result.filter(p => p.category_id === selectedCategory);
    }
    if (selectedBrand) {
      result = result.filter(p => p.brand_id === selectedBrand);
    }

    // Urutkan produk menggunakan Smart Natural Sorting engine
    // Mendukung pengurutan hari terkecil -> terbesar via Regex, kuota, harga, & grouping brand/kategori
    return sortProductsIntelligently(result, {
      brands,
      categories,
      selectedBrand,
      selectedCategory,
      query,
    });
  }, [products, selectedCategory, selectedBrand, brands, categories, query]);

  const filteredProducts = useMemo(() => {
    if (viewMode === 'grid' || viewMode === 'table') {
      return sortedRawProducts;
    }

    // Untuk tampilan list, selipkan header brand - kategori
    const listWithHeaders = [];
    let lastBrandId = null;
    let lastCategoryId = null;

    sortedRawProducts.forEach((product) => {
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
  }, [sortedRawProducts, viewMode, brands, categories]);

  const confirmDelete = (id, fallbackName) => {
    const product = products.find(p => p.id === id);
    const productName = product?.name || fallbackName || 'produk ini';
    setConfirmModal({ visible: true, id, name: productName });
  };

  const performDelete = async () => {
    const { id, name } = confirmModal;
    setConfirmModal({ visible: false, id: null, name: '' });
    try {
      await deleteProduct(user?.id, id);
      showToast(`Produk "${name}" telah dihapus`, 'success');
      load();
    } catch (error) {
      showToast(`Gagal menghapus produk: ${error.message}`, 'error');
    }
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

            <View style={styles.modeSegment}>
              <TouchableOpacity
                style={[styles.modeSegmentBtn, viewMode === 'table' && styles.modeSegmentBtnActive]}
                onPress={() => setViewMode('table')}
                accessibilityLabel="Tabel Excel"
              >
                <Ionicons name="grid-outline" size={15} color={viewMode === 'table' ? '#fff' : '#64748B'} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeSegmentBtn, viewMode === 'list' && styles.modeSegmentBtnActive]}
                onPress={() => setViewMode('list')}
                accessibilityLabel="Daftar List"
              >
                <Ionicons name="list" size={15} color={viewMode === 'list' ? '#fff' : '#64748B'} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeSegmentBtn, viewMode === 'grid' && styles.modeSegmentBtnActive]}
                onPress={() => setViewMode('grid')}
                accessibilityLabel="Daftar Grid"
              >
                <Ionicons name="apps" size={15} color={viewMode === 'grid' ? '#fff' : '#64748B'} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
        
        {/* Filters */}
        <View style={{ marginTop: 12 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }} contentContainerStyle={{ gap: 8 }}>
            <TouchableOpacity
              style={[styles.filterChip, !selectedCategory && styles.filterChipActive]}
              onPress={() => {
                setSelectedCategory(null);
                setSelectedBrand(null);
              }}
            >
              <Text style={[styles.filterChipText, !selectedCategory && styles.filterChipTextActive]}>Semua Kategori</Text>
            </TouchableOpacity>
            {(!selectedBrand || products.some(p => p.brand_id === selectedBrand && (!p.category_id || p.category_id === 'null' || p.category_id === 'none'))) && (
              <TouchableOpacity
                style={[styles.filterChip, selectedCategory === 'uncategorized' && styles.filterChipActive]}
                onPress={() => {
                  setSelectedCategory(selectedCategory === 'uncategorized' ? null : 'uncategorized');
                  setSelectedBrand(null);
                }}
              >
                <Text style={[styles.filterChipText, selectedCategory === 'uncategorized' && styles.filterChipTextActive]}>Unkategori</Text>
              </TouchableOpacity>
            )}
            {visibleCategories.map(c => (
              <TouchableOpacity
                key={c.id}
                style={[styles.filterChip, selectedCategory === c.id && styles.filterChipActive]}
                onPress={() => {
                  setSelectedCategory(selectedCategory === c.id ? null : c.id);
                  setSelectedBrand(null);
                }}
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
            {visibleBrands.map(b => (
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
      <View style={{ flex: 1 }}>
        {viewMode === 'table' ? (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.tableScrollWrapper}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[Colors.primary]}
                tintColor={Colors.primary}
              />
            }
          >
            <ProductEditableTable
              products={sortedRawProducts}
              categories={categories}
              brands={brands}
              navigation={navigation}
              userId={user?.id}
              showToast={showToast}
              onProductUpdated={() => load()}
              onDeleteProduct={confirmDelete}
            />
          </ScrollView>
        ) : (
          <FlatList
            data={filteredProducts}
            key={`${viewMode === 'grid' ? 'GRID' : 'LIST'}-${selectedCategory || 'all'}-${gridColumns}`}
            numColumns={viewMode === 'grid' ? gridColumns : 1}
            keyExtractor={(item) => item.id}
            initialNumToRender={100}
            windowSize={100}
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
            try {
              if (item.isHeader) {
                return (
                  <View style={styles.brandHeaderContainer}>
                    <Ionicons name="pricetag" size={16} color={Colors.white} style={{ marginRight: 8 }} />
                    <Text style={styles.brandHeaderText}>{`${item.brandName} - ${item.categoryName}`}</Text>
                  </View>
                );
              }
  
              let margin = Number(item.price || 0) - Number(item.costPrice || item.cost_price || 0);
              let displayPrice = formatIDR(item.price || 0);
              let displayCostPrice = formatIDR(item.costPrice || item.cost_price || 0);
              let basePrice = Number(item.price || 0);
              let stock = Number(item.stock) || 0;
              
              if (Array.isArray(item.variants) && item.variants.length > 0) {
                const prices = item.variants.map(v => Number(v.price) || 0);
                const costPrices = item.variants.map(v => Number(v.costPrice) || 0);
                const stocks = item.variants.map(v => Number(v.stock) || 0);
                
                const minPrice = Math.min(...prices);
                const maxPrice = Math.max(...prices);
                
                displayPrice = minPrice === maxPrice ? formatIDR(minPrice) : `${formatIDR(minPrice)} - ${formatIDR(maxPrice)}`;
                basePrice = minPrice;
                
                const minCost = Math.min(...costPrices);
                margin = minPrice - minCost;
                
                stock = stocks.reduce((sum, s) => sum + s, 0);
                displayCostPrice = formatIDR(minCost);
              }

              const marginPercentage = basePrice > 0 ? ((margin / basePrice) * 100).toFixed(1) : 0;
              const categoryName = categories.find(c => c.id === item.category_id)?.name;
              const brandName = brands.find(b => b.id === item.brand_id)?.name;
            const isUnlimited = isUnlimitedProduct(item);
            let stockBadgeStyle = isUnlimited ? { backgroundColor: '#F5F3FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 } : styles.stockBadgeNormal;
            let stockTextStyle = isUnlimited ? { color: '#6D28D9', fontSize: 12, fontWeight: '600' } : styles.stockTextNormal;
            let stockLabel = isUnlimited ? '∞ Unlimited' : `Stok: ${stock}`;
  
            if (!isUnlimited) {
              if (stock <= 0) {
                stockBadgeStyle = styles.stockBadgeHabis;
                stockTextStyle = styles.stockTextHabis;
                stockLabel = 'Habis';
              } else if (stock <= 5) {
                stockBadgeStyle = styles.stockBadgeSedikit;
                stockTextStyle = styles.stockTextSedikit;
                stockLabel = `Stok: ${stock}`;
              }
            }
  
            const isPulsing = !isUnlimited && stock <= 5;
            const CardComponent = isPulsing ? PulsingCard : TouchableOpacity;
            const pulseType = stock <= 0 ? 'danger' : 'warning';
            const isInvalid = isFormatInvalid(item.name);
  
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
                    <Text style={[styles.productNameGrid, isInvalid && styles.productNameInvalid]} numberOfLines={2}>
                      {isInvalid ? '⚠️ ' : ''}{item.name}
                    </Text>
                    
                    {isInvalid && (
                      <Text style={styles.formatWarningText} numberOfLines={1}>
                        Format: 15GB 28HARI Brand
                      </Text>
                    )}
                    
                    {(!selectedCategory || selectedCategory === 'uncategorized') && (categoryName || brandName || selectedCategory === 'uncategorized') && (
                      <Text style={styles.productCategoryGrid} numberOfLines={1}>
                         {[categoryName || (selectedCategory === 'uncategorized' ? 'Tanpa Kategori' : null), brandName].filter(Boolean).join(' • ')}
                      </Text>
                    )}
                    {/* Price & Stock Row */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                      <Text style={styles.productPriceGrid}>{displayPrice}</Text>
                      <View style={stockBadgeStyle}>
                        <Text style={stockTextStyle}>{stockLabel}</Text>
                      </View>
                    </View>
  
                    <View style={styles.cardDivider} />
                    
                    {/* Cost & Profit Info */}
                    <View style={{ flexDirection: 'column', gap: 2 }}>
                      <Text style={styles.marginCostText}>Modal: {displayCostPrice}</Text>
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
                    <Text style={[styles.productName, isInvalid && styles.productNameInvalid]} numberOfLines={1}>
                      {isInvalid ? '⚠️ ' : ''}{item.name}
                    </Text>
                    
                    {/* Mini Actions */}
                    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                        <TouchableOpacity 
                          onPress={(e) => {
                            if (e && typeof e.stopPropagation === 'function') {
                              e.stopPropagation();
                            }
                            navigation.navigate('ProductReport', { productId: item.id, productName: item.name });
                          }}
                        >
                           <Ionicons name="analytics-outline" size={16} color={Colors.info} />
                        </TouchableOpacity>
                        <TouchableOpacity 
                          onPress={(e) => {
                            if (e && typeof e.stopPropagation === 'function') {
                              e.stopPropagation();
                            }
                            navigation.navigate('ProductChangeLog', { productId: item.id, productName: item.name });
                          }}
                        >
                           <Ionicons name="time-outline" size={16} color="#8E44AD" />
                        </TouchableOpacity>
                        <TouchableOpacity 
                          onPress={(e) => {
                            if (e && typeof e.stopPropagation === 'function') {
                              e.stopPropagation();
                            }
                            confirmDelete(item.id);
                          }}
                        >
                           <Ionicons name="trash-outline" size={16} color={Colors.danger} />
                        </TouchableOpacity>
                    </View>
                  </View>
  
                  {isInvalid && (
                    <Text style={styles.formatWarningText}>
                      Format tidak sesuai! Gunakan format: 15GB 28HARI Brand
                    </Text>
                  )}
  
                  {(!selectedCategory || selectedCategory === 'uncategorized') && (categoryName || brandName || selectedCategory === 'uncategorized') && (
                    <Text style={styles.productCategoryText} numberOfLines={1}>
                       {[categoryName || (selectedCategory === 'uncategorized' ? 'Tanpa Kategori' : null), brandName].filter(Boolean).join(' • ')}
                    </Text>
                  )}
                  
                  {/* Price & Stock Row */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                    <Text style={styles.productPriceText}>{displayPrice}</Text>
                    <View style={stockBadgeStyle}>
                      <Text style={stockTextStyle}>{stockLabel}</Text>
                    </View>
                  </View>
  
                  <View style={styles.cardDivider} />
  
                  {/* Cost, Margin & Barcode */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Text style={styles.marginCostText}>Modal: {displayCostPrice}</Text>
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
            } catch (e) {
              return (
                <View style={{ padding: Spacing.md, backgroundColor: '#FFF0F0', marginBottom: Spacing.sm, borderRadius: Radii.md, borderWidth: 1, borderColor: 'red' }}>
                  <Text style={{ color: 'red', fontWeight: 'bold' }}>Error rendering item: {item.name || 'Header'}</Text>
                  <Text style={{ color: 'red', fontSize: 11 }}>{e.message}</Text>
                </View>
              );
            }
          }}
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <Ionicons name="cube" size={48} color={Colors.muted} style={styles.emptyIcon} />
              <Text style={styles.emptyTitle}>
                {selectedCategory === 'uncategorized'
                  ? 'Tidak ada produk tanpa kategori'
                  : 'Belum ada produk'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {selectedCategory === 'uncategorized'
                  ? 'Semua produk sudah memiliki kategori'
                  : 'Tambah produk pertama Anda untuk memulai'}
              </Text>
              {selectedCategory !== 'uncategorized' && (
                <TouchableOpacity 
                  style={styles.emptyButton}
                  onPress={() => navigation.navigate('FormProduk')}
                >
                  <Text style={styles.emptyButtonText}>+ Tambah Produk</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        />
      )}
      </View>
      <ConfirmModal
        visible={confirmModal.visible}
        title="Hapus Produk"
        message={`Apakah Anda yakin ingin menghapus "${confirmModal.name}"? Tindakan ini tidak dapat dibatalkan.`}
        confirmText="Hapus"
        cancelText="Batal"
        onConfirm={performDelete}
        onCancel={() => setConfirmModal({ visible: false, id: null, name: '' })}
        type="danger"
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
  modeSegment: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 8,
    padding: 2,
    alignItems: 'center',
  },
  modeSegmentBtn: {
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeSegmentBtnActive: {
    backgroundColor: Colors.primary,
    ...Shadows.sm,
  },
  tableScrollWrapper: {
    padding: Spacing.md,
    paddingBottom: 80,
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
    fontWeight: 'bold',
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
    fontWeight: 'bold',
    color: Colors.primary,
  },
  productPriceText: {
    fontSize: FontSize.bodyLg,
    fontWeight: 'bold',
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
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.md,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  brandHeaderText: {
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.bold,
    color: Colors.white,
    letterSpacing: 0.5,
  },
  productNameInvalid: {
    color: Colors.danger,
  },
  formatWarningText: {
    fontSize: 9,
    color: Colors.danger,
    fontWeight: FontWeight.bold,
    marginTop: 2,
    marginBottom: 4,
  },
});

