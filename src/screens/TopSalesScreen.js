import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Shadows } from '../theme';
import { useAuth } from '../context/AuthContext';
import { getSalesHistory } from '../services/salesSupabase';

export default function TopSalesScreen({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [topProducts, setTopProducts] = useState([]);
  const [topInsights, setTopInsights] = useState([]);

  const loadData = async () => {
    try {
      if (!user?.id) return;
      
      const salesData = await getSalesHistory(user.id);
      
      // Aggregate sales by product
      const productStats = {};
      const insightStats = {};
      
      salesData.forEach(sale => {
        if (sale.items && Array.isArray(sale.items)) {
          sale.items.forEach(item => {
            const key = item.product_name;
            if (!productStats[key]) {
              productStats[key] = {
                name: item.product_name,
                qty: 0,
                total: 0
              };
            }
            productStats[key].qty += (item.qty || 0);
            productStats[key].total += (item.line_total || 0);
            
            if (!insightStats[key]) {
              insightStats[key] = {
                name: item.product_name,
                purchaseCount: 0,
                qty: 0,
                amount: 0,
              };
            }
            insightStats[key].purchaseCount += 1;
            insightStats[key].qty += (item.qty || 0);
            insightStats[key].amount += (item.line_total || 0);
          });
        }
      });

      // Convert to array and sort by quantity descending
      const sortedProducts = Object.values(productStats)
        .sort((a, b) => b.qty - a.qty)
        .map((item, index) => ({
          ...item,
          rank: index + 1
        }));

      setTopProducts(sortedProducts);
      
      const sortedInsights = Object.values(insightStats)
        .sort((a, b) => b.purchaseCount - a.purchaseCount)
        .slice(0, 20);
      setTopInsights(sortedInsights);

    } catch (error) {
      console.error('Error loading top sales:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.id]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const renderItem = ({ item }) => (
    <View style={styles.itemCard}>
      <View style={styles.rankContainer}>
        <View style={[
          styles.rankBadge, 
          item.rank <= 3 ? styles.topRank : styles.normalRank
        ]}>
          <Text style={[
            styles.rankText,
            item.rank <= 3 ? styles.topRankText : styles.normalRankText
          ]}>
            #{item.rank}
          </Text>
        </View>
      </View>
      
      <View style={styles.productInfo}>
        <Text style={styles.productName}>{item.name}</Text>
        <Text style={styles.salesCount}>Terjual: {item.qty} pcs</Text>
      </View>
    </View>
  );
  
  const renderInsightItem = ({ item }) => (
    <View style={styles.insightItem}>
      <View style={{ flex: 1 }}>
        <Text style={styles.insightName}>{item.name}</Text>
        <Text style={styles.insightMeta}>
          {item.purchaseCount}x dibeli • {item.qty} pcs • {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(item.amount)}
        </Text>
      </View>
      <Ionicons name="stats-chart" size={18} color={Colors.muted} />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Top Penjualan</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={topProducts}
          renderItem={renderItem}
          keyExtractor={(item) => item.name}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="stats-chart" size={64} color={Colors.muted} />
              <Text style={styles.emptyText}>Belum ada data penjualan</Text>
            </View>
          }
          ListFooterComponent={
            topInsights.length > 0 ? (
              <View style={styles.insightsSection}>
                <Text style={styles.insightsTitle}>Top Insight Performa</Text>
                <FlatList
                  data={topInsights}
                  renderItem={renderInsightItem}
                  keyExtractor={(item) => item.name}
                  scrollEnabled={false}
                />
              </View>
            ) : null
          }
        />
      )}
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
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: Spacing.md,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 8,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  rankContainer: {
    marginRight: Spacing.md,
  },
  rankBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  topRank: {
    backgroundColor: '#FFF8E1',
    borderWidth: 1,
    borderColor: '#FFC107',
  },
  normalRank: {
    backgroundColor: '#F5F5F5',
  },
  rankText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  topRankText: {
    color: '#FF8F00',
  },
  normalRankText: {
    color: Colors.text,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  salesCount: {
    fontSize: 14,
    color: Colors.muted,
  },
  emptyContainer: {
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
  },
  emptyText: {
    marginTop: Spacing.md,
    fontSize: 16,
    color: Colors.muted,
    textAlign: 'center',
  },
  insightsSection: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.card,
    borderRadius: 8,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  insightsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  insightName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  insightMeta: {
    fontSize: 12,
    color: Colors.muted,
    marginTop: 2,
  },
});
