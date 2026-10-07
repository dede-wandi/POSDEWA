import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { tableStyles as t } from './tableStyles';

const TYPE_BADGE = {
  addition: { label: 'Tambah', bg: '#DCFCE7', text: '#15803D', icon: 'add-circle-outline' },
  reduction: { label: 'Kurang', bg: '#FEE2E2', text: '#B91C1C', icon: 'remove-circle-outline' },
  adjustment: { label: 'Penyesuaian', bg: '#EFF6FF', text: '#1D4ED8', icon: 'settings-outline' },
};
const DEFAULT_BADGE = { label: 'Lainnya', bg: '#F1F5F9', text: '#475569', icon: 'help-circle-outline' };

const COLUMNS = [
  { label: '#', style: 'colNo', center: true },
  { label: 'WAKTU', style: 'colTime' },
  { label: 'PRODUK', style: 'colProduct' },
  { label: 'TIPE', style: 'colType', center: true },
  { label: 'JUMLAH', style: 'colQty', right: true },
  { label: 'STOK (AWAL → AKHIR)', style: 'colChange', center: true },
  { label: 'ALASAN & CATATAN', style: 'colReason', last: true },
];

const formatDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : '-';

/** Excel-like stock mutation history table. */
export function StockHistoryTable({ history, emptyHint }) {
  return (
    <View style={t.card}>
      <ScrollView horizontal nestedScrollEnabled style={t.scroll} contentContainerStyle={t.scrollContent}>
        <View style={t.container}>
          <View style={t.headerRow}>
            {COLUMNS.map(col => (
              <View
                key={col.label}
                style={[
                  t.headerCell, s[col.style],
                  col.center && { justifyContent: 'center' },
                  col.right && { justifyContent: 'flex-end' },
                  col.last && t.lastCol,
                ]}
              >
                <Text style={t.headerText}>{col.label}</Text>
              </View>
            ))}
          </View>

          {history.length > 0 ? (
            history.map((h, i) => {
              const badge = TYPE_BADGE[h.type] || DEFAULT_BADGE;
              const isReduction = h.type === 'reduction';
              return (
                <View key={h.id || `hist-${i}`} style={[t.row, i % 2 === 0 ? t.rowEven : t.rowOdd]}>
                  <View style={[t.cell, s.colNo, t.center]}><Text style={t.noText}>{i + 1}</Text></View>
                  <View style={[t.cell, s.colTime]}><Text style={s.timeText}>{formatDate(h.created_at)}</Text></View>
                  <View style={[t.cell, s.colProduct]}>
                    <Text style={t.nameText} numberOfLines={2}>{h.products?.name || 'Produk tidak ditemukan'}</Text>
                    {h.products?.barcode ? <Text style={t.codeText}>🏷️ {h.products.barcode}</Text> : null}
                  </View>
                  <View style={[t.cell, s.colType, t.center]}>
                    <View style={[t.pill, { backgroundColor: badge.bg, borderColor: 'transparent', alignSelf: 'center' }]}>
                      <Ionicons name={badge.icon} size={12} color={badge.text} style={{ marginRight: 3 }} />
                      <Text style={[t.pillText, { color: badge.text }]}>{badge.label}</Text>
                    </View>
                  </View>
                  <View style={[t.cell, s.colQty, t.right]}>
                    <Text style={[s.qtyText, { color: isReduction ? '#DC2626' : '#16A34A' }]}>
                      {isReduction ? '-' : '+'}{h.quantity} pcs
                    </Text>
                  </View>
                  <View style={[t.cell, s.colChange, t.center]}>
                    <View style={s.changeBox}>
                      <Text style={s.prevText}>{h.previous_stock ?? '-'}</Text>
                      <Ionicons name="arrow-forward" size={12} color="#94A3B8" style={{ marginHorizontal: 4 }} />
                      <Text style={s.nextText}>{h.new_stock ?? '-'}</Text>
                    </View>
                  </View>
                  <View style={[t.cell, s.colReason, t.lastCol]}>
                    <Text style={s.reasonText}>{h.reason || '-'}</Text>
                    {h.notes ? <Text style={s.notesText}>{h.notes}</Text> : null}
                  </View>
                </View>
              );
            })
          ) : (
            <View style={t.empty}>
              <Ionicons name="time-outline" size={44} color="#CBD5E1" />
              <Text style={t.emptyTitle}>Belum ada riwayat mutasi</Text>
              <Text style={t.emptySub}>{emptyHint}</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  colNo: { width: 46, paddingHorizontal: 2 },
  colTime: { flex: 1.2, minWidth: 135 },
  colProduct: { flex: 2.5, minWidth: 220 },
  colType: { flex: 1, minWidth: 110 },
  colQty: { flex: 0.9, minWidth: 95 },
  colChange: { flex: 1.2, minWidth: 140 },
  colReason: { flex: 1.8, minWidth: 190 },

  timeText: { fontSize: 11, color: '#475569' },
  qtyText: { fontSize: 12, fontWeight: '700' },
  changeBox: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 4,
    borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 6, paddingVertical: 2,
  },
  prevText: { fontSize: 11, color: '#64748B', fontWeight: '500' },
  nextText: { fontSize: 11, color: '#0F172A', fontWeight: '700' },
  reasonText: { fontSize: 11, color: '#1E293B', fontWeight: '500' },
  notesText: { fontSize: 10, color: '#94A3B8', fontStyle: 'italic', marginTop: 1 },
});
