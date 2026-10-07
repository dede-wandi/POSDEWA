import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/**
 * Reusable Type Badge for products (Fisik, Titipan, Digital, Voucher, Jasa).
 */
export function TypeBadge({ item }) {
  if (item.isConsignment) {
    return (
      <View style={styles.badgeConsignment}>
        <Text style={styles.badgeConsignmentText}>🤝 Titipan</Text>
      </View>
    );
  }
  if (item.productType === 'digital') {
    return (
      <View style={styles.badgeDigital}>
        <Text style={styles.badgeDigitalText}>⚡ Digital/PPOB</Text>
      </View>
    );
  }
  if (item.productType === 'voucher') {
    return (
      <View style={styles.badgeVoucher}>
        <Text style={styles.badgeVoucherText}>🎟️ Voucher</Text>
      </View>
    );
  }
  if (item.productType === 'financial_service') {
    return (
      <View style={styles.badgeService}>
        <Text style={styles.badgeServiceText}>💳 Jasa/Admin</Text>
      </View>
    );
  }
  return (
    <View style={styles.badgePhysical}>
      <Text style={styles.badgePhysicalText}>📦 Fisik Toko</Text>
    </View>
  );
}

/**
 * Reusable Stock Condition Pill for table and cards.
 */
export function StockPill({ item, isSmall = false }) {
  if (!item.isPhysicalStock) {
    return (
      <View style={styles.stockPillDigital}>
        <Text style={styles.stockPillDigitalText}>
          {item.isDigital ? 'Saldo Server' : 'Jasa/Kas'}
        </Text>
      </View>
    );
  }

  const isOutOfStock = item.isOutOfStock;
  const isLowStock = item.isLowStock;

  return (
    <View
      style={[
        styles.stockPill,
        isOutOfStock
          ? styles.stockPillEmpty
          : isLowStock
          ? styles.stockPillLow
          : styles.stockPillSafe,
      ]}
    >
      <Text
        style={[
          styles.stockPillText,
          isSmall && { fontSize: 10 },
          isOutOfStock
            ? styles.stockPillTextEmpty
            : isLowStock
            ? styles.stockPillTextLow
            : styles.stockPillTextSafe,
        ]}
      >
        {item.stockDisplay}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badgePhysical: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgePhysicalText: {
    fontSize: 10,
    color: '#1D4ED8',
    fontWeight: '700',
  },
  badgeConsignment: {
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeConsignmentText: {
    fontSize: 10,
    color: '#7C3AED',
    fontWeight: '700',
  },
  badgeDigital: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeDigitalText: {
    fontSize: 10,
    color: '#B45309',
    fontWeight: '700',
  },
  badgeVoucher: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeVoucherText: {
    fontSize: 10,
    color: '#047857',
    fontWeight: '700',
  },
  badgeService: {
    backgroundColor: '#FDF2F8',
    borderWidth: 1,
    borderColor: '#FBCFE8',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeServiceText: {
    fontSize: 10,
    color: '#BE185D',
    fontWeight: '700',
  },

  stockPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stockPillSafe: {
    backgroundColor: '#ECFDF5',
  },
  stockPillLow: {
    backgroundColor: '#FFFBEB',
  },
  stockPillEmpty: {
    backgroundColor: '#FEF2F2',
  },
  stockPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  stockPillTextSafe: {
    color: '#059669',
  },
  stockPillTextLow: {
    color: '#D97706',
  },
  stockPillTextEmpty: {
    color: '#DC2626',
  },
  stockPillDigital: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  stockPillDigitalText: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
});
