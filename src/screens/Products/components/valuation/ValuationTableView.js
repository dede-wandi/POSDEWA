import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TypeBadge, StockPill } from './ValuationBadges';
import { formatIDR } from '../../../../utils/currency';
import { Colors, Shadows } from '../../../../theme';

/**
 * Excel Spreadsheet Table Component.
 * Engineered for clean responsive edge-to-edge full width on desktop/tablet
 * while maintaining horizontal scroll for mobile.
 */
export function ValuationTableView({
  products = [],
  summary,
  sortBy,
  sortAsc,
  onSort,
}) {
  const renderSortIcon = (field) => {
    if (sortBy !== field) return null;
    return (
      <Ionicons
        name={sortAsc ? 'caret-up' : 'caret-down'}
        size={12}
        color={Colors.primary}
        style={{ marginLeft: 4 }}
      />
    );
  };

  return (
    <View style={styles.tableWrapperCard}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={true}
        nestedScrollEnabled={true}
        style={styles.tableScrollView}
        contentContainerStyle={styles.tableScrollContent}
      >
        <View style={styles.tableContainer}>
          {/* EXCEL HEADER ROW */}
          <View style={styles.tableHeaderRow}>
            {/* Col 1: No */}
            <View style={[styles.tableCellHeader, styles.colNo]}>
              <Text style={styles.tableHeaderTitle}>#</Text>
            </View>

            {/* Col 2: Produk */}
            <TouchableOpacity
              style={[styles.tableCellHeader, styles.colProduct]}
              onPress={() => onSort('name')}
              activeOpacity={0.7}
            >
              <Text style={styles.tableHeaderTitle}>PRODUK</Text>
              {renderSortIcon('name')}
            </TouchableOpacity>

            {/* Col 3: Tipe */}
            <TouchableOpacity
              style={[styles.tableCellHeader, styles.colType]}
              onPress={() => onSort('productType')}
              activeOpacity={0.7}
            >
              <Text style={styles.tableHeaderTitle}>TIPE</Text>
              {renderSortIcon('productType')}
            </TouchableOpacity>

            {/* Col 4: Stock */}
            <TouchableOpacity
              style={[styles.tableCellHeader, styles.colStock]}
              onPress={() => onSort('stock')}
              activeOpacity={0.7}
            >
              <Text style={styles.tableHeaderTitle}>STOCK</Text>
              {renderSortIcon('stock')}
            </TouchableOpacity>

            {/* Col 5: Harga Modal (HPP) */}
            <TouchableOpacity
              style={[styles.tableCellHeader, styles.colCost]}
              onPress={() => onSort('costPrice')}
              activeOpacity={0.7}
            >
              <Text style={styles.tableHeaderTitle}>HARGA MODAL (HPP)</Text>
              {renderSortIcon('costPrice')}
            </TouchableOpacity>

            {/* Col 6: Harga Jual */}
            <TouchableOpacity
              style={[styles.tableCellHeader, styles.colSell]}
              onPress={() => onSort('sellPrice')}
              activeOpacity={0.7}
            >
              <Text style={styles.tableHeaderTitle}>HARGA JUAL</Text>
              {renderSortIcon('sellPrice')}
            </TouchableOpacity>

            {/* Col 7: Total Modal Item */}
            <TouchableOpacity
              style={[styles.tableCellHeader, styles.colTotalCost]}
              onPress={() => onSort('storeItemCapital')}
              activeOpacity={0.7}
            >
              <Text style={styles.tableHeaderTitle}>MODAL DI RAK</Text>
              {renderSortIcon('storeItemCapital')}
            </TouchableOpacity>

            {/* Col 8: Potensi Profit */}
            <TouchableOpacity
              style={[styles.tableCellHeader, styles.colProfit]}
              onPress={() => onSort('itemPotentialProfit')}
              activeOpacity={0.7}
            >
              <Text style={styles.tableHeaderTitle}>POTENSI PROFIT</Text>
              {renderSortIcon('itemPotentialProfit')}
            </TouchableOpacity>

            {/* Col 9: Total Nilai Jual (Border right: 0 to flush seamlessly against card edge) */}
            <TouchableOpacity
              style={[styles.tableCellHeader, styles.colTotalRetail]}
              onPress={() => onSort('totalItemRetail')}
              activeOpacity={0.7}
            >
              <Text style={styles.tableHeaderTitle}>TOTAL NILAI JUAL</Text>
              {renderSortIcon('totalItemRetail')}
            </TouchableOpacity>
          </View>

          {/* TOTAL SUMMARY ROW (PINNED AT THE TOP FOR EASY IMMEDIATE VIEWING) */}
          {products.length > 0 && summary && (
            <View style={styles.tableFooterRow}>
              {/* Col 1: Icon */}
              <View style={[styles.tableCellFooter, styles.colNo]}>
                <Ionicons name="calculator-outline" size={14} color="#1E293B" />
              </View>

              {/* Col 2: TOTAL Label */}
              <View style={[styles.tableCellFooter, styles.colProduct]}>
                <Text style={styles.footerLabelText}>
                  TOTAL ({summary.count} Item)
                </Text>
              </View>

              {/* Col 3: Type Breakdown */}
              <View style={[styles.tableCellFooter, styles.colType]}>
                <Text style={styles.footerSubText}>
                  {summary.physicalCount} Fisik
                </Text>
              </View>

              {/* Col 4: Total Stock */}
              <View style={[styles.tableCellFooter, styles.colStock]}>
                <Text style={styles.footerStockText}>
                  {summary.totalStock.toLocaleString('id-ID')} pcs
                </Text>
                <Text style={styles.footerSubText}>Fisik di rak</Text>
              </View>

              {/* Col 5: Cost Placeholder */}
              <View style={[styles.tableCellFooter, styles.colCost]}>
                <Text style={styles.footerDashText}>-</Text>
              </View>

              {/* Col 6: Sell Placeholder */}
              <View style={[styles.tableCellFooter, styles.colSell]}>
                <Text style={styles.footerDashText}>-</Text>
              </View>

              {/* Col 7: Total Modal Toko */}
              <View style={[styles.tableCellFooter, styles.colTotalCost]}>
                <Text style={styles.footerTotalCostText}>
                  {formatIDR(summary.totalStoreCost)}
                </Text>
                <Text style={styles.footerSubText}>
                  Modal Fisik Toko
                </Text>
                {summary.totalConsignmentCost > 0 && (
                  <Text style={styles.footerConsignmentCostText}>
                    +Setor: {formatIDR(summary.totalConsignmentCost)}
                  </Text>
                )}
              </View>

              {/* Col 8: Total Potensi Profit */}
              <View style={[styles.tableCellFooter, styles.colProfit]}>
                <Text style={styles.footerProfitText}>
                  +{formatIDR(summary.totalProfit)}
                </Text>
              </View>

              {/* Col 9: Total Nilai Jual */}
              <View style={[styles.tableCellFooter, styles.colTotalRetail]}>
                <Text style={styles.footerRetailText}>
                  {formatIDR(summary.totalRetail)}
                </Text>
              </View>
            </View>
          )}

          {/* EXCEL TABLE ROWS */}
          {products.map((p, idx) => {
            const isOutOfStock = p.isOutOfStock;
            const isEven = idx % 2 === 0;
            const hasMultiVariants = Boolean(
              (p.hasVariants || p.hasVariant) &&
              Array.isArray(p.variants) &&
              p.variants.length > 0
            );

            return (
              <React.Fragment key={p.id || idx}>
                {/* Main / Parent Product Row */}
                <View
                  style={[
                    styles.tableRow,
                    isEven ? styles.tableRowEven : styles.tableRowOdd,
                    isOutOfStock && styles.tableRowEmpty,
                    hasMultiVariants && styles.tableRowParent,
                  ]}
                >
                  {/* Col 1: No */}
                  <View style={[styles.tableCell, styles.colNo]}>
                    <Text style={styles.cellNoText}>{idx + 1}</Text>
                  </View>

                  {/* Col 2: Produk */}
                  <View style={[styles.tableCell, styles.colProduct]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                      <Text style={[styles.cellProductName, hasMultiVariants && { fontWeight: '700' }]} numberOfLines={2}>
                        {p.parentName || p.name}
                      </Text>
                      {hasMultiVariants && (
                        <View style={styles.parentVariantBadge}>
                          <Text style={styles.parentVariantBadgeText}>Total {p.variants.length} Varian</Text>
                        </View>
                      )}
                    </View>
                    {p.variantName && !hasMultiVariants ? (
                      <View style={styles.variantChip}>
                        <Text style={styles.variantChipText}>🏷️ Varian: {p.variantName}</Text>
                      </View>
                    ) : null}
                    {p.consignorName ? (
                      <Text style={styles.cellConsignorText}>Penitip: {p.consignorName}</Text>
                    ) : null}
                  </View>

                  {/* Col 3: Tipe */}
                  <View style={[styles.tableCell, styles.colType]}>
                    <TypeBadge item={p} />
                  </View>

                  {/* Col 4: Stock */}
                  <View style={[styles.tableCell, styles.colStock]}>
                    <StockPill item={p} />
                  </View>

                  {/* Col 5: Harga Modal (HPP) */}
                  <View style={[styles.tableCell, styles.colCost]}>
                    <Text style={[styles.cellCostText, hasMultiVariants && { fontWeight: '700' }]}>{p.formattedCost}</Text>
                    {p.isConsignment && (
                      <Text style={styles.cellSubHint}>(Wajib Setor)</Text>
                    )}
                    {p.isDigital && (
                      <Text style={[styles.cellSubHint, { color: '#D97706' }]}>(Potong Saldo)</Text>
                    )}
                  </View>

                  {/* Col 6: Harga Jual */}
                  <View style={[styles.tableCell, styles.colSell]}>
                    <Text style={[styles.cellSellText, hasMultiVariants && { fontWeight: '700' }]}>{p.formattedSell}</Text>
                  </View>

                  {/* Col 7: Total Modal Item */}
                  <View style={[styles.tableCell, styles.colTotalCost]}>
                    {p.isConsignment ? (
                      <>
                        <Text style={styles.cellModalTitipanText}>Rp 0</Text>
                        <Text style={styles.cellModalTitipanSub}>
                          Setor: {formatIDR(p.totalItemCost)}
                        </Text>
                      </>
                    ) : p.isDigital ? (
                      <>
                        <Text style={styles.cellModalDigitalText}>Rp 0</Text>
                        <Text style={styles.cellModalDigitalSub}>(Saldo Server)</Text>
                      </>
                    ) : p.isService ? (
                      <>
                        <Text style={styles.cellModalDigitalText}>Rp 0</Text>
                        <Text style={styles.cellModalDigitalSub}>(Jasa Admin)</Text>
                      </>
                    ) : (
                      <Text style={[styles.cellTotalCostText, hasMultiVariants && { fontWeight: '800' }]}>
                        {p.formattedStoreCapital}
                      </Text>
                    )}
                  </View>

                  {/* Col 8: Potensi Profit */}
                  <View style={[styles.tableCell, styles.colProfit]}>
                    {p.isDigital || p.isService ? (
                      <>
                        <Text style={[styles.cellProfitText, { color: '#D97706' }]}>
                          +{formatIDR(p.profitPerTrx)}
                        </Text>
                        <Text style={[styles.cellProfitSubText, { color: '#B45309' }]}>
                          per transaksi
                        </Text>
                      </>
                    ) : (
                      <Text style={[styles.cellProfitText, hasMultiVariants && { fontWeight: '800' }]}>
                        {p.formattedPotentialProfit}
                      </Text>
                    )}
                  </View>

                  {/* Col 9: Total Nilai Jual */}
                  <View style={[styles.tableCell, styles.colTotalRetail]}>
                    {p.isDigital || p.isService ? (
                      <>
                        <Text style={[styles.cellTotalRetailText, { color: '#94A3B8' }]}>
                          -
                        </Text>
                        <Text style={[styles.cellSubHint, { color: '#64748B' }]}>
                          (Real-time)
                        </Text>
                      </>
                    ) : (
                      <Text style={[styles.cellTotalRetailText, hasMultiVariants && { fontWeight: '800' }]}>
                        {p.formattedTotalRetail}
                      </Text>
                    )}
                  </View>
                </View>

                {/* Sub-rows: Rincian Varian di Bawahnya */}
                {hasMultiVariants &&
                  p.variants.map((v, vIdx) => {
                    const isVarEmpty = v.stock === 0;
                    return (
                      <View
                        key={v.id || `${p.id}-var-${vIdx}`}
                        style={[
                          styles.tableRow,
                          styles.tableRowVariant,
                          isVarEmpty && styles.tableRowEmpty,
                        ]}
                      >
                        {/* Col 1: Sub No */}
                        <View style={[styles.tableCell, styles.colNo, styles.variantCell]}>
                          <Text style={styles.variantSubIndexText}>
                            {idx + 1}.{vIdx + 1}
                          </Text>
                        </View>

                        {/* Col 2: Varian */}
                        <View style={[styles.tableCell, styles.colProduct, styles.variantCell]}>
                          <View style={styles.variantNameRow}>
                            <Text style={styles.variantTreeIcon}>↳</Text>
                            <View style={styles.variantNamePill}>
                              <Text style={styles.variantNameText}>Varian: {v.variantName}</Text>
                            </View>
                          </View>
                        </View>

                        {/* Col 3: Tipe */}
                        <View style={[styles.tableCell, styles.colType, styles.variantCell]}>
                          <View style={styles.variantTypeBadge}>
                            <Text style={styles.variantTypeBadgeText}>🏷️ Varian</Text>
                          </View>
                        </View>

                        {/* Col 4: Stock */}
                        <View style={[styles.tableCell, styles.colStock, styles.variantCell]}>
                          <View
                            style={[
                              styles.variantStockBadge,
                              v.stock === 0
                                ? styles.stockEmptyBadge
                                : v.stock <= 5
                                ? styles.stockLowBadge
                                : styles.stockSafeBadge,
                            ]}
                          >
                            <Text
                              style={[
                                styles.variantStockBadgeText,
                                v.stock === 0
                                  ? styles.stockEmptyText
                                  : v.stock <= 5
                                  ? styles.stockLowText
                                  : styles.stockSafeText,
                              ]}
                            >
                              {v.stock} pcs
                            </Text>
                          </View>
                        </View>

                        {/* Col 5: Harga Modal (HPP) */}
                        <View style={[styles.tableCell, styles.colCost, styles.variantCell]}>
                          <Text style={styles.variantNumberText}>{formatIDR(v.costPrice)}</Text>
                        </View>

                        {/* Col 6: Harga Jual */}
                        <View style={[styles.tableCell, styles.colSell, styles.variantCell]}>
                          <Text style={styles.variantNumberText}>{formatIDR(v.sellPrice)}</Text>
                        </View>

                        {/* Col 7: Total Modal Item */}
                        <View style={[styles.tableCell, styles.colTotalCost, styles.variantCell]}>
                          <Text style={styles.variantNumberText}>
                            {formatIDR(p.isConsignment || p.isDigital || p.isService ? 0 : v.totalItemCost)}
                          </Text>
                        </View>

                        {/* Col 8: Potensi Profit */}
                        <View style={[styles.tableCell, styles.colProfit, styles.variantCell]}>
                          <Text style={[styles.variantNumberText, { color: Colors.success, fontWeight: '700' }]}>
                            +{formatIDR(v.itemPotentialProfit)}
                          </Text>
                        </View>

                        {/* Col 9: Total Nilai Jual */}
                        <View style={[styles.tableCell, styles.colTotalRetail, styles.variantCell]}>
                          <Text style={styles.variantNumberText}>
                            {formatIDR(v.totalItemRetail)}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
              </React.Fragment>
            );
          })}

          {products.length === 0 && (
            <View style={styles.emptyTableBox}>
              <Ionicons name="search" size={36} color={Colors.placeholder} />
              <Text style={styles.emptyTableText}>
                Tidak ada produk yang cocok dengan pencarian/filter
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  tableWrapperCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    overflow: 'hidden',
    marginBottom: 20,
    ...Shadows.sm,
  },
  tableScrollView: {
    width: '100%',
  },
  tableScrollContent: {
    minWidth: '100%',
    flexGrow: 1,
  },
  tableContainer: {
    width: '100%',
    minWidth: 980,
    flex: 1,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: '#E2E8F0',
    borderBottomWidth: 1.5,
    borderBottomColor: '#94A3B8',
  },
  tableCellHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRightWidth: 1,
    borderRightColor: '#CBD5E1',
    backgroundColor: '#F1F5F9',
  },
  tableHeaderTitle: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#334155',
    letterSpacing: 0.2,
  },

  // Responsive Column Widths & Distribution
  colNo: {
    width: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colProduct: {
    flex: 2,
    minWidth: 170,
    justifyContent: 'flex-start',
  },
  colType: {
    width: 105,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colStock: {
    width: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colCost: {
    flex: 1,
    minWidth: 110,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  },
  colSell: {
    flex: 1,
    minWidth: 105,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  },
  colTotalCost: {
    flex: 1.1,
    minWidth: 120,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  },
  colProfit: {
    flex: 1.1,
    minWidth: 120,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  },
  colTotalRetail: {
    flex: 1.1,
    minWidth: 120,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    borderRightWidth: 0,
  },

  // Table Row
  tableRow: {
    flexDirection: 'row',
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    minHeight: 34,
  },
  tableRowEven: {
    backgroundColor: '#FFFFFF',
  },
  tableRowOdd: {
    backgroundColor: '#F8FAFC',
  },
  tableRowEmpty: {
    backgroundColor: '#FEF2F2',
  },
  tableCell: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    justifyContent: 'center',
  },

  cellNoText: {
    fontSize: 10.5,
    color: '#64748B',
    fontWeight: '600',
    textAlign: 'center',
  },
  cellProductName: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  variantChip: {
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    alignSelf: 'flex-start',
    marginTop: 1,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  variantChipText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#475569',
  },
  cellBarcodeText: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  cellConsignorText: {
    fontSize: 10,
    color: '#7C3AED',
    marginTop: 1,
    fontWeight: '600',
  },

  cellCostText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
    textAlign: 'right',
  },
  cellSubHint: {
    fontSize: 9,
    color: '#7C3AED',
    marginTop: 1,
    textAlign: 'right',
  },
  cellSellText: {
    fontSize: 12,
    color: '#0F172A',
    fontWeight: '600',
    textAlign: 'right',
  },
  cellTotalCostText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '700',
    textAlign: 'right',
  },
  cellModalTitipanText: {
    fontSize: 12,
    color: '#16A34A',
    fontWeight: '700',
    textAlign: 'right',
  },
  cellModalTitipanSub: {
    fontSize: 9,
    color: '#6D28D9',
    marginTop: 1,
    textAlign: 'right',
  },
  cellModalDigitalText: {
    fontSize: 12,
    color: '#D97706',
    fontWeight: '700',
    textAlign: 'right',
  },
  cellModalDigitalSub: {
    fontSize: 9,
    color: '#92400E',
    marginTop: 1,
    textAlign: 'right',
  },
  cellProfitText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '700',
    textAlign: 'right',
  },
  cellProfitSubText: {
    fontSize: 10,
    color: '#10B981',
    marginTop: 1,
    textAlign: 'right',
  },
  cellTotalRetailText: {
    fontSize: 12,
    color: '#1E293B',
    fontWeight: '600',
    textAlign: 'right',
  },

  // EXCEL FOOTER SUMMARY ROW (=SUM)
  tableFooterRow: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: '#F1F5F9',
    borderBottomWidth: 1.5,
    borderBottomColor: '#94A3B8',
    minHeight: 34,
  },
  tableCellFooter: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRightWidth: 1,
    borderRightColor: '#CBD5E1',
    justifyContent: 'center',
  },
  footerLabelText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
  },
  footerSubText: {
    fontSize: 8.5,
    color: '#64748B',
    marginTop: 0.5,
  },
  footerStockText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  footerDashText: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'right',
  },
  footerTotalCostText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primary,
    textAlign: 'right',
  },
  footerConsignmentCostText: {
    fontSize: 8.5,
    color: '#7C3AED',
    marginTop: 0.5,
    textAlign: 'right',
  },
  footerProfitText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
    textAlign: 'right',
  },
  footerProfitSubText: {
    fontSize: 9,
    color: '#10B981',
    marginTop: 0.5,
    textAlign: 'right',
  },
  footerRetailText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'right',
  },
  emptyTableBox: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    backgroundColor: '#FFFFFF',
  },
  emptyTableText: {
    fontSize: 11,
    color: Colors.muted,
    marginTop: 4,
  },

  // STYLES FOR VARIANT BREAKDOWN (PARENT & CHILD ROWS)
  tableRowParent: {
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1.5,
    borderTopColor: '#CBD5E1',
  },
  parentVariantBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 5,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  parentVariantBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#4338CA',
  },
  tableRowVariant: {
    backgroundColor: '#FBFBFE',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    borderLeftWidth: 3,
    borderLeftColor: '#6366F1',
    minHeight: 28,
  },
  variantCell: {
    backgroundColor: '#FBFBFE',
    paddingVertical: 2.5,
    paddingHorizontal: 8,
  },
  variantSubIndexText: {
    fontSize: 9.5,
    color: '#64748B',
    fontWeight: '600',
    textAlign: 'center',
  },
  variantNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 2,
  },
  variantTreeIcon: {
    fontSize: 12,
    color: '#6366F1',
    fontWeight: '700',
    marginRight: 4,
  },
  variantNamePill: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  variantNameText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4338CA',
  },
  variantTypeBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  variantTypeBadgeText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#64748B',
  },
  variantStockBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  variantStockBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  variantNumberText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#0F172A',
    textAlign: 'right',
  },
  stockSafeBadge: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  stockSafeText: {
    color: '#15803D',
  },
  stockLowBadge: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  stockLowText: {
    color: '#B45309',
  },
  stockEmptyBadge: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  stockEmptyText: {
    color: '#B91C1C',
  },
  variantNumberText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
    textAlign: 'right',
  },
});
