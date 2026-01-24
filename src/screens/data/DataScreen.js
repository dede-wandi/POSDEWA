import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert, FlatList, Modal } from 'react-native';
import { Colors } from '../../theme/colors';
import { useNavigation } from '@react-navigation/native';
import { getPrefixProducts } from '../../api/prefix';
import { useToast } from '../../contexts/ToastContext';

const formatIDR = (value) => {
  const n = Number(value || 0);
  try {
    return n.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
  } catch {
    return `Rp ${n}`;
  }
};

export default function DataScreen() {
  const navigation = useNavigation();
  const [msisdn, setMsisdn] = useState('');
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [errorDialog, setErrorDialog] = useState('');

  const disabled = !msisdn || loading;

  const normalizeList = (data) => {
    const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : data?.items || [];
    return list;
  };

  const sortProducts = (list) => {
    const getPrice = (it) => Number(it?.price ?? it?.qgrow ?? 0);
    return [...(list || [])].sort((a, b) => getPrice(a) - getPrice(b));
  };

  const fetchProducts = async (reset = true, loadAll = false) => {
    try {
      setLoading(true);
      let currentPage = reset ? 1 : page + 1;
      let all = [];
      let more = true;

      while (true) {
        const res = await getPrefixProducts({ msisdn, page: currentPage, type: 'data' });
        const list = normalizeList(res);
        const info = res?.meta?.info || res?.info;
        all.push(...list);
        const totalPage = Number(info?.total_page || 0);
        const moreRecords = Boolean(info?.more_records);
        if (!loadAll) {
          more = list.length > 0;
          break;
        }
        if (!moreRecords || !list?.length || (totalPage && currentPage >= totalPage) || currentPage >= 200) {
          more = false;
          break;
        }
        currentPage += 1;
      }

      const listSorted = sortProducts(all);
      if (reset) {
        setProducts(listSorted);
        setPage(reset ? 1 : currentPage);
      } else {
        setProducts((prev) => sortProducts([...(prev || []), ...listSorted]));
        setPage((p) => p + 1);
      }
      setHasMore(more);
    } catch (e) {
      setErrorDialog('Produk tidak ditemukan');
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = () => {
    if (!msisdn) return;
    setHasChecked(true);
    fetchProducts(true, true);
  };

  const onLoadMore = () => {
    if (!hasChecked || !msisdn) return;
    if (!loading && hasMore && products.length > 0) fetchProducts(false);
  };

  const renderItem = ({ item }) => {
    const name = item?.product_name || item?.name || item?.title || 'Produk';
    const price = item?.price ?? item?.qgrow ?? 0;
    const id = item?.id || item?.product_id;
    const onSelect = () => {
      if (!id) {
        showToast('Produk tidak valid: ID produk tidak tersedia.', 'error');
        return;
      }
      navigation.navigate('PaymentSaldoMitra', {
        kind: 'Data',
        title: name,
        amount: Number(price || 0),
        paymentPayload: {
          product_id: id,
          account_no: msisdn,
          amount: Number(price || 0),
        },
        inquiry: {
          nama: msisdn,
          idpel: msisdn,
          nominal_pokok: Number(price || 0),
          admin: 0,
          denda: 0,
          total_bayar: Number(price || 0),
        },
      });
    };
    return (
      <Pressable
        onPress={onSelect}
        style={({ pressed }) => [{
          backgroundColor: 'white',
          borderRadius: 12,
          borderWidth: 1,
          borderColor: pressed ? Colors.primary : '#e6eef4',
          padding: 10,
          width: '48%',
          marginBottom: 10,
        }]}
      >
        <Text style={{ color: '#0f172a', fontWeight: '700' }} numberOfLines={2}>{name}</Text>
        <Text style={{ color: Colors.primary, marginTop: 4, fontWeight: '400' }}>Harga: {formatIDR(price)}</Text>
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <View style={{ padding: 16 }}>
        <Text style={{ fontSize: 20, fontWeight: '700', color: '#0f172a', marginBottom: 12 }}>Paket Data</Text>
        <View style={cardBox}>
          <Text style={{ fontSize: 12, marginBottom: 6, color: '#334155' }}>Nomor HP</Text>
          <TextInput
            placeholder="Masukkan nomor HP (mis. 089668997397)"
            placeholderTextColor="#94a3b8"
            keyboardType="number-pad"
            value={msisdn}
            onChangeText={setMsisdn}
            onSubmitEditing={onSubmit}
            style={inputStyle}
          />
          <View style={{ height: 12 }} />
          <Pressable
            onPress={onSubmit}
            disabled={disabled}
            style={({ pressed }) => ({
              height: 46,
              backgroundColor: disabled ? '#a3c0d1' : pressed ? '#073d61' : Colors.primary,
              borderRadius: 10,
              alignItems: 'center',
              justifyContent: 'center',
            })}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: 'white', fontWeight: '600' }}>Cek Data</Text>}
          </Pressable>
        </View>
      </View>

      <FlatList
        data={products}
        keyExtractor={(item, idx) => String(item?.id || item?.product_id || item?.sku || idx)}
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={{ justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 8 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.2}
        refreshing={refreshing}
        onRefresh={() => {
          if (!msisdn || !hasChecked) return;
          setRefreshing(true);
          fetchProducts(true, true).finally(() => setRefreshing(false));
        }}
        ListEmptyComponent={() => (
          <View style={{ paddingHorizontal: 4 }}>
            {!loading && (
              <View />
            )}
          </View>
        )}
      />

      <Modal visible={Boolean(errorDialog)} transparent animationType="fade" onRequestClose={() => setErrorDialog('')}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <View style={{ backgroundColor: 'white', borderRadius: 12, borderWidth: 1, borderColor: '#e6eef4', padding: 24, maxWidth: 420, width: '100%' }}>
            <Text style={{ fontSize: 16, color: '#0f172a', fontWeight: '600' }}>Produk tidak ditemukan</Text>
            <Text style={{ color: '#64748b', marginTop: 6 }}>Silakan periksa nomor HP atau coba muat ulang halaman.</Text>
            <View style={{ height: 12 }} />
            <Pressable
              onPress={() => setErrorDialog('')}
              style={({ pressed }) => ({
                height: 44,
                backgroundColor: pressed ? '#073d61' : Colors.primary,
                borderRadius: 10,
                alignItems: 'center',
                justifyContent: 'center',
              })}
            >
              <Text style={{ color: 'white', fontWeight: '600' }}>Tutup</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const cardBox = {
  backgroundColor: 'white',
  borderRadius: 10,
  borderWidth: 1,
  borderColor: '#e6eef4',
  padding: 8,
};

const inputStyle = {
  height: 46,
  borderWidth: 1,
  borderColor: '#dbe5ef',
  borderRadius: 10,
  paddingHorizontal: 12,
  backgroundColor: 'white',
  color: '#0f172a',
};