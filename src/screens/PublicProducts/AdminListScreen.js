import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme';
import {
  listPublicProductsAdmin,
  deletePublicProduct,
} from '../../services/publicProductsSupabase';

export default function AdminListScreen({ navigation }) {
  const [products, setProducts] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [brandOptions, setBrandOptions] = useState([]);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [selectedBrandId, setSelectedBrandId] = useState(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [priceSort, setPriceSort] = useState('none');
  const [showFilters, setShowFilters] = useState(false);

  const load = async () => {
    setLoading(true);
    const result = await listPublicProductsAdmin();
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
      Alert.alert('Error', result.error || 'Gagal memuat produk publik');
      setProducts([]);
      setAllProducts([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      load();
    });
    return unsubscribe;
  }, [navigation]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

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

  const resetFilters = () => {
    setSelectedBrandId(null);
    setSelectedCategoryId(null);
    setPriceSort('none');
  };

  const confirmDelete = (id, title) => {
    Alert.alert(
      'Hapus Produk',
      `Hapus produk publik "${title}"?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            const result = await deletePublicProduct(id);
            if (!result.success) {
              Alert.alert('Error', result.error || 'Gagal menghapus produk');
              return;
            }
            await load();
          },
        },
      ],
    );
  };

  const renderItem = ({ item }) => {
    const firstImage = Array.isArray(item.image_urls) && item.image_urls.length > 0 ? item.image_urls[0] : null;
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('PublicProductForm', { id: item.id })}
      >
        <View style={styles.cardHeader}>
          <View style={styles.imageWrapper}>
            {firstImage ? (
              <Image source={{ uri: firstImage }} style={styles.image} resizeMode="cover" />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons name="image-outline" size={24} color={Colors.muted} />
              </View>
            )}
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
            <Text style={styles.price}>Rp {Number(item.price || 0).toLocaleString('id-ID')}</Text>
            <View style={styles.metaRow}>
              {item.brand?.name ? (
                <View style={styles.chip}>
                  <Ionicons name="pricetag-outline" size={12} color={Colors.primary} />
                  <Text style={styles.chipText}>{item.brand.name}</Text>
                </View>
              ) : null}
              {item.category?.name ? (
                <View style={styles.chip}>
                  <Ionicons name="albums-outline" size={12} color={Colors.info} />
                  <Text style={styles.chipText}>{item.category.name}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
        <View style={styles.cardFooter}>
          <View style={styles.statusWrapper}>
            <View style={[styles.statusDot, { backgroundColor: item.is_active ? '#34C759' : Colors.muted }]} />
            <Text style={styles.statusText}>{item.is_active ? 'Aktif' : 'Nonaktif'}</Text>
          </View>
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: Colors.primary }]}
              onPress={() => navigation.navigate('PublicProductForm', { id: item.id })}
            >
              <Ionicons name="create-outline" size={16} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: Colors.danger }]}
              onPress={() => confirmDelete(item.id, item.title)}
            >
              <Ionicons name="trash-outline" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Memuat produk publik...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.filterBar}>
        <TouchableOpacity style={styles.filterLabelWrapper} onPress={() => setShowFilters(prev => !prev)}>
          <Ionicons name="options-outline" size={16} color={Colors.primary} />
          <Text style={styles.filterBarTitle}>Filter</Text>
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
        <TouchableOpacity style={[styles.resetButton, { marginLeft: 'auto' }]} onPress={resetFilters}>
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
        contentContainerStyle={products.length === 0 ? styles.emptyContainer : styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContent}>
            <Ionicons name="cube-outline" size={40} color={Colors.muted} />
            <Text style={styles.emptyTitle}>Belum ada produk publik</Text>
            <Text style={styles.emptySubtitle}>Tambahkan produk untuk ditampilkan di halaman publik.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: Colors.muted,
    fontSize: 14,
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
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
  filterLabelWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterBarTitle: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
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
  listContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
  },
  imageWrapper: {
    width: 64,
    height: 64,
    borderRadius: 12,
    overflow: 'hidden',
    marginRight: 12,
    backgroundColor: '#f2f2f7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  price: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.success,
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#f2f2f7',
  },
  chipText: {
    marginLeft: 4,
    fontSize: 11,
    color: Colors.text,
  },
  cardFooter: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: Colors.muted,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
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
