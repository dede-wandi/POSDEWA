import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Modal, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { syncPendingProfits } from '../services/walletSupabase';

export default function UnsyncedProfitWarning({ wallets, unsyncedProfits, onSyncSuccess }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  
  const [isSyncingProfit, setIsSyncingProfit] = useState(false);
  const [syncProfitModalVisible, setSyncProfitModalVisible] = useState(false);
  const [syncProfitData, setSyncProfitData] = useState({ totalProfit: 0, totalTrx: 0, cashWallet: null, profitWallet: null });

  if (!unsyncedProfits || unsyncedProfits.length === 0) {
    return null;
  }

  const fmt = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0);

  const handleManualSyncProfit = () => {
    let cashWallet = wallets.find(w => w.type === 'CASH');
    if (!cashWallet) cashWallet = wallets.find(w => (w.name || '').toLowerCase().includes('kasir') || (w.name || '').toLowerCase().includes('laci'));
    
    let profitWallet = wallets.find(w => w.type === 'PROFIT');
    if (!profitWallet) profitWallet = wallets.find(w => (w.name || '').toLowerCase().includes('laba') || (w.name || '').toLowerCase().includes('profit'));

    if (!cashWallet || !profitWallet) {
      showToast('Dompet Kasir atau Laba tidak ditemukan!', 'error');
      return;
    }

    const totalProfit = unsyncedProfits.reduce((sum, item) => sum + Number(item.total_profit), 0);
    const totalTrx = unsyncedProfits.reduce((sum, item) => sum + Number(item.total_transaksi), 0);

    setSyncProfitData({ totalProfit, totalTrx, cashWallet, profitWallet });
    setSyncProfitModalVisible(true);
  };

  const executeManualSyncProfit = async () => {
    setIsSyncingProfit(true);
    const { data, error } = await syncPendingProfits(user?.id, syncProfitData.cashWallet.id, syncProfitData.profitWallet.id);
    setIsSyncingProfit(false);
    setSyncProfitModalVisible(false);
    
    if (data?.success) {
      showToast(`Berhasil menarik Rp ${fmt(data.synced_amount)}`, 'success');
      if (onSyncSuccess) onSyncSuccess();
    } else {
      showToast(data?.message || error?.message || 'Gagal menarik profit', 'error');
    }
  };

  return (
    <>
      <View style={styles.alertContainer}>
        <View style={styles.alertHeader}>
          <Ionicons name="warning-outline" size={20} color="#f59e0b" />
          <Text style={styles.alertTitle}>Profit Belum Ditarik</Text>
        </View>
        <Text style={styles.alertDesc}>
          Anda memiliki profit yang belum disinkronkan ke Dompet Laba:
        </Text>
        {unsyncedProfits.map((item, index) => (
          <View key={index} style={styles.alertItem}>
            <Text style={styles.alertDate}>{item.tanggal}</Text>
            <View style={styles.alertItemRight}>
              <Text style={styles.alertTrx}>{item.total_transaksi} trx</Text>
              <Text style={styles.alertAmount}>{fmt(item.total_profit)}</Text>
            </View>
          </View>
        ))}
        <TouchableOpacity 
          style={[styles.alertBtn, isSyncingProfit && { opacity: 0.7 }]} 
          onPress={handleManualSyncProfit}
          disabled={isSyncingProfit}
        >
          {isSyncingProfit ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="download-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.alertBtnText}>Tarik Profit Sekarang</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Modal Konfirmasi Tarik Profit */}
      <Modal visible={syncProfitModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Konfirmasi Tarik Profit</Text>
              <TouchableOpacity onPress={() => setSyncProfitModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              <View style={styles.modalIconWrap}>
                <Ionicons name="swap-vertical" size={32} color="#d97706" />
              </View>
              <Text style={styles.modalSub}>
                Anda akan memindahkan total profit sejumlah
              </Text>
              <Text style={styles.modalAmount}>
                Rp {fmt(syncProfitData.totalProfit)}
              </Text>
              <Text style={styles.modalInfo}>
                Dari <Text style={{ fontWeight: 'bold', color: '#374151' }}>{syncProfitData.cashWallet?.name}</Text> ke <Text style={{ fontWeight: 'bold', color: '#374151' }}>{syncProfitData.profitWallet?.name}</Text>
              </Text>
            </View>

            <TouchableOpacity 
              style={[styles.btnAction, { backgroundColor: '#f59e0b', width: '100%', marginBottom: 10 }]} 
              onPress={executeManualSyncProfit}
              disabled={isSyncingProfit}
            >
              {isSyncingProfit ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.btnActionText}>Ya, Pindahkan Sekarang</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.btnAction, { backgroundColor: '#e5e7eb', width: '100%' }]} 
              onPress={() => setSyncProfitModalVisible(false)}
              disabled={isSyncingProfit}
            >
              <Text style={[styles.btnActionText, { color: '#4b5563' }]}>Batal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  alertContainer: { backgroundColor: '#fffbeb', borderColor: '#fcd34d', borderWidth: 1, borderRadius: 12, padding: 16, marginTop: 12, marginBottom: 12 },
  alertHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  alertTitle: { fontSize: 15, fontWeight: 'bold', color: '#92400e', marginLeft: 6 },
  alertDesc: { fontSize: 13, color: '#92400e', marginBottom: 12 },
  alertItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fef3c7', padding: 10, borderRadius: 8, marginBottom: 8 },
  alertDate: { fontSize: 14, fontWeight: '600', color: '#92400e' },
  alertItemRight: { alignItems: 'flex-end' },
  alertTrx: { fontSize: 11, color: '#b45309' },
  alertAmount: { fontSize: 14, fontWeight: 'bold', color: '#92400e' },
  alertBtn: { backgroundColor: '#f59e0b', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8, marginTop: 8 },
  alertBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', maxWidth: 400, backgroundColor: '#FFF', borderRadius: 16, padding: 20, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#0F172A' },
  modalIconWrap: { backgroundColor: '#fef3c7', padding: 16, borderRadius: 50, marginBottom: 16 },
  modalSub: { fontSize: 16, textAlign: 'center', color: '#4b5563', lineHeight: 24 },
  modalAmount: { fontSize: 24, fontWeight: 'bold', color: '#16a34a', marginVertical: 8 },
  modalInfo: { fontSize: 14, textAlign: 'center', color: '#6b7280' },
  btnAction: { paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  btnActionText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 }
});
