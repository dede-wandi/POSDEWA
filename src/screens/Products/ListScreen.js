import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, Alert, StyleSheet, Dimensions, RefreshControl } from 'react-native';
import { getProducts, deleteProduct, findProducts } from '../../services/products';
import { useAuth } from '../../context/AuthContext';
import { formatIDR } from '../../utils/currency';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme';

const { width } = Dimensions.get('window');

export default function ListScreen({ navigation, route }) {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

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
      {/* Search and Add Section */}
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
          
          return (
            <TouchableOpacity 
              onPress={() => navigation.navigate('FormProduk', { id: item.id })} 
              style={styles.productCard}
            >
              <View style={styles.productHeader}>
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
                  </View>
                  <Text style={styles.marginValue}>
                    {formatIDR(margin)} ({marginPercentage}%)
                  </Text>
                </View>
              </View>

              <View style={styles.actionButtons}>
                <TouchableOpacity 
                  style={styles.reportButton}
                  onPress={() => navigation.navigate('ProductReport', { 
                    productId: item.id, 
                    productName: item.name 
                  })}
                >
                  <View style={styles.buttonContent}>
                    <Ionicons name="analytics" size={16} color="#ffffff" style={styles.buttonIcon} />
                    <Text style={styles.reportButtonText}>Report</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.editButton}
                  onPress={() => navigation.navigate('FormProduk', { id: item.id })}
                >
                  <View style={styles.buttonContent}>
                    <Ionicons name="create" size={16} color="#ffffff" style={styles.buttonIcon} />
                    <Text style={styles.editButtonText}>Edit</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.deleteButton}
                  onPress={() => confirmDelete(item.id)}
                >
                  <View style={styles.buttonContent}>
                    <Ionicons name="trash" size={16} color="#ffffff" style={styles.buttonIcon} />
                    <Text style={styles.deleteButtonText}>Hapus</Text>
                  </View>
                </TouchableOpacity>
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
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.border,
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
  },
  reportButton: {
    flex: 1,
    backgroundColor: Colors.info,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
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
    flex: 1,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
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
    flex: 1,
    backgroundColor: Colors.danger,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
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
});
