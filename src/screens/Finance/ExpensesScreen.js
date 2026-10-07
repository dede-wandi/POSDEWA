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
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  getExpenses,
  createExpense,
  deleteExpense,
  getExpenseSummary,
  EXPENSE_CATEGORIES,
  PAYMENT_SOURCES,
} from '../../services/expenseSupabase';
import { formatIDR } from '../../utils/currency';
import { Colors, Spacing, Radii, Shadows } from '../../theme';

export default function ExpensesScreen({ navigation }) {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('month'); // 'today', 'month', 'year', 'all'
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');

  // Modal Input Pengeluaran
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [amountInput, setAmountInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('operational');
  const [selectedSource, setSelectedSource] = useState('cash');
  const [descriptionInput, setDescriptionInput] = useState('');

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [sumRes, expRes] = await Promise.all([
        getExpenseSummary(user.id, selectedPeriod),
        getExpenses(user.id, {
          category: selectedCategoryFilter !== 'all' ? selectedCategoryFilter : null,
        }),
      ]);

      if (sumRes.success) setSummary(sumRes.data);
      if (expRes.success) setExpenses(expRes.data);
    } catch {
      showToast('Gagal memuat data pengeluaran', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, selectedPeriod, selectedCategoryFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleCreateExpense = async () => {
    const rawNumber = amountInput.replace(/\D/g, '');
    const num = Number(rawNumber);

    if (!num || num <= 0) {
      showToast('Masukkan nominal pengeluaran yang valid', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const res = await createExpense(user?.id, {
        amount: num,
        category: selectedCategory,
        source: selectedSource,
        description: descriptionInput.trim(),
      });

      if (res.success) {
        showToast('Pengeluaran berhasil dicatat!', 'success');
        setModalVisible(false);
        setAmountInput('');
        setDescriptionInput('');
        loadData();
      } else {
        showToast(res.error || 'Gagal menyimpan pengeluaran', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteExpense = (item) => {
    Alert.alert(
      'Hapus Pengeluaran',
      `Yakin ingin menghapus catatan pengeluaran sebesar ${formatIDR(item.amount)}?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            const res = await deleteExpense(user?.id, item.id);
            if (res.success) {
              showToast('Pengeluaran dihapus', 'success');
              loadData();
            } else {
              showToast('Gagal menghapus pengeluaran', 'error');
            }
          },
        },
      ]
    );
  };

  const formatAmountText = (val) => {
    const clean = val.replace(/\D/g, '');
    if (!clean) return '';
    return Number(clean).toLocaleString('id-ID');
  };

  const getCategoryMeta = (catId) => {
    return EXPENSE_CATEGORIES.find(c => c.id === catId) || EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1];
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Memuat Pengeluaran...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const totalExpenseAmount = summary?.totalAmount || 0;
  const cashExpenseAmount = summary?.cashAmount || 0;
  const nonCashExpenseAmount = summary?.nonCashAmount || 0;

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
          <Text style={styles.headerTitle}>Pengeluaran & Biaya</Text>
          <Text style={styles.headerSubtitle}>Catat Biaya Operasional & Arus Kas Keluar</Text>
        </View>
        <TouchableOpacity
          onPress={() => setModalVisible(true)}
          style={styles.addHeaderBtn}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.addHeaderBtnText}>Catat</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
      >
        {/* Period Selector */}
        <View style={styles.periodRow}>
          {[
            { id: 'today', label: 'Hari Ini' },
            { id: 'month', label: 'Bulan Ini' },
            { id: 'year', label: 'Tahun Ini' },
            { id: 'all', label: 'Semua' },
          ].map(p => (
            <TouchableOpacity
              key={p.id}
              style={[styles.periodBtn, selectedPeriod === p.id && styles.periodBtnActive]}
              onPress={() => setSelectedPeriod(p.id)}
            >
              <Text style={[styles.periodBtnText, selectedPeriod === p.id && styles.periodBtnTextActive]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Hero Card Total Expense */}
        <View style={styles.heroCard}>
          <View style={styles.heroRow}>
            <View>
              <Text style={styles.heroSub}>TOTAL PENGELUARAN ({selectedPeriod === 'today' ? 'HARI INI' : selectedPeriod === 'month' ? 'BULAN INI' : 'PERIODE INI'})</Text>
              <Text style={styles.heroAmount}>{formatIDR(totalExpenseAmount)}</Text>
            </View>
            <View style={styles.heroIconBox}>
              <Ionicons name="wallet" size={26} color="#fff" />
            </View>
          </View>

          <View style={styles.heroDivider} />

          <View style={styles.heroSubGrid}>
            <View style={styles.heroSubItem}>
              <Text style={styles.heroSubLabel}>Kas Tunai (Laci Kasir)</Text>
              <Text style={styles.heroSubVal}>{formatIDR(cashExpenseAmount)}</Text>
              <Text style={styles.heroSubHint}>Mengurangi saldo kas fisik</Text>
            </View>
            <View style={styles.heroSubItem}>
              <Text style={styles.heroSubLabel}>Bank / Non-Tunai</Text>
              <Text style={styles.heroSubVal}>{formatIDR(nonCashExpenseAmount)}</Text>
              <Text style={styles.heroSubHint}>Transfer & e-wallet</Text>
            </View>
          </View>
        </View>

        {/* Relations Banner to Cash Reconciliation */}
        <TouchableOpacity
          style={styles.reconcileBanner}
          onPress={() => navigation.navigate('CashReconciliation')}
          activeOpacity={0.85}
        >
          <View style={styles.reconcileIconBox}>
            <Ionicons name="calculator" size={22} color="#0284C7" />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.reconcileTitle}>Cek Keseimbangan Saldo Fisik</Text>
            <Text style={styles.reconcileDesc}>
              Pastikan pengeluaran kas tunai cocok dengan sisa uang fisik di laci kasir.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#0284C7" />
        </TouchableOpacity>

        {/* Category Filter Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
          <TouchableOpacity
            style={[styles.categoryChip, selectedCategoryFilter === 'all' && styles.categoryChipActive]}
            onPress={() => setSelectedCategoryFilter('all')}
          >
            <Text style={[styles.categoryChipText, selectedCategoryFilter === 'all' && styles.categoryChipTextActive]}>
              Semua Kategori
            </Text>
          </TouchableOpacity>
          {EXPENSE_CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.categoryChip, selectedCategoryFilter === cat.id && styles.categoryChipActive]}
              onPress={() => setSelectedCategoryFilter(cat.id)}
            >
              <Text style={[styles.categoryChipText, selectedCategoryFilter === cat.id && styles.categoryChipTextActive]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Expenses List */}
        <View style={styles.listSection}>
          <Text style={styles.listTitle}>
            Riwayat Pengeluaran ({expenses.length})
          </Text>

          {expenses.map((item, idx) => {
            const cat = getCategoryMeta(item.category);
            const isCash = item.source === 'cash' || !item.source;
            const dateStr = item.created_at
              ? new Date(item.created_at).toLocaleDateString('id-ID', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '-';

            return (
              <View key={item.id || idx} style={styles.expenseCard}>
                <View style={[styles.expenseIconBox, { backgroundColor: cat.bg }]}>
                  <Ionicons name={cat.icon} size={22} color={cat.color} />
                </View>

                <View style={styles.expenseInfo}>
                  <Text style={styles.expenseCatName}>{cat.label}</Text>
                  {item.description ? (
                    <Text style={styles.expenseDesc} numberOfLines={2}>
                      {item.description}
                    </Text>
                  ) : null}
                  <View style={styles.expenseMetaRow}>
                    <Text style={styles.expenseDate}>{dateStr}</Text>
                    <View style={[styles.sourceBadge, isCash ? styles.sourceBadgeCash : styles.sourceBadgeBank]}>
                      <Text style={[styles.sourceBadgeText, isCash ? styles.sourceBadgeTextCash : styles.sourceBadgeTextBank]}>
                        {isCash ? 'Kas Tunai' : 'Bank/Non-Tunai'}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.expenseAmountWrap}>
                  <Text style={styles.expenseAmount}>-{formatIDR(item.amount)}</Text>
                  <TouchableOpacity
                    onPress={() => handleDeleteExpense(item)}
                    style={styles.deleteBtn}
                  >
                    <Ionicons name="trash-outline" size={16} color={Colors.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}

          {expenses.length === 0 && (
            <View style={styles.emptyBox}>
              <Ionicons name="receipt-outline" size={44} color={Colors.placeholder} />
              <Text style={styles.emptyTitle}>Belum Ada Pengeluaran</Text>
              <Text style={styles.emptySub}>Klik tombol '+ Catat' di atas untuk mencatat pengeluaran baru.</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Modal Catat Pengeluaran */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Catat Pengeluaran Baru</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              {/* Input Nominal */}
              <Text style={styles.inputLabel}>Nominal Pengeluaran (Rp) *</Text>
              <View style={styles.amountInputWrap}>
                <Text style={styles.rpPrefix}>Rp</Text>
                <TextInput
                  style={styles.amountInput}
                  placeholder="0"
                  placeholderTextColor={Colors.placeholder}
                  keyboardType="numeric"
                  value={amountInput}
                  onChangeText={(val) => setAmountInput(formatAmountText(val))}
                />
              </View>

              {/* Quick Preset Buttons */}
              <View style={styles.quickPresetRow}>
                {[10000, 20000, 50000, 100000, 250000].map(amt => (
                  <TouchableOpacity
                    key={amt}
                    style={styles.presetChip}
                    onPress={() => setAmountInput(amt.toLocaleString('id-ID'))}
                  >
                    <Text style={styles.presetChipText}>{amt / 1000}k</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Kategori Pengeluaran */}
              <Text style={styles.inputLabel}>Kategori Pengeluaran *</Text>
              <View style={styles.categoryGrid}>
                {EXPENSE_CATEGORIES.map(cat => {
                  const isSelected = selectedCategory === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.catGridItem,
                        isSelected && { borderColor: cat.color, backgroundColor: cat.bg },
                      ]}
                      onPress={() => setSelectedCategory(cat.id)}
                    >
                      <Ionicons name={cat.icon} size={18} color={isSelected ? cat.color : '#64748B'} />
                      <Text
                        style={[
                          styles.catGridText,
                          isSelected && { color: cat.color, fontWeight: '700' },
                        ]}
                      >
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Sumber Pembayaran */}
              <Text style={styles.inputLabel}>Sumber Dana / Kas *</Text>
              <View style={styles.sourceGrid}>
                {PAYMENT_SOURCES.map(src => {
                  const isSelected = selectedSource === src.id;
                  return (
                    <TouchableOpacity
                      key={src.id}
                      style={[
                        styles.sourceItem,
                        isSelected && styles.sourceItemActive,
                      ]}
                      onPress={() => setSelectedSource(src.id)}
                    >
                      <Ionicons
                        name={src.icon}
                        size={18}
                        color={isSelected ? Colors.primary : '#64748B'}
                      />
                      <Text
                        style={[
                          styles.sourceText,
                          isSelected && styles.sourceTextActive,
                        ]}
                      >
                        {src.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Catatan / Keterangan */}
              <Text style={styles.inputLabel}>Catatan / Keterangan</Text>
              <TextInput
                style={styles.descInput}
                placeholder="Contoh: Beli kantong plastik & struk thermal"
                placeholderTextColor={Colors.placeholder}
                value={descriptionInput}
                onChangeText={setDescriptionInput}
                multiline
                numberOfLines={3}
              />

              {/* Submit Button */}
              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleCreateExpense}
                disabled={submitting}
                activeOpacity={0.8}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>Simpan Pengeluaran</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
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
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 11,
    color: Colors.muted,
    marginTop: 1,
  },
  addHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.danger,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
  },
  addHeaderBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 3,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  periodRow: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    padding: 3,
    marginBottom: 14,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
  },
  periodBtnActive: {
    backgroundColor: '#FFFFFF',
    ...Shadows.sm,
  },
  periodBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  periodBtnTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  heroCard: {
    backgroundColor: '#DC2626',
    borderRadius: 20,
    padding: 20,
    marginBottom: 14,
    ...Shadows.md,
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroSub: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FECACA',
    letterSpacing: 0.5,
  },
  heroAmount: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 4,
  },
  heroIconBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginVertical: 14,
  },
  heroSubGrid: {
    flexDirection: 'row',
  },
  heroSubItem: {
    flex: 1,
  },
  heroSubLabel: {
    fontSize: 11,
    color: '#FEE2E2',
  },
  heroSubVal: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 2,
  },
  heroSubHint: {
    fontSize: 9,
    color: '#FECACA',
    marginTop: 1,
  },
  reconcileBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  reconcileIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reconcileTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0369A1',
  },
  reconcileDesc: {
    fontSize: 11,
    color: '#0284C7',
    marginTop: 2,
    lineHeight: 15,
  },
  categoryScroll: {
    marginBottom: 14,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: '#E2E8F0',
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: Colors.primary,
  },
  categoryChipText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
  },
  listSection: {
    marginTop: 2,
  },
  listTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 10,
  },
  expenseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  expenseIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  expenseInfo: {
    flex: 1,
    marginRight: 8,
  },
  expenseCatName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  expenseDesc: {
    fontSize: 11,
    color: '#475569',
    marginTop: 2,
  },
  expenseMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  expenseDate: {
    fontSize: 10,
    color: Colors.muted,
    marginRight: 8,
  },
  sourceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  sourceBadgeCash: {
    backgroundColor: '#ECFDF5',
  },
  sourceBadgeBank: {
    backgroundColor: '#EFF6FF',
  },
  sourceBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  sourceBadgeTextCash: {
    color: '#059669',
  },
  sourceBadgeTextBank: {
    color: '#2563EB',
  },
  expenseAmountWrap: {
    alignItems: 'flex-end',
  },
  expenseAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.danger,
    marginBottom: 4,
  },
  deleteBtn: {
    padding: 4,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 36,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
    marginTop: 8,
  },
  emptySub: {
    fontSize: 12,
    color: Colors.muted,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 260,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalScroll: {
    padding: 18,
    paddingBottom: 40,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
    marginTop: 10,
  },
  amountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#DC2626',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FEF2F2',
  },
  rpPrefix: {
    fontSize: 18,
    fontWeight: '700',
    color: '#DC2626',
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    padding: 0,
  },
  quickPresetRow: {
    flexDirection: 'row',
    marginTop: 8,
    justifyContent: 'space-between',
  },
  presetChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
  },
  presetChipText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  catGridItem: {
    width: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
    margin: 4,
    backgroundColor: '#F8FAFC',
  },
  catGridText: {
    fontSize: 11,
    color: '#334155',
    marginLeft: 6,
    flex: 1,
  },
  sourceGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sourceItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
    marginHorizontal: 3,
    backgroundColor: '#F8FAFC',
  },
  sourceItemActive: {
    borderColor: Colors.primary,
    backgroundColor: '#EEF2FF',
  },
  sourceText: {
    fontSize: 11,
    color: '#475569',
    marginLeft: 4,
    fontWeight: '600',
  },
  sourceTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  descInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
    textAlignVertical: 'top',
  },
  submitBtn: {
    backgroundColor: Colors.danger,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
    ...Shadows.md,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
