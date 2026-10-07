import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TypeBadge, StockPill } from './ValuationBadges';
import { formatIDR } from '../../../../utils/currency';
import { Colors, Shadows } from '../../../../theme';

/**
 * Mobile-friendly Card View for Products Valuation.
 */
export function ValuationCardList({ products = [], totalStockUnits = 0, navigation }) {
  return (
    <View style={styles.listSection}>
      <Text style={styles.listCountLabel}>
        Menampilkan {products.length} produk ({totalStockUnits} unit fisik di rak)
      </Text>

      {products.map((p, idx) => (
        <View key={p.id || idx} style={styles.productCard}>
          <View style={styles.productTopRow}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                <Text style={styles.productName} numberOfLines={2}>
                  {p.parentName || p.name}
                </Text>
                {p.variantName ? (
                  <View style={styles.variantChip}>
                    <Text style={styles.variantChipText}>🏷️ {p.variantName}</Text>
                  </View>
                ) : null}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 2 }}>
                <TypeBadge item={p} />
              </View>
              {p.consignorName ? (
                <Text style={styles.consignorNameText}>Penitip: {p.consignorName}</Text>
              ) : null}
            </View>

            <StockPill item={p} />
          </View>

          {/* Price Breakdown Grid */}
          <View style={styles.productDetailsGrid}>
            <View style={styles.prodDetailItem}>
              <Text style={styles.prodDetailLabel}>
                {p.isConsignment
                  ? 'Harga Setor Penitip'
                  : p.isDigital
                  ? 'Harga Modal (Server)'
                  : 'Harga Modal (HPP)'}
              </Text>
              <Text style={styles.prodDetailVal}>{p.formattedCost}</Text>
            </View>

            <View style={styles.prodDetailItem}>
              <Text style={styles.prodDetailLabel}>Harga Jual</Text>
              <Text style={styles.prodDetailVal}>{p.formattedSell}</Text>
            </View>

            <View style={styles.prodDetailItem}>
              <Text style={styles.prodDetailLabel}>
                {p.isConsignment
                  ? 'Modal Toko'
                  : p.isDigital
                  ? 'Modal di Rak'
                  : 'Total Modal di Rak'}
              </Text>
              <Text
                style={[
                  styles.prodDetailVal,
                  {
                    color:
                      p.isConsignment || p.isDigital || p.isService
                        ? '#16A34A'
                        : Colors.primary,
                    fontWeight: '700',
                  },
                ]}
              >
                {p.isConsignment
                  ? 'Rp 0 (Titipan)'
                  : p.isDigital
                  ? 'Rp 0 (Saldo Server)'
                  : p.isService
                  ? 'Rp 0 (Jasa)'
                  : p.formattedStoreCapital}
              </Text>
            </View>

            <View style={styles.prodDetailItem}>
              <Text style={styles.prodDetailLabel}>
                {p.isConsignment
                  ? 'Komisi Bersih Toko'
                  : p.isDigital || p.isService
                  ? 'Profit per Trx'
                  : 'Potensi Profit'}
              </Text>
              <Text
                style={[
                  styles.prodDetailVal,
                  {
                    color: p.isDigital || p.isService ? '#D97706' : Colors.success,
                    fontWeight: '700',
                  },
                ]}
              >
                {p.isDigital || p.isService
                  ? `+${formatIDR(p.profitPerTrx)}`
                  : p.formattedPotentialProfit}
              </Text>
            </View>
          </View>

          {p.isConsignment && (
            <TouchableOpacity
              style={styles.payoutBtn}
              onPress={() => navigation.navigate('Expenses')}
              activeOpacity={0.8}
            >
              <Ionicons name="hand-right-outline" size={14} color="#6D28D9" />
              <Text style={styles.payoutBtnText}>Catat Setoran ke Penitip di Pengeluaran →</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}

      {products.length === 0 && (
        <View style={styles.emptyContainer}>
          <Ionicons name="search" size={40} color={Colors.placeholder} />
          <Text style={styles.emptyText}>Tidak ada produk yang sesuai filter</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  listSection: {
    marginTop: 2,
  },
  listCountLabel: {
    fontSize: 12,
    color: Colors.muted,
    marginBottom: 10,
  },
  productCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadows.sm,
  },
  productTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  productName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  productBarcode: {
    fontSize: 11,
    color: Colors.muted,
    marginLeft: 6,
  },
  consignorNameText: {
    fontSize: 11,
    color: '#7C3AED',
    marginTop: 2,
    fontWeight: '500',
  },
  productDetailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
  },
  prodDetailItem: {
    width: '50%',
    paddingVertical: 3,
  },
  prodDetailLabel: {
    fontSize: 10,
    color: Colors.muted,
  },
  prodDetailVal: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
    marginTop: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.muted,
    marginTop: 8,
  },
  payoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F3FF',
    borderRadius: 10,
    paddingVertical: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  payoutBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6D28D9',
    marginLeft: 6,
  },
  variantChip: {
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  variantChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
});
