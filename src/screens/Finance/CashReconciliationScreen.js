import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  calculateCashBalance,
  setStartingCash,
  saveReconciliation,
  getReconciliationHistory,
  getLocalDateString,
  CASH_DENOMINATIONS,
} from '../../services/cashReconciliationSupabase';
import { formatIDR } from '../../utils/currency';
import { Colors, Spacing, Radii, Shadows } from '../../theme';

export default function CashReconciliationScreen({ navigation }) {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [balanceData, setBalanceData] = useState(null);
  const [history, setHistory] = useState([]);

  // Modal Modal Awal
  const [modalStartingCash, setModalStartingCash] = useState(false);
  const [startingCashInput, setStartingCashInput] = useState('');

  // Hitung Uang Fisik (Kalkulator Pecahan & Direct Input)
  const [useDenominations, setUseDenominations] = useState(true);
  const [denomCounts, setDenomCounts] = useState({});
  const [directCashInput, setDirectCashInput] = useState('');
  const [savingReconcile, setSavingReconcile] = useState(false);
  const [notesInput, setNotesInput] = useState('');

  const todayStr = getLocalDateString();

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [balRes, histRes] = await Promise.all([
        calculateCashBalance(user.id, todayStr),
        getReconciliationHistory(user.id),
      ]);

      if (balRes.success) {
        setBalanceData(balRes.data);
        setStartingCashInput(String(balRes.data.startingCash || 0));

        // Restore saved reconciliation for today if available
        if (balRes.data.savedReconciliation) {
          const saved = balRes.data.savedReconciliation;
          if (saved.denominations && Object.keys(saved.denominations).length > 0) {
            setDenomCounts(saved.denominations);
          }
          if (saved.actualCash) {
            setDirectCashInput(String(saved.actualCash));
          }
          if (saved.notes) {
            setNotesInput(saved.notes);
          }
        }
      }
      setHistory(histRes || []);
    } catch {
      showToast('Gagal memuat saldo kasir', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, todayStr]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Calculate total actual cash from denominations or direct input
  const actualCashCalculated = React.useMemo(() => {
    if (useDenominations) {
      let total = 0;
      CASH_DENOMINATIONS.forEach(d => {
        const count = Number(denomCounts[d.value] || 0);
        total += d.value * count;
      });
      return total;
    } else {
      const clean = directCashInput.replace(/\D/g, '');
      return Number(clean || 0);
    }
  }, [useDenominations, denomCounts, directCashInput]);

  const expectedCash = balanceData?.expectedCash || 0;
  const difference = actualCashCalculated - expectedCash;

  const handleUpdateStartingCash = async () => {
    const clean = startingCashInput.replace(/\D/g, '');
    const num = Number(clean || 0);

    const res = await setStartingCash(user?.id, num, todayStr);
    if (res.success) {
      showToast('Modal kas awal berhasil disimpan', 'success');
      setModalStartingCash(false);
      loadData();
    } else {
      showToast('Gagal menyimpan modal kas', 'error');
    }
  };

  const handleDenomChange = (val, countStr) => {
    const clean = countStr.replace(/\D/g, '');
    const count = clean ? parseInt(clean, 10) : 0;
    setDenomCounts(prev => ({
      ...prev,
      [val]: count,
    }));
  };

  const handleSaveReconciliation = async () => {
    setSavingReconcile(true);
    try {
      const res = await saveReconciliation(user?.id, {
        dateStr: todayStr,
        startingCash: balanceData?.startingCash || 0,
        expectedCash,
        actualCash: actualCashCalculated,
        denominations: denomCounts,
        notes: notesInput.trim(),
      });

      if (res.success) {
        showToast('Rekonsiliasi saldo kas berhasil disimpan!', 'success');
        loadData();
      } else {
        showToast(res.error || 'Gagal menyimpan rekonsiliasi', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan', 'error');
    } finally {
      setSavingReconcile(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Menghitung Rekonsiliasi Kas...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const {
    startingCash = 0,
    cashSalesTotal = 0,
    nonCashSalesTotal = 0,
    cashExpensesTotal = 0,
    cashSalesCount = 0,
  } = balanceData || {};

  const isBalanced = actualCashCalculated > 0 && difference === 0;
  const isSurplus = difference > 0;
  const isDeficit = difference < 0;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.navigate('MainTabs', { screen: 'Home' });
            }
          }}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color={Colors.primary} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Rekonsiliasi Saldo Kas Fisik</Text>
          <Text style={styles.headerSubtitle}>Cocokkan Penjualan, Pengeluaran & Uang di Laci</Text>
        </View>
        <TouchableOpacity
          onPress={onRefresh}
          style={styles.refreshBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh" size={20} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
      >
        {/* Status Keseimbangan Banner (Balance Status) */}
        <View
          style={[
            styles.statusBanner,
            actualCashCalculated === 0
              ? styles.statusBannerNeutral
              : isBalanced
              ? styles.statusBannerBalanced
              : isSurplus
              ? styles.statusBannerSurplus
              : styles.statusBannerDeficit,
          ]}
        >
          <View style={styles.statusBannerIcon}>
            <Ionicons
              name={
                actualCashCalculated === 0
                  ? 'information-circle'
                  : isBalanced
                  ? 'checkmark-circle'
                  : isSurplus
                  ? 'alert-circle'
                  : 'close-circle'
              }
              size={32}
              color={
                actualCashCalculated === 0
                  ? '#0284C7'
                  : isBalanced
                  ? '#16A34A'
                  : isSurplus
                  ? '#D97706'
                  : '#DC2626'
              }
            />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text
              style={[
                styles.statusBannerTitle,
                {
                  color:
                    actualCashCalculated === 0
                      ? '#0369A1'
                      : isBalanced
                      ? '#15803D'
                      : isSurplus
                      ? '#B45309'
                      : '#B91C1C',
                },
              ]}
            >
              {actualCashCalculated === 0
                ? 'HITUNG UANG FISIK DI LACI'
                : isBalanced
                ? 'SALDO KAS FISIK BALANCE (SEIMBANG)'
                : isSurplus
                ? `SALDO LEBIH: +${formatIDR(difference)}`
                : `SALDO KURANG: -${formatIDR(Math.abs(difference))}`}
            </Text>
            <Text style={styles.statusBannerDesc}>
              {actualCashCalculated === 0
                ? 'Masukkan jumlah uang fisik di laci kasir di bawah ini untuk melihat apakah cocok dengan sistem.'
                : isBalanced
                ? 'Uang fisik di laci tepat sesuai dengan perhitungan penjualan dan pengeluaran sistem!'
                : isSurplus
                ? 'Uang fisik di laci lebih banyak dari sistem. Periksa kemungkinan ada penjualan tunai yang belum dicatat.'
                : 'Uang fisik di laci kurang. Periksa apakah ada pengeluaran tunai belum dicatat atau selisih kembalian kasir.'}
            </Text>
          </View>
        </View>

        {/* Breakdown Card: Alur Saldo Kas Seharusnya */}
        <View style={styles.flowCard}>
          <Text style={styles.flowCardTitle}>Perhitungan Kas Sistem Hari Ini</Text>

          {/* Modal Kas Awal */}
          <View style={styles.flowRow}>
            <View style={styles.flowRowLeft}>
              <View style={[styles.flowDot, { backgroundColor: '#64748B' }]} />
              <Text style={styles.flowLabel}>Modal Kas Awal (Buka Kasir)</Text>
            </View>
            <TouchableOpacity
              onPress={() => setModalStartingCash(true)}
              style={styles.editStartingBtn}
            >
              <Text style={styles.flowVal}>{formatIDR(startingCash)}</Text>
              <Ionicons name="create-outline" size={14} color={Colors.primary} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          </View>

          {/* Penjualan Tunai (+) */}
          <View style={styles.flowRow}>
            <View style={styles.flowRowLeft}>
              <View style={[styles.flowDot, { backgroundColor: '#16A34A' }]} />
              <View>
                <Text style={styles.flowLabel}>(+) Penjualan Kas Tunai</Text>
                <Text style={styles.flowSubLabel}>{cashSalesCount} transaksi tunai</Text>
              </View>
            </View>
            <Text style={[styles.flowVal, { color: '#16A34A' }]}>
              +{formatIDR(cashSalesTotal)}
            </Text>
          </View>

          {/* Pengeluaran Kas Tunai (-) */}
          <View style={styles.flowRow}>
            <View style={styles.flowRowLeft}>
              <View style={[styles.flowDot, { backgroundColor: '#DC2626' }]} />
              <View>
                <Text style={styles.flowLabel}>(-) Pengeluaran Kas Tunai</Text>
                <Text style={styles.flowSubLabel}>Biaya dari kas laci</Text>
              </View>
            </View>
            <Text style={[styles.flowVal, { color: '#DC2626' }]}>
              -{formatIDR(cashExpensesTotal)}
            </Text>
          </View>

          <View style={styles.flowDivider} />

          {/* Saldo Seharusnya di Laci */}
          <View style={[styles.flowRow, { marginTop: 4 }]}>
            <Text style={styles.expectedTitle}>Saldo Kas Seharusnya di Laci</Text>
            <Text style={styles.expectedAmount}>{formatIDR(expectedCash)}</Text>
          </View>

          {nonCashSalesTotal > 0 && (
            <View style={styles.nonCashInfoRow}>
              <Ionicons name="card-outline" size={14} color="#64748B" />
              <Text style={styles.nonCashInfoText}>
                Penjualan non-tunai (QRIS/Transfer): {formatIDR(nonCashSalesTotal)} (tidak masuk laci)
              </Text>
            </View>
          )}
        </View>

        {/* Quick Action Navigation */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#EFF6FF' }]}
            onPress={() => navigation.navigate('Expenses')}
            activeOpacity={0.8}
          >
            <Ionicons name="wallet-outline" size={16} color="#2563EB" />
            <Text style={[styles.actionBtnText, { color: '#1D4ED8' }]}>Catat Pengeluaran</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#ECFDF5' }]}
            onPress={() => navigation.navigate('SalesReport')}
            activeOpacity={0.8}
          >
            <Ionicons name="receipt-outline" size={16} color="#059669" />
            <Text style={[styles.actionBtnText, { color: '#047857' }]}>Lihat Penjualan</Text>
          </TouchableOpacity>
        </View>

        {/* Input Uang Fisik Section */}
        <View style={styles.countSection}>
          <View style={styles.countHeader}>
            <View>
              <Text style={styles.countTitle}>Hitung Uang Fisik di Laci</Text>
              <Text style={styles.countSubtitle}>Hitung fisik uang tunai saat tutup kasir</Text>
            </View>

            {/* Toggle Mode: Kalkulator Pecahan vs Input Langsung */}
            <TouchableOpacity
              style={styles.toggleModeBtn}
              onPress={() => setUseDenominations(!useDenominations)}
            >
              <Text style={styles.toggleModeText}>
                {useDenominations ? 'Mode Langsung' : 'Kalkulator Pecahan'}
              </Text>
            </TouchableOpacity>
          </View>

          {useDenominations ? (
            /* Kalkulator Pecahan Uang */
            <View style={styles.denominationsWrap}>
              {CASH_DENOMINATIONS.map(d => {
                const count = denomCounts[d.value] || '';
                const subtotal = d.value * Number(count || 0);

                return (
                  <View key={d.value} style={styles.denomRow}>
                    <View style={styles.denomLabelBox}>
                      <Text style={styles.denomName}>{d.label}</Text>
                    </View>

                    <View style={styles.denomInputWrap}>
                      <TextInput
                        style={styles.denomInput}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={Colors.placeholder}
                        value={String(count)}
                        onChangeText={(txt) => handleDenomChange(d.value, txt)}
                      />
                      <Text style={styles.denomUnit}>lembar</Text>
                    </View>

                    <Text style={styles.denomSubtotal}>
                      {subtotal > 0 ? formatIDR(subtotal) : 'Rp 0'}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : (
            /* Input Langsung Nominal */
            <View style={styles.directInputWrap}>
              <Text style={styles.directInputLabel}>Total Fisik Uang di Laci (Rp)</Text>
              <View style={styles.directInputBox}>
                <Text style={styles.directRpPrefix}>Rp</Text>
                <TextInput
                  style={styles.directInput}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={Colors.placeholder}
                  value={directCashInput ? Number(directCashInput.replace(/\D/g, '')).toLocaleString('id-ID') : ''}
                  onChangeText={(val) => setDirectCashInput(val)}
                />
              </View>
            </View>
          )}

          {/* Total Uang Fisik & Selisih Summary Card */}
          <View style={styles.reconcileSummaryBox}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryItemLabel}>Total Uang Fisik</Text>
              <Text style={styles.summaryItemVal}>{formatIDR(actualCashCalculated)}</Text>
            </View>

            <View style={styles.summaryItem}>
              <Text style={styles.summaryItemLabel}>Saldo Seharusnya</Text>
              <Text style={styles.summaryItemVal}>{formatIDR(expectedCash)}</Text>
            </View>

            <View style={styles.summaryItem}>
              <Text style={styles.summaryItemLabel}>Selisih</Text>
              <Text
                style={[
                  styles.summaryItemVal,
                  {
                    color:
                      difference === 0
                        ? '#16A34A'
                        : difference > 0
                        ? '#D97706'
                        : '#DC2626',
                    fontWeight: '800',
                  },
                ]}
              >
                {difference === 0
                  ? 'Rp 0 (Pas)'
                  : difference > 0
                  ? `+${formatIDR(difference)}`
                  : `-${formatIDR(Math.abs(difference))}`}
              </Text>
            </View>
          </View>

          {/* Catatan / Keterangan Kasir */}
          <TextInput
            style={styles.reconcileNotesInput}
            placeholder="Catatan tutup kasir (opsional, misal: sisa uang kembalian ditaruh di brankas)..."
            placeholderTextColor={Colors.placeholder}
            value={notesInput}
            onChangeText={setNotesInput}
            multiline
            numberOfLines={2}
          />

          {/* Tombol Simpan Rekonsiliasi */}
          <TouchableOpacity
            style={styles.saveReconcileBtn}
            onPress={handleSaveReconciliation}
            disabled={savingReconcile}
            activeOpacity={0.8}
          >
            {savingReconcile ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="save-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.saveReconcileBtnText}>Simpan Rekonsiliasi Kasir</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* History Tutup Kasir Sebelumnya */}
        {history.length > 0 && (
          <View style={styles.historySection}>
            <Text style={styles.historyTitle}>Riwayat Rekonsiliasi Terakhir</Text>
            {history.slice(0, 5).map(item => (
              <View key={item.id} style={styles.historyCard}>
                <View>
                  <Text style={styles.historyDate}>{item.dateStr}</Text>
                  <Text style={styles.historyDetails}>
                    Fisik: {formatIDR(item.actualCash)} | Sistem: {formatIDR(item.expectedCash)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.historyBadge,
                    item.status === 'balanced'
                      ? styles.historyBadgeBalanced
                      : item.status === 'surplus'
                      ? styles.historyBadgeSurplus
                      : styles.historyBadgeDeficit,
                  ]}
                >
                  <Text
                    style={[
                      styles.historyBadgeText,
                      item.status === 'balanced'
                        ? styles.historyBadgeTextBalanced
                        : item.status === 'surplus'
                        ? styles.historyBadgeTextSurplus
                        : styles.historyBadgeTextDeficit,
                    ]}
                  >
                    {item.status === 'balanced'
                      ? 'Balance'
                      : item.status === 'surplus'
                      ? `+${formatIDR(item.difference)}`
                      : `-${formatIDR(Math.abs(item.difference))}`}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Modal Edit Modal Kas Awal */}
      <Modal visible={modalStartingCash} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalCardTitle}>Atur Modal Kas Awal</Text>
            <Text style={styles.modalCardDesc}>
              Masukkan jumlah modal uang kembalian saat membuka kasir hari ini.
            </Text>

            <View style={styles.modalInputWrap}>
              <Text style={styles.modalRp}>Rp</Text>
              <TextInput
                style={styles.modalInput}
                keyboardType="numeric"
                placeholder="0"
                value={startingCashInput ? Number(startingCashInput.replace(/\D/g, '')).toLocaleString('id-ID') : ''}
                onChangeText={setStartingCashInput}
              />
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setModalStartingCash(false)}
              >
                <Text style={styles.modalCancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleUpdateStartingCash}
              >
                <Text style={styles.modalConfirmText}>Simpan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F6FB',
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: Colors.muted,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    padding: 6,
    marginRight: 8,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 11,
    color: Colors.muted,
    marginTop: 1,
  },
  refreshBtn: {
    padding: 6,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1.5,
  },
  statusBannerNeutral: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
  },
  statusBannerBalanced: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  statusBannerSurplus: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  statusBannerDeficit: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  statusBannerIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  statusBannerDesc: {
    fontSize: 11,
    color: '#475569',
    marginTop: 3,
    lineHeight: 15,
  },
  flowCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadows.sm,
  },
  flowCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
  },
  flowRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
  },
  flowRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  flowLabel: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
  },
  flowSubLabel: {
    fontSize: 10,
    color: Colors.muted,
  },
  flowVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  editStartingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  flowDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 10,
  },
  expectedTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  expectedAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.primary,
  },
  nonCashInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  nonCashInfoText: {
    fontSize: 10,
    color: Colors.muted,
    marginLeft: 6,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    marginHorizontal: 3,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  countSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadows.sm,
  },
  countHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  countTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  countSubtitle: {
    fontSize: 11,
    color: Colors.muted,
    marginTop: 1,
  },
  toggleModeBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  toggleModeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primary,
  },
  denominationsWrap: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 6,
  },
  denomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  denomLabelBox: {
    width: 95,
  },
  denomName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  denomInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 8,
    marginHorizontal: 8,
  },
  denomInput: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    paddingVertical: 4,
  },
  denomUnit: {
    fontSize: 10,
    color: Colors.muted,
  },
  denomSubtotal: {
    width: 95,
    textAlign: 'right',
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },
  directInputWrap: {
    paddingVertical: 10,
  },
  directInputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  directInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  directRpPrefix: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.primary,
    marginRight: 6,
  },
  directInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  reconcileSummaryBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryItemLabel: {
    fontSize: 10,
    color: Colors.muted,
    marginBottom: 2,
  },
  summaryItemVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  reconcileNotesInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
    fontSize: 12,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
    marginTop: 12,
    textAlignVertical: 'top',
  },
  saveReconcileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 14,
    ...Shadows.sm,
  },
  saveReconcileBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  historySection: {
    marginTop: 8,
  },
  historyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  historyCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  historyDate: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  historyDetails: {
    fontSize: 10,
    color: Colors.muted,
    marginTop: 2,
  },
  historyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  historyBadgeBalanced: {
    backgroundColor: '#ECFDF5',
  },
  historyBadgeSurplus: {
    backgroundColor: '#FFFBEB',
  },
  historyBadgeDeficit: {
    backgroundColor: '#FEF2F2',
  },
  historyBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  historyBadgeTextBalanced: {
    color: '#059669',
  },
  historyBadgeTextSurplus: {
    color: '#D97706',
  },
  historyBadgeTextDeficit: {
    color: '#DC2626',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 360,
  },
  modalCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalCardDesc: {
    fontSize: 12,
    color: Colors.muted,
    marginTop: 4,
    marginBottom: 14,
  },
  modalInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F8FAFC',
    marginBottom: 16,
  },
  modalRp: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
    marginRight: 6,
  },
  modalInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
  },
  modalCancelText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  modalConfirmBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  modalConfirmText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
