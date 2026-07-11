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
  ActivityIndicator,
  Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { getDashboardStats, getRecentSales } from '../services/dashboardSupabase';
import { getMenuConfigs } from '../services/menuConfigSupabase';
import { getDashboardShortcuts } from '../models/Shortcut';
import { Colors, Spacing, Radii, Shadows, FontSize, FontWeight, TextStyles } from '../theme';

const { width } = Dimensions.get('window');

export default function DashboardScreen({ navigation }) {
  const { user, getBusinessName } = useAuth();
  const { showToast } = useToast();
  const [stats, setStats] = useState(null);
  const [recentSales, setRecentSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [menuConfigs, setMenuConfigs] = useState({});
  const [menuErrors, setMenuErrors] = useState({});

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

  const getDynamicGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 11) return 'Selamat Pagi';
    if (hour < 15) return 'Selamat Siang';
    if (hour < 18) return 'Selamat Sore';
    return 'Selamat Malam';
  };

  const loadDashboardData = async () => {
    try {

      // Load dashboard stats
      const statsResult = await getDashboardStats(user?.id);
      if (statsResult.success) {
        setStats(statsResult.data);
      } else {
        showToast('Gagal memuat statistik: ' + statsResult.error, 'error');
      }

      // Load recent sales
      const salesResult = await getRecentSales(user?.id, 5);
      if (salesResult.success) {
        setRecentSales(salesResult.data);
      } else {
      }

      // Load menu configurations
      if (user?.id) {
        const configResult = await getMenuConfigs(user.id);
        if (configResult.success && configResult.data) {
          setMenuConfigs(configResult.data);
          setMenuErrors({}); // Reset error states on reload
        }
      }

    } catch (error) {
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
      activeOpacity={0.7}
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
              color={comparison.isUp ? '#03AC0E' : '#F44336'}
            />
            <Text style={[styles.comparisonText, { color: comparison.isUp ? '#03AC0E' : '#F44336' }]}>
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
      activeOpacity={0.7}
    >
      <View style={styles.saleItemHeader}>
        <View style={styles.invoiceBadge}>
          <Ionicons name="receipt-outline" size={12} color="#4B5563" style={{ marginRight: 4 }} />
          <Text style={styles.saleItemInvoice}>
            {sale.no_invoice || `#${sale.id.substring(0, 8)}`}
          </Text>
        </View>
        <Text style={styles.saleItemDate}>{formatDateString(sale.created_at)}</Text>
      </View>

      <View style={styles.saleItemDetails}>
        <View>
          <Text style={styles.saleItemLabel}>Total Transaksi</Text>
          <Text style={styles.saleItemTotal}>{formatCurrency(sale.total)}</Text>
        </View>
        <View style={styles.profitBadgeContainer}>
          <Text style={styles.saleItemLabelProfit}>Profit</Text>
          <Text style={styles.saleItemProfit}>
            {formatCurrency(sale.profit)}
          </Text>
        </View>
      </View>

      <View style={styles.dividerLine} />

      <View style={styles.saleItemsList}>
        {(() => {
          const items = sale.sale_items || [];
          if (items.length === 0) return <Text style={styles.saleItemCount}>Tidak ada item</Text>;

          if (items.length === 1) {
            return (
              <Text style={styles.saleItemCount} numberOfLines={1}>
                1 Item: {items[0].qty}x {items[0].product_name} ({formatCurrency(items[0].price)})
              </Text>
            );
          }

          return (
            <View>
              <Text style={styles.saleItemCountHeader}>{items.length} Item Terjual:</Text>
              {items.slice(0, 2).map((prod, idx) => (
                <Text key={idx} style={styles.saleItemCount} numberOfLines={1}>
                  • {prod.qty}x {prod.product_name} ({formatCurrency(prod.price)})
                </Text>
              ))}
              {items.length > 2 && (
                <Text style={[styles.saleItemCount, { fontStyle: 'italic', color: '#9CA3AF' }]}>
                  ... dan {items.length - 2} item lainnya
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
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Premium Header */}
      <View style={styles.header}>
        {/* Profile Row */}
        <View style={styles.profileHeaderRow}>
          <TouchableOpacity
            style={styles.profileInfoBlock}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Akun')}
          >
            <View style={styles.headerAvatar}>
              <Text style={styles.headerAvatarText}>
                {getBusinessName()?.charAt(0).toUpperCase() || 'M'}
              </Text>
            </View>
            <View style={styles.greetingColumn}>
              <Text style={styles.greetingSub}>{getDynamicGreeting()}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.businessNameTitle} numberOfLines={1}>
                  {getBusinessName()}
                </Text>
              </View>
            </View>
          </TouchableOpacity>

          <View style={styles.headerIcons}>

            <TouchableOpacity
              style={styles.headerIconButton}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('History')}
            >
              <View>
                <Ionicons name="notifications-outline" size={22} color="#4B5563" />
                {(stats?.today?.transactions || 0) > 0 && (
                  <View style={styles.notiBadge} />
                )}
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Bar Row */}
        <View style={styles.searchBarRow}>
          <TouchableOpacity
            style={styles.searchBar}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Produk', { screen: 'DaftarProduk' })}
          >
            <Ionicons name="search-outline" size={16} color="#9CA3AF" style={{ marginRight: 8 }} />
            <Text style={styles.searchBarText}>Cari produk, transaksi, atau fitur...</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* GoFood/GoPay Wallet Style Financial Card */}
        <View style={styles.walletCard}>
          {/* Left Section: Balance Info */}
          <TouchableOpacity
            style={styles.walletBalanceSection}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('SalesAnalyticsDashboard', { initialTab: 'profit' })}
          >
            <View style={styles.walletBrandRow}>
              <Ionicons name="wallet-outline" size={14} color={Colors.white} style={{ marginRight: 4 }} />
              <Text style={styles.walletBrandName}>{getBusinessName()}</Text>
            </View>
            <Text style={styles.walletBalanceLabel}>Hari Ini</Text>
            <Text style={styles.walletBalanceValue}>{formatCurrency(stats?.today?.profit)}</Text>
            <View style={styles.walletProfitBadge}>
              <Text style={styles.walletProfitLabel}>Bulan Ini: </Text>
              <Text style={styles.walletProfitValue}>{formatCurrency(stats?.month?.profit)}</Text>
            </View>
          </TouchableOpacity>

          {/* Vertical Divider */}
          <View style={styles.walletDivider} />

          {/* Right Section: Action Buttons */}
          <View style={styles.walletActionsSection}>
            <TouchableOpacity
              style={styles.walletActionItem}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('Penjualan')}
            >
              <View style={styles.walletActionIconBg}>
                <Ionicons name="cart" size={18} color={Colors.primary} />
              </View>
              <Text style={styles.walletActionLabel}>Kasir</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.walletActionItem}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('AnnualProfitReport')}
            >
              <View style={styles.walletActionIconBg}>
                <Ionicons name="trending-up" size={18} color={Colors.primary} />
              </View>
              <Text style={styles.walletActionLabel}>Keuangan</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.walletActionItem}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('History')}
            >
              <View style={styles.walletActionIconBg}>
                <Ionicons name="time" size={18} color={Colors.primary} />
              </View>
              <Text style={styles.walletActionLabel}>Riwayat</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Menu Grid (Tokopedia Style Shortcuts) */}
        <View style={styles.menuContainer}>
          <View style={styles.menuGrid}>
            {getDashboardShortcuts().map((item) => (
              <TouchableOpacity
                key={item.key}
                style={styles.menuItem}
                onPress={() => item.onPress(navigation)}
                activeOpacity={0.7}
              >
                <View style={styles.menuIconWrapper}>
                  {item.renderIcon(menuConfigs, menuErrors, setMenuErrors)}
                  {item.badgeText && (
                    <View style={[
                      styles.badgeContainer,
                      { backgroundColor: item.badgeText === 'HOT' ? '#FF3B30' : '#FF9500' }
                    ]}>
                      <Text style={styles.badgeText}>{item.badgeText}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.menuLabel}>{item.label}</Text>
              </TouchableOpacity>
            ))}
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
                  activeOpacity={0.7}
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
              activeOpacity={0.7}
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
  header: {
    backgroundColor: Colors.card,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  profileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  profileInfoBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 16,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  headerAvatarText: {
    color: Colors.white,
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.bold,
  },
  greetingColumn: {
    flex: 1,
  },
  greetingSub: {
    fontSize: FontSize.sm,
    color: Colors.muted,
    fontWeight: FontWeight.medium,
    marginBottom: 1,
  },
  businessNameTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginRight: 6,
  },
  searchBarRow: {
    width: '100%',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.lightBg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  searchBarText: {
    fontSize: FontSize.caption,
    color: Colors.placeholder,
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconButton: {
    paddingHorizontal: Spacing.sm,
    position: 'relative',
  },
  notiBadge: {
    position: 'absolute',
    top: -1,
    right: 2,
    backgroundColor: Colors.danger,
    borderRadius: 4,
    width: 8,
    height: 8,
    borderWidth: 1,
    borderColor: Colors.white,
  },
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    borderRadius: Radii.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
  },
  memberBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  comparisonContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  comparisonLabel: {
    fontSize: FontSize.xs,
    color: Colors.placeholder,
  },
  comparisonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radii.sm,
  },
  comparisonText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    marginLeft: 2,
  },
  section: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  seeAllText: {
    fontSize: FontSize.caption,
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: Radii.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.card,
  },
  statCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  iconBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statCardTitle: {
    fontSize: FontSize.caption,
    color: Colors.muted,
    marginLeft: 6,
    fontWeight: FontWeight.semibold,
  },
  statCardValue: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginTop: 8,
    marginBottom: 2,
  },
  statCardSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.muted,
  },
  alertCard: {
    backgroundColor: Colors.dangerLight,
    borderRadius: Radii.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#FED7D7',
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  alertTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: '#E53E3E',
    marginLeft: 6,
  },
  alertText: {
    fontSize: FontSize.caption,
    color: '#C53030',
  },
  alertButton: {
    backgroundColor: '#E53E3E',
    borderRadius: Radii.xs,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  alertButtonText: {
    color: Colors.white,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  saleItem: {
    backgroundColor: Colors.card,
    borderRadius: Radii.md,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.card,
  },
  saleItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  invoiceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.lightBg,
    borderRadius: Radii.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  saleItemInvoice: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
  },
  saleItemDate: {
    fontSize: FontSize.xs,
    color: Colors.muted,
  },
  saleItemDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  saleItemLabel: {
    fontSize: FontSize.xxs,
    color: Colors.muted,
    marginBottom: 1,
  },
  saleItemTotal: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  profitBadgeContainer: {
    alignItems: 'flex-end',
  },
  saleItemLabelProfit: {
    fontSize: FontSize.xxs,
    color: Colors.muted,
    marginBottom: 1,
    textAlign: 'right',
  },
  saleItemProfit: {
    fontSize: FontSize.caption,
    color: Colors.warning,
    fontWeight: FontWeight.semibold,
  },
  dividerLine: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: 6,
  },
  saleItemsList: {
    marginTop: 1,
  },
  saleItemCountHeader: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  saleItemCount: {
    fontSize: FontSize.xs,
    color: Colors.muted,
    marginTop: 1,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyStateText: {
    fontSize: FontSize.body,
    color: Colors.muted,
    marginTop: 8,
  },
  menuContainer: {
    paddingHorizontal: Spacing.lg,
    marginTop: 14,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderRadius: Radii.lg,
    paddingTop: 18,
    paddingBottom: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.card,
  },
  menuItem: {
    width: '25%',
    alignItems: 'center',
    marginBottom: 14,
  },
  menuLabel: {
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontWeight: FontWeight.semibold,
    marginTop: 2,
  },
  walletCard: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: Spacing.lg,
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primaryDark,
  },
  walletBalanceSection: {
    flex: 1.2,
  },
  walletBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  walletBrandName: {
    color: Colors.white,
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
    fontFamily: 'Poppins',
  },
  walletBalanceLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: FontSize.sm,
    fontFamily: 'Poppins',
    marginBottom: 2,
  },
  walletBalanceValue: {
    color: Colors.white,
    fontSize: FontSize.h3,
    fontWeight: FontWeight.extrabold,
    fontFamily: 'Poppins',
    lineHeight: 24,
  },
  walletProfitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  walletProfitLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: FontSize.xs,
    fontFamily: 'Poppins',
  },
  walletProfitValue: {
    color: '#FFE082',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    fontFamily: 'Poppins',
  },
  walletDivider: {
    width: 1,
    height: 55,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: 10,
  },
  walletActionsSection: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  walletActionItem: {
    alignItems: 'center',
    flex: 1,
  },
  walletActionIconBg: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  walletActionLabel: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: FontWeight.bold,
    fontFamily: 'Poppins',
    textAlign: 'center',
  },
  menuIconWrapper: {
    position: 'relative',
    marginBottom: 6,
  },
  badgeContainer: {
    position: 'absolute',
    top: -6,
    right: -10,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    zIndex: 10,
    borderWidth: 1.5,
    borderColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: Colors.white,
    fontSize: 8,
    fontWeight: FontWeight.extrabold,
  },
});
