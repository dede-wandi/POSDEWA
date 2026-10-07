import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StockStatus } from '../../../models/StockItemModel';
import { tableStyles as t } from './tableStyles';

const COLUMNS = [
  { key: 'no', label: '#', style: 'colNo', center: true },
  { key: 'name', label: 'PRODUK & SKU', style: 'colProduct', sort: 'name' },
  { key: 'cat', label: 'KATEGORI', style: 'colCategory' },
  { key: 'stock', label: 'STOK', style: 'colStock', sort: 'stock', center: true },
  { key: 'status', label: 'STATUS', style: 'colStatus', center: true },
  { key: 'act', label: 'AKSI CEPAT', style: 'colActions', center: true, last: true },
];

function StatusPill({ status, small }) {
  const m = StockStatus.meta(status);
  return (
    <View style={[t.pill, { backgroundColor: m.bg, borderColor: m.border, alignSelf: 'center' }, small && { paddingVertical: 1.5 }]}>
      <Text style={[t.pillText, { color: m.text }, small && { fontSize: 10 }]}>{m.label}</Text>
    </View>
  );
}

function StockValue({ stock, status, small }) {
  const m = StockStatus.meta(status);
  if (status === 'unlimited') {
    return <Text style={[s.stockValue, { color: m.text }, small && { fontSize: 13 }]}>∞</Text>;
  }
  return (
    <View style={[s.stockBox, { backgroundColor: m.bg }, small && { paddingVertical: 1.5, minWidth: 54 }]}>
      <Text style={[s.stockValue, { color: m.text }, small && { fontSize: 11.5 }]}>
        {stock} <Text style={s.stockUnit}>pcs</Text>
      </Text>
    </View>
  );
}

function ActionButtons({ onAdd, onAdjust, small, disabled }) {
  if (disabled) return <Text style={s.noActionText}>Tanpa stok</Text>;
  return (
    <View style={s.actions}>
      <TouchableOpacity style={[s.btn, s.btnAdd, small && s.btnSmall]} onPress={onAdd} activeOpacity={0.7}>
        <Ionicons name="add" size={small ? 11 : 13} color="#059669" />
        <Text style={[s.btnText, { color: '#059669' }, small && { fontSize: 10 }]}>{small ? 'Stok' : 'Tambah'}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[s.btn, s.btnAdjust, small && s.btnSmall]} onPress={onAdjust} activeOpacity={0.7}>
        <Ionicons name="settings-outline" size={small ? 11 : 12} color="#2563EB" />
        <Text style={[s.btnText, { color: '#2563EB' }, small && { fontSize: 10 }]}>{small ? 'Ubah' : 'Sesuaikan'}</Text>
      </TouchableOpacity>
    </View>
  );
}

function ProductRow({ item, index, onAction }) {
  const accent = StockStatus.meta(item.status).accent;
  return (
    <>
      <View
        style={[
          t.row,
          index % 2 === 0 ? t.rowEven : t.rowOdd,
          accent && { borderLeftColor: accent },
          item.hasVariants && t.rowParent,
        ]}
      >
        <View style={[t.cell, s.colNo, t.center]}><Text style={t.noText}>{index + 1}</Text></View>
        <View style={[t.cell, s.colProduct]}>
          <View style={s.titleRow}>
            <Text style={t.nameText} numberOfLines={2}>{item.name}</Text>
            {item.hasVariants && (
              <View style={s.variantBadge}><Text style={s.variantBadgeText}>📦 {item.variants.length} Varian</Text></View>
            )}
          </View>
          {item.code ? <Text style={t.codeText} numberOfLines={1}>🏷️ {item.code}</Text> : null}
        </View>
        <View style={[t.cell, s.colCategory]}>
          <View style={[t.pill, t.grayPill]}><Text style={t.grayPillText} numberOfLines={1}>{item.categoryName}</Text></View>
        </View>
        <View style={[t.cell, s.colStock, t.center]}>
          <StockValue stock={item.stock} status={item.status} />
          {item.hasVariants && !item.isUnlimited && <Text style={s.subHint}>Total {item.variants.length} varian</Text>}
        </View>
        <View style={[t.cell, s.colStatus, t.center]}><StatusPill status={item.status} /></View>
        <View style={[t.cell, s.colActions, t.center, t.lastCol]}>
          <ActionButtons
            disabled={item.isUnlimited}
            onAdd={() => onAction('add', item, null)}
            onAdjust={() => onAction('adjust', item, null)}
          />
        </View>
      </View>

      {item.variants.map(v => (
        <View key={v.key} style={[t.row, t.rowVariant]}>
          <View style={[t.cell, s.colNo, t.center]}><Text style={t.subNoText}>{index + 1}.{v.index + 1}</Text></View>
          <View style={[t.cell, s.colProduct]}>
            <View style={s.titleRow}>
              <Text style={s.treeIcon}>↳</Text>
              <View style={s.variantNamePill}><Text style={s.variantNameText} numberOfLines={1}>Varian: {v.name}</Text></View>
              {v.barcode ? <Text style={t.codeText}>({v.barcode})</Text> : null}
            </View>
          </View>
          <View style={[t.cell, s.colCategory]}>
            <View style={[t.pill, t.grayPill]}><Text style={[t.grayPillText, { fontSize: 10 }]}>🏷️ Sub Varian</Text></View>
          </View>
          <View style={[t.cell, s.colStock, t.center]}><StockValue stock={v.stock} status={v.status} small /></View>
          <View style={[t.cell, s.colStatus, t.center]}><StatusPill status={v.status} small /></View>
          <View style={[t.cell, s.colActions, t.center, t.lastCol]}>
            <ActionButtons
              small
              disabled={v.isUnlimited}
              onAdd={() => onAction('add', item, v)}
              onAdjust={() => onAction('adjust', item, v)}
            />
          </View>
        </View>
      ))}
    </>
  );
}

/** Excel-like product stock table with indented variant sub-rows. */
export function StockProductTable({ items, sortBy, sortOrder, onSort, onAction, emptyHint }) {
  return (
    <View style={t.card}>
      <ScrollView horizontal nestedScrollEnabled style={t.scroll} contentContainerStyle={t.scrollContent}>
        <View style={t.container}>
          <View style={t.headerRow}>
            {COLUMNS.map(col => {
              const Wrapper = col.sort ? TouchableOpacity : View;
              return (
                <Wrapper
                  key={col.key}
                  style={[t.headerCell, s[col.style], col.center && { justifyContent: 'center' }, col.last && t.lastCol]}
                  {...(col.sort ? { onPress: () => onSort(col.sort), activeOpacity: 0.7 } : {})}
                >
                  <Text style={t.headerText}>{col.label}</Text>
                  {col.sort && sortBy === col.sort && (
                    <Ionicons name={sortOrder === 'asc' ? 'caret-up' : 'caret-down'} size={12} color="#0284C7" style={{ marginLeft: 4 }} />
                  )}
                </Wrapper>
              );
            })}
          </View>

          {items.length > 0 ? (
            items.map((item, idx) => <ProductRow key={item.id || idx} item={item} index={idx} onAction={onAction} />)
          ) : (
            <View style={t.empty}>
              <Ionicons name="cube-outline" size={44} color="#CBD5E1" />
              <Text style={t.emptyTitle}>Tidak ada produk ditemukan</Text>
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
  colProduct: { flex: 3, minWidth: 260 },
  colCategory: { flex: 1.2, minWidth: 125 },
  colStock: { flex: 1, minWidth: 110 },
  colStatus: { flex: 1.1, minWidth: 120 },
  colActions: { width: 180 },

  titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  variantBadge: {
    backgroundColor: '#EFF6FF', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1.5,
    borderWidth: 1, borderColor: '#BFDBFE',
  },
  variantBadgeText: { fontSize: 10, fontWeight: '700', color: '#2563EB' },
  treeIcon: { fontSize: 13, color: '#0284C7', fontWeight: '700' },
  variantNamePill: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 4,
    paddingHorizontal: 6, paddingVertical: 1.5,
  },
  variantNameText: { fontSize: 11, fontWeight: '600', color: '#334155' },

  stockBox: { paddingHorizontal: 8, paddingVertical: 2.5, borderRadius: 6, minWidth: 62, alignItems: 'center' },
  stockValue: { fontSize: 13, fontWeight: '800', textAlign: 'center' },
  stockUnit: { fontSize: 10, fontWeight: '500', color: '#94A3B8' },
  subHint: { fontSize: 9.5, color: '#0284C7', fontWeight: '600', marginTop: 2 },

  actions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  btn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, height: 26, gap: 2 },
  btnSmall: { paddingHorizontal: 6, height: 24 },
  btnAdd: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  btnAdjust: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  btnText: { fontSize: 11, fontWeight: '600' },
  noActionText: { fontSize: 10.5, color: '#94A3B8', fontStyle: 'italic' },
});
