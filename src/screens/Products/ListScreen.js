import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, Alert, StyleSheet, Dimensions, RefreshControl, Image } from 'react-native';
import { getProducts, deleteProduct, findProducts } from '../../services/products';
import { useAuth } from '../../context/AuthContext';
import { formatIDR } from '../../utils/currency';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme';

const { width } = Dimensions.get('window');

import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

export default function ListScreen({ navigation, route }) {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [isGrid, setIsGrid] = useState(false);

  const load = async () => {
    console.log('🔄 ListScreen: Loading products for user:', user?.id);
    console.log('🔄 ListScreen: User object:', user);
    try {
      const all = await getProducts(user?.id);
      console.log('✅ ListScreen: Products loaded:', all?.length || 0, 'items');
      console.log('📦 ListScreen: Products data:', all);
      setProducts(all || []);
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
              Alert.alert('✅ Berhasil', `Produk "${productName}" telah dihapus`);
              load(); 
            } catch (error) {
              Alert.alert('❌ Error', 'Gagal menghapus produk. Silakan coba lagi.');
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
            <TouchableOpacity
              onPress={() => navigation.navigate('Scan', { mode: 'pick', returnTo: 'DaftarProduk' })}
              style={{ marginLeft: 8, backgroundColor: Colors.primary, padding: 10, borderRadius: 10 }}
            >
              <Ionicons name="scan" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={styles.viewToggleGroup}>
            <TouchableOpacity
              style={[styles.viewToggleButton, !isGrid && styles.viewToggleButtonActive]}
              onPress={() => setIsGrid(false)}
            >
              <Ionicons name="list" size={16} color={!isGrid ? '#fff' : Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewToggleButton, isGrid && styles.viewToggleButtonActive]}
              onPress={() => setIsGrid(true)}
            >
              <Ionicons name="grid" size={16} color={isGrid ? '#fff' : Colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.actionRight}>
          <TouchableOpacity 
            style={styles.exportButton} 
            onPress={async () => {
              try {
                if (!products || products.length === 0) {
                  Alert.alert('Export Produk', 'Tidak ada data produk untuk diexport');
                  return;
                }

                const header = ['Nama', 'Barcode', 'Harga Jual', 'Harga Modal', 'Stok', 'Margin'];
                const rows = products.map(p => {
                  const price = Number(p.price || 0);
                  const cost = Number(p.costPrice ?? p.cost_price ?? 0);
                  const margin = price - cost;
                  return [
                    `"${(p.name || '').replace(/"/g, '""')}"`,
                    `"${(p.barcode || '').replace(/"/g, '""')}"`,
                    price,
                    cost,
                    p.stock ?? 0,
                    margin
                  ].join(',');
                });

                const csv = [header.join(','), ...rows].join('\n');
                const fileUri = `${FileSystem.cacheDirectory}produk.csv`;
                await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });
                const canShare = await Sharing.isAvailableAsync();
                if (canShare) {
                  await Sharing.shareAsync(fileUri, {
                    mimeType: 'text/csv',
                    dialogTitle: 'Export Produk ke CSV',
                  });
                } else {
                  Alert.alert('Export Produk', `File disimpan di cache:\n${fileUri}`);
                }
              } catch (error) {
                console.error('❌ Export produk error:', error);
                Alert.alert('Export Produk', 'Terjadi kesalahan saat export data');
              }
            }}
          >
            <Ionicons name="download-outline" size={18} color="#ffffff" style={styles.buttonIcon} />
            <Text style={styles.exportButtonText}>Export Excel</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.addButton} 
            onPress={() => navigation.navigate('FormProduk')}
          >
            <View style={styles.buttonContent}>
              <Ionicons name="add-circle" size={18} color="#ffffff" style={styles.buttonIcon} />
              <Text style={styles.addButtonText}>Tambah</Text>
            </View>
          </TouchableOpacity>
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
        data={products}
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
              <View style={styles.productHeader}>
        {item.image_urls && item.image_urls.length > 0 && item.image_urls[0] ? (
          <Image source={{ uri: item.image_urls[0] }} style={styles.productImage} resizeMode="contain" />
        ) : null}
                <View style={styles.productInfo}>
                  <Text style={styles.productName}>{item.name}</Text>
                  <Text style={styles.productBarcode}>
                    {item.barcode ? '' : ''}
                    <Ionicons name="barcode" size={14} color={Colors.muted} style={styles.inlineIcon} />
                    {` ${item.barcode || 'Tanpa barcode'}`}
                  </Text>
                </View>
                <View style={styles.stockBadge}>
                  <Text style={styles.stockText}>{item.stock}</Text>
                </View>
              </View>

              <View style={styles.priceSection}>
                <View style={styles.priceRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="pricetag" size={14} color={Colors.muted} style={styles.inlineIcon} />
                    <Text style={styles.priceLabel}>Harga Jual</Text>
                  </View>
                  <Text style={styles.priceValue}>{formatIDR(item.price)}</Text>
                </View>
                <View style={styles.priceRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="wallet" size={14} color={Colors.muted} style={styles.inlineIcon} />
                    <Text style={styles.priceLabel}>Harga Modal</Text>
                  </View>
                  <Text style={styles.costValue}>{formatIDR(item.costPrice ?? item.cost_price ?? 0)}</Text>
                </View>
                <View style={styles.marginRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="trending-up" size={14} color={Colors.info} style={styles.inlineIcon} />
                    <Text style={styles.marginLabel}>Margin</Text>
                    <Text style={styles.marginValue}>
                      {`  ${formatIDR(margin)} (${marginPercentage}%)`}
                    </Text>
                  </View>
                  <View style={styles.actionButtons}>
                    <TouchableOpacity 
                      style={styles.reportButton}
                      onPress={() => navigation.navigate('ProductReport', { 
                        productId: item.id, 
                        productName: item.name 
                      })}
                    >
                      <Ionicons name="analytics" size={18} color="#ffffff" />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.editButton}
                      onPress={() => navigation.navigate('FormProduk', { id: item.id })}
                    >
                      <Ionicons name="create" size={18} color="#ffffff" />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.deleteButton}
                      onPress={() => confirmDelete(item.id)}
                    >
                      <Ionicons name="trash" size={18} color="#ffffff" />
                    </TouchableOpacity>
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
  addButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    justifyContent: 'center',
  },
  actionRight: {
    flexDirection: 'row',
    marginTop: 12,
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.info,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  exportButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
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
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  productImage: {
          width: 80,
          height: 80,
          borderRadius: 10,
          marginRight: 12,
          backgroundColor: '#f5f5f5',
        },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  productBarcode: {
    fontSize: 14,
    color: Colors.muted,
  },
  stockBadge: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginLeft: 12,
  },
  stockText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  priceSection: {
    marginBottom: 16,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  priceLabel: {
    fontSize: 14,
    color: Colors.muted,
  },
  priceValue: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.success,
  },
  costValue: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.danger,
  },
  marginRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 8,
    borderRadius: 8,
    marginTop: 4,
  },
  marginLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  marginValue: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.info,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
  reportButton: {
    backgroundColor: Colors.info,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  reportButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  editButton: {
    backgroundColor: Colors.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  editButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: Colors.danger,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  deleteButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIcon: {
    marginRight: 6,
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
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    width: (width - 16 * 2 - 8) / 2,
  },
  productImageGrid: {
    width: '100%',
    height: 100,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: '#f5f5f5',
  },
  productInfoGrid: {
    flex: 1,
  },
  productNameGrid: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
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
});
