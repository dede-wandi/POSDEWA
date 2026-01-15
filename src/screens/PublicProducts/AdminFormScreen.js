import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Switch,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme';
import {
  listPublicBrands,
  listPublicCategories,
  createPublicBrand,
  createPublicCategory,
  createPublicProduct,
  updatePublicProduct,
  getPublicProductById,
} from '../../services/publicProductsSupabase';

export default function AdminFormScreen({ navigation, route }) {
  const id = route.params?.id || null;
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrls, setImageUrls] = useState(['', '', '', '', '']);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brandId, setBrandId] = useState(null);
  const [categoryId, setCategoryId] = useState(null);
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [addingBrand, setAddingBrand] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [toastText, setToastText] = useState('');

  const loadMasterData = async () => {
    const brandResult = await listPublicBrands();
    if (brandResult.success) {
      setBrands(brandResult.data || []);
    }
    const categoryResult = await listPublicCategories();
    if (categoryResult.success) {
      setCategories(categoryResult.data || []);
    }
  };

  const loadDetail = async () => {
    if (!id) return;
    setLoading(true);
    const result = await getPublicProductById(id);
    if (!result.success) {
      Alert.alert('Error', result.error || 'Gagal memuat produk');
      setLoading(false);
      return;
    }
    if (!result.data) {
      setLoading(false);
      return;
    }
    const data = result.data;
    setTitle(data.title || '');
    setPrice(String(data.price || ''));
    setDescription(data.description || '');
    const imgs = Array.isArray(data.image_urls) ? data.image_urls.slice(0, 5) : [];
    const padded = [...imgs, '', '', '', '', ''].slice(0, 5);
    setImageUrls(padded);
    setBrandId(data.brand_id || data.brand?.id || null);
    setCategoryId(data.category_id || data.category?.id || null);
    setIsActive(data.is_active !== false);
    setLoading(false);
  };

  useEffect(() => {
    loadMasterData();
  }, []);

  useEffect(() => {
    loadDetail();
  }, [id]);

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Validasi', 'Judul wajib diisi');
      return;
    }
    const numericPrice = Number(price || 0);
    if (Number.isNaN(numericPrice) || numericPrice < 0) {
      Alert.alert('Validasi', 'Harga tidak valid');
      return;
    }
    const urls = imageUrls
      .map((u) => String(u || '').trim())
      .filter((u) => u.length > 0)
      .slice(0, 5);

    const payload = {
      title: title.trim(),
      price: numericPrice,
      description: description.trim() || null,
      image_urls: urls,
      brand_id: brandId,
      category_id: categoryId,
      is_active: isActive,
    };

    setLoading(true);
    try {
      let result;
      if (id) {
        result = await updatePublicProduct(id, payload);
      } else {
        result = await createPublicProduct(payload);
      }
      if (!result.success) {
        Alert.alert('Error', result.error || 'Gagal menyimpan produk');
        setLoading(false);
        return;
      }
      setToastText('Produk publik berhasil disimpan');
      setToastVisible(true);
      setTimeout(() => {
        setToastVisible(false);
        navigation.goBack();
      }, 1200);
    } catch (e) {
      Alert.alert('Error', e?.message || 'Gagal menyimpan produk');
    } finally {
      setLoading(false);
    }
  };

  const handleAddBrand = async () => {
    const name = String(newBrandName || '').trim();
    if (!name) {
      Alert.alert('Validasi', 'Nama brand wajib diisi');
      return;
    }
    const result = await createPublicBrand(name);
    if (result.success) {
      await loadMasterData();
      setBrandId(result.data.id);
      setNewBrandName('');
      setAddingBrand(false);
      setToastText('Brand berhasil dibuat');
      setToastVisible(true);
      setTimeout(() => setToastVisible(false), 1200);
    } else {
      Alert.alert('Error', result.error || 'Gagal membuat brand');
    }
  };

  const handleAddCategory = async () => {
    const name = String(newCategoryName || '').trim();
    if (!name) {
      Alert.alert('Validasi', 'Nama kategori wajib diisi');
      return;
    }
    const result = await createPublicCategory(name);
    if (result.success) {
      await loadMasterData();
      setCategoryId(result.data.id);
      setNewCategoryName('');
      setAddingCategory(false);
      setToastText('Kategori berhasil dibuat');
      setToastVisible(true);
      setTimeout(() => setToastVisible(false), 1200);
    } else {
      Alert.alert('Error', result.error || 'Gagal membuat kategori');
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
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{id ? 'Edit Produk Publik' : 'Produk Publik Baru'}</Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveButton} disabled={loading}>
          {loading ? (
            <Ionicons name="hourglass-outline" size={18} color="#fff" />
          ) : (
            <Ionicons name="save-outline" size={18} color="#fff" />
          )}
          <Text style={styles.saveButtonText}>Simpan</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.form} contentContainerStyle={styles.formContent}>
        <Text style={styles.label}>Judul</Text>
        <TextInput
          style={[styles.input, styles.inputSpacing]}
          value={title}
          onChangeText={setTitle}
          placeholder="Nama produk"
        />

        <Text style={styles.label}>Harga</Text>
        <TextInput
          style={[styles.input, styles.inputSpacing]}
          value={price}
          onChangeText={setPrice}
          placeholder="0"
          keyboardType="numeric"
        />

        <Text style={styles.label}>Brand</Text>
        <View style={styles.sectionSpacing}>
          {renderBrandOptions()}
        </View>

        <Text style={styles.label}>Kategori</Text>
        <View style={styles.sectionSpacing}>
          {renderCategoryOptions()}
        </View>

        <Text style={styles.label}>URL Gambar (maksimal 5)</Text>
        <View style={styles.sectionSpacing}>
          {imageUrls.map((url, index) => (
            <View key={index} style={styles.imageUrlRow}>
              <TextInput
                style={[styles.input, styles.inlineInput, styles.inputSpacing]}
                value={url}
                onChangeText={(text) => {
                  const next = [...imageUrls];
                  next[index] = text;
                  setImageUrls(next);
                }}
                placeholder={`https://... (${index + 1})`}
              />
              <View style={styles.imageThumbWrapper}>
                {String(url || '').trim() ? (
                  <Image source={{ uri: url }} style={styles.imageThumb} resizeMode="cover" />
                ) : (
                  <View style={[styles.imageThumb, styles.imageThumbPlaceholder]}>
                    <Ionicons name="image-outline" size={18} color={Colors.muted} />
                  </View>
                )}
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.label}>Deskripsi</Text>
        <TextInput
          style={[styles.input, styles.textArea, styles.inputSpacing]}
          value={description}
          onChangeText={setDescription}
          placeholder="Deskripsi singkat produk"
          multiline
          numberOfLines={4}
        />

        <View style={styles.switchRow}>
          <Text style={styles.label}>Tampilkan di publik</Text>
          <Switch value={isActive} onValueChange={setIsActive} />
        </View>
      </ScrollView>
      {toastVisible && (
        <View style={styles.toastContainer}>
          <Ionicons name="checkmark-circle" size={18} color="#fff" style={{ marginRight: 6 }} />
          <Text style={styles.toastText}>{toastText}</Text>
        </View>
      )}
      {loading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Menyimpan...</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.primary,
    borderRadius: 16,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
  },
  form: {
    flex: 1,
  },
  formContent: {
    padding: 16,
    paddingBottom: 40,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
    fontSize: 14,
  },
  inputSpacing: {
    marginBottom: 12,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
  imageUrlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  imageThumbWrapper: {
    width: 56,
    height: 56,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#fff',
  },
  imageThumb: {
    width: '100%',
    height: '100%',
  },
  imageThumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f2f2f7',
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
  sectionSpacing: {
    marginBottom: 12,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  loadingBox: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  loadingText: {
    marginTop: 10,
    color: Colors.text,
    fontWeight: '600',
  },
  toastContainer: {
    position: 'absolute',
    top: 12,
    left: 16,
    right: 16,
    backgroundColor: '#2e7d32',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  toastText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
});
