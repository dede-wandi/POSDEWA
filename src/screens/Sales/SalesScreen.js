import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, Alert, StyleSheet, Dimensions, RefreshControl, Modal, Image, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radii, Shadows, Typography, FontSize, FontWeight } from '../../theme';
import { findByBarcodeOrName, findByBarcodeExact, getProducts, getCategories, getBrands } from '../../services/products';
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
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [selectedBrandId, setSelectedBrandId] = useState(null);

  // Dynamic filter chips logic (Cascading/Contextual Filters)
  const visibleCategories = useMemo(() => {
    if (!selectedBrandId) return categories;
    const availableCategoryIds = new Set(
      allProducts
        .filter(p => p.brand_id === selectedBrandId)
        .map(p => p.category_id)
        .filter(Boolean)
    );
    return categories.filter(c => availableCategoryIds.has(c.id));
  }, [categories, allProducts, selectedBrandId]);

  const visibleBrands = useMemo(() => {
    if (!selectedCategoryId) return brands;
    const availableBrandIds = new Set(
      allProducts
        .filter(p => p.category_id === selectedCategoryId)
        .map(p => p.brand_id)
        .filter(Boolean)
    );
    return brands.filter(b => availableBrandIds.has(b.id));
  }, [brands, allProducts, selectedCategoryId]);

  // Reset selected filters if they are no longer in the dynamic visible list
  useEffect(() => {
    if (selectedBrandId) {
      const isAvailable = visibleBrands.some(b => b.id === selectedBrandId);
      if (!isAvailable) {
        setSelectedBrandId(null);
      }
    }
  }, [selectedBrandId, visibleBrands]);

  useEffect(() => {
    if (selectedCategoryId) {
      const isAvailable = visibleCategories.some(c => c.id === selectedCategoryId);
      if (!isAvailable) {
        setSelectedCategoryId(null);
      }
    }
  }, [selectedCategoryId, visibleCategories]);
  
  // Token modal states
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [tokenCode, setTokenCode] = useState('');
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [selectedProductForVariant, setSelectedProductForVariant] = useState(null);

  const total = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.lineTotal, 0);
  }, [cart]);

  const profit = useMemo(() => {
    return cart.reduce((sum, item) => {
      const unitCost = item?.costPrice ?? item?.cost ?? 0;
      return sum + ((item.price - unitCost) * item.qty);
    }, 0);
  }, [cart]);

  const processedResults = useMemo(() => {
    let list = [...results];
    
    // 1. Jika tidak mem-filter kategori spesifik (e.g. Semua Kategori dipilih), tampilkan normal tanpa header/pengelompokan
    // Urutkan berdasarkan item yang paling baru ditambahkan (created_at descending)
    if (!selectedCategoryId) {
      return list.sort((a, b) => {
        const dateA = a.created_at || '';
        const dateB = b.created_at || '';
        if (dateA && dateB) {
          return dateB.localeCompare(dateA);
        }
        return String(b.id || '').localeCompare(String(a.id || ''));
      });
    }

    // 2. Jika kategori dipilih, urutkan: Brand secara alfabet, lalu Kategori secara alfabet, lalu harga terendah ke tertinggi (termurah)
    const sorted = list.sort((a, b) => {
      const brandA = brands.find(br => br.id === a.brand_id)?.name || 'Tanpa Brand';
      const brandB = brands.find(br => br.id === b.brand_id)?.name || 'Tanpa Brand';
      
      const isAEmpty = brandA === 'Tanpa Brand';
      const isBEmpty = brandB === 'Tanpa Brand';
      
      if (isAEmpty && !isBEmpty) return 1;
      if (!isAEmpty && isBEmpty) return -1;
      
      const compBrand = brandA.localeCompare(brandB, undefined, { sensitivity: 'base' });
      if (compBrand !== 0) return compBrand;
      
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

    if (productLayout === 'grid') {
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
  }, [results, selectedCategoryId, productLayout, brands, categories]);

  const loadInitialProducts = async () => {
    try {
      if (!user?.id) return;
      setRefreshing(true);
      const products = await getProducts(user.id);
      setAllProducts(products || []);
      setResults(products || []);
    } catch (error) {
      showToast('Gagal memuat produk', 'error');
    } finally {
      setRefreshing(false);
    }
  };

  const loadFilters = async () => {
    try {
      if (!user?.id) return;
      const [cats, brs] = await Promise.all([getCategories(user.id), getBrands(user.id)]);
      setCategories(cats || []);
      setBrands(brs || []);
    } catch (e) {
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        loadInitialProducts();
        loadFilters();
      }
    }, [user?.id])
  );

  const applyFilters = useCallback((list) => {
    let filtered = list || [];
    if (selectedCategoryId) {
      filtered = filtered.filter(p => p.category_id === selectedCategoryId);
    }
    if (selectedBrandId) {
      filtered = filtered.filter(p => p.brand_id === selectedBrandId);
    }
    return filtered;
  }, [selectedCategoryId, selectedBrandId]);

  const handleSearch = async () => {
    if (!query.trim()) {
      setResults(applyFilters(allProducts));
      return;
    }

    try {
      const searchResults = await findByBarcodeOrName(user?.id, query.trim());
      setResults(applyFilters(searchResults || []));
    } catch (error) {
      showToast('Gagal mencari produk', 'error');
      setResults(applyFilters([]));
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      handleSearch();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, allProducts, selectedCategoryId, selectedBrandId]);

  useEffect(() => {
    let active = true;

    const searchByBarcode = async () => {
      if (query.trim() && /^\d+$/.test(query.trim())) {
        try {
          const exactMatch = await findByBarcodeExact(user?.id, query.trim());
          if (active && exactMatch) {
            let matchedVariant = null;
            if (exactMatch.variants && exactMatch.variants.length > 0) {
              matchedVariant = exactMatch.variants.find(v => {
                if (!v.barcode) return false;
                return v.barcode.split(',').map(b => b.trim()).includes(query.trim());
              });
            }
            addToCart(exactMatch, matchedVariant);
            setQuery('');
            setResults([]);
          }
        } catch (error) {
        }
      }
    };

    const timeoutId = setTimeout(searchByBarcode, 1000);
    return () => { 
      active = false;
      clearTimeout(timeoutId);
    };
  }, [query]);

  // Handle reset cart from PaymentScreen
  useEffect(() => {
    if (route.params?.resetCart) {
      setCart([]);
      navigation.setParams({ resetCart: undefined });
    }
  }, [route.params?.resetCart]);

  // Handle updated cart from ProductListScreen
  useEffect(() => {
    if (route.params?.updatedCart) {
      
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
          let matchedVariant = null;
          if (exactMatch.variants && exactMatch.variants.length > 0) {
            matchedVariant = exactMatch.variants.find(v => {
              if (!v.barcode) return false;
              return v.barcode.split(',').map(b => b.trim()).includes(String(scanned).trim());
            });
          }
          addToCart(exactMatch, matchedVariant);
          setQuery('');
          setResults([]);
        } else {
          showToast('Produk tidak ditemukan', 'error');
          setQuery(String(scanned));
          await handleSearch();
        }
      } catch (error) {
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

  const addToCart = (product, matchedVariant = null) => {
    if (matchedVariant) {
      if (Number(matchedVariant.stock) <= 0) {
        showToast(`Stok varian ${matchedVariant.name} habis`, 'error');
        return;
      }
      addProductToCart(product, null, matchedVariant);
      return;
    }

    if (product.stock <= 0 && (!Array.isArray(product.variants) || product.variants.length === 0)) {
      showToast('Stok habis, tidak bisa menambahkan produk', 'error');
      return;
    }

    // Check if product has variants
    if (Array.isArray(product.variants) && product.variants.length > 0) {
      setSelectedProductForVariant(product);
      setShowVariantModal(true);
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

  const addProductToCart = (product, tokenCode = null, variant = null) => {
    const cartItemId = variant ? `${product.id}-${variant.name}` : product.id;
    const existingItem = cart.find(item => item.id === cartItemId);
    
    const maxStock = variant ? variant.stock : product.stock;
    const itemPrice = variant ? variant.price : product.price;
    const itemName = variant ? `${product.name} - ${variant.name}` : product.name;
    const itemCostPrice = variant ? variant.costPrice : (product.cost_price || product.costPrice || product.cost || 0);

    if (existingItem) {
      if (existingItem.qty >= maxStock) {
        showToast(`Stok tidak cukup. Sisa stok hanya ${maxStock}`, 'error');
        return;
      }
      setCart(cart.map(item =>
        item.id === cartItemId
          ? { ...item, qty: item.qty + 1, lineTotal: (item.qty + 1) * itemPrice }
          : item
      ));
    } else {
      const newItem = {
        id: cartItemId,
        originalProductId: product.id,
        variantName: variant ? variant.name : null,
        name: itemName,
        price: itemPrice,
        costPrice: itemCostPrice,
        qty: 1,
        lineTotal: itemPrice,
        tokenCode: tokenCode,
        stock: maxStock
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

  const { width } = useWindowDimensions();
  const isTablet = width > 768;
  const gridColumns = width >= 1024 ? 4 : (width >= 768 ? 3 : (width >= 600 ? 3 : 2));

  const cartContent = (
    <>
      <View style={[styles.cartSection, !isTablet && { flex: 1, paddingTop: 16 }]}>
        {isTablet && <Text style={styles.sectionTitle}>Keranjang Belanja</Text>}
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
                  <Ionicons name="remove" size={16} color={Colors.muted} />
                </TouchableOpacity>
                <Text style={styles.quantityText}>{item.qty}</Text>
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={() => updateQuantity(item.id, item.qty + 1)}
                >
                  <Ionicons name="add" size={16} color={Colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removeFromCart(item.id)}
                >
                  <Ionicons name="trash-outline" size={16} color={Colors.danger} />
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      </View>

      {/* Summary and Checkout */}
      <View style={styles.summarySection}>
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Penjualan</Text>
            <Text style={styles.summaryTotal}>{formatIDR(total)}</Text>
          </View>
          <TouchableOpacity style={styles.checkoutButton} onPress={() => {
            setShowMobileCart(false);
            navigateToPayment();
          }}>
            <View style={styles.checkoutContent}>
              <Ionicons name="card-outline" size={18} color="#ffffff" style={{ marginRight: 8 }} />
              <Text style={styles.checkoutButtonText}>Lanjut ke Pembayaran</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={[styles.mainLayout, isTablet && styles.mainLayoutTablet]}>
        <View style={[styles.leftPanel, isTablet && cart.length > 0 && styles.leftPanelTablet]}>
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
              style={[styles.toggleButton, styles.toggleButtonActive, { marginRight: 8 }]}
              onPress={() => navigation.navigate('Scan', { mode: 'sale' })}
            >
              <Ionicons name="barcode-outline" size={18} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleButton, styles.toggleButtonActive]}
              onPress={() => setProductLayout(prev => prev === 'grid' ? 'list' : 'grid')}
            >
              <Ionicons 
                name={productLayout === 'grid' ? 'grid' : 'list'} 
                size={16} 
                color="#fff" 
              />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.filterSection}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={[{ id: null, name: 'Semua Kategori' }, ...visibleCategories]}
            keyExtractor={(item) => String(item.id ?? 'all')}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  (selectedCategoryId === item.id) && styles.filterChipActive
                ]}
                onPress={() => setSelectedCategoryId(item.id)}
              >
                <Text style={[
                  styles.filterChipText,
                  (selectedCategoryId === item.id) && styles.filterChipTextActive
                ]}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            )}
          />
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={[{ id: null, name: 'Semua Brand' }, ...visibleBrands]}
            keyExtractor={(item) => String(item.id ?? 'all')}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  (selectedBrandId === item.id) && styles.filterChipActive
                ]}
                onPress={() => setSelectedBrandId(item.id)}
              >
                <Text style={[
                  styles.filterChipText,
                  (selectedBrandId === item.id) && styles.filterChipTextActive
                ]}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </View>

      {/* Product List */}
      <View style={styles.resultsSection}>
          <FlatList
            data={processedResults}
            key={`${productLayout}-${selectedCategoryId || 'all'}-${gridColumns}`} // Force re-render when layout/category/columns change
            numColumns={productLayout === 'grid' ? gridColumns : 1}
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
              if (item.isHeader) {
                return (
                  <View style={styles.brandHeaderContainer}>
                    <Ionicons name="pricetag" size={14} color={Colors.white} style={{ marginRight: 6 }} />
                    <Text style={styles.brandHeaderText}>{`${item.brandName} - ${item.categoryName}`}</Text>
                  </View>
                );
              }

              const categoryName = categories.find(c => c.id === item.category_id)?.name;
              const brandName = brands.find(b => b.id === item.brand_id)?.name;

              let displayPrice = formatIDR(item.price || 0);
              let stock = Number(item.stock) || 0;
              
              if (Array.isArray(item.variants) && item.variants.length > 0) {
                const prices = item.variants.map(v => Number(v.price) || 0);
                const stocks = item.variants.map(v => Number(v.stock) || 0);
                
                const minPrice = Math.min(...prices);
                const maxPrice = Math.max(...prices);
                
                displayPrice = minPrice === maxPrice ? formatIDR(minPrice) : `${formatIDR(minPrice)} - ${formatIDR(maxPrice)}`;
                stock = stocks.reduce((sum, s) => sum + s, 0);
              }
              
              const stockLabel = stock > 0 ? `Stok: ${stock}` : 'Habis';

              if (productLayout === 'grid') {
                return (
                  <View style={styles.resultCardGrid}>
                    <View style={[styles.stockBadge, stock <= 0 && styles.stockBadgeEmpty]}>
                      <Text style={[styles.stockBadgeText, stock <= 0 && styles.stockBadgeTextEmpty]}>
                        {stockLabel}
                      </Text>
                    </View>
                    {item.image_urls && item.image_urls[0] ? (
                      <Image source={{ uri: item.image_urls[0] }} style={styles.resultImageGrid} resizeMode="cover" />
                    ) : (
                      <View style={[styles.resultImageGrid, { backgroundColor: Colors.lightBg, alignItems: 'center', justifyContent: 'center' }]}>
                        <Ionicons name="image-outline" size={24} color={Colors.placeholder} />
                      </View>
                    )}
                    <View style={styles.resultInfoGrid}>
                      <Text style={styles.resultNameGrid} numberOfLines={2}>{item.name}</Text>
                      {(categoryName || brandName) && (
                        <Text style={styles.productCategoryGrid} numberOfLines={1}>
                           {[categoryName, brandName].filter(Boolean).join(' • ')}
                        </Text>
                      )}
                      <View style={styles.productRowGrid}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.resultPrice}>{displayPrice}</Text>
                        </View>
                        <TouchableOpacity
                          style={[
                            styles.addButtonGrid,
                            stock <= 0 && styles.addButtonDisabled
                          ]}
                          onPress={() => addToCart(item)}
                          disabled={stock <= 0}
                        >
                          <Ionicons 
                            name={stock <= 0 ? "ban" : "add"} 
                            size={16} 
                            color={stock <= 0 ? Colors.muted : Colors.white} 
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              }

              return (
                <View style={styles.resultCard}>
                  <View style={[styles.stockBadge, stock <= 0 && styles.stockBadgeEmpty]}>
                    <Text style={[styles.stockBadgeText, stock <= 0 && styles.stockBadgeTextEmpty]}>
                      {stockLabel}
                    </Text>
                  </View>
                  {item.image_urls && item.image_urls[0] ? (
                    <Image source={{ uri: item.image_urls[0] }} style={styles.resultImageList} resizeMode="cover" />
                  ) : (
                    <View style={[styles.resultImageList, { backgroundColor: Colors.lightBg, alignItems: 'center', justifyContent: 'center' }]}>
                      <Ionicons name="image-outline" size={18} color={Colors.placeholder} />
                    </View>
                  )}
                  <View style={styles.resultInfo}>
                    <Text style={styles.resultName}>{item.name}</Text>
                    {(categoryName || brandName) && (
                      <Text style={styles.productCategoryText} numberOfLines={1}>
                         {[categoryName, brandName].filter(Boolean).join(' • ')}
                      </Text>
                    )}
                    <View style={styles.resultBarcodeRow}>
                      <Ionicons name="barcode-outline" size={12} color={Colors.muted} style={{ marginRight: 4 }} />
                      <Text style={styles.resultBarcode}>{item.barcode || 'Tanpa barcode'}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 4 }}>
                      <Text style={styles.resultPrice}>{displayPrice}</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.addButtonList,
                      item.stock <= 0 && styles.addButtonDisabled
                    ]}
                    onPress={() => addToCart(item)}
                    disabled={item.stock <= 0}
                  >
                    <Ionicons 
                      name={item.stock <= 0 ? "ban" : "add"} 
                      size={16} 
                      color={item.stock <= 0 ? Colors.muted : Colors.white} 
                    />
                  </TouchableOpacity>
                </View>
              );
            }}
          />
        </View>
        </View>

      {/* Right / Bottom Panel */}
      {cart.length > 0 && (
        isTablet ? (
          <View style={[styles.rightPanel, styles.rightPanelTablet]}>
            {cartContent}
          </View>
        ) : (
          <View style={styles.floatingMobileCart}>
             <TouchableOpacity style={styles.floatingMobileCartButton} onPress={() => setShowMobileCart(true)}>
               <View style={styles.floatingMobileCartInfo}>
                 <Text style={styles.floatingMobileCartItemCount}>{cart.length} Item</Text>
                 <Text style={styles.floatingMobileCartTotal}>{formatIDR(total)}</Text>
               </View>
               <View style={styles.floatingMobileCartAction}>
                 <Text style={styles.floatingMobileCartActionText}>Lihat Keranjang</Text>
                 <Ionicons name="chevron-up" size={16} color="#fff" />
               </View>
             </TouchableOpacity>
          </View>
        )
      )}
      </View>

      {/* Mobile Cart Modal */}
      {!isTablet && (
        <Modal
          visible={showMobileCart}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowMobileCart(false)}
        >
          <View style={styles.mobileCartOverlay}>
             <View style={styles.mobileCartContainer}>
               <View style={styles.mobileCartHeader}>
                 <Text style={styles.mobileCartHeaderTitle}>Keranjang Belanja</Text>
                 <TouchableOpacity onPress={() => setShowMobileCart(false)} style={styles.mobileCartCloseButton}>
                   <Ionicons name="close" size={24} color={Colors.darkText} />
                 </TouchableOpacity>
               </View>
               {cartContent}
             </View>
          </View>
        </Modal>
      )}

      {/* Variant Selection Modal */}
      <Modal
        visible={showVariantModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowVariantModal(false);
          setSelectedProductForVariant(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Pilih Varian Produk</Text>
            <Text style={styles.modalSubtitle}>
              {selectedProductForVariant?.name}
            </Text>
            
            <View style={{ gap: 10, marginBottom: 20, maxHeight: 300 }}>
              {selectedProductForVariant?.variants?.map((v, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.tokenInput,
                    { 
                      marginBottom: 0, 
                      backgroundColor: v.stock <= 0 ? Colors.background : Colors.white,
                      opacity: v.stock <= 0 ? 0.5 : 1
                    }
                  ]}
                  disabled={v.stock <= 0}
                  onPress={() => {
                    if (v.stock > 0) {
                      addProductToCart(selectedProductForVariant, null, v);
                      setShowVariantModal(false);
                      setSelectedProductForVariant(null);
                    }
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: Colors.text }}>{v.name}</Text>
                    <Text style={{ fontSize: 14, color: Colors.primary, fontWeight: '700' }}>
                      {formatIDR(v.price)}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 12, color: Colors.muted, marginTop: 4 }}>
                    Sisa Stok: {v.stock}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity 
              style={[styles.modalCancelButton, { marginRight: 0 }]}
              onPress={() => {
                setShowVariantModal(false);
                setSelectedProductForVariant(null);
              }}
            >
              <Text style={styles.modalCancelText}>Tutup</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  floatingMobileCart: {
    padding: 16,
    backgroundColor: Colors.card,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  floatingMobileCartButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  floatingMobileCartInfo: {
    flex: 1,
  },
  floatingMobileCartItemCount: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    marginBottom: 4,
  },
  floatingMobileCartTotal: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  floatingMobileCartAction: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  floatingMobileCartActionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 4,
  },
  mobileCartOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  mobileCartContainer: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    minHeight: '50%',
    paddingBottom: 20,
  },
  mobileCartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  mobileCartHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.darkText,
  },
  mobileCartCloseButton: {
    padding: 4,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  mainLayout: {
    flex: 1,
    flexDirection: 'column',
  },
  mainLayoutTablet: {
    flexDirection: 'row',
  },
  leftPanel: {
    flex: 1,
    display: 'flex',
  },
  leftPanelTablet: {
    flex: 2.2,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  rightPanel: {
    flexShrink: 1,
    maxHeight: '50%',
    backgroundColor: Colors.card,
    borderTopLeftRadius: Radii.lg,
    borderTopRightRadius: Radii.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  rightPanelTablet: {
    flex: 1.2,
    height: '100%',
    maxHeight: '100%',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    shadowOpacity: 0,
    elevation: 0,
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
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    flex: 1,
  },
  searchIcon: {
    fontSize: FontSize.subtitle,
    marginRight: 12,
    color: Colors.muted,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.subtitle,
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
  filterSection: {
    marginTop: 12,
    gap: 8,
  },
  filterChip: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: FontSize.caption,
    color: Colors.text,
  },
  filterChipTextActive: {
    color: Colors.white,
    fontWeight: FontWeight.semibold,
  },
  sectionTitle: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
    marginBottom: 12,
  },
  resultCard: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    alignItems: 'center',
    ...Shadows.card,
  },
  resultImageList: {
    width: 64,
    height: 64,
    borderRadius: 12,
    marginRight: 12,
  },
  addButtonList: {
    backgroundColor: Colors.primary,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  resultCardGrid: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 12,
    margin: 6,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    width: (width - 60) / 2, // 2 column with safe padding calculation
    ...Shadows.card,
  },
  resultImageGrid: {
    width: '100%',
    height: 110,
    borderRadius: 12,
    marginBottom: 8,
  },
  resultInfoGrid: {
    flex: 1,
    justifyContent: 'space-between',
  },
  resultNameGrid: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.darkText,
    marginBottom: 4,
    height: 36, // limit to 2 lines height roughly
  },
  productRowGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 4,
  },
  addButtonGrid: {
    backgroundColor: Colors.primary,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    color: Colors.darkText,
    marginBottom: 4,
  },
  resultBarcode: {
    fontSize: FontSize.sm,
    color: Colors.muted,
  },
  resultPrice: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.extrabold,
    color: Colors.primary,
    marginBottom: 0,
  },
  resultStock: {
    fontSize: FontSize.xs,
    color: Colors.muted,
    marginTop: 2,
  },
  stockBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    zIndex: 1,
    ...Shadows.card,
  },
  stockBadgeEmpty: {
    backgroundColor: Colors.dangerLight,
    borderColor: Colors.danger,
  },
  stockBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  stockBadgeTextEmpty: {
    color: Colors.danger,
  },
  addButtonDisabled: {
    backgroundColor: '#E2E8F0',
  },
  viewAllButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
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
    flexShrink: 1,
    backgroundColor: Colors.card,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  cartItem: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    alignItems: 'center',
    ...Shadows.card,
  },
  cartItemInfo: {
    flex: 1,
  },
  cartItemName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.darkText,
    marginBottom: 4,
  },
  cartItemToken: {
    fontSize: 12,
    color: Colors.secondary,
    marginBottom: 4,
    fontStyle: 'italic',
  },
  cartItemPrice: {
    fontSize: 13,
    color: Colors.muted,
    fontWeight: '500',
  },
  cartItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityButton: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  quantityText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.darkText,
    marginHorizontal: 8,
    minWidth: 20,
    textAlign: 'center',
  },
  removeButton: {
    backgroundColor: Colors.dangerLight,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  summarySection: {
    backgroundColor: Colors.card,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  summaryCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.card,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.darkText,
  },
  summaryTotal: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.primary,
  },
  checkoutButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    ...Shadows.card,
  },
  checkoutButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
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
  productCategoryText: {
    fontSize: FontSize.xs,
    color: Colors.muted,
    marginBottom: 4,
  },
  productCategoryGrid: {
    fontSize: FontSize.xs,
    color: Colors.muted,
    marginBottom: 4,
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
    width: '100%',
  },
  brandHeaderText: {
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.bold,
    color: Colors.white,
    letterSpacing: 0.5,
  },
});
