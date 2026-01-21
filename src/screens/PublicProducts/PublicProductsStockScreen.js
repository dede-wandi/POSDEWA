import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../theme';
import { listPublicProductsAdmin, updatePublicProduct } from '../../services/publicProductsSupabase';

const sortRowsByStock = (items, direction = 'asc') => {
  const dir = direction === 'desc' ? 'desc' : 'asc';
  return [...items].sort((a, b) => {
    const aVal = a.stock || 0;
    const bVal = b.stock || 0;
    return dir === 'asc' ? aVal - bVal : bVal - aVal;
  });
};

export default function PublicProductsStockScreen() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');

  const load = useCallback(async () => {
    setLoading(true);
    const result = await listPublicProductsAdmin();
    if (result.success) {
      const data = (result.data || [])
        .map((p) => ({
          ...p,
          stock: p.stock !== undefined && p.stock !== null ? Number(p.stock) : 0,
        }))
        .map((p) => ({
          ...p,
          stockInput: String(p.stock || 0),
        }));
      setRows(sortRowsByStock(data, 'asc'));
    } else {
      setRows([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRows((prev) => sortRowsByStock(prev, sortDirection));
    setRefreshing(false);
  };

  const handleChangeStockInput = (id, value) => {
    setRows((prev) =>
      prev.map((row) =>
        row.id === id
          ? {
              ...row,
              stockInput: value.replace(/[^0-9]/g, ''),
            }
          : row,
      ),
    );
  };

  const saveStock = async (row) => {
    const value = String(row.stockInput || '').trim();
    const next = value === '' ? 0 : Number(value);
    if (Number.isNaN(next) || next < 0) {
      Alert.alert('Validasi', 'Stok harus berupa angka dan tidak boleh negatif.');
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id
            ? {
                ...r,
                stockInput: r.stock !== undefined && r.stock !== null ? String(r.stock) : '',
              }
            : r,
        ),
      );
      return;
    }
    if (row.stock === next) {
      return;
    }
    setSavingId(row.id);
    const result = await updatePublicProduct(row.id, { stock: next });
    setSavingId(null);
    if (!result.success) {
      Alert.alert('Error', result.error || 'Gagal menyimpan stok');
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id
            ? {
                ...r,
                stockInput: r.stock !== undefined && r.stock !== null ? String(r.stock) : '',
              }
            : r,
        ),
      );
      return;
    }
    setRows((prev) => {
      const updated = prev.map((r) =>
        r.id === row.id
          ? {
              ...r,
              stock: next,
              stockInput: String(next),
            }
          : r,
      );
      return sortRowsByStock(updated, sortDirection);
    });
  };

  const handleToggleSortDirection = () => {
    setSortDirection((prev) => {
      const next = prev === 'asc' ? 'desc' : 'asc';
      setRows((items) => sortRowsByStock(items, next));
      return next;
    });
  };

  const renderHeader = () => (
    <View style={styles.headerRow}>
      <View style={[styles.cell, styles.nameCell]}>
        <Text style={styles.headerText}>Produk</Text>
      </View>
      <View style={[styles.cell, styles.brandCell]}>
        <Text style={styles.headerText}>Brand</Text>
      </View>
      <View style={[styles.cell, styles.stockCell]}>
        <Text style={styles.headerText} onPress={handleToggleSortDirection}>
          Stok {sortDirection === 'asc' ? '↑' : '↓'}
        </Text>
      </View>
    </View>
  );

  const renderItem = ({ item }) => (
    <View style={styles.dataRow}>
      <View style={[styles.cell, styles.nameCell]}>
        <Text style={styles.nameText} numberOfLines={2}>
          {item.title}
        </Text>
      </View>
      <View style={[styles.cell, styles.brandCell]}>
        <Text style={styles.brandText} numberOfLines={1}>
          {item.brand?.name || '-'}
        </Text>
      </View>
      <View style={[styles.cell, styles.stockCell]}>
        <TextInput
          style={styles.stockInput}
          value={String(item.stockInput ?? '')}
          onChangeText={(text) => handleChangeStockInput(item.id, text)}
          keyboardType="numeric"
          returnKeyType="done"
          onSubmitEditing={() => saveStock(item)}
          onEndEditing={() => saveStock(item)}
        />
        {savingId === item.id && (
          <ActivityIndicator size="small" color={Colors.primary} style={styles.savingIndicator} />
        )}
      </View>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Memuat data stok...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        stickyHeaderIndices={[0]}
        renderItem={renderItem}
        contentContainerStyle={rows.length === 0 ? styles.emptyContainer : styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
        }
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.emptyText}>Belum ada produk publik.</Text>
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
  listContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: Colors.muted,
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
  },
  dataRow: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  cell: {
    justifyContent: 'center',
  },
  nameCell: {
    flex: 2.2,
    paddingRight: 8,
  },
  brandCell: {
    flex: 1.3,
    paddingRight: 8,
  },
  stockCell: {
    width: 52,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.muted,
  },
  nameText: {
    fontSize: 14,
    color: Colors.text,
  },
  brandText: {
    fontSize: 12,
    color: Colors.muted,
  },
  stockInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 4,
    maxWidth: 60,
    fontSize: 12,
    textAlign: 'center',
    backgroundColor: '#fff',
  },
  savingIndicator: {
    marginLeft: 6,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 16,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
    color: Colors.muted,
  },
});
