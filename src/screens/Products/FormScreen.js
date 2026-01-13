import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ScrollView, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme';
import { createProduct, getProductById, updateProduct } from '../../services/products';
import { useAuth } from '../../context/AuthContext';

export default function FormScreen({ navigation, route }) {
  const { id } = route.params || {};
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [price, setPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [stock, setStock] = useState('');
  const [imageUrls, setImageUrls] = useState(['', '', '', '', '']);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  useEffect(() => {
    (async () => {
      if (id) {
        const prod = await getProductById(user?.id, id);
        if (prod) {
          setName(prod.name);
          setBarcode(prod.barcode || '');
          setPrice(String(prod.price || ''));
          setCostPrice(String(prod.costPrice ?? prod.cost_price ?? ''));
          setStock(String(prod.stock || ''));
          
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
      setBarcode(String(route.params.pickedBarcode));
      // Bersihkan param agar tidak diproses berulang
      navigation.setParams({ pickedBarcode: null });
    }
  }, [route?.params?.pickedBarcode]);

  const save = async () => {
    const payload = {
      name: name.trim(),
      barcode: barcode.trim(),
      price: Number(price || 0),
      costPrice: Number(costPrice || 0),
      stock: Number(stock || 0),
      image_urls: imageUrls.filter(u => u.trim() !== ''),
    };

    if (!payload.name) {
      Alert.alert('Validasi', 'Nama produk wajib diisi');
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
        Alert.alert('Error', result.error || 'Gagal menyimpan produk');
        return;
      }
      
      Alert.alert('Sukses', 'Produk tersimpan');
      navigation.goBack();
    } catch (e) {
      console.log('❌ FormScreen: Save error:', e);
      Alert.alert('Error', e.message || 'Gagal menyimpan produk');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {id ? 'Edit Produk' : 'Tambah Produk'}
        </Text>
        <Text style={styles.subtitle}>
          {id ? 'Perbarui informasi produk' : 'Masukkan detail produk baru'}
        </Text>
      </View>

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
          <Text style={styles.label}>Barcode</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TextInput 
              value={barcode} 
              onChangeText={setBarcode} 
              placeholder="Masukkan barcode (opsional)" 
              style={[styles.input, { flex: 1 }]}
              placeholderTextColor={Colors.muted}
            />
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
});
