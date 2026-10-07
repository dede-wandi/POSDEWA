import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../../../../theme';

/**
 * Toolbar for Search, Filter Chips, Quick Navigation, and Export actions.
 */
export function ValuationFilterToolbar({
  navigation,
  searchQuery,
  setSearchQuery,
  activeTab,
  setActiveTab,
  typeCounts,
  exporting,
  onExportExcel,
  refreshing,
  onRefresh,
}) {
  return (
    <View style={styles.container}>
      {/* Quick Relations Action Buttons */}
      <View style={styles.quickNavRow}>
        <TouchableOpacity
          style={[styles.quickNavBtn, { backgroundColor: '#EFF6FF' }]}
          onPress={() => navigation.navigate('StockManagement')}
          activeOpacity={0.8}
        >
          <Ionicons name="layers-outline" size={18} color="#3B82F6" />
          <Text style={[styles.quickNavText, { color: '#1D4ED8' }]}>Kelola Stok</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.quickNavBtn, { backgroundColor: '#ECFDF5' }]}
          onPress={() => navigation.navigate('SalesReport')}
          activeOpacity={0.8}
        >
          <Ionicons name="document-text-outline" size={18} color="#10B981" />
          <Text style={[styles.quickNavText, { color: '#047857' }]}>Laporan Sales</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.quickNavBtn, { backgroundColor: '#FFFBEB' }]}
          onPress={() => navigation.navigate('CashReconciliation')}
          activeOpacity={0.8}
        >
          <Ionicons name="wallet-outline" size={18} color="#F59E0B" />
          <Text style={[styles.quickNavText, { color: '#B45309' }]}>Rekonsiliasi Kas</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color={Colors.muted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Cari nama produk, tipe, barcode, atau nama penitip..."
          placeholderTextColor={Colors.placeholder}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color={Colors.muted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs Filter Kategori Tipe & Kondisi Stok */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsWrap}>
        <TouchableOpacity
          style={[styles.tabChip, activeTab === 'all' && styles.tabChipActive]}
          onPress={() => setActiveTab('all')}
        >
          <Text style={[styles.tabChipText, activeTab === 'all' && styles.tabChipTextActive]}>
            Semua ({typeCounts.all || 0})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabChip, activeTab === 'physical' && styles.tabChipActive]}
          onPress={() => setActiveTab('physical')}
        >
          <Text style={[styles.tabChipText, activeTab === 'physical' && styles.tabChipTextActive]}>
            📦 Fisik & Voucher ({typeCounts.physical || 0})
          </Text>
        </TouchableOpacity>

        {Boolean(typeCounts.consignment > 0) && (
          <TouchableOpacity
            style={[styles.tabChip, activeTab === 'consignment' && styles.tabChipActive]}
            onPress={() => setActiveTab('consignment')}
          >
            <Text style={[styles.tabChipText, activeTab === 'consignment' && styles.tabChipTextActive]}>
              🤝 Titipan ({typeCounts.consignment})
            </Text>
          </TouchableOpacity>
        )}

        {Boolean(typeCounts.digital > 0) && (
          <TouchableOpacity
            style={[styles.tabChip, activeTab === 'digital' && styles.tabChipActive]}
            onPress={() => setActiveTab('digital')}
          >
            <Text style={[styles.tabChipText, activeTab === 'digital' && styles.tabChipTextActive]}>
              ⚡ Digital/PPOB ({typeCounts.digital})
            </Text>
          </TouchableOpacity>
        )}



        {Boolean(typeCounts.service > 0) && (
          <TouchableOpacity
            style={[styles.tabChip, activeTab === 'service' && styles.tabChipActive]}
            onPress={() => setActiveTab('service')}
          >
            <Text style={[styles.tabChipText, activeTab === 'service' && styles.tabChipTextActive]}>
              💳 Jasa/Admin ({typeCounts.service})
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.tabChip, activeTab === 'low' && styles.tabChipActive]}
          onPress={() => setActiveTab('low')}
        >
          <Text style={[styles.tabChipText, activeTab === 'low' && styles.tabChipTextActive]}>
            Stok Menipis ({typeCounts.low || 0})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabChip, activeTab === 'empty' && styles.tabChipActive]}
          onPress={() => setActiveTab('empty')}
        >
          <Text style={[styles.tabChipText, activeTab === 'empty' && styles.tabChipTextActive]}>
            Stok Habis ({typeCounts.empty || 0})
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Action Toolbar */}
      <View style={styles.toolbarContainer}>
        <View style={styles.actionButtonGroup}>
          {onRefresh && (
            <TouchableOpacity
              style={styles.refreshToolbarBtn}
              onPress={onRefresh}
              activeOpacity={0.8}
              disabled={refreshing}
              accessibilityLabel="Refresh Data Valuasi"
            >
              {refreshing ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <>
                  <Ionicons name="refresh" size={15} color={Colors.primary} />
                  <Text style={styles.refreshToolbarBtnText}>Refresh</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.exportBtn}
            onPress={onExportExcel}
            activeOpacity={0.8}
            disabled={exporting}
          >
            {exporting ? (
              <ActivityIndicator size="small" color="#047857" />
            ) : (
              <>
                <Ionicons name="document-text" size={15} color="#047857" />
                <Text style={styles.exportBtnText}>Export .xlsx</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Table Notice */}
      <View style={styles.tableHintBox}>
        <Ionicons name="information-circle-outline" size={15} color="#3B82F6" />
        <Text style={styles.tableHintText}>
          Tips: Kolom TIPE membedakan barang Fisik, Titipan, dan Digital. Tabel menyesuaikan lebar layar secara otomatis.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 4,
  },
  quickNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  quickNavBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 12,
    marginHorizontal: 3,
  },
  quickNavText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    marginLeft: 8,
    paddingVertical: 2,
  },
  tabsWrap: {
    marginBottom: 14,
  },
  tabChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#E2E8F0',
    marginRight: 8,
  },
  tabChipActive: {
    backgroundColor: Colors.primary,
  },
  tabChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  tabChipTextActive: {
    color: '#FFFFFF',
  },
  toolbarContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 10,
  },
  actionButtonGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  refreshToolbarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  refreshToolbarBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
    marginLeft: 5,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  exportBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#047857',
    marginLeft: 5,
  },
  tableHintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  tableHintText: {
    fontSize: 11,
    color: '#1E40AF',
    marginLeft: 6,
    flex: 1,
  },
});
