import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radii, Shadows } from '../theme';

export default function MoreMenuScreen({ navigation }) {
  const items = [
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
      label: 'Laporan',
      icon: 'bar-chart',
      iconColor: '#9C27B0',
      bgColor: '#F3E5F5',
      onPress: () => navigation.navigate('TransactionReport'),
    },
    {
      label: 'Penjualan',
      icon: 'clipboard',
      iconColor: '#009688',
      bgColor: '#E0F2F1',
      onPress: () => navigation.navigate('SalesReport'),
    },
    {
      label: 'Stok',
      icon: 'layers',
      iconColor: '#F44336',
      bgColor: '#FFEBEE',
      onPress: () => navigation.navigate('StockManagement'),
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
      label: 'Profil Akun',
      icon: 'person-circle',
      iconColor: Colors.primary,
      bgColor: '#E3F2FD',
      onPress: () => navigation.navigate('Akun'),
    },
    {
      label: 'Scan Barcode',
      icon: 'scan',
      iconColor: Colors.text,
      bgColor: '#F5F5F5',
      onPress: () => navigation.navigate('Scan'),
    },
    {
      label: 'Top Penjualan',
      icon: 'trending-up',
      iconColor: '#FFC107',
      bgColor: '#FFF8E1',
      onPress: () => navigation.navigate('TopSales'),
    },
  ];

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
          {items.map((item, index) => (
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
          ))}
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
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  menuItem: {
    width: '30%',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  menuIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xs,
    ...Shadows.card,
  },
  menuLabel: {
    fontSize: 13,
    color: Colors.text,
    textAlign: 'center',
  },
});

