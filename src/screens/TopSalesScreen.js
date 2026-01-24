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

  const loadData = async () => {
    try {
      if (!user?.id) return;
      
      const salesData = await getSalesHistory(user.id);
      
      // Aggregate sales by product
      const productStats = {};
      
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
});
