import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ScrollView, StyleSheet, Image, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme';
import { createProduct, getProductById, updateProduct, getCategories, getBrands, addCategory, addBrand } from '../../services/products';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatIDR } from '../../utils/currency';
export default function FormScreen({ navigation, route }) {
  const { id } = route.params || {};
  const { user } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [barcodes, setBarcodes] = useState(['']);
  const [price, setPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [stock, setStock] = useState('');
  const [variants, setVariants] = useState([]);
  const [newVariantName, setNewVariantName] = useState('');
  const [newVariantPrice, setNewVariantPrice] = useState('');
  const [newVariantCostPrice, setNewVariantCostPrice] = useState('');
  const [newVariantStock, setNewVariantStock] = useState('');
  const [imageUrls, setImageUrls] = useState(['', '', '', '', '']);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  
  // Category & Brand State
  const [categoryId, setCategoryId] = useState(null);
  const [brandId, setBrandId] = useState(null);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [addingCategory, setAddingCategory] = useState(false);
  const [addingBrand, setAddingBrand] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newBrandName, setNewBrandName] = useState('');

  // Draft recovery & auto-save states/refs
  const [isDraftRestored, setIsDraftRestored] = useState(false);
  const latestFormState = useRef({
    name: '',
    barcodes: [''],
    price: '',
    costPrice: '',
    stock: '',
    variants: [],
    categoryId: null,
    brandId: null,
    imageUrls: ['', '', '', '', ''],
    id,
    user,
  });

  const initialValuesRef = useRef(null);
  const isSavingRef = useRef(false);
  const hasSavedRef = useRef(false);

  // Sync latestFormState on changes
  useEffect(() => {
    latestFormState.current = {
      name,
      barcodes,
      price,
      costPrice,
      stock,
      variants,
      categoryId,
      brandId,
      imageUrls,
      id,
      user,
    };
  }, [name, barcodes, price, costPrice, stock, variants, categoryId, brandId, imageUrls, id, user]);

  const checkIfDirty = () => {
    if (!initialValuesRef.current) return false;
    const current = {
      name: latestFormState.current.name,
      barcodes: latestFormState.current.barcodes,
      price: latestFormState.current.price,
      costPrice: latestFormState.current.costPrice,
      stock: latestFormState.current.stock,
      variants: latestFormState.current.variants,
      categoryId: latestFormState.current.categoryId,
      brandId: latestFormState.current.brandId,
      imageUrls: latestFormState.current.imageUrls,
    };
    return JSON.stringify(current) !== JSON.stringify(initialValuesRef.current);
  };

  const loadMasterData = async () => {
    if (!user?.id) return;
    try {
      const cats = await getCategories(user.id);
      setCategories(cats || []);
      const brs = await getBrands(user.id);
      setBrands(brs || []);
    } catch (e) {
    }
  };

  useEffect(() => {
    loadMasterData();
  }, [user]);

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      showToast('Nama kategori wajib diisi', 'error');
      return;
    }
    const result = await addCategory(user.id, newCategoryName);
    if (result.success) {
      await loadMasterData();
      setCategoryId(result.data.id);
      setNewCategoryName('');
      setAddingCategory(false);
      showToast('Kategori berhasil dibuat', 'success');
    } else {
      showToast(result.error || 'Gagal membuat kategori', 'error');
    }
  };

  const handleAddBrand = async () => {
    if (!newBrandName.trim()) {
      showToast('Nama brand wajib diisi', 'error');
      return;
    }
    const result = await addBrand(user.id, newBrandName);
    if (result.success) {
      await loadMasterData();
      setBrandId(result.data.id);
      setNewBrandName('');
      setAddingBrand(false);
      showToast('Brand berhasil dibuat', 'success');
    } else {
      showToast(result.error || 'Gagal membuat brand', 'error');
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      // 1. Fetch database product if editing
      let initialData = null;
      if (id) {
        initialData = await getProductById(user?.id, id);
      }

      // 2. Check and restore draft from AsyncStorage if exists
      try {
        const draftKey = `product-draft-${id || 'new'}`;
        const storedDraft = await AsyncStorage.getItem(draftKey);
        if (storedDraft) {
          const draft = JSON.parse(storedDraft);
          setName(draft.name || '');
          setBarcodes(draft.barcodes || ['']);
          setPrice(draft.price || '');
          setCostPrice(draft.costPrice || '');
          setStock(draft.stock || '');
          setVariants(draft.variants || []);
          setCategoryId(draft.categoryId || null);
          setBrandId(draft.brandId || null);
          setImageUrls(draft.imageUrls || ['', '', '', '', '']);
          
          setIsDraftRestored(true);

          if (initialData) {
            initialValuesRef.current = {
              name: initialData.name || '',
              barcodes: initialData.barcode ? initialData.barcode.split(',') : [''],
              price: String(initialData.price || ''),
              costPrice: String(initialData.costPrice ?? initialData.cost_price ?? ''),
              stock: String(initialData.stock || ''),
              variants: initialData.variants || [],
              categoryId: initialData.category_id || null,
              brandId: initialData.brand_id || null,
              imageUrls: initialData.image_urls && Array.isArray(initialData.image_urls) ? 
                [...initialData.image_urls, '', '', '', '', ''].slice(0, 5) : ['', '', '', '', ''],
            };
          } else {
            initialValuesRef.current = {
              name: '',
              barcodes: [''],
              price: '',
              costPrice: '',
              stock: '',
              variants: [],
              categoryId: null,
              brandId: null,
              imageUrls: ['', '', '', '', ''],
            };
          }
          setLoading(false);
          return;
        }
      } catch (err) {
        console.log('Error reading draft', err);
      }

      // 3. Fallback to database data
      if (initialData) {
        const vals = {
          name: initialData.name || '',
          barcodes: initialData.barcode ? initialData.barcode.split(',') : [''],
          price: String(initialData.price || ''),
          costPrice: String(initialData.costPrice ?? initialData.cost_price ?? ''),
          stock: String(initialData.stock || ''),
          variants: initialData.variants || [],
          categoryId: initialData.category_id || null,
          brandId: initialData.brand_id || null,
          imageUrls: initialData.image_urls && Array.isArray(initialData.image_urls) ? 
            [...initialData.image_urls, '', '', '', '', ''].slice(0, 5) : ['', '', '', '', ''],
        };
        setName(vals.name);
        setBarcodes(vals.barcodes);
        setPrice(vals.price);
        setCostPrice(vals.costPrice);
        setStock(vals.stock);
        setVariants(vals.variants);
        setCategoryId(vals.categoryId);
        setBrandId(vals.brandId);
        setImageUrls(vals.imageUrls);
        initialValuesRef.current = vals;
      } else {
        const vals = {
          name: '',
          barcodes: [''],
          price: '',
          costPrice: '',
          stock: '',
          variants: [],
          categoryId: null,
          brandId: null,
          imageUrls: ['', '', '', '', ''],
        };
        initialValuesRef.current = vals;
      }
      setLoading(false);
    })();
  }, [id, user]);

  // Save draft to AsyncStorage on every input change, only after loading is complete
  useEffect(() => {
    if (loading || hasSavedRef.current) return;
    const saveDraft = async () => {
      try {
        const draftKey = `product-draft-${id || 'new'}`;
        const draftData = {
          name,
          barcodes,
          price,
          costPrice,
          stock,
          variants,
          categoryId,
          brandId,
          imageUrls,
        };
        await AsyncStorage.setItem(draftKey, JSON.stringify(draftData));
      } catch (err) {
        console.log('Error saving draft', err);
      }
    };
    saveDraft();
  }, [loading, id, name, barcodes, price, costPrice, stock, variants, categoryId, brandId, imageUrls]);

  const performAutoSave = async () => {
    if (isSavingRef.current || !latestFormState.current.user?.id) return;
    if (!checkIfDirty()) return;

    const {
      id: currentId,
      name: currentName,
      barcodes: currentBarcodes,
      price: currentPrice,
      costPrice: currentCostPrice,
      stock: currentStock,
      variants: currentVariants,
      categoryId: currentCategoryId,
      brandId: currentBrandId,
      imageUrls: currentImageUrls,
      user: currentUser,
    } = latestFormState.current;

    // Minimum requirement for auto-save is a non-empty name
    if (!currentName.trim()) return;

    let finalPrice = Number(currentPrice || 0);
    let finalCostPrice = Number(currentCostPrice || 0);
    let finalStock = Number(currentStock || 0);

    if (currentVariants && currentVariants.length > 0) {
      finalStock = currentVariants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
      const prices = currentVariants.map(v => Number(v.price) || 0);
      finalPrice = prices.length > 0 ? Math.min(...prices) : finalPrice;
      const costPrices = currentVariants.map(v => Number(v.costPrice) || 0);
      finalCostPrice = costPrices.length > 0 ? Math.min(...costPrices) : finalCostPrice;
    }

    isSavingRef.current = true;
    try {
      const payload = {
        name: currentName.trim(),
        barcode: currentBarcodes.filter(b => b.trim()).join(','),
        price: finalPrice,
        costPrice: finalCostPrice,
        stock: finalStock,
        variants: currentVariants,
        image_urls: currentImageUrls.filter(u => u.trim() !== ''),
        category_id: currentCategoryId,
        brand_id: currentBrandId,
      };

      if (currentId) {
        await updateProduct(currentUser.id, currentId, payload);
        console.log('Product auto-saved (edit) successfully.');
      } else {
        // Auto-save new product
        const result = await createProduct(currentUser.id, payload);
        if (result && result.success && result.data?.id) {
          console.log('Product auto-saved (new) successfully. ID:', result.data.id);
          // Clear the 'new' draft
          const draftKey = `product-draft-new`;
          await AsyncStorage.removeItem(draftKey);
        }
      }

      // Reset initial values to current so dirty is false
      const currentVals = {
        name: currentName,
        barcodes: currentBarcodes,
        price: currentPrice,
        costPrice: currentCostPrice,
        stock: currentStock,
        variants: currentVariants,
        categoryId: currentCategoryId,
        brandId: currentBrandId,
        imageUrls: currentImageUrls,
      };
      initialValuesRef.current = currentVals;

      // Clear draft storage
      const draftKey = `product-draft-${currentId || 'new'}`;
      await AsyncStorage.removeItem(draftKey);
    } catch (e) {
      console.log('Auto-save request failed', e);
    } finally {
      isSavingRef.current = false;
    }
  };

  const resetFormToDatabase = async () => {
    try {
      const draftKey = `product-draft-${id || 'new'}`;
      await AsyncStorage.removeItem(draftKey);
      setIsDraftRestored(false);
      
      // Reload values
      if (id) {
        const initialData = await getProductById(user?.id, id);
        if (initialData) {
          const vals = {
            name: initialData.name || '',
            barcodes: initialData.barcode ? initialData.barcode.split(',') : [''],
            price: String(initialData.price || ''),
            costPrice: String(initialData.costPrice ?? initialData.cost_price ?? ''),
            stock: String(initialData.stock || ''),
            variants: initialData.variants || [],
            categoryId: initialData.category_id || null,
            brandId: initialData.brand_id || null,
            imageUrls: initialData.image_urls && Array.isArray(initialData.image_urls) ? 
              [...initialData.image_urls, '', '', '', '', ''].slice(0, 5) : ['', '', '', '', ''],
          };
          setName(vals.name);
          setBarcodes(vals.barcodes);
          setPrice(vals.price);
          setCostPrice(vals.costPrice);
          setStock(vals.stock);
          setVariants(vals.variants);
          setCategoryId(vals.categoryId);
          setBrandId(vals.brandId);
          setImageUrls(vals.imageUrls);
          initialValuesRef.current = vals;
        }
      } else {
        setName('');
        setBarcodes(['']);
        setPrice('');
        setCostPrice('');
        setStock('');
        setVariants([]);
        setCategoryId(null);
        setBrandId(null);
        setImageUrls(['', '', '', '', '']);
        initialValuesRef.current = {
          name: '',
          barcodes: [''],
          price: '',
          costPrice: '',
          stock: '',
          variants: [],
          categoryId: null,
          brandId: null,
          imageUrls: ['', '', '', '', ''],
        };
      }
      showToast('Formulir berhasil di-reset ke data asli', 'success');
    } catch (err) {
      console.log('Error resetting draft', err);
      showToast('Gagal mereset formulir', 'error');
    }
  };

  // Trigger auto save on navigation blur
  useEffect(() => {
    const unsub = navigation.addListener('blur', () => {
      performAutoSave();
    });
    return unsub;
  }, [navigation]);

  // Trigger auto save on component unmount
  useEffect(() => {
    return () => {
      performAutoSave();
    };
  }, []);

  // Tangkap barcode hasil scan dari screen Scan (mode: pick)
  useEffect(() => {
    if (route?.params?.pickedBarcode) {
      const scanned = String(route.params.pickedBarcode).trim();
      setBarcodes(prev => {
        // Jika input terakhir kosong, pakai itu. Jika tidak, tambah baru.
        const last = prev[prev.length - 1];
        if (!last || last.trim() === '') {
           const newArr = [...prev];
           newArr[newArr.length - 1] = scanned;
           return newArr;
        }
        return [...prev, scanned];
      });
      // Bersihkan param agar tidak diproses berulang
      navigation.setParams({ pickedBarcode: null });
    }
  }, [route?.params?.pickedBarcode]);

  const save = async () => {
    let finalPrice = Number(price || 0);
    let finalCostPrice = Number(costPrice || 0);
    let finalStock = Number(stock || 0);

    if (variants && variants.length > 0) {
      finalStock = variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
      const prices = variants.map(v => Number(v.price) || 0);
      finalPrice = prices.length > 0 ? Math.min(...prices) : finalPrice;
      const costPrices = variants.map(v => Number(v.costPrice) || 0);
      finalCostPrice = costPrices.length > 0 ? Math.min(...costPrices) : finalCostPrice;
    }

    const payload = {
      name: name.trim(),
      barcode: barcodes.filter(b => b.trim()).join(','),
      price: finalPrice,
      costPrice: finalCostPrice,
      stock: finalStock,
      variants: variants,
      image_urls: imageUrls.filter(u => u.trim() !== ''),
      category_id: categoryId,
      brand_id: brandId,
    };

    if (!payload.name) {
      showToast('Nama produk wajib diisi', 'error');
      return;
    }

    try {
      hasSavedRef.current = true; // prevent saveDraft from writing again
      let result;
      if (id) {
        result = await updateProduct(user?.id, id, payload);
      } else {
        result = await createProduct(user?.id, payload);
      }
      
      // Handle new response format
      if (result && result.success === false) {
        hasSavedRef.current = false; // reset in case of failure
        showToast(result.error || 'Gagal menyimpan produk', 'error');
        return;
      }

      // Clear draft on successful save
      try {
        const draftKey = `product-draft-${id || 'new'}`;
        await AsyncStorage.removeItem(draftKey);
      } catch (err) {
        console.log('Error removing draft on save', err);
      }

      // Update initial values so unmount doesn't auto-save again
      initialValuesRef.current = {
        name,
        barcodes,
        price,
        costPrice,
        stock,
        categoryId,
        brandId,
        imageUrls,
      };
      
      showToast('Produk tersimpan', 'success');
      navigation.goBack();
    } catch (e) {
      hasSavedRef.current = false; // reset in case of failure
      showToast(e.message || 'Gagal menyimpan produk', 'error');
    }
  };

  const renderBrandOptions = () => (
    <View style={styles.chipsRow}>
      {brands.map((b) => (
        <TouchableOpacity
          key={b.id}
          style={[
            styles.optionChip,
            brandId === b.id && styles.optionChipActive,
          ]}
          onPress={() => setBrandId(b.id)}
        >
          <Text
            style={[
              styles.optionChipText,
              brandId === b.id && styles.optionChipTextActive,
            ]}
          >
            {b.name}
          </Text>
        </TouchableOpacity>
      ))}
      <TouchableOpacity style={styles.addChip} onPress={() => setAddingBrand(true)}>
        <Ionicons name="add" size={14} color={Colors.primary} />
        <Text style={styles.addChipText}>Brand</Text>
      </TouchableOpacity>
      {addingBrand && (
        <View style={styles.inlineAddRow}>
          <TextInput
            style={[styles.input, styles.inlineInput]}
            value={newBrandName}
            onChangeText={setNewBrandName}
            placeholder="Nama brand baru"
            placeholderTextColor={Colors.muted}
          />
          <TouchableOpacity style={styles.smallButton} onPress={handleAddBrand}>
            <Ionicons name="checkmark" size={16} color="#fff" />
            <Text style={styles.smallButtonText}>Simpan</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.smallButton, { backgroundColor: Colors.border }]} onPress={() => { setAddingBrand(false); setNewBrandName(''); }}>
            <Ionicons name="close" size={16} color={Colors.text} />
            <Text style={[styles.smallButtonText, { color: Colors.text }]}>Batal</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderCategoryOptions = () => (
    <View style={styles.chipsRow}>
      {categories.map((c) => (
        <TouchableOpacity
          key={c.id}
          style={[
            styles.optionChip,
            categoryId === c.id && styles.optionChipActive,
          ]}
          onPress={() => setCategoryId(c.id)}
        >
          <Text
            style={[
              styles.optionChipText,
              categoryId === c.id && styles.optionChipTextActive,
            ]}
          >
            {c.name}
          </Text>
        </TouchableOpacity>
      ))}
      <TouchableOpacity style={styles.addChip} onPress={() => setAddingCategory(true)}>
        <Ionicons name="add" size={14} color={Colors.primary} />
        <Text style={styles.addChipText}>Kategori</Text>
      </TouchableOpacity>
      {addingCategory && (
        <View style={styles.inlineAddRow}>
          <TextInput
            style={[styles.input, styles.inlineInput]}
            value={newCategoryName}
            onChangeText={setNewCategoryName}
            placeholder="Nama kategori baru"
            placeholderTextColor={Colors.muted}
          />
          <TouchableOpacity style={styles.smallButton} onPress={handleAddCategory}>
            <Ionicons name="checkmark" size={16} color="#fff" />
            <Text style={styles.smallButtonText}>Simpan</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.smallButton, { backgroundColor: Colors.border }]} onPress={() => { setAddingCategory(false); setNewCategoryName(''); }}>
            <Ionicons name="close" size={16} color={Colors.text} />
            <Text style={[styles.smallButtonText, { color: Colors.text }]}>Batal</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      {isDraftRestored && (
        <View style={styles.draftBanner}>
          <View style={styles.draftBannerTextContainer}>
            <Ionicons name="document-text" size={16} color={Colors.info} style={{ marginRight: 6 }} />
            <Text style={styles.draftBannerText}>
              Memulihkan draf yang belum disimpan.
            </Text>
          </View>
          <TouchableOpacity style={styles.draftResetButton} onPress={resetFormToDatabase}>
            <Text style={styles.draftResetButtonText}>Reset ke Asli</Text>
          </TouchableOpacity>
        </View>
      )}

      {!user && (
        <View style={styles.warningContainer}>
          <Text style={styles.warningText}>
            ⚠️ Login untuk menyimpan ke cloud Supabase. Tanpa login, data tersimpan lokal di perangkat.
          </Text>
        </View>
      )}

      <View style={styles.imagePreviewSection}>
        {imageUrls.filter(u => u).length > 0 ? (
          <View style={styles.imagePreviewContainer}>
            <Image
              source={{ uri: imageUrls[selectedImageIndex] || imageUrls.find(u => u) }}
              style={styles.mainImage}
              resizeMode="contain"
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbnailScroll}>
              {imageUrls.map((u, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => setSelectedImageIndex(idx)}
                  style={[
                    styles.thumbnailWrapper,
                    selectedImageIndex === idx && styles.thumbnailActive
                  ]}
                >
                  {u ? (
                    <Image source={{ uri: u }} style={styles.thumbnailImage} />
                  ) : (
                    <View style={styles.thumbnailPlaceholder} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="image" size={28} color={Colors.muted} />
            <Text style={styles.imagePlaceholderText}>Tambahkan URL gambar produk</Text>
          </View>
        )}
      </View>

      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Nama Produk *</Text>
          <TextInput 
            value={name} 
            onChangeText={setName} 
            style={[styles.input, styles.textArea]}
            placeholder="Masukkan nama produk"
            placeholderTextColor={Colors.muted}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Barcode (Bisa lebih dari satu)</Text>
          {barcodes.map((code, index) => (
            <View key={index} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <TextInput 
                value={code} 
                onChangeText={(text) => {
                  const newArr = [...barcodes];
                  newArr[index] = text;
                  setBarcodes(newArr);
                }} 
                placeholder={`Barcode ${index + 1}`} 
                style={[styles.input, { flex: 1 }]}
                placeholderTextColor={Colors.muted}
              />
              {index === barcodes.length - 1 && (
                <TouchableOpacity
                  onPress={() => navigation.navigate('Scan', { mode: 'pick', returnTo: 'FormProduk', returnParams: { id } })}
                  style={{
                    marginLeft: 8,
                    backgroundColor: Colors.primary,
                    padding: 12,
                    borderRadius: 10,
                  }}
                >
                  <Ionicons name="scan" size={20} color="#fff" />
                </TouchableOpacity>
              )}
              {barcodes.length > 1 && (
                <TouchableOpacity
                  onPress={() => {
                    const newArr = barcodes.filter((_, i) => i !== index);
                    setBarcodes(newArr);
                  }}
                  style={{
                    marginLeft: 8,
                    backgroundColor: Colors.error,
                    padding: 12,
                    borderRadius: 10,
                  }}
                >
                  <Ionicons name="trash" size={20} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
          ))}
          <TouchableOpacity 
            onPress={() => setBarcodes([...barcodes, ''])}
            style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5 }}
          >
             <Ionicons name="add-circle" size={20} color={Colors.primary} />
             <Text style={{ color: Colors.primary, marginLeft: 5 }}>Tambah Barcode Lain</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Brand</Text>
          <View style={styles.sectionSpacing}>
            {renderBrandOptions()}
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Kategori</Text>
          <View style={styles.sectionSpacing}>
            {renderCategoryOptions()}
          </View>
        </View>

        {variants.length === 0 && (
          <>
            <View style={[styles.row, { gap: 12 }]}>
              <View style={[styles.inputGroup, { flex: 1, marginBottom: 0 }]}>
                <Text style={styles.label}>Harga Modal</Text>
                <TextInput 
                  value={costPrice} 
                  onChangeText={setCostPrice} 
                  keyboardType="numeric" 
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor={Colors.muted}
                />
              </View>

              <View style={[styles.inputGroup, { flex: 1, marginBottom: 0 }]}>
                <Text style={styles.label}>Harga Jual *</Text>
                <TextInput 
                  value={price} 
                  onChangeText={setPrice} 
                  keyboardType="numeric" 
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor={Colors.muted}
                />
              </View>

              <View style={[styles.inputGroup, { flex: 1, marginBottom: 0 }]}>
                <Text style={styles.label}>Stok *</Text>
                <TextInput 
                  value={stock} 
                  onChangeText={setStock} 
                  keyboardType="numeric" 
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor={Colors.muted}
                />
              </View>
            </View>
            <View style={{ marginBottom: 20 }} />
          </>
        )}

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Varian Produk (Opsional)</Text>
          <Text style={{ fontSize: 12, color: Colors.muted, marginBottom: 8 }}>
            Jika produk memiliki varian, tentukan nama, modal, jual, dan stok per varian.
          </Text>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            <View style={{ minWidth: Platform.OS === 'web' ? '100%' : 500 }}>
              {variants.length > 0 && (
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8, paddingHorizontal: 4 }}>
                  <Text style={{ flex: 2, fontSize: 12, fontWeight: '600', color: Colors.muted }}>Nama Varian</Text>
                  <Text style={{ flex: 1.5, fontSize: 12, fontWeight: '600', color: Colors.muted }}>Modal</Text>
                  <Text style={{ flex: 1.5, fontSize: 12, fontWeight: '600', color: Colors.muted }}>Jual</Text>
                  <Text style={{ flex: 1, fontSize: 12, fontWeight: '600', color: Colors.muted }}>Stok</Text>
                  <View style={{ width: 30 }} />
                </View>
              )}
              
              {variants.map((v, idx) => (
                <View key={idx} style={{ flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                  <TextInput
                    style={[styles.input, { flex: 2, paddingVertical: 8, paddingHorizontal: 10, fontSize: 14 }]}
                    value={v.name}
                    onChangeText={(val) => {
                      const newVars = [...variants];
                      newVars[idx].name = val;
                      setVariants(newVars);
                    }}
                    placeholder="Nama"
                    placeholderTextColor={Colors.muted}
                  />
                  <TextInput
                    style={[styles.input, { flex: 1.5, paddingVertical: 8, paddingHorizontal: 10, fontSize: 14 }]}
                    value={String(v.costPrice !== undefined && v.costPrice !== null ? v.costPrice : '')}
                    onChangeText={(val) => {
                      const newVars = [...variants];
                      newVars[idx].costPrice = val;
                      setVariants(newVars);
                    }}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={Colors.muted}
                  />
                  <TextInput
                    style={[styles.input, { flex: 1.5, paddingVertical: 8, paddingHorizontal: 10, fontSize: 14 }]}
                    value={String(v.price !== undefined && v.price !== null ? v.price : '')}
                    onChangeText={(val) => {
                      const newVars = [...variants];
                      newVars[idx].price = val;
                      setVariants(newVars);
                    }}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={Colors.muted}
                  />
                  <TextInput
                    style={[styles.input, { flex: 1, paddingVertical: 8, paddingHorizontal: 10, fontSize: 14 }]}
                    value={String(v.stock !== undefined && v.stock !== null ? v.stock : '')}
                    onChangeText={(val) => {
                      const newVars = [...variants];
                      newVars[idx].stock = val;
                      setVariants(newVars);
                    }}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={Colors.muted}
                  />
                  <TouchableOpacity 
                    onPress={() => setVariants(variants.filter((_, i) => i !== idx))}
                    style={{ width: 30, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Ionicons name="trash-outline" size={20} color={Colors.danger} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </ScrollView>
          
          <TouchableOpacity 
            style={[styles.smallButton, { backgroundColor: Colors.primary, justifyContent: 'center', alignSelf: 'flex-start' }]} 
            onPress={() => {
              setVariants([...variants, {
                name: '',
                costPrice: '',
                price: '',
                stock: '',
              }]);
            }}
          >
            <Ionicons name="add" size={16} color="#fff" />
            <Text style={styles.smallButtonText}>Tambah Baris Varian</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Image URLs (Max 5)</Text>
          {imageUrls.map((url, index) => (
            <TextInput 
              key={index}
              value={url} 
              onChangeText={(text) => {
                const newUrls = [...imageUrls];
                newUrls[index] = text;
                setImageUrls(newUrls);
              }} 
              style={[styles.input, { marginBottom: 8 }]}
              placeholder={`URL Image ${index + 1}`}
              placeholderTextColor={Colors.muted}
            />
          ))}
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={save}>
          <View style={styles.buttonContent}>
            <Ionicons name={id ? 'save' : 'add-circle'} size={18} color="#ffffff" style={styles.buttonIcon} />
            <Text style={styles.saveButtonText}>
              {id ? 'Perbarui Produk' : 'Tambah Produk'}
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  imagePreviewSection: {
    padding: 16,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  imagePreviewContainer: {
    alignItems: 'center',
  },
  mainImage: {
    width: 410,
    height: 410,
    borderRadius: 12,
    backgroundColor: Colors.background,
    alignSelf: 'center',
  },
  thumbnailScroll: {
    marginTop: 12,
  },
  thumbnailWrapper: {
    width: 54,
    height: 54,
    borderRadius: 10,
    marginRight: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  thumbnailActive: {
    borderColor: Colors.primary,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.background,
  },
  imagePlaceholder: {
    height: 220,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholderText: {
    fontSize: 12,
    color: Colors.muted,
    marginTop: 6,
  },
  header: {
    backgroundColor: Colors.card,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.muted,
  },
  warningContainer: {
    backgroundColor: Colors.warningLight,
    borderColor: Colors.warning,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    margin: 16,
  },
  warningText: {
    color: Colors.darkText,
    fontSize: 14,
    textAlign: 'center',
  },
  form: {
    padding: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfWidth: {
    width: '48%',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: Colors.card,
    color: Colors.text,
  },
  textArea: {
    minHeight: 80,
    lineHeight: 22,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIcon: {
    marginRight: 8,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  optionChipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  optionChipText: {
    fontSize: 12,
    color: Colors.text,
  },
  optionChipTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  addChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.white,
  },
  addChipText: {
    marginLeft: 4,
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
  },
  variantsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  variantChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  variantChipText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '600',
    marginRight: 6,
  },
  inlineAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    width: '100%',
  },
  inlineInput: {
    flex: 1,
  },
  smallButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: Colors.primary,
    borderRadius: 10,
  },
  smallButtonText: {
    marginLeft: 6,
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  sectionSpacing: {
    marginBottom: 0,
  },
  draftBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.infoLight,
    borderColor: Colors.info,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 0,
  },
  draftBannerTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  draftBannerText: {
    color: Colors.info,
    fontSize: 14,
    fontWeight: '500',
  },
  draftResetButton: {
    backgroundColor: Colors.info,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  draftResetButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
});
