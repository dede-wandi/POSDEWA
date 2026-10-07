import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatIDR } from '../../../../utils/currency';
import { Shadows, Colors } from '../../../../theme';

/**
 * Card displaying statistics for Consignment (Barang Titipan) products.
 */
export function ValuationConsignmentCard({ consignmentStats }) {
  if (!consignmentStats || !consignmentStats.count) {
    return null;
  }

  return (
    <View style={styles.consignmentSummaryCard}>
      <View style={styles.sectionTitleRow}>
        <Ionicons name="hand-right" size={18} color="#8B5CF6" />
        <Text style={styles.sectionTitle}>
          Barang Titipan / Konsinyasi ({consignmentStats.count} Produk)
        </Text>
      </View>
      <Text style={styles.consignmentSummaryNotice}>
        Modal Toko = Rp 0 (Bukan aset modal sendiri). Penjualan dicatat sebagai hutang setor ke pemilik barang & laba komisi toko.
      </Text>

      <View style={styles.consignmentGrid}>
        <View style={styles.consignmentGridItem}>
          <Text style={styles.consignmentGridLabel}>Kewajiban Setor</Text>
          <Text style={[styles.consignmentGridVal, { color: '#7C3AED' }]}>
            {formatIDR(consignmentStats.totalCost)}
          </Text>
          <Text style={styles.consignmentGridHint}>Jika semua laku</Text>
        </View>

        <View style={styles.consignmentGridItem}>
          <Text style={styles.consignmentGridLabel}>Total Nilai Jual</Text>
          <Text style={[styles.consignmentGridVal, { color: '#1E293B' }]}>
            {formatIDR(consignmentStats.totalRetail)}
          </Text>
          <Text style={styles.consignmentGridHint}>{consignmentStats.totalStock} pcs di rak</Text>
        </View>

        <View style={styles.consignmentGridItem}>
          <Text style={styles.consignmentGridLabel}>Potensi Komisi</Text>
          <Text style={[styles.consignmentGridVal, { color: '#D97706' }]}>
            +{formatIDR(consignmentStats.potentialProfit)}
          </Text>
          <Text style={styles.consignmentGridHint}>Cuan bersih toko</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  consignmentSummaryCard: {
    backgroundColor: '#F5F3FF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: '#DDD6FE',
    ...Shadows.sm,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6D28D9',
    marginLeft: 6,
  },
  consignmentSummaryNotice: {
    fontSize: 11,
    color: '#6D28D9',
    marginBottom: 10,
    lineHeight: 15,
  },
  consignmentGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  consignmentGridItem: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    marginHorizontal: 3,
    borderWidth: 1,
    borderColor: '#EDE9FE',
  },
  consignmentGridLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.muted,
  },
  consignmentGridVal: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 4,
  },
  consignmentGridHint: {
    fontSize: 9,
    color: Colors.placeholder,
    marginTop: 2,
  },
});
