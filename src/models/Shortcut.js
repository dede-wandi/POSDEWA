import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const TOKO_GREEN = '#03AC0E';

/**
 * Base class representing a general menu shortcut.
 */
export class BaseShortcut {
  constructor(key, label, defaultIcon, defaultColor, defaultBg, defaultBorder = '#E5E7EB', badgeText = null) {
    this.key = key;
    this.label = label;
    this.defaultIcon = defaultIcon;
    this.defaultColor = defaultColor;
    this.defaultBg = defaultBg;
    this.defaultBorder = defaultBorder;
    this.badgeText = badgeText;
  }

  renderIcon(menuConfigs, menuErrors, setMenuErrors) {
    return (
      <View style={[styles.defaultCircle, { backgroundColor: this.defaultBg, borderColor: this.defaultBorder }]}>
        <Ionicons name={this.defaultIcon} size={24} color={this.defaultColor} />
      </View>
    );
  }

  /**
   * Polymorphically handle click presses. Must be overridden.
   */
  onPress(navigation) {
    throw new Error('onPress() must be implemented in subclass');
  }
}

/**
 * Subclass for shortcuts that navigate to specific screens.
 */
export class NavigationShortcut extends BaseShortcut {
  constructor(key, label, defaultIcon, defaultColor, defaultBg, defaultBorder, screenName, params = {}, badgeText = null) {
    super(key, label, defaultIcon, defaultColor, defaultBg, defaultBorder, badgeText);
    this.screenName = screenName;
    this.params = params;
  }

  onPress(navigation) {
    if (navigation) {
      navigation.navigate(this.screenName, this.params);
    }
  }
}

/**
 * Subclass for shortcuts that perform custom callbacks or actions.
 */
export class ActionShortcut extends BaseShortcut {
  constructor(key, label, defaultIcon, defaultColor, defaultBg, defaultBorder, actionFn, badgeText = null) {
    super(key, label, defaultIcon, defaultColor, defaultBg, defaultBorder, badgeText);
    this.actionFn = actionFn;
  }

  onPress(navigation) {
    if (this.actionFn) {
      this.actionFn(navigation);
    }
  }
}

/**
 * Centered metadata configurations for MenuSettingsScreen.
 */
export const DEFAULT_MENUS_METADATA = [
  {
    key: 'kasir',
    label: 'Kasir',
    defaultIcon: 'cart-outline',
    defaultColor: '#3B82F6',
    defaultBg: '#EFF6FF',
    defaultBorder: '#DBEAFE',
  },
  {
    key: 'produk',
    label: 'Produk',
    defaultIcon: 'cube-outline',
    defaultColor: TOKO_GREEN,
    defaultBg: '#E8F5E9',
    defaultBorder: '#C8E6C9',
  },
  {
    key: 'annual_profit',
    label: 'Laporan Profit',
    defaultIcon: 'pie-chart-outline',
    defaultColor: '#8B5CF6',
    defaultBg: '#F5F3FF',
    defaultBorder: '#EDE9FE',
  },
  {
    key: 'riwayat',
    label: 'Riwayat',
    defaultIcon: 'time-outline',
    defaultColor: '#F59E0B',
    defaultBg: '#FFFBEB',
    defaultBorder: '#FEF3C7',
  },
  {
    key: 'barcode',
    label: 'Barcode',
    defaultIcon: 'barcode-outline',
    defaultColor: '#475569',
    defaultBg: '#F8FAFC',
    defaultBorder: '#E2E8F0',
  },
  {
    key: 'stok',
    label: 'Stok',
    defaultIcon: 'layers-outline',
    defaultColor: '#EF4444',
    defaultBg: '#FEF2F2',
    defaultBorder: '#FEE2E2',
  },
  {
    key: 'laporan',
    label: 'Penjualan',
    defaultIcon: 'document-text-outline',
    defaultColor: '#0D9488',
    defaultBg: '#F0FDFA',
    defaultBorder: '#CCFBF1',
  },
  {
    key: 'more',
    label: 'More',
    defaultIcon: 'grid-outline',
    defaultColor: '#4F46E5',
    defaultBg: '#EEF2FF',
    defaultBorder: '#E0E7FF',
  }
];

/**
 * Generate dashboard shortcuts list.
 */
export const getDashboardShortcuts = () => {
  return [
    new NavigationShortcut('kasir', 'Kasir', 'cart-outline', '#3B82F6', '#EFF6FF', '#DBEAFE', 'Penjualan', {}, 'HOT'),
    new NavigationShortcut('produk', 'Produk', 'cube-outline', TOKO_GREEN, '#E8F5E9', '#C8E6C9', 'Produk', { screen: 'DaftarProduk' }),
    new NavigationShortcut('annual_profit', 'Laporan Profit', 'pie-chart-outline', '#8B5CF6', '#F5F3FF', '#EDE9FE', 'AnnualProfitReport', {}, 'NEW'),
    new NavigationShortcut('riwayat', 'Riwayat', 'time-outline', '#F59E0B', '#FFFBEB', '#FEF3C7', 'History'),
    new NavigationShortcut('barcode', 'Barcode', 'barcode-outline', '#475569', '#F8FAFC', '#E2E8F0', 'Scan'),
    new NavigationShortcut('stok', 'Stok', 'layers-outline', '#EF4444', '#FEF2F2', '#FEE2E2', 'StockManagement'),
    new NavigationShortcut('laporan', 'Penjualan', 'document-text-outline', '#0D9488', '#F0FDFA', '#CCFBF1', 'SalesReport'),
    new NavigationShortcut('more', 'More', 'grid-outline', '#4F46E5', '#EEF2FF', '#E0E7FF', 'MoreMenu')
  ];
};

const styles = StyleSheet.create({
  imageContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  defaultCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0,
  }
});
