import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { getDashboardStats, getRecentSales } from '../services/dashboardSupabase';
import { Colors, Spacing, Radii, Shadows } from '../theme';

const { width } = Dimensions.get('window');

export default function DashboardScreen({ navigation }) {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentSales, setRecentSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboardData = async () => {
    try {
      console.log('📊 DashboardScreen: Loading dashboard data...');
      
      // Load dashboard stats
      const statsResult = await getDashboardStats(user?.id);
      if (statsResult.success) {
        setStats(statsResult.data);
      } else {
        console.log('❌ DashboardScreen: Error loading stats:', statsResult.error);
        Alert.alert('Error', 'Gagal memuat statistik: ' + statsResult.error);
      }

      // Load recent sales
      const salesResult = await getRecentSales(user?.id, 5);
      if (salesResult.success) {
        setRecentSales(salesResult.data);
      } else {
        console.log('❌ DashboardScreen: Error loading recent sales:', salesResult.error);
      }

    } catch (error) {
      console.log('❌ DashboardScreen: Exception loading dashboard data:', error);
      Alert.alert('Error', 'Terjadi kesalahan saat memuat data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [user?.id])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const StatCard = ({ title, value, subtitle, icon, color = Colors.primary, onPress, comparison }) => (
    <TouchableOpacity
      style={[
        styles.statCard,
        { borderColor: Colors.border }
      ]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.85}
    >
      <View style={styles.statCardHeader}>
        <View style={[styles.iconBadge, { backgroundColor: `${color}22` }]}> 
          <Ionicons name={icon} size={20} color={color} />
        </View>
        <Text style={styles.statCardTitle}>{title}</Text>
      </View>
      <Text style={[styles.statCardValue]}>{value}</Text>
      {subtitle && <Text style={styles.statCardSubtitle}>{subtitle}</Text>}
      {comparison && (
        <View style={styles.comparisonContainer}>
           <Text style={styles.comparisonLabel}>
             {comparison.label}: {comparison.value}
           </Text>
           <View style={[styles.comparisonBadge, { backgroundColor: comparison.isUp ? '#E8F5E9' : '#FFEBEE' }]}>
             <Ionicons 
                name={comparison.isUp ? "arrow-up" : "arrow-down"} 
                size={12} 
                color={comparison.isUp ? Colors.success : Colors.danger} 
             />
             <Text style={[styles.comparisonText, { color: comparison.isUp ? Colors.success : Colors.danger }]}>
                {comparison.diff}
             </Text>
           </View>
        </View>
      )}
    </TouchableOpacity>
  );

  const SaleItem = ({ sale }) => (
    <TouchableOpacity 
      style={styles.saleItem}
      onPress={() => navigation.navigate('History')}
    >
      <View style={styles.saleItemHeader}>
        <Text style={styles.saleItemInvoice}>
          {sale.no_invoice || `#${sale.id.substring(0, 8)}`}
        </Text>
        <Text style={styles.saleItemDate}>{formatDate(sale.created_at)}</Text>
      </View>
      <View style={styles.saleItemDetails}>
        <Text style={styles.saleItemTotal}>{formatCurrency(sale.total)}</Text>
        <Text style={styles.saleItemProfit}>
          Profit: {formatCurrency(sale.profit)}
        </Text>
      </View>
      <View style={{ marginTop: 8 }}>
            {(() => {
               const items = sale.sale_items || [];
               if (items.length === 0) return <Text style={styles.saleItemCount}>0 Items</Text>;

               if (items.length === 1) {
                  return (
                     <Text style={styles.saleItemCount}>
                        1 Item : {items[0].qty}x {items[0].product_name} {formatCurrency(items[0].price)}
                     </Text>
                  );
               }

               return (
                  <View>
                     <Text style={styles.saleItemCount}>{items.length} Items :</Text>
                     {items.slice(0, 3).map((prod, idx) => (
                        <Text key={idx} style={[styles.saleItemCount, { marginLeft: 8, marginTop: 2 }]}>
                           - {prod.qty}x {prod.product_name} {formatCurrency(prod.price)}
                        </Text>
                     ))}
                     {items.length > 3 && (
                        <Text style={[styles.saleItemCount, { marginLeft: 8, marginTop: 2 }]}>
                           ... dan {items.length - 3} lainnya
                        </Text>
                     )}
                  </View>
               );
            })()}
          </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Memuat dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.shopBadge}>
              <Ionicons name="bag-handle" size={18} color="#fff" />
            </View>
            <View style={styles.shopInfo}>
              <Text style={styles.shopName}>DEWA STORE</Text>
              <Text style={styles.shopSubtitle}>
                Dashboard Toko
              </Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity 
              style={styles.headerIconButton} 
              activeOpacity={0.8}
              onPress={() => navigation.navigate('History')}
            >
              <View>
                <Ionicons name="notifications-outline" size={20} color={Colors.text} />
                {(stats?.today?.transactions || 0) > 0 && (
                  <View style={{
                    position: 'absolute',
                    top: -2,
                    right: -2,
                    backgroundColor: Colors.danger,
                    borderRadius: 6,
                    width: 10,
                    height: 10,
                    borderWidth: 1,
                    borderColor: Colors.card
                  }} />
                )}
              </View>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.headerIconButton} 
              activeOpacity={0.8}
              onPress={() => navigation.navigate('Akun')}
            >
              <Ionicons name="person-circle" size={26} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Menu Grid */}
        <View style={styles.menuContainer}>
          <View style={styles.menuGrid}>
            <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Penjualan')}>
              <View style={[styles.menuIcon, { backgroundColor: '#E3F2FD' }]}>
                <Ionicons name="cart" size={24} color="#2196F3" />
              </View>
              <Text style={styles.menuLabel}>Kasir</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Produk', { screen: 'DaftarProduk' })}>
              <View style={[styles.menuIcon, { backgroundColor: '#E8F5E9' }]}>
                <Ionicons name="cube" size={24} color="#4CAF50" />
              </View>
              <Text style={styles.menuLabel}>Produk</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Produk', { screen: 'PublicProductsAdmin' })}>
              <View style={[styles.menuIcon, { backgroundColor: '#F3E5F5' }]}>
                <Ionicons name="globe" size={24} color="#9C27B0" />
              </View>
              <Text style={styles.menuLabel}>Produk Publik</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('History')}>
              <View style={[styles.menuIcon, { backgroundColor: '#FFF3E0' }]}>
                <Ionicons name="time" size={24} color="#FF9800" />
              </View>
              <Text style={styles.menuLabel}>Riwayat</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Scan')}>
              <View style={[styles.menuIcon, { backgroundColor: '#F5F5F5' }]}>
                <Ionicons name="scan" size={24} color={Colors.text} />
              </View>
              <Text style={styles.menuLabel}>Barcode</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('StockManagement')}>
              <View style={[styles.menuIcon, { backgroundColor: '#FFEBEE' }]}>
                <Ionicons name="layers" size={24} color="#F44336" />
              </View>
              <Text style={styles.menuLabel}>Stok</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('SalesReport')}>
              <View style={[styles.menuIcon, { backgroundColor: '#E0F2F1' }]}>
                <Ionicons name="clipboard" size={24} color="#009688" />
              </View>
              <Text style={styles.menuLabel}>Penjualan</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('MoreMenu')}>
              <View style={[styles.menuIcon, { backgroundColor: '#E3F2FD' }]}>
                <Ionicons name="grid" size={24} color={Colors.primary} />
              </View>
              <Text style={styles.menuLabel}>More</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Today's Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hari Ini</Text>
          <View style={styles.statsGrid}>
            <StatCard
              title="Total Penjualan"
              value={formatCurrency(stats?.today?.total)}
              subtitle={`${stats?.today?.transactions || 0} transaksi`}
              icon="cash-outline"
              color={Colors.success}
              onPress={() => navigation.navigate('SalesAnalytics', { type: 'sales', period: 'today' })}
              comparison={{
                label: 'Kemarin',
                value: formatCurrency(stats?.today?.yesterdayTotal),
                isUp: (stats?.today?.total || 0) >= (stats?.today?.yesterdayTotal || 0),
                diff: (stats?.today?.yesterdayTotal || 0) > 0 
                  ? `${Math.abs(((stats?.today?.total - stats.today.yesterdayTotal) / stats.today.yesterdayTotal) * 100).toFixed(1)}%`
                  : stats?.today?.total > 0 ? '100%' : '0%'
              }}
            />
            <StatCard
              title="Profit"
              value={formatCurrency(stats?.today?.profit)}
              subtitle="Keuntungan hari ini"
              icon="trending-up-outline"
              color={Colors.warning}
              onPress={() => navigation.navigate('SalesAnalytics', { type: 'profit', period: 'today' })}
              comparison={{
                label: 'Kemarin',
                value: formatCurrency(stats?.today?.yesterdayProfit),
                isUp: (stats?.today?.profit || 0) >= (stats?.today?.yesterdayProfit || 0),
                diff: (stats?.today?.yesterdayProfit || 0) > 0 
                  ? `${Math.abs(((stats?.today?.profit - stats?.today?.yesterdayProfit) / stats?.today?.yesterdayProfit) * 100).toFixed(1)}%`
                  : stats?.today?.profit > 0 ? '100%' : '0%'
              }}
            />
          </View>
        </View>

        {/* Monthly Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bulan Ini</Text>
          <View style={styles.statsGrid}>
            <StatCard
              title="Total Penjualan"
              value={formatCurrency(stats?.month?.total)}
              subtitle={`${stats?.month?.transactions || 0} transaksi`}
              icon="calendar-outline"
              color={Colors.primary}
              onPress={() => navigation.navigate('SalesAnalytics', { type: 'sales', period: 'month' })}
              comparison={{
                label: 'Bulan Lalu',
                value: formatCurrency(stats?.month?.lastMonthTotal),
                isUp: (stats?.month?.total || 0) >= (stats?.month?.lastMonthTotal || 0),
                diff: (stats?.month?.lastMonthTotal || 0) > 0 
                  ? `${Math.abs(((stats?.month?.total - stats.month.lastMonthTotal) / stats.month.lastMonthTotal) * 100).toFixed(1)}%`
                  : stats?.month?.total > 0 ? '100%' : '0%'
              }}
            />
            <StatCard
              title="Profit"
              value={formatCurrency(stats?.month?.profit)}
              subtitle="Keuntungan bulan ini"
              icon="bar-chart-outline"
              color={Colors.secondary}
              onPress={() => navigation.navigate('SalesAnalytics', { type: 'profit', period: 'month' })}
              comparison={{
                label: 'Bulan Lalu',
                value: formatCurrency(stats?.month?.lastMonthProfit),
                isUp: (stats?.month?.profit || 0) >= (stats?.month?.lastMonthProfit || 0),
                diff: (stats?.month?.lastMonthProfit || 0) > 0 
                  ? `${Math.abs(((stats?.month?.profit - stats.month.lastMonthProfit) / stats.month.lastMonthProfit) * 100).toFixed(1)}%`
                  : stats?.month?.profit > 0 ? '100%' : '0%'
              }}
            />
          </View>
        </View>

        {/* Products Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Produk</Text>
          <View style={styles.statsGrid}>
            <StatCard
              title="Total Produk"
              value={stats?.products?.total?.toString() || '0'}
              subtitle="Produk terdaftar"
              icon="cube-outline"
              color="#32D74B"
              onPress={() => navigation.navigate('Produk', { screen: 'DaftarProduk' })}
            />
            <StatCard
              title="Stock Menipis"
              value={stats?.products?.lowStock?.length?.toString() || '0'}
              subtitle="Stock ≤ 5"
              icon="warning-outline"
              color="#FF3B30"
              onPress={() => navigation.navigate('StockManagement')}
            />
          </View>
        </View>

        {/* Low Stock Alert */}
        {stats?.products?.lowStock?.length > 0 && (
          <View style={styles.section}>
            <View style={styles.alertCard}>
              <View style={styles.alertHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="warning" size={20} color={Colors.danger} />
                  <Text style={styles.alertTitle}>Peringatan Stock</Text>
                </View>
                <TouchableOpacity 
                  style={styles.alertButton}
                  onPress={() => navigation.navigate('StockManagement')}
                >
                  <Text style={styles.alertButtonText}>Kelola Stock</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.alertText}>
                {stats.products.lowStock.length} produk memiliki stock menipis
              </Text>
            </View>
        </View>
        )}

        {/* Recent Sales */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Penjualan Terbaru</Text>
            <TouchableOpacity 
              onPress={() => navigation.navigate('History')}
            >
              <Text style={styles.seeAllText}>Lihat Semua</Text>
            </TouchableOpacity>
          </View>
          
          {recentSales.length > 0 ? (
            recentSales.map((sale) => (
              <SaleItem key={sale.id} sale={sale} />
            ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={48} color="#C7C7CC" />
              <Text style={styles.emptyStateText}>Belum ada penjualan hari ini</Text>
            </View>
          )}
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
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: Colors.muted,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  shopBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  shopInfo: {
    flex: 1,
  },
  shopName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  shopSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: Colors.muted,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconButton: {
    paddingHorizontal: 8,
  },
  comparisonContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  comparisonLabel: {
    fontSize: 10,
    color: Colors.muted,
  },
  comparisonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  comparisonText: {
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 2,
  },
  section: {
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  seeAllText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '500',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: Radii.md,
    padding: Spacing.lg,
    borderWidth: 1,
    ...Shadows.card,
  },
  statCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statCardTitle: {
    fontSize: 14,
    color: Colors.muted,
    marginLeft: Spacing.sm,
    fontWeight: '500',
  },
  statCardValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  statCardSubtitle: {
    fontSize: 12,
    color: Colors.muted,
  },
  alertCard: {
    backgroundColor: '#FFF5F5',
    borderRadius: Radii.md,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#DC2626',
    marginLeft: Spacing.sm,
  },
  alertText: {
    fontSize: 14,
    color: '#7F1D1D',
  },
  alertButton: {
    backgroundColor: Colors.danger,
    borderRadius: Radii.sm,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  alertButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  saleItem: {
    backgroundColor: Colors.card,
    borderRadius: Radii.md,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    ...Shadows.card,
  },
  saleItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  saleItemInvoice: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
  },
  saleItemDate: {
    fontSize: 10,
    color: Colors.muted,
  },
  saleItemDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  saleItemTotal: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.success,
  },
  saleItemProfit: {
    fontSize: 10,
    color: Colors.warning,
    fontWeight: '500',
  },
  saleItemCount: {
    fontSize: 10,
    color: Colors.muted,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: Colors.muted,
    marginTop: Spacing.sm,
  },
  menuContainer: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    ...Shadows.card,
  },
  menuItem: {
    width: '23%',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  menuIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  menuLabel: {
    fontSize: 12,
    color: Colors.text,
    textAlign: 'center',
    fontWeight: '500',
  },
});
