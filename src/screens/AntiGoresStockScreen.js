import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radii, Shadows } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { searchAntiGores, upsertType, deleteType, checkAntiGoresReady } from '../services/antigoresSupabase';

export default function AntiGoresStockScreen({ navigation }) {
  const { user } = useAuth();
  const { showToast } = useToast ? useToast() : { showToast: () => {} };
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [schemaReady, setSchemaReady] = useState(true);
  const [schemaMsg, setSchemaMsg] = useState('');
  const AG_SCHEMA_SQL = `create extension if not exists pgcrypto;

create table if not exists public.ag_simple (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  brand text not null,
  termasuk text not null default '',
  ukuran_layar text not null default '',
  stock integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists ag_simple_set_updated_at on public.ag_simple;
create trigger ag_simple_set_updated_at
before update on public.ag_simple
for each row execute function public.set_updated_at();

create index if not exists ag_simple_owner_idx on public.ag_simple(owner_id);
create index if not exists ag_simple_brand_idx on public.ag_simple(brand);

alter table public.ag_simple enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ag_simple' and policyname='ag_simple_select_own') then
    create policy ag_simple_select_own on public.ag_simple for select using (auth.uid() = owner_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ag_simple' and policyname='ag_simple_mod_own') then
    create policy ag_simple_mod_own on public.ag_simple for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
  end if;
end $$;`;
  const [editingMap, setEditingMap] = useState({});
  const [rowEdits, setRowEdits] = useState({});
  const [savingRows, setSavingRows] = useState({});
  // simplified model: no device search state needed
  const [newRow, setNewRow] = useState({ brand: '', termasuk: '', ukuran_layar: '', stock: '' });
  const [addingRow, setAddingRow] = useState(false);

  const load = useCallback(async (q) => {
    setLoading(true);
    try {
      const chk = await checkAntiGoresReady();
      if (!chk.ready) {
        setSchemaReady(false);
        setSchemaMsg(chk.message || '');
        setData([]);
      } else {
        setSchemaReady(true);
        setSchemaMsg('');
        const res = await searchAntiGores({ ownerId: user.id, query: q, limit: 100 });
        const sorted = [...res].sort((a, b) => {
          const av = parseUkuran(a.ukuran_layar || '');
          const bv = parseUkuran(b.ukuran_layar || '');
          if (av === bv) return (a.name || '').localeCompare(b.name || '');
          return av - bv;
        });
        setData(sorted);
      }
    } catch (e) {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    load('');
  }, [load]);

  useEffect(() => {
    const t = setTimeout(() => load(query), 300);
    return () => clearTimeout(t);
  }, [query, load]);

  const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parseUkuran = (s) => {
    if (!s) return Number.POSITIVE_INFINITY;
    const str = String(s).replace(',', '.');
    const m = str.match(/(\d+(?:\.\d+)?)/);
    if (!m) return Number.POSITIVE_INFINITY;
    const v = parseFloat(m[1]);
    return isNaN(v) ? Number.POSITIVE_INFINITY : v;
  };
  const renderHighlighted = (text, q) => {
    if (!q || !q.trim()) return <Text style={styles.cellText}>{text || '-'}</Text>;
    try {
      const safe = escapeRegExp(q.trim());
      const re = new RegExp(`(${safe})`, 'ig');
      const parts = String(text || '').split(re);
      return (
        <Text style={styles.cellText}>
          {parts.map((part, idx) =>
            re.test(part) ? (
              <Text key={idx} style={{ backgroundColor: '#FFF59D' }}>{part}</Text>
            ) : (
              <Text key={idx}>{part}</Text>
            )
          )}
        </Text>
      );
    } catch {
      return <Text style={styles.cellText}>{text || '-'}</Text>;
    }
  };

  const startEdit = (row) => {
    setEditingMap((m) => ({ ...m, [row.id]: true }));
    setRowEdits((e) => ({
      ...e,
      [row.id]: {
        name: row.name || '',
        termasuk: row.termasuk || '',
        ukuran_layar: row.ukuran_layar || '',
        stock: String(row.stock || 0)
      }
    }));
  };
  const cancelEdit = (id) => {
    setEditingMap((m) => {
      const n = { ...m };
      delete n[id];
      return n;
    });
    setRowEdits((e) => {
      const n = { ...e };
      delete n[id];
      return n;
    });
  };
  const saveEdit = async (id) => {
    const draft = rowEdits[id];
    if (!draft) return;
    setSavingRows((s) => ({ ...s, [id]: true }));
    try {
      await upsertType({
        ownerId: user.id,
        id,
        name: (draft.name || '').trim(),
        termasuk: draft.termasuk || '',
        ukuran_layar: draft.ukuran_layar || '',
        stock: Number(draft.stock) || 0
      });
      if (showToast) showToast('Baris disimpan', 'success');
      await load(query);
      cancelEdit(id);
    } catch (e) {
      if (showToast) showToast('Gagal menyimpan', 'error');
    } finally {
      setSavingRows((s) => ({ ...s, [id]: false }));
    }
  };
  const onEditChange = (id, key, val) => {
    setRowEdits((e) => ({ ...e, [id]: { ...(e[id] || {}), [key]: val } }));
  };

  const renderItem = ({ item }) => {
    const isEditing = !!editingMap[item.id];
    const d = rowEdits[item.id] || {};
    return (
      <View style={styles.tableRow}>
        <View style={[styles.cell, { flex: 2 }]}>
          {isEditing ? (
            <TextInput
              style={[styles.inputLine, { marginBottom: 0 }]}
              value={d.name ?? ''}
              onChangeText={(v) => onEditChange(item.id, 'name', v)}
              placeholder="Brand"
              placeholderTextColor={Colors.muted}
              returnKeyType="done"
              onSubmitEditing={() => saveEdit(item.id)}
            />
          ) : (
            renderHighlighted(item.name, query)
          )}
        </View>
        <View style={[styles.cell, { flex: 4 }]}>
          {isEditing ? (
            <TextInput
              style={[styles.inputLine, { marginBottom: 0 }]}
              value={d.termasuk ?? ''}
              onChangeText={(v) => onEditChange(item.id, 'termasuk', v)}
              placeholder="Termasuk"
              placeholderTextColor={Colors.muted}
              returnKeyType="done"
              onSubmitEditing={() => saveEdit(item.id)}
            />
          ) : (
            renderHighlighted(item.termasuk || '', query)
          )}
        </View>
        <View style={[styles.cell, { flex: 2 }]}>
          {isEditing ? (
            <TextInput
              style={[styles.inputLine, { marginBottom: 0 }]}
              value={d.ukuran_layar ?? ''}
              onChangeText={(v) => onEditChange(item.id, 'ukuran_layar', v)}
              placeholder="Ukuran Layar"
              placeholderTextColor={Colors.muted}
              returnKeyType="done"
              onSubmitEditing={() => saveEdit(item.id)}
            />
          ) : (
            renderHighlighted(item.ukuran_layar || '', query)
          )}
        </View>
        <View style={[styles.cell, { flex: 1, alignItems: 'flex-end' }]}>
          {isEditing ? (
            <TextInput
              style={[styles.inputLine, { marginBottom: 0, textAlign: 'right' }]}
              value={d.stock ?? '0'}
              onChangeText={(v) => onEditChange(item.id, 'stock', v.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={Colors.muted}
              returnKeyType="done"
              onSubmitEditing={() => saveEdit(item.id)}
            />
          ) : (
            <Text style={styles.cellText}>{item.stock}</Text>
          )}
        </View>
        <View style={[styles.cell, { flex: 1, justifyContent: 'flex-end' }]}>
          {isEditing ? (
            <>
              <TouchableOpacity
                onPress={() => saveEdit(item.id)}
                style={[styles.smallIconBtn, { backgroundColor: '#E8F5E9', marginRight: 6 }]}
                disabled={!!savingRows[item.id]}
              >
                {savingRows[item.id] ? (
                  <ActivityIndicator size="small" color="#2E7D32" />
                ) : (
                  <Ionicons name="checkmark" size={18} color="#2E7D32" />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => cancelEdit(item.id)}
                style={[styles.smallIconBtn, { backgroundColor: '#FFEBEE' }]}
                disabled={!!savingRows[item.id]}
              >
                <Ionicons name="close" size={18} color="#C62828" />
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                onPress={() => startEdit(item)}
                style={[styles.smallIconBtn, { backgroundColor: '#E3F2FD', marginRight: 6 }]}
              >
                <Ionicons name="create-outline" size={18} color={Colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  try {
                    await deleteType({ ownerId: user.id, id: item.id });
                    if (showToast) showToast('Baris dihapus', 'success');
                    await load(query);
                  } catch (e) {
                    if (showToast) showToast('Gagal menghapus', 'error');
                  }
                }}
                style={[styles.smallIconBtn, { backgroundColor: '#FFEBEE' }]}
              >
                <Ionicons name="trash-outline" size={18} color="#C62828" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cek Stok Antigores</Text>
        <View style={{ width: 22 }} />
      </View>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={Colors.muted} style={{ marginRight: 8 }} />
        <TextInput
          placeholder="Cari tipe atau model HP, mis. A 13 G"
          placeholderTextColor={Colors.muted}
          value={query}
          onChangeText={setQuery}
          style={styles.input}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={18} color={Colors.muted} />
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.tableWrapper}>
        <View style={styles.tableHeader}>
          <Text style={[styles.headerCell, { flex: 2 }]}>Brand</Text>
            <Text style={[styles.headerCell, { flex: 4 }]}>Termasuk</Text>
            <Text style={[styles.headerCell, { flex: 2 }]}>Ukuran Layar</Text>
            <Text style={[styles.headerCell, { flex: 1, textAlign: 'right' }]}>Stok</Text>
        </View>
        <View style={styles.tableAddRow}>
          <TextInput
            style={[styles.inputLine, { flex: 2, marginRight: 8 }]}
            placeholder="Brand"
            placeholderTextColor={Colors.muted}
            value={newRow.brand}
            onChangeText={(v) => setNewRow(prev => ({ ...prev, brand: v }))}
          />
          <TextInput
            style={[styles.inputLine, { flex: 4, marginRight: 8 }]}
            placeholder="Termasuk (pisah dengan / atau ,)"
            placeholderTextColor={Colors.muted}
            value={newRow.termasuk}
            onChangeText={(v) => setNewRow(prev => ({ ...prev, termasuk: v }))}
          />
            <TextInput
              style={[styles.inputLine, { flex: 2, marginRight: 8 }]}
              placeholder="Ukuran Layar (opsional)"
              placeholderTextColor={Colors.muted}
              value={newRow.ukuran_layar}
              onChangeText={(v) => setNewRow(prev => ({ ...prev, ukuran_layar: v }))}
            />
          <TextInput
            style={[styles.inputLine, { flex: 1 }]}
            placeholder="Stok"
            placeholderTextColor={Colors.muted}
            keyboardType="number-pad"
            value={newRow.stock}
            onChangeText={(v) => setNewRow(prev => ({ ...prev, stock: v.replace(/[^0-9]/g, '') }))}
          />
        </View>
        <View style={{ alignItems: 'flex-end', marginTop: 6 }}>
          <TouchableOpacity
            disabled={addingRow || !(newRow.brand.trim().length >= 2 && newRow.stock.trim().length > 0)}
            style={[styles.primaryBtn, (addingRow || !(newRow.brand.trim().length >= 2 && newRow.stock.trim().length > 0)) && { opacity: 0.6 }]}
            onPress={async () => {
              const brand = newRow.brand.trim();
              const stockNum = Number(newRow.stock) || 0;
              setAddingRow(true);
              try {
                await upsertType({ ownerId: user.id, name: brand, termasuk: newRow.termasuk || '', ukuran_layar: newRow.ukuran_layar || '', stock: stockNum });
                setNewRow({ brand: '', termasuk: '', ukuran_layar: '', stock: '' });
                if (showToast) showToast('Tipe ditambahkan', 'success');
                await load(query);
              } catch (e) {
                if (showToast) showToast('Gagal menambah tipe', 'error');
              } finally {
                setAddingRow(false);
              }
            }}
          >
            {addingRow ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Simpan</Text>}
          </TouchableOpacity>
        </View>
      </View>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
          <Text style={styles.loadingText}>Memuat data...</Text>
        </View>
      ) : !schemaReady ? (
        <View style={{ padding: Spacing.lg }}>
          <Text style={[styles.empty, { marginBottom: 8 }]}>Skema tabel Antigores belum tersedia.</Text>
          <Text style={{ color: Colors.muted, fontSize: 12, marginBottom: 12 }}>Pesan: {schemaMsg || 'relation not found'}</Text>
          <Text style={{ color: Colors.text, fontSize: 12, marginBottom: 8 }}>
            Jalankan file SQL berikut di Supabase SQL Editor project Anda:
          </Text>
          <Text style={{ color: Colors.primary, fontWeight: '700' }}>
            supabase_antigores_schema.sql
          </Text>
          <Text style={{ color: Colors.muted, fontSize: 12, marginTop: 8 }}>
            Setelah dijalankan, kembali ke halaman ini dan tarik untuk refresh, atau ketuk tombol di bawah.
          </Text>
          <View style={{ marginTop: Spacing.md, flexDirection: 'row' }}>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => load(query)}
            >
              <Text style={styles.primaryBtnText}>Coba Muat Ulang</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryBtn, { marginLeft: 8, backgroundColor: '#607D8B' }]}
              onPress={async () => {
                try {
                  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(AG_SCHEMA_SQL);
                    if (showToast) showToast('SQL Antigores disalin ke clipboard', 'success');
                  } else if (typeof document !== 'undefined') {
                    const el = document.createElement('textarea');
                    el.value = AG_SCHEMA_SQL;
                    document.body.appendChild(el);
                    el.select();
                    document.execCommand('copy');
                    document.body.removeChild(el);
                    if (showToast) showToast('SQL Antigores disalin ke clipboard', 'success');
                  } else {
                    if (showToast) showToast('Clipboard tidak tersedia di platform ini', 'error');
                  }
                } catch (e) {
                  if (showToast) showToast('Gagal menyalin ke clipboard', 'error');
                }
              }}
            >
              <Text style={styles.primaryBtnText}>Copy SQL ke Clipboard</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <>
          <View style={styles.tableHeaderSticky}>
            <Text style={[styles.headerCell, { flex: 2 }]}>Brand</Text>
            <Text style={[styles.headerCell, { flex: 4 }]}>Termasuk</Text>
            <Text style={[styles.headerCell, { flex: 2 }]}>Ukuran Layar</Text>
            <Text style={[styles.headerCell, { flex: 1, textAlign: 'right' }]}>Stok</Text>
            <Text style={[styles.headerCell, { flex: 1, textAlign: 'right' }]}></Text>
          </View>
          <FlatList
            data={data}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingHorizontal: Spacing.md, paddingBottom: Spacing.lg }}
            ListEmptyComponent={<Text style={styles.empty}>Belum ada tipe antigores.</Text>}
          />
        </>
      )}

      {/* Inline editing, no modal needed */}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  searchBox: {
    margin: Spacing.md,
    paddingHorizontal: Spacing.md,
    height: 42,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff'
  },
  input: { flex: 1, color: Colors.text },
  inputLine: {
    height: 42,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    color: Colors.text,
    marginBottom: Spacing.sm
  },
  row: {
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderRadius: Radii.md,
    backgroundColor: Colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    ...Shadows.card
  },
  title: { fontSize: 14, fontWeight: '700', color: Colors.text },
  subtitle: { marginTop: 4, fontSize: 12, color: Colors.muted },
  matches: { marginTop: 6, fontSize: 12, color: Colors.text },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 8, color: Colors.muted, fontSize: 12 },
  empty: { textAlign: 'center', color: Colors.muted, marginTop: Spacing.xl },
  modalContainer: { flex: 1, backgroundColor: Colors.background },
  modalHeader: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  deviceItem: { fontSize: 14, color: Colors.text, marginBottom: 8 },
  addButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center'
  },
  addButtonText: { color: '#fff', fontWeight: '700', marginLeft: 6, fontSize: 12 },
  tableWrapper: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm, marginTop: Spacing.sm },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tableHeaderSticky: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: Spacing.md,
    backgroundColor: '#fafafa',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  headerCell: { fontWeight: '700', color: Colors.text },
  tableAddRow: { flexDirection: 'row', marginTop: 8 },
  cell: { flexDirection: 'row', alignItems: 'center' },
  cellText: { color: Colors.text, flexWrap: 'wrap' },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingHorizontal: Spacing.md
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radii.md,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
  dangerBtn: {
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radii.md,
  },
  dangerBtnText: { color: '#C62828', fontWeight: '700' },
  label: { color: Colors.muted, marginBottom: 6, fontSize: 12 },
  smallBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: Radii.md,
  },
  smallBtnText: { fontWeight: '700', fontSize: 12 }
  ,
  smallIconBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center'
  },
  secondaryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff'
  },
  secondaryBtnText: { color: Colors.text, fontWeight: '700' }
});
