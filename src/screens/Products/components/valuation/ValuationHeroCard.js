import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatIDR } from '../../../../utils/currency';
import { Shadows } from '../../../../theme';

/**
 * KPI Hero Card displaying total physical store inventory valuation.
 */
export function ValuationHeroCard({ data }) {
  const {
    totalCostValue = 0,
    totalRetailValue = 0,
    potentialProfit = 0,
    totalStockUnits = 0,
    totalProducts = 0,
  } = data || {};

  return (
    <View style={styles.heroCard}>
      <View style={styles.heroHeader}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={styles.heroLabel}>TOTAL MODAL</Text>
          <Text style={styles.heroValue}>{formatIDR(totalCostValue)}</Text>
          <Text style={styles.heroNotice}>
            ✓ Hanya menghitung Barang Fisik & Voucher Toko (Titipan & Digital tidak menguras modal fisik)
          </Text>
        </View>
        <View style={styles.heroIconBox}>
          <Ionicons name="cube" size={28} color="#FFFFFF" />
        </View>
      </View>

      <View style={styles.heroDivider} />

      <View style={styles.heroGrid}>
        <View style={styles.heroStatItem}>
          <Text style={styles.heroStatLabel}>Estimasi Nilai Jual</Text>
          <Text style={styles.heroStatVal}>{formatIDR(totalRetailValue)}</Text>
        </View>
        <View style={styles.heroStatItem}>
          <Text style={styles.heroStatLabel}>Potensi Keuntungan</Text>
          <Text style={[styles.heroStatVal, { color: '#4ADE80' }]}>
            +{formatIDR(potentialProfit)}
          </Text>
        </View>
        <View style={styles.heroStatItem}>
          <Text style={styles.heroStatLabel}>Total Fisik di Rak Toko</Text>
          <Text style={styles.heroStatVal}>{totalStockUnits.toLocaleString('id-ID')} pcs</Text>
        </View>
        <View style={styles.heroStatItem}>
          <Text style={styles.heroStatLabel}>Total Produk</Text>
          <Text style={styles.heroStatVal}>{totalProducts.toLocaleString('id-ID')} item</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: '#3730A3',
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    ...Shadows.md,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#C7D2FE',
    letterSpacing: 0.5,
  },
  heroValue: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 4,
  },
  heroNotice: {
    fontSize: 10,
    color: '#E0E7FF',
    marginTop: 6,
    lineHeight: 14,
  },
  heroIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginVertical: 14,
  },
  heroGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  heroStatItem: {
    width: '50%',
    marginBottom: 8,
  },
  heroStatLabel: {
    fontSize: 11,
    color: '#E0E7FF',
  },
  heroStatVal: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 2,
  },
});
