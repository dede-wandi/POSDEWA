import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme';

export default function TopSalesMenuScreen({ navigation }) {
  const menuItems = [
    {
      title: 'Top Produk',
      subtitle: 'Produk paling laris terjual',
      icon: 'cube',
      color: '#4CAF50',
      route: 'TopList',
      params: { type: 'product', title: 'Top Produk' }
    },
    {
      title: 'Top Kategori',
      subtitle: 'Kategori dengan penjualan tertinggi',
      icon: 'grid',
      color: '#2196F3',
      route: 'TopList',
      params: { type: 'category', title: 'Top Kategori' }
    },
    {
      title: 'Top Brand',
      subtitle: 'Brand paling diminati',
      icon: 'pricetag',
      color: '#9C27B0',
      route: 'TopList',
      params: { type: 'brand', title: 'Top Brand' }
    },
    {
      title: 'Top Tanggal (Profit)',
      subtitle: 'Tanggal dengan profit tertinggi (1 thn)',
      icon: 'calendar',
      color: '#FF9800',
      route: 'TopList',
      params: { type: 'date', title: 'Top Tanggal (Profit)' }
    },
    {
      title: 'Analisis Profit',
      subtitle: 'Grafik profit bulanan & tahunan',
      icon: 'stats-chart',
      color: '#E91E63',
      route: 'ProfitAnalysis',
      params: {}
    },
    {
      title: 'Analisis Transaksi',
      subtitle: 'Grafik transaksi harian, bulanan & tahunan',
      icon: 'bar-chart',
      color: '#2196F3',
      route: 'TransactionAnalysis',
      params: {}
    }
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Laporan Top Penjualan</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.card}
            onPress={() => navigation.navigate(item.route, item.params)}
          >
            <View style={[styles.iconContainer, { backgroundColor: item.color + '20' }]}>
              <Ionicons name={item.icon} size={28} color={item.color} />
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.muted} />
          </TouchableOpacity>
        ))}
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
    padding: 16,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
  },
  content: {
    padding: 16,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 12,
    color: Colors.muted,
  },
});
