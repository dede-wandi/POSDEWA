import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Dimensions,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { getDashboardStats, getRecentSales } from '../services/dashboardSupabase';
import { Colors, Spacing, Radii, Shadows } from '../theme';

const { width } = Dimensions.get('window');
const GRAB_GREEN = '#00B14F';

export default function DashboardScreen({ navigation }) {
  const { user, getBusinessName } = useAuth();
  const { showToast } = useToast();
  const [stats, setStats] = useState(null);
  const [recentSales, setRecentSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDashboardDate = (date) => {
    return date.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatDashboardTime = (date) => {
    return date.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  };

  const loadDashboardData = async () => {
    try {
      console.log('📊 DashboardScreen: Loading dashboard data...');
      
      // Load dashboard stats
      const statsResult = await getDashboardStats(user?.id);
      if (statsResult.success) {
        setStats(statsResult.data);
      } else {
        console.log('❌ DashboardScreen: Error loading stats:', statsResult.error);
        showToast('Gagal memuat statistik: ' + statsResult.error, 'error');
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
      showToast('Terjadi kesalahan saat memuat data', 'error');
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

  const formatDateString = (dateString) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const StatCard = ({ title, value, subtitle, icon, color = Colors.primary, onPress, comparison }) => (
    <TouchableOpacity
      style={styles.statCard}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.85}
    >
      <View style={styles.statCardHeader}>
        <View style={[styles.iconBadge, { backgroundColor: `${color}15` }]}> 
          <Ionicons name={icon} size={18} color={color} />
        </View>
        <Text style={styles.statCardTitle}>{title}</Text>
      </View>
      <Text style={styles.statCardValue}>{value}</Text>
      {subtitle && <Text style={styles.statCardSubtitle}>{subtitle}</Text>}
      {comparison && (
        <View style={styles.comparisonContainer}>
           <Text style={styles.comparisonLabel}>
             {comparison.label}: {comparison.value}
           </Text>
           <View style={[styles.comparisonBadge, { backgroundColor: comparison.isUp ? '#E8F5E9' : '#FFEBEE' }]}>
             <Ionicons 
                name={comparison.isUp ? "arrow-up" : "arrow-down"} 
                size={10} 
                color={comparison.isUp ? '#4CAF50' : '#F44336'} 
             />
             <Text style={[styles.comparisonText, { color: comparison.isUp ? '#4CAF50' : '#F44336' }]}>
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
        <Text style={styles.saleItemDate}>{formatDateString(sale.created_at)}</Text>
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
          <ActivityIndicator size="large" color={GRAB_GREEN} />
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
              <Ionicons name="storefront" size={20} color="#fff" />
            </View>
            <View style={styles.shopInfo}>
              <Text style={styles.shopName}>{getBusinessName()}</Text>
              <Text style={styles.shopSubtitle}>
                {formatDashboardDate(currentDateTime)} • {formatDashboardTime(currentDateTime)}
              </Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity 
              style={styles.headerIconButton} 
              activeOpacity={0.8}
              onPress={() => navigation.navigate('AIAssistant')}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={22} color={GRAB_GREEN} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.headerIconButton} 
              activeOpacity={0.8}
              onPress={() => navigation.navigate('History')}
            >
              <View>
                <Ionicons name="notifications-outline" size={22} color="#1C1C1E" />
                {(stats?.today?.transactions || 0) > 0 && (
                  <View style={{
                    position: 'absolute',
                    top: -2,
                    right: -2,
                    backgroundColor: '#FF3B30',
                    borderRadius: 5,
                    width: 10,
                    height: 10,
                    borderWidth: 1.5,
                    borderColor: '#FFFFFF'
                  }} />
                )}
              </View>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.headerIconButton} 
              activeOpacity={0.8}
              onPress={() => navigation.navigate('Akun')}
            >
              <Ionicons name="person-circle-outline" size={26} color={GRAB_GREEN} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Menu Grid */}
        <View style={styles.menuContainer}>
          <View style={styles.menuGrid}>
            <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Penjualan')} activeOpacity={0.85}>
              <View style={[styles.menuIcon, { backgroundColor: '#3078F0' }]}>
                <Ionicons name="cart" size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.menuLabel}>Kasir</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Produk', { screen: 'DaftarProduk' })} activeOpacity={0.85}>
              <View style={[styles.menuIcon, { backgroundColor: '#00B14F' }]}>
                <Ionicons name="cube" size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.menuLabel}>Produk</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Produk', { screen: 'PublicProductsAdmin' })} activeOpacity={0.85}>
              <View style={[styles.menuIcon, { backgroundColor: '#9C27B0' }]}>
                <Ionicons name="globe" size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.menuLabel}>Produk Publik</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('History')} activeOpacity={0.85}>
              <View style={[styles.menuIcon, { backgroundColor: '#FF9500' }]}>
                <Ionicons name="time" size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.menuLabel}>Riwayat</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Scan')} activeOpacity={0.85}>
              <View style={[styles.menuIcon, { backgroundColor: '#5E5E5E' }]}>
                <Ionicons name="scan" size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.menuLabel}>Barcode</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('StockManagement')} activeOpacity={0.85}>
              <View style={[styles.menuIcon, { backgroundColor: '#FF3B30' }]}>
                <Ionicons name="layers" size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.menuLabel}>Stok</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('SalesReport')} activeOpacity={0.85}>
              <View style={[styles.menuIcon, { backgroundColor: '#009688' }]}>
                <Ionicons name="clipboard" size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.menuLabel}>Penjualan</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('MoreMenu')} activeOpacity={0.85}>
              <View style={[styles.menuIcon, { backgroundColor: '#5856D6' }]}>
                <Ionicons name="grid" size={24} color="#FFFFFF" />
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
              color="#4CAF50"
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
              color="#FF9500"
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
              color={GRAB_GREEN}
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
              color="#5856D6"
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
                  <Ionicons name="warning" size={20} color="#FF3B30" />
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
    backgroundColor: '#F2F2F7',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  shopBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: GRAB_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    shadowColor: GRAB_GREEN,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  shopInfo: {
    flex: 1,
  },
  shopName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  shopSubtitle: {
    marginTop: 4,
    fontSize: 11,
    color: '#8E8E93',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconButton: {
    paddingHorizontal: 6,
  },
  comparisonContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f2f2f7',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  comparisonLabel: {
    fontSize: 10,
    color: '#8E8E93',
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
    marginTop: 20,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 12,
  },
  seeAllText: {
    fontSize: 14,
    color: GRAB_GREEN,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  statCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statCardTitle: {
    fontSize: 13,
    color: '#8E8E93',
    marginLeft: 8,
    fontWeight: '600',
  },
  statCardValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1C1C1E',
    marginTop: 10,
    marginBottom: 4,
  },
  statCardSubtitle: {
    fontSize: 11,
    color: '#8E8E93',
  },
  alertCard: {
    backgroundColor: '#FFF2F2',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FFE0E0',
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30',
    marginLeft: 8,
  },
  alertText: {
    fontSize: 14,
    color: '#FF3B30',
  },
  alertButton: {
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  alertButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  saleItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  saleItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  saleItemInvoice: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  saleItemDate: {
    fontSize: 10,
    color: '#8E8E93',
  },
  saleItemDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  saleItemTotal: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  saleItemProfit: {
    fontSize: 10,
    color: '#FF9500',
    fontWeight: '500',
  },
  saleItemCount: {
    fontSize: 10,
    color: '#8E8E93',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 12,
  },
  menuContainer: {
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingTop: 20,
    paddingBottom: 4,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 3,
  },
  menuItem: {
    width: '25%',
    alignItems: 'center',
    marginBottom: 16,
  },
  menuIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  menuLabel: {
    fontSize: 12,
    color: '#1C1C1E',
    textAlign: 'center',
    fontWeight: '600',
  },
});
