import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ScrollView, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme';
import { createProduct, getProductById, updateProduct, getCategories, getBrands, addCategory, addBrand } from '../../services/products';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../contexts/ToastContext';

export default function FormScreen({ navigation, route }) {
  const { id } = route.params || {};
  const { user } = useAuth();
  const { showToast } = useToast();

  const [name, setName] = useState('');
  const [barcodes, setBarcodes] = useState(['']);
  const [price, setPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [stock, setStock] = useState('');
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

  const loadMasterData = async () => {
    if (!user?.id) return;
    try {
      const cats = await getCategories(user.id);
      setCategories(cats || []);
      const brs = await getBrands(user.id);
      setBrands(brs || []);
    } catch (e) {
      console.log('Error loading master data', e);
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
      if (id) {
        const prod = await getProductById(user?.id, id);
        if (prod) {
          setName(prod.name);
          setBarcodes(prod.barcode ? prod.barcode.split(',') : ['']);
          setPrice(String(prod.price || ''));
          setCostPrice(String(prod.costPrice ?? prod.cost_price ?? ''));
          setStock(String(prod.stock || ''));
          setCategoryId(prod.category_id || null);
          setBrandId(prod.brand_id || null);
          
          if (prod.image_urls && Array.isArray(prod.image_urls)) {
            const urls = [...prod.image_urls];
            while (urls.length < 5) urls.push('');
            setImageUrls(urls);
          }
        }
      }
    })();
  }, [id, user]);

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
    const payload = {
      name: name.trim(),
      barcode: barcodes.filter(b => b.trim()).join(','),
      price: Number(price || 0),
      costPrice: Number(costPrice || 0),
      stock: Number(stock || 0),
      image_urls: imageUrls.filter(u => u.trim() !== ''),
      category_id: categoryId,
      brand_id: brandId,
    };

    if (!payload.name) {
      showToast('Nama produk wajib diisi', 'error');
      return;
    }

    try {
      let result;
      if (id) {
        result = await updateProduct(user?.id, id, payload);
      } else {
        result = await createProduct(user?.id, payload);
      }
      
      // Handle new response format
      if (result && result.success === false) {
        showToast(result.error || 'Gagal menyimpan produk', 'error');
        return;
      }
      
      showToast('Produk tersimpan', 'success');
      navigation.goBack();
    } catch (e) {
      console.log('❌ FormScreen: Save error:', e);
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

        <View style={styles.row}>
          <View style={[styles.inputGroup, styles.halfWidth]}>
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

          <View style={[styles.inputGroup, styles.halfWidth]}>
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
        </View>

        <View style={styles.inputGroup}>
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
    backgroundColor: '#fff3cd',
    borderColor: '#ffeaa7',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    margin: 16,
  },
  warningText: {
    color: '#856404',
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
    backgroundColor: '#fff',
  },
  optionChipActive: {
    borderColor: Colors.primary,
    backgroundColor: '#ffe5ef',
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
    backgroundColor: '#fff',
  },
  addChipText: {
    marginLeft: 4,
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
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
});
