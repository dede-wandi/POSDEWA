import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { calculateFinalStock } from '../../../services/stockMutationService';

const CONFIG = {
  add: {
    title: 'Tambah Stok',
    subtitle: 'Input penambahan fisik barang',
    icon: 'add', iconColor: '#15803D', iconBg: '#DCFCE7', submitColor: '#10B981',
    submitLabel: 'Simpan Penambahan',
    reasons: ['Restok Supplier', 'Retur Pelanggan', 'Koreksi Fisik', 'Produksi Sendiri'],
    notesPlaceholder: 'No. Invoice supplier, nota jalan, dsb...',
  },
  adjust: {
    title: 'Penyesuaian Stok',
    subtitle: 'Opname fisik atau koreksi selisih stok',
    icon: 'settings-outline', iconColor: '#2563EB', iconBg: '#EFF6FF', submitColor: '#0284C7',
    submitLabel: 'Terapkan Koreksi',
    reasons: ['Opname Fisik Toko', 'Barang Rusak / Cacat', 'Barang Hilang / Selisih', 'Koreksi Data'],
    notesPlaceholder: 'Catatan hasil opname atau keterangan kerusakan...',
  },
};

const MODES = [
  { id: 'set', label: 'Set Nilai', icon: 'create-outline', field: 'Total Stok Fisik Aktual *' },
  { id: 'add', label: 'Tambah', icon: 'add-circle-outline', field: 'Jumlah Ditambahkan *' },
  { id: 'subtract', label: 'Kurangi', icon: 'remove-circle-outline', field: 'Jumlah Dikurangi *' },
];

/**
 * Single modal for both "Tambah Stok" and "Sesuaikan Stok".
 * target: { source: 'add'|'adjust', item: StockItem, variant: StockVariant|null } | null
 */
export function StockMutationModal({ target, onClose, onSubmit }) {
  const [mode, setMode] = useState('add');
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const source = target?.source || 'add';
  const cfg = CONFIG[source];
  const current = target ? (target.variant ? target.variant.stock : target.item.stock) : 0;
  const displayName = target ? (target.variant ? target.variant.displayName : target.item.name) : '';

  useEffect(() => {
    if (!target) return;
    const isAdjust = target.source === 'adjust';
    setMode(isAdjust ? 'set' : 'add');
    setValue(isAdjust ? String(current) : '');
    setReason('');
    setNotes('');
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps

  const canSubmit = !submitting && value.trim() && reason.trim();
  const preview = calculateFinalStock(current, mode, value);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onSubmit({ mode, value, reason, notes, source });
    } finally {
      setSubmitting(false);
    }
  };

  const fieldLabel = source === 'add' ? 'Jumlah Tambahan (pcs) *' : MODES.find(m => m.id === mode).field;

  return (
    <Modal visible={!!target} animationType="fade" transparent onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.card}>
          <View style={s.header}>
            <View style={s.headerLeft}>
              <View style={[s.headerIcon, { backgroundColor: cfg.iconBg }]}>
                <Ionicons name={cfg.icon} size={20} color={cfg.iconColor} />
              </View>
              <View>
                <Text style={s.title}>{cfg.title}</Text>
                <Text style={s.subtitle}>{cfg.subtitle}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={{ padding: 6 }}>
              <Ionicons name="close" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView style={s.body}>
            <View style={s.banner}>
              <Text style={s.bannerName}>{displayName}</Text>
              <View style={s.bannerRow}>
                <Text style={s.bannerLabel}>Stok saat ini:</Text>
                <Text style={s.bannerValue}>{current} pcs</Text>
              </View>
              <View style={[s.bannerRow, { marginTop: 4 }]}>
                <Text style={s.bannerLabel}>Setelah perubahan:</Text>
                <Text style={[s.bannerValue, { color: '#0284C7', fontWeight: '800' }]}>{preview} pcs</Text>
              </View>
            </View>

            {source === 'adjust' && (
              <View style={s.group}>
                <Text style={s.label}>Metode Koreksi</Text>
                <View style={s.segmented}>
                  {MODES.map(m => {
                    const active = mode === m.id;
                    return (
                      <TouchableOpacity
                        key={m.id}
                        style={[s.segBtn, active && s.segBtnActive]}
                        onPress={() => { setMode(m.id); setValue(m.id === 'set' ? String(current) : ''); }}
                      >
                        <Ionicons name={m.icon} size={15} color={active ? '#FFFFFF' : '#475569'} style={{ marginRight: 4 }} />
                        <Text style={[s.segText, active && s.segTextActive]}>{m.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            <View style={s.group}>
              <Text style={s.label}>{fieldLabel}</Text>
              <TextInput
                style={s.input}
                value={value}
                onChangeText={setValue}
                placeholder="0"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                autoFocus
              />
            </View>

            <View style={s.group}>
              <Text style={s.label}>Alasan *</Text>
              <View style={s.chips}>
                {cfg.reasons.map(r => (
                  <TouchableOpacity key={r} style={[s.chip, reason === r && s.chipActive]} onPress={() => setReason(r)}>
                    <Text style={[s.chipText, reason === r && s.chipTextActive]}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={[s.input, { marginTop: 6 }]}
                value={reason}
                onChangeText={setReason}
                placeholder="Atau ketik alasan lain..."
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={s.group}>
              <Text style={s.label}>Catatan Tambahan (Opsional)</Text>
              <TextInput
                style={[s.input, { height: 60, textAlignVertical: 'top' }]}
                value={notes}
                onChangeText={setNotes}
                placeholder={cfg.notesPlaceholder}
                placeholderTextColor="#94A3B8"
                multiline
              />
            </View>
          </ScrollView>

          <View style={s.footer}>
            <TouchableOpacity style={s.cancelBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={s.cancelText}>Batal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.submitBtn, { backgroundColor: cfg.submitColor }, !canSubmit && { opacity: 0.5 }]}
              onPress={handleSubmit}
              disabled={!canSubmit}
              activeOpacity={0.8}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={s.submitText}>{cfg.submitLabel}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.55)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 520, maxHeight: '90%', backgroundColor: '#FFFFFF', borderRadius: 14, overflow: 'hidden' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIcon: { width: 38, height: 38, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  subtitle: { fontSize: 12, color: '#64748B', marginTop: 1 },
  body: { padding: 20 },
  label: { fontSize: 12, fontWeight: '600', color: '#334155', marginBottom: 6 },
  input: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: '#0F172A',
  },
  footer: {
    flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 10,
    paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#E2E8F0', backgroundColor: '#F8FAFC',
  },
  cancelBtn: { paddingVertical: 9, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CBD5E1' },
  cancelText: { fontSize: 13, fontWeight: '600', color: '#475569' },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 9, paddingHorizontal: 16, borderRadius: 8 },
  submitText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
});

const s = StyleSheet.create({
  ...modalStyles,
  banner: { backgroundColor: '#F8FAFC', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16 },
  bannerName: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 6 },
  bannerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bannerLabel: { fontSize: 12, color: '#64748B' },
  bannerValue: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  group: { marginBottom: 14 },
  segmented: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 8, padding: 3, gap: 4 },
  segBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 7, borderRadius: 6 },
  segBtnActive: { backgroundColor: '#0284C7' },
  segText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  segTextActive: { color: '#FFFFFF', fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  chip: { backgroundColor: '#F1F5F9', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#E2E8F0' },
  chipActive: { backgroundColor: '#0284C7', borderColor: '#0284C7' },
  chipText: { fontSize: 11, fontWeight: '500', color: '#475569' },
  chipTextActive: { color: '#FFFFFF', fontWeight: '700' },
});
