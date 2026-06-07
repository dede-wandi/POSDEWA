import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getMenuConfigs, saveMenuConfigs } from '../../services/menuConfigSupabase';
import { Colors, Spacing, Radii, Shadows, Typography } from '../../theme';

import { DEFAULT_MENUS_METADATA } from '../../models/Shortcut';

const TOKO_GREEN = Colors.primary;

const DEFAULT_MENUS = DEFAULT_MENUS_METADATA;

export default function MenuSettingsScreen({ navigation }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // State maps menu_key to current text input URL
  const [urls, setUrls] = useState({});
  // State tracks image load errors for preview fallback
  const [imageErrors, setImageErrors] = useState({});

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      if (user?.id) {
        const result = await getMenuConfigs(user.id);
        if (result.success && result.data) {
          const initialUrls = {};
          DEFAULT_MENUS.forEach(menu => {
            initialUrls[menu.key] = result.data[menu.key] || '';
          });
          setUrls(initialUrls);
        } else {
          console.error('Failed to load menu configurations:', result.error);
          showToast(result.error || 'Gagal memuat konfigurasi menu', 'error');
        }
      }
    } catch (error) {
      console.error('Error in loadSettings:', error);
      showToast('Gagal memuat konfigurasi menu', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      if (user?.id) {
        const result = await saveMenuConfigs(user.id, urls);
        if (result.success) {
          showToast('Konfigurasi menu berhasil disimpan', 'success');
        } else {
          console.error('Failed to save menu configurations:', result.error);
          showToast(result.error || 'Gagal menyimpan konfigurasi menu', 'error');
        }
      }
    } catch (error) {
      console.error('Error in handleSave:', error);
      showToast('Gagal menyimpan konfigurasi menu', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    Alert.alert(
      'Reset Konfigurasi',
      'Apakah Anda yakin ingin mereset semua gambar menu ke ikon default?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              setSaving(true);
              if (user?.id) {
                // Construct empty map to clear URLs
                const clearedMap = {};
                DEFAULT_MENUS.forEach(menu => {
                  clearedMap[menu.key] = '';
                });
                
                const result = await saveMenuConfigs(user.id, clearedMap);
                if (result.success) {
                  setUrls(clearedMap);
                  setImageErrors({});
                  showToast('Semua menu telah direset ke default', 'success');
                } else {
                  showToast('Gagal mereset menu: ' + result.error, 'error');
                }
              }
            } catch (error) {
              console.error('Error resetting menu configurations:', error);
              showToast('Gagal mereset konfigurasi menu', 'error');
            } finally {
              setSaving(false);
            }
          }
        }
      ]
    );
  };

  const updateUrl = (key, val) => {
    setUrls(prev => ({
      ...prev,
      [key]: val
    }));
    // Clear error tracker if they change the URL
    if (imageErrors[key]) {
      setImageErrors(prev => ({
        ...prev,
        [key]: false
      }));
    }
  };

  const handleImageError = (key) => {
    setImageErrors(prev => ({
      ...prev,
      [key]: true
    }));
  };

  const renderIconPreview = (menu) => {
    const customUrl = urls[menu.key]?.trim();
    const hasError = imageErrors[menu.key];

    // If we have a URL and it hasn't errored out, show the Image
    if (customUrl && customUrl.startsWith('http') && !hasError) {
      return (
        <View style={styles.previewContainer}>
          <Image
            source={{ uri: customUrl }}
            style={styles.customImage}
            onError={() => handleImageError(menu.key)}
            resizeMode="cover"
          />
        </View>
      );
    }

    // Default Tokopedia-style fallback
    return (
      <View style={[styles.defaultIconCircle, { backgroundColor: menu.defaultBg }]}>
        <Ionicons name={menu.defaultIcon} size={24} color={menu.defaultColor} />
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={24} color={TOKO_GREEN} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Pengaturan Menu</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={TOKO_GREEN} />
          <Text style={styles.loadingText}>Memuat menu...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color={TOKO_GREEN} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pengaturan Menu</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <Text style={styles.descriptionText}>
            Ubah gambar menu shortcut pada halaman depan dengan memasukkan tautan (URL) gambar kustom. Kosongkan link jika ingin menggunakan ikon default.
          </Text>

          {DEFAULT_MENUS.map((menu) => (
            <View key={menu.key} style={styles.menuCard}>
              <View style={styles.menuRow}>
                {renderIconPreview(menu)}
                <View style={styles.menuDetails}>
                  <Text style={styles.menuLabel}>{menu.label}</Text>
                  <Text style={styles.menuKeyText}>Key: {menu.key}</Text>
                </View>
              </View>
              
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.textInput}
                  value={urls[menu.key] || ''}
                  onChangeText={(text) => updateUrl(menu.key, text)}
                  placeholder="https://example.com/icon.png"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="none"
                  keyboardType="url"
                  clearButtonMode="while-editing"
                />
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Sticky Bottom Actions */}
      <View style={styles.actionSection}>
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.disabledButton]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>Simpan Pengaturan</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.resetButton, saving && styles.disabledButton]}
          onPress={handleReset}
          disabled={saving}
          activeOpacity={0.8}
        >
          <Text style={styles.resetButtonText}>Reset ke Default</Text>
        </TouchableOpacity>
      </View>
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
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.darkText,
  },
  placeholder: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: Colors.muted,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  descriptionText: {
    fontSize: 13,
    color: Colors.muted,
    lineHeight: 18,
    marginBottom: 20,
  },
  menuCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.lg,
    padding: 12,
    marginBottom: 12,
    ...Shadows.card,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  previewContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: Colors.lightBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  customImage: {
    width: '100%',
    height: '100%',
  },
  defaultIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuDetails: {
    marginLeft: 12,
    flex: 1,
  },
  menuLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.darkText,
  },
  menuKeyText: {
    fontSize: 11,
    color: Colors.placeholder,
    marginTop: 2,
  },
  inputContainer: {
    backgroundColor: Colors.lightBg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.sm,
    paddingHorizontal: 10,
  },
  textInput: {
    height: 38,
    fontSize: 13,
    color: Colors.text,
  },
  actionSection: {
    padding: 16,
    backgroundColor: Colors.card,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  saveButton: {
    backgroundColor: TOKO_GREEN,
    borderRadius: Radii.lg,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  saveButtonText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  resetButton: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.lg,
    paddingVertical: 12,
    alignItems: 'center',
  },
  resetButtonText: {
    color: Colors.danger,
    fontSize: 14,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.6,
  },
});
