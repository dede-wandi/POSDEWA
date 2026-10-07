import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ConfirmModal from '../../../../components/ConfirmModal';
import { deleteProduct } from '../../../../services/products';
import { EditableProduct } from '../../../../models/EditableProductModel';
import { PRODUCT_TYPES } from '../../../../services/productTypeService';
import { formatIDR } from '../../../../utils/currency';
import { Colors, Shadows } from '../../../../theme';

/**
 * Excel-like Inline Editable Spreadsheet Table Component for Products Admin.
 * Features:
 * 1. Auto-Save with debounce & on-blur persistence
 * 2. Dedicated Dropdowns for Tipe Produk & Kategori
 * 3. Front-and-Center column positioning for Modal (HPP), Harga Jual, and Laba
 */
export function ProductEditableTable({
  products = [],
  categories = [],
  brands = [],
  navigation,
  userId,
  showToast,
  onProductUpdated,
  onDeleteProduct,
}) {
  const [modelMap, setModelMap] = useState({});
  const [focusedCell, setFocusedCell] = useState(null);
  const [globalSavingCount, setGlobalSavingCount] = useState(0);

  // Internal ConfirmModal state (fallback if onDeleteProduct is not provided)
  const [internalConfirm, setInternalConfirm] = useState({
    visible: false,
    id: null,
    name: '',
  });

  const handleDeleteClick = (productId, productName) => {
    if (onDeleteProduct) {
      onDeleteProduct(productId, productName);
    } else {
      setInternalConfirm({
        visible: true,
        id: productId,
        name: productName || 'produk ini',
      });
    }
  };

  const handlePerformInternalDelete = async () => {
    const { id, name } = internalConfirm;
    setInternalConfirm({ visible: false, id: null, name: '' });
    if (!id || !userId) return;

    try {
      if (debounceTimersRef.current[id]) {
        clearTimeout(debounceTimersRef.current[id]);
        delete debounceTimersRef.current[id];
      }
      setModelMap(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await deleteProduct(userId, id);
      showToast?.(`Produk "${name}" telah dihapus`, 'success');
      onProductUpdated?.();
    } catch (err) {
      showToast?.(`Gagal menghapus produk: ${err.message}`, 'error');
    }
  };

  // Modal Picker state for mobile/native platforms
  const [pickerModal, setPickerModal] = useState({
    visible: false,
    type: null, // 'productType' or 'category'
    productId: null,
    title: '',
  });

  const debounceTimersRef = useRef({});

  // Synchronize incoming products into domain models without overwriting active dirty drafts
  useEffect(() => {
    setModelMap(prev => {
      const next = { ...prev };
      products.forEach(p => {
        if (!p || !p.id) return;
        if (!next[p.id]) {
          next[p.id] = new EditableProduct(p);
        } else if (!next[p.id].isDirty()) {
          next[p.id] = new EditableProduct(p);
        }
      });
      return next;
    });
  }, [products]);

  // Clean up debounce timers on unmount
  useEffect(() => {
    const timers = debounceTimersRef.current;
    return () => {
      Object.values(timers).forEach(t => clearTimeout(t));
    };
  }, []);

  const [, setTick] = useState(0);
  const triggerRender = useCallback(() => setTick(t => t + 1), []);

  // Core Auto-Save execution
  const executeAutoSave = useCallback(
    async (productId) => {
      const item = modelMap[productId];
      if (!item || !item.isDirty()) return;

      const validation = item.validate();
      if (!validation.isValid) {
        triggerRender();
        return;
      }

      setGlobalSavingCount(c => c + 1);
      triggerRender();

      try {
        await item.save(userId);
        triggerRender();
        onProductUpdated?.();

        // Clear "Tersimpan" badge after 2.5 seconds
        setTimeout(() => {
          if (item) {
            item.savedJustNow = false;
            triggerRender();
          }
        }, 2500);
      } catch (err) {
        showToast?.(err.message || 'Gagal menyimpan perubahan otomatis', 'error');
        triggerRender();
      } finally {
        setGlobalSavingCount(c => Math.max(0, c - 1));
      }
    },
    [modelMap, userId, showToast, onProductUpdated, triggerRender]
  );

  // Trigger auto-save with optional debounce (or immediate on blur / dropdown selection)
  const triggerAutoSave = useCallback(
    (productId, immediate = false) => {
      if (debounceTimersRef.current[productId]) {
        clearTimeout(debounceTimersRef.current[productId]);
      }

      if (immediate) {
        executeAutoSave(productId);
      } else {
        debounceTimersRef.current[productId] = setTimeout(() => {
          executeAutoSave(productId);
        }, 1200);
      }
    },
    [executeAutoSave]
  );

  // Field change handler
  const handleFieldChange = (id, field, value, shouldAutoSave = true) => {
    const item = modelMap[id];
    if (!item) return;

    item.updateField(field, value);
    triggerRender();

    if (shouldAutoSave) {
      triggerAutoSave(id, false);
    }
  };

  // Adjust stock via +/- stepper
  const handleStockStep = (id, delta) => {
    const item = modelMap[id];
    if (!item) return;
    const current = Number(item.stock || 0);
    const next = Math.max(0, current + delta);
    item.updateField('stock', next);
    triggerRender();
    triggerAutoSave(id, false);
  };

  // Open native selection modal
  const openPickerModal = (type, productId, title) => {
    setPickerModal({
      visible: true,
      type,
      productId,
      title,
    });
  };

  const handleSelectPickerOption = (value) => {
    const { type, productId } = pickerModal;
    setPickerModal({ visible: false, type: null, productId: null, title: '' });

    if (!productId) return;

    if (type === 'productType') {
      handleFieldChange(productId, 'productType', value, false);
      triggerAutoSave(productId, true); // Immediate save
    } else if (type === 'brand') {
      handleFieldChange(productId, 'brandId', value || null, false);
      triggerAutoSave(productId, true); // Immediate save
    } else if (type === 'category') {
      handleFieldChange(productId, 'categoryId', value || null, false);
      triggerAutoSave(productId, true); // Immediate save
    }
  };

  const activePickerItem = pickerModal.productId ? modelMap[pickerModal.productId] : null;

  return (
    <View style={styles.outerContainer}>
      {/* Auto-Save Status Banner */}
      <View style={styles.statusBar}>
        <View style={styles.statusLeft}>
          <View style={[styles.statusDot, globalSavingCount > 0 && styles.statusDotSaving]} />
          <Text style={styles.statusText}>
            {globalSavingCount > 0
              ? 'Menyimpan perubahan ke database...'
              : 'Auto-Save Aktif: Setiap perubahan harga, modal, stok & tipe langsung otomatis tersimpan.'}
          </Text>
        </View>

        {globalSavingCount > 0 && (
          <ActivityIndicator size="small" color="#059669" style={{ marginLeft: 8 }} />
        )}
      </View>

      {/* Spreadsheet Table Card */}
      <View style={styles.tableWrapperCard}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={true}
          style={styles.tableScrollView}
          contentContainerStyle={styles.tableScrollContent}
        >
          <View style={styles.tableContainer}>
            {/* Table Header Row (Optimized Column Sequence) */}
            <View style={styles.tableHeaderRow}>
              {/* 1. No */}
              <View style={[styles.cellHeader, styles.colNo]}>
                <Text style={styles.headerTitle}>#</Text>
              </View>

              {/* 2. Barcode */}
              <View style={[styles.cellHeader, styles.colBarcode]}>
                <Text style={styles.headerTitle}>BARCODE / SKU</Text>
              </View>

              {/* 3. Nama Produk */}
              <View style={[styles.cellHeader, styles.colName]}>
                <Text style={styles.headerTitle}>NAMA PRODUK</Text>
              </View>

              {/* 4. Modal (HPP) - FRONT AND CENTER */}
              <View style={[styles.cellHeader, styles.colCost]}>
                <Text style={styles.headerTitle}>MODAL (HPP)</Text>
              </View>

              {/* 5. Harga Jual - FRONT AND CENTER */}
              <View style={[styles.cellHeader, styles.colPrice]}>
                <Text style={styles.headerTitle}>HARGA JUAL</Text>
              </View>

              {/* 6. Laba / Margin - AUTO CALCULATED */}
              <View style={[styles.cellHeader, styles.colMargin]}>
                <Text style={styles.headerTitle}>LABA / MARGIN</Text>
              </View>

              {/* 7. Stok */}
              <View style={[styles.cellHeader, styles.colStock]}>
                <Text style={styles.headerTitle}>STOK</Text>
              </View>

              {/* 8. Tipe Produk (Dropdown) */}
              <View style={[styles.cellHeader, styles.colType]}>
                <Text style={styles.headerTitle}>TIPE</Text>
              </View>

              {/* 9. Brand (Dropdown) */}
              <View style={[styles.cellHeader, styles.colBrand]}>
                <Text style={styles.headerTitle}>BRAND</Text>
              </View>

              {/* 10. Kategori (Dropdown) */}
              <View style={[styles.cellHeader, styles.colCategory]}>
                <Text style={styles.headerTitle}>KATEGORI</Text>
              </View>

              {/* 11. Status / Aksi */}
              <View style={[styles.cellHeader, styles.colStatus]}>
                <Text style={styles.headerTitle}>AKSI</Text>
              </View>
            </View>

            {/* Table Rows */}
            {products.map((raw, idx) => {
              const item = modelMap[raw.id] || new EditableProduct(raw);
              const isEven = idx % 2 === 0;

              return (
                <View
                  key={item.id || idx}
                  style={[
                    styles.tableRow,
                    isEven ? styles.rowEven : styles.rowOdd,
                    item.isDirty() && styles.rowDirty,
                    item.savedJustNow && styles.rowSaved,
                  ]}
                >
                  {/* 1. No */}
                  <View style={[styles.cell, styles.colNo]}>
                    <Text style={styles.noText}>{idx + 1}</Text>
                  </View>

                  {/* 2. Barcode / SKU (Editable) */}
                  <View style={[styles.cell, styles.colBarcode]}>
                    <TextInput
                      style={[
                        styles.cellInput,
                        focusedCell === `${item.id}-barcode` && styles.cellInputFocused,
                      ]}
                      value={item.barcode}
                      placeholder="SKU / Barcode"
                      placeholderTextColor="#94A3B8"
                      selectTextOnFocus={true}
                      onFocus={() => setFocusedCell(`${item.id}-barcode`)}
                      onBlur={() => {
                        setFocusedCell(null);
                        triggerAutoSave(item.id, true);
                      }}
                      onChangeText={val => handleFieldChange(item.id, 'barcode', val)}
                    />
                  </View>

                  {/* 3. Nama Produk (Editable) */}
                  <View style={[styles.cell, styles.colName]}>
                    <TextInput
                      style={[
                        styles.cellInput,
                        styles.nameInput,
                        focusedCell === `${item.id}-name` && styles.cellInputFocused,
                      ]}
                      value={item.name}
                      placeholder="Nama produk..."
                      placeholderTextColor="#94A3B8"
                      onFocus={() => setFocusedCell(`${item.id}-name`)}
                      onBlur={() => {
                        setFocusedCell(null);
                        triggerAutoSave(item.id, true);
                      }}
                      onChangeText={val => handleFieldChange(item.id, 'name', val)}
                    />
                    {item.errorMessage && (
                      <Text style={styles.errorSubText}>{item.errorMessage}</Text>
                    )}
                  </View>

                  {/* 4. Modal (HPP) (Editable) */}
                  <View style={[styles.cell, styles.colCost]}>
                    <View
                      style={[
                        styles.moneyInputWrap,
                        focusedCell === `${item.id}-cost` && styles.cellInputFocused,
                      ]}
                    >
                      <Text style={styles.rpPrefix}>Rp</Text>
                      <TextInput
                        style={styles.moneyInput}
                        keyboardType="numeric"
                        selectTextOnFocus={true}
                        value={String(item.costPrice ?? 0)}
                        placeholder="0"
                        placeholderTextColor="#94A3B8"
                        onFocus={() => setFocusedCell(`${item.id}-cost`)}
                        onBlur={() => {
                          setFocusedCell(null);
                          triggerAutoSave(item.id, true);
                        }}
                        onChangeText={val => handleFieldChange(item.id, 'costPrice', val)}
                      />
                    </View>
                  </View>

                  {/* 5. Harga Jual (Editable) */}
                  <View style={[styles.cell, styles.colPrice]}>
                    <View
                      style={[
                        styles.moneyInputWrap,
                        focusedCell === `${item.id}-price` && styles.cellInputFocused,
                      ]}
                    >
                      <Text style={styles.rpPrefix}>Rp</Text>
                      <TextInput
                        style={styles.moneyInput}
                        keyboardType="numeric"
                        selectTextOnFocus={true}
                        value={String(item.price ?? 0)}
                        placeholder="0"
                        placeholderTextColor="#94A3B8"
                        onFocus={() => setFocusedCell(`${item.id}-price`)}
                        onBlur={() => {
                          setFocusedCell(null);
                          triggerAutoSave(item.id, true);
                        }}
                        onChangeText={val => handleFieldChange(item.id, 'price', val)}
                      />
                    </View>
                  </View>

                  {/* 6. Laba / Margin (Reactive Auto Calculation) */}
                  <View style={[styles.cell, styles.colMargin]}>
                    <Text style={styles.marginText}>{item.formattedProfit}</Text>
                    <Text style={styles.marginPercentText}>
                      ({item.marginPercent.toFixed(1)}%)
                    </Text>
                  </View>

                  {/* 7. Stok (Editable + Steppers) */}
                  <View style={[styles.cell, styles.colStock]}>
                    <View style={styles.stockStepperWrap}>
                      <TouchableOpacity
                        style={styles.stepBtn}
                        onPress={() => handleStockStep(item.id, -1)}
                      >
                        <Text style={styles.stepBtnText}>-</Text>
                      </TouchableOpacity>

                      <TextInput
                        style={[
                          styles.stockInput,
                          focusedCell === `${item.id}-stock` && styles.cellInputFocused,
                        ]}
                        keyboardType="numeric"
                        selectTextOnFocus={true}
                        value={String(item.stock ?? 0)}
                        onFocus={() => setFocusedCell(`${item.id}-stock`)}
                        onBlur={() => {
                          setFocusedCell(null);
                          triggerAutoSave(item.id, true);
                        }}
                        onChangeText={val => handleFieldChange(item.id, 'stock', val)}
                      />

                      <TouchableOpacity
                        style={styles.stepBtn}
                        onPress={() => handleStockStep(item.id, 1)}
                      >
                        <Text style={styles.stepBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* 8. Tipe Produk (Dropdown Selector) */}
                  <View style={[styles.cell, styles.colType]}>
                    {Platform.OS === 'web' ? (
                      <select
                        value={item.productType}
                        onChange={(e) => {
                          const val = e.target.value;
                          handleFieldChange(item.id, 'productType', val, false);
                          triggerAutoSave(item.id, true);
                        }}
                        style={webSelectStyle}
                      >
                        {PRODUCT_TYPES.map(t => (
                          <option key={t.id} value={t.id}>
                            {t.label.split(' ')[0]} {t.label.split(' ')[1] || ''}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <TouchableOpacity
                        style={[styles.dropdownButton, { backgroundColor: item.typeInfo.bg }]}
                        onPress={() => openPickerModal('productType', item.id, 'Pilih Tipe Produk')}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[styles.dropdownButtonText, { color: item.typeInfo.color }]}
                          numberOfLines={1}
                        >
                          {item.typeInfo.label.split(' ')[0]}
                        </Text>
                        <Ionicons name="chevron-down" size={12} color={item.typeInfo.color} />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* 9. Brand (Dropdown Selector) */}
                  <View style={[styles.cell, styles.colBrand]}>
                    {Platform.OS === 'web' ? (
                      <select
                        value={item.brandId || ''}
                        onChange={(e) => {
                          const val = e.target.value || null;
                          handleFieldChange(item.id, 'brandId', val, false);
                          triggerAutoSave(item.id, true);
                        }}
                        style={webSelectStyle}
                      >
                        <option value="">- Brand -</option>
                        {brands.map(b => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <TouchableOpacity
                        style={styles.dropdownButton}
                        onPress={() => openPickerModal('brand', item.id, 'Pilih Brand Produk')}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.categoryDropdownText} numberOfLines={1}>
                          {brands.find(b => b.id === item.brandId)?.name || 'Pilih...'}
                        </Text>
                        <Ionicons name="chevron-down" size={12} color="#64748B" />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* 10. Kategori (Dropdown Selector) */}
                  <View style={[styles.cell, styles.colCategory]}>
                    {Platform.OS === 'web' ? (
                      <select
                        value={item.categoryId || ''}
                        onChange={(e) => {
                          const val = e.target.value || null;
                          handleFieldChange(item.id, 'categoryId', val, false);
                          triggerAutoSave(item.id, true);
                        }}
                        style={webSelectStyle}
                      >
                        <option value="">- Kategori -</option>
                        {categories.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <TouchableOpacity
                        style={styles.dropdownButton}
                        onPress={() => openPickerModal('category', item.id, 'Pilih Kategori Produk')}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.categoryDropdownText} numberOfLines={1}>
                          {categories.find(c => c.id === item.categoryId)?.name || 'Pilih...'}
                        </Text>
                        <Ionicons name="chevron-down" size={12} color="#64748B" />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* 11. Status / Aksi */}
                  <View style={[styles.cell, styles.colStatus]}>
                    <View style={styles.statusActionWrap}>
                      {item.saving ? (
                        <ActivityIndicator size="small" color="#059669" />
                      ) : item.savedJustNow ? (
                        <View style={styles.savedChip}>
                          <Ionicons name="checkmark" size={12} color="#047857" />
                          <Text style={styles.savedChipText}>Ok</Text>
                        </View>
                      ) : (
                        <View style={styles.actionBtnGroup}>
                          <TouchableOpacity
                            style={styles.detailBtn}
                            onPress={() => navigation?.navigate('FormProduk', { id: item.id })}
                            accessibilityLabel="Edit Lengkap"
                          >
                            <Ionicons name="open-outline" size={14} color="#64748B" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.deleteBtn}
                            onPress={() => handleDeleteClick(item.id, item.name)}
                            accessibilityLabel="Hapus Produk"
                          >
                            <Ionicons name="trash-outline" size={14} color="#EF4444" />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              );
            })}

            {products.length === 0 && (
              <View style={styles.emptyContainer}>
                <Ionicons name="cube-outline" size={40} color="#94A3B8" />
                <Text style={styles.emptyText}>Tidak ada produk untuk ditampilkan</Text>
              </View>
            )}
          </View>
        </ScrollView>
      </View>

      {/* Native Modal Picker for Mobile Platforms */}
      <Modal
        visible={pickerModal.visible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setPickerModal({ visible: false, type: null, productId: null, title: '' })}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setPickerModal({ visible: false, type: null, productId: null, title: '' })}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{pickerModal.title}</Text>
              <TouchableOpacity
                onPress={() => setPickerModal({ visible: false, type: null, productId: null, title: '' })}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 320 }}>
              {pickerModal.type === 'productType' &&
                PRODUCT_TYPES.map(t => {
                  const isSelected = activePickerItem?.productType === t.id;
                  return (
                    <TouchableOpacity
                      key={t.id}
                      style={[styles.modalOptionItem, isSelected && styles.modalOptionSelected]}
                      onPress={() => handleSelectPickerOption(t.id)}
                    >
                      <Ionicons
                        name={t.icon}
                        size={18}
                        color={t.color}
                        style={{ marginRight: 10 }}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.modalOptionLabel, isSelected && { color: t.color, fontWeight: '700' }]}>
                          {t.label}
                        </Text>
                        <Text style={styles.modalOptionDesc}>{t.desc}</Text>
                      </View>
                      {isSelected && <Ionicons name="checkmark" size={18} color={t.color} />}
                    </TouchableOpacity>
                  );
                })}

              {pickerModal.type === 'brand' && (
                <>
                  <TouchableOpacity
                    style={[
                      styles.modalOptionItem,
                      !activePickerItem?.brandId && styles.modalOptionSelected,
                    ]}
                    onPress={() => handleSelectPickerOption(null)}
                  >
                    <Text style={styles.modalOptionLabel}>- Tanpa Brand -</Text>
                    {!activePickerItem?.brandId && (
                      <Ionicons name="checkmark" size={18} color={Colors.primary} />
                    )}
                  </TouchableOpacity>
                  {brands.map(b => {
                    const isSelected = activePickerItem?.brandId === b.id;
                    return (
                      <TouchableOpacity
                        key={b.id}
                        style={[styles.modalOptionItem, isSelected && styles.modalOptionSelected]}
                        onPress={() => handleSelectPickerOption(b.id)}
                      >
                        <Text
                          style={[styles.modalOptionLabel, isSelected && { color: Colors.primary, fontWeight: '700' }]}
                        >
                          {b.name}
                        </Text>
                        {isSelected && <Ionicons name="checkmark" size={18} color={Colors.primary} />}
                      </TouchableOpacity>
                    );
                  })}
                </>
              )}

              {pickerModal.type === 'category' && (
                <>
                  <TouchableOpacity
                    style={[
                      styles.modalOptionItem,
                      !activePickerItem?.categoryId && styles.modalOptionSelected,
                    ]}
                    onPress={() => handleSelectPickerOption(null)}
                  >
                    <Text style={styles.modalOptionLabel}>- Tanpa Kategori -</Text>
                    {!activePickerItem?.categoryId && (
                      <Ionicons name="checkmark" size={18} color={Colors.primary} />
                    )}
                  </TouchableOpacity>
                  {categories.map(c => {
                    const isSelected = activePickerItem?.categoryId === c.id;
                    return (
                      <TouchableOpacity
                        key={c.id}
                        style={[styles.modalOptionItem, isSelected && styles.modalOptionSelected]}
                        onPress={() => handleSelectPickerOption(c.id)}
                      >
                        <Text
                          style={[styles.modalOptionLabel, isSelected && { color: Colors.primary, fontWeight: '700' }]}
                        >
                          {c.name}
                        </Text>
                        {isSelected && <Ionicons name="checkmark" size={18} color={Colors.primary} />}
                      </TouchableOpacity>
                    );
                  })}
                </>
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Internal Confirmation Modal (Fallback) */}
      <ConfirmModal
        visible={internalConfirm.visible}
        title="Hapus Produk"
        message={`Apakah Anda yakin ingin menghapus "${internalConfirm.name}"? Tindakan ini tidak dapat dibatalkan.`}
        confirmText="Hapus"
        cancelText="Batal"
        onConfirm={handlePerformInternalDelete}
        onCancel={() => setInternalConfirm({ visible: false, id: null, name: '' })}
        type="danger"
      />
    </View>
  );
}

// Web native <select> style definition
const webSelectStyle = {
  width: '100%',
  backgroundColor: '#FFFFFF',
  border: '1px solid #CBD5E1',
  borderRadius: 6,
  padding: '3px 4px',
  fontSize: 11,
  color: '#0F172A',
  fontWeight: '600',
  outline: 'none',
  cursor: 'pointer',
  boxSizing: 'border-box',
};

const styles = StyleSheet.create({
  outerContainer: {
    width: '100%',
    marginBottom: 20,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 8,
  },
  statusDotSaving: {
    backgroundColor: '#F59E0B',
  },
  statusText: {
    fontSize: 11,
    color: '#166534',
    fontWeight: '600',
    flex: 1,
  },

  // Table Card
  tableWrapperCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    overflow: 'hidden',
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
    minWidth: 1060,
    flex: 1,
  },

  // Header Row
  tableHeaderRow: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: '#E2E8F0',
    borderBottomWidth: 2,
    borderBottomColor: '#94A3B8',
  },
  cellHeader: {
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRightWidth: 1,
    borderRightColor: '#CBD5E1',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  headerTitle: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#334155',
    letterSpacing: 0.2,
  },

  // Column Sizing (FRONT AND CENTER HPP & HARGA JUAL)
  colNo: {
    width: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colBarcode: {
    width: 105,
  },
  colName: {
    flex: 2,
    minWidth: 170,
  },
  colCost: {
    width: 115,
  },
  colPrice: {
    width: 115,
  },
  colMargin: {
    width: 105,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  colStock: {
    width: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colType: {
    width: 115,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colBrand: {
    width: 110,
  },
  colCategory: {
    width: 115,
  },
  colStatus: {
    width: 85,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 0,
  },

  // Table Rows
  tableRow: {
    flexDirection: 'row',
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    minHeight: 36,
    alignItems: 'center',
  },
  rowEven: {
    backgroundColor: '#FFFFFF',
  },
  rowOdd: {
    backgroundColor: '#F8FAFC',
  },
  rowDirty: {
    backgroundColor: '#FEFCE8',
  },
  rowSaved: {
    backgroundColor: '#ECFDF5',
  },
  cell: {
    paddingVertical: 3,
    paddingHorizontal: 5,
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  noText: {
    fontSize: 10.5,
    color: '#64748B',
    fontWeight: '600',
  },

  // Cell Text Inputs
  cellInput: {
    width: '100%',
    minWidth: 0,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 3,
    fontSize: 11.5,
    color: '#0F172A',
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
  },
  nameInput: {
    fontWeight: '600',
  },
  cellInputFocused: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
  },
  errorSubText: {
    fontSize: 9,
    color: '#DC2626',
    marginTop: 2,
  },

  // Money Input
  moneyInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 6,
    width: '100%',
    overflow: 'hidden',
  },
  rpPrefix: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '700',
    marginRight: 2,
    flexShrink: 0,
  },
  moneyInput: {
    flex: 1,
    width: '100%',
    minWidth: 0,
    borderWidth: 0,
    paddingHorizontal: 2,
    paddingVertical: 2.5,
    textAlign: 'right',
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0F172A',
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
  },

  // Margin Display
  marginText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#059669',
    textAlign: 'right',
  },
  marginPercentText: {
    fontSize: 9.5,
    color: '#10B981',
    textAlign: 'right',
    marginTop: 0.5,
  },

  // Stock Steppers
  stockStepperWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    overflow: 'hidden',
  },
  stepBtn: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#334155',
  },
  stockInput: {
    width: 36,
    minWidth: 0,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
    paddingVertical: 2,
    borderWidth: 0,
    backgroundColor: 'transparent',
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
  },

  // Dropdown Button (Mobile / Native)
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 3,
    width: '100%',
  },
  dropdownButtonText: {
    fontSize: 9.5,
    fontWeight: '700',
    flex: 1,
  },
  categoryDropdownText: {
    fontSize: 11,
    color: '#334155',
    flex: 1,
    fontWeight: '500',
  },

  // Status Action
  statusActionWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  savedChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#047857',
    marginLeft: 2,
  },
  actionBtnGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailBtn: {
    padding: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    padding: 6,
    backgroundColor: '#FEF2F2',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 8,
  },

  // Modal Picker (Native)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    ...Shadows.md,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalOptionSelected: {
    backgroundColor: '#EFF6FF',
  },
  modalOptionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  modalOptionDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
});
