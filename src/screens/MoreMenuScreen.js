import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radii, Shadows } from '../theme';
import { useAuth } from '../context/AuthContext';

export default function MoreMenuScreen({ navigation }) {
  const { user } = useAuth();
  
  // Check if user is superadmin
  const isSuperAdmin = user?.id === '9286a3ed-d219-4dab-bfab-aa6e52434540' || user?.email === 'admin@gmail.com';

  const mainItems = [
    {
      label: 'Kasir',
      icon: 'cart',
      iconColor: '#2196F3',
      bgColor: '#E3F2FD',
      onPress: () => navigation.navigate('MainTabs', { screen: 'Penjualan', params: { screen: 'Penjualan' } }),
    },
    {
      label: 'Produk',
      icon: 'cube',
      iconColor: '#4CAF50',
      bgColor: '#E8F5E9',
      onPress: () => navigation.navigate('MainTabs', { screen: 'Produk', params: { screen: 'DaftarProduk' } }),
    },
    {
      label: 'Inject Voucher',
      icon: 'flash',
      iconColor: '#F59E0B',
      bgColor: '#FEF3C7',
      onPress: () => navigation.navigate('InjectVoucher'),
    },
    {
      label: 'Produk Publik',
      icon: 'globe',
      iconColor: '#9C27B0',
      bgColor: '#F3E5F5',
      onPress: () => navigation.navigate('MainTabs', { screen: 'Produk', params: { screen: 'PublicProductsAdmin' } }),
    },
    {
      label: 'Riwayat',
      icon: 'time',
      iconColor: '#FF9800',
      bgColor: '#FFF3E0',
      onPress: () => navigation.navigate('History'),
    },

    {
      label: 'Insight Performa Produk',
      icon: 'stats-chart',
      iconColor: '#607D8B',
      bgColor: '#ECEFF1',
      onPress: () => navigation.navigate('TopList', { type: 'product', title: 'Insight Performa Produk', insightOnly: true }),
    },
    {
      label: 'Penjualan',
      icon: 'clipboard',
      iconColor: '#009688',
      bgColor: '#E0F2F1',
      onPress: () => navigation.navigate('SalesReport'),
    },
    {
      label: 'Laporan Profit / Laba',
      icon: 'bar-chart',
      iconColor: '#8B5CF6',
      bgColor: '#F5F3FF',
      onPress: () => navigation.navigate('AnnualProfitReport'),
    },
    {
      label: 'Stok',
      icon: 'layers',
      iconColor: '#F44336',
      bgColor: '#FFEBEE',
      onPress: () => navigation.navigate('StockManagement'),
    },
    {
      label: 'Valuasi Aset Stok',
      icon: 'pie-chart',
      iconColor: '#4338CA',
      bgColor: '#EEF2FF',
      onPress: () => navigation.navigate('ProductAssetValuation'),
    },
    {
      label: 'Pengeluaran Toko',
      icon: 'wallet',
      iconColor: '#DC2626',
      bgColor: '#FEF2F2',
      onPress: () => navigation.navigate('Expenses'),
    },
    {
      label: 'Rekonsiliasi Kas',
      icon: 'calculator',
      iconColor: '#0284C7',
      bgColor: '#F0F9FF',
      onPress: () => navigation.navigate('CashReconciliation'),
    },
    {
      label: 'Pengaturan Invoice',
      icon: 'document-text',
      iconColor: '#607D8B',
      bgColor: '#ECEFF1',
      onPress: () => navigation.navigate('InvoiceSettings'),
    },

    {
      label: 'Channel Pembayaran',
      icon: 'wallet',
      iconColor: '#3F51B5',
      bgColor: '#E8EAF6',
      onPress: () => navigation.navigate('PaymentChannels'),
    },
    {
      label: 'Scan Barcode',
      icon: 'scan',
      iconColor: Colors.text,
      bgColor: '#F5F5F5',
      onPress: () => navigation.navigate('Scan'),
    },

    {
      label: 'Cek Stok Antigores',
      icon: 'shield-checkmark',
      iconColor: '#607D8B',
      bgColor: '#ECEFF1',
      onPress: () => navigation.navigate('AntiGoresStock'),
    },
    {
      label: 'Top Penjualan',
      icon: 'trending-up',
      iconColor: '#FFC107',
      bgColor: '#FFF8E1',
      onPress: () => navigation.navigate('TopSales'),
    },
    {
      label: 'Profil Akun',
      icon: 'person-circle',
      iconColor: Colors.primary,
      bgColor: '#E3F2FD',
      onPress: () => navigation.navigate('ProfileEdit'),
    },
  ];

  const managementItems = [
    {
      label: 'Keuangan',
      icon: 'cash',
      iconColor: '#4CAF50',
      bgColor: '#E8F5E9',
      onPress: () => navigation.navigate('Finance'),
    }
  ];

  const renderMenuItem = (item, index) => {
    if (item.isEmpty) {
      return <View key={item.id} style={styles.menuItem} />; // Invisible filler
    }
    return (
      <TouchableOpacity
        key={index}
      style={styles.menuItem}
      onPress={item.onPress}
      activeOpacity={0.85}
    >
      <View style={[styles.menuIcon, { backgroundColor: item.bgColor }]}>
        <Ionicons name={item.icon} size={24} color={item.iconColor} />
      </View>
      <Text style={styles.menuLabel}>{item.label}</Text>
    </TouchableOpacity>
    );
  };

  // Fill empty slots so the last row aligns correctly with space-between
  const fillEmptySlots = (items, columns = 4) => {
    const filledItems = [...items];
    const remainder = filledItems.length % columns;
    if (remainder > 0) {
      const emptyCount = columns - remainder;
      for (let i = 0; i < emptyCount; i++) {
        filledItems.push({ isEmpty: true, id: `empty-${i}` });
      }
    }
    return filledItems;
  };

  const filledMainItems = fillEmptySlots(mainItems);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={22} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Menu Lainnya</Text>
        <View style={{ width: 22 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.grid}>
          {filledMainItems.map(renderMenuItem)}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between', // Changed to flex-start for more predictable grid with few items
  },
  section: {
    marginTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: Spacing.md,
    marginLeft: 4,
  },
  menuItem: {
    width: '22%',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  menuIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  menuLabel: {
    fontSize: 11.5,
    color: Colors.text,
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 14,
  },
});
