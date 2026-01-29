import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { getTopProducts, getTopCategories, getTopBrands, getTopDates } from '../../services/topSalesSupabase';
import { getSalesHistory } from '../../services/salesSupabase';
import { formatIDR } from '../../utils/currency';

export default function TopListScreen({ navigation, route }) {
  const { type, title } = route.params;
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [topInsights, setTopInsights] = useState([]);

  const loadData = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      let result = [];
      switch (type) {
        case 'product':
          result = await getTopProducts(user.id);
          break;
        case 'category':
          result = await getTopCategories(user.id);
          break;
        case 'brand':
          result = await getTopBrands(user.id);
          break;
        case 'date':
          result = await getTopDates(user.id);
          break;
        default:
          result = [];
      }
      setData(result);
      
      if (type === 'product') {
        const sales = await getSalesHistory(user.id);
        const insightStats = {};
        sales.forEach(sale => {
          if (sale.items && Array.isArray(sale.items)) {
            sale.items.forEach(item => {
              const key = item.product_name;
              if (!insightStats[key]) {
                insightStats[key] = {
                  name: item.product_name,
                  purchaseCount: 0,
                  qty: 0,
                  amount: 0,
                };
              }
              insightStats[key].purchaseCount += 1;
              insightStats[key].qty += Number(item.qty || 0);
              insightStats[key].amount += Number(item.line_total || 0);
            });
          }
        });
        const sortedInsights = Object.values(insightStats)
          .sort((a, b) => b.purchaseCount - a.purchaseCount)
          .slice(0, 20);
        setTopInsights(sortedInsights);
      } else {
        setTopInsights([]);
      }
    } catch (error) {
      console.error('Error loading top list:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [type, user?.id]);

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
      
      <View style={styles.infoContainer}>
        <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
        <View style={styles.statsRow}>
            {type !== 'date' && (
                <Text style={styles.qtyText}>
                    {item.qty} pcs
                </Text>
            )}
            <Text style={[styles.totalText, type === 'date' && { color: Colors.success }]}>
                {formatIDR(item.total)}
            </Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
      </View>

      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={data}
          renderItem={renderItem}
          keyExtractor={(item, index) => index.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Belum ada data penjualan</Text>
            </View>
          }
          ListFooterComponent={
            type === 'product' && topInsights.length > 0 ? (
              <View style={styles.insightsSection}>
                <Text style={styles.insightsTitle}>Top Insight Performa</Text>
                {topInsights.map((item, idx) => (
                  <View key={`${item.name}-${idx}`} style={styles.insightItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.insightName}>{item.name}</Text>
                      <Text style={styles.insightMeta}>
                        {item.purchaseCount}x dibeli • {item.qty} pcs • {formatIDR(item.amount)}
                      </Text>
                    </View>
                    <Ionicons name="stats-chart" size={18} color={Colors.muted} />
                  </View>
                ))}
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
  },
  itemCard: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  rankContainer: {
    marginRight: 16,
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  topRank: {
    backgroundColor: '#FFD700', // Goldish
  },
  normalRank: {
    backgroundColor: Colors.border,
  },
  rankText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  topRankText: {
    color: '#000',
  },
  normalRankText: {
    color: Colors.text,
  },
  infoContainer: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  qtyText: {
    fontSize: 14,
    color: Colors.muted,
  },
  totalText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.muted,
  },
  insightsSection: {
    marginTop: 16,
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  insightsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
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
