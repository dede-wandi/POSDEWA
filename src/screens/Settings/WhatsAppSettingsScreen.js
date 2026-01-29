import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { getSupabaseClient } from '../../services/supabase';
import { useToast } from '../../contexts/ToastContext';

export default function WhatsAppSettingsScreen({ navigation }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({
    wa_target_1: '',
    wa_target_2: '',
    wa_target_3: ''
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) return;

      const { data: { user: currentUser }, error } = await supabase.auth.getUser();
      
      if (error) {
        console.error('Error loading user settings:', error);
        return;
      }

      if (currentUser && currentUser.user_metadata) {
        setSettings({
          wa_target_1: currentUser.user_metadata.wa_target_1 || '',
          wa_target_2: currentUser.user_metadata.wa_target_2 || '',
          wa_target_3: currentUser.user_metadata.wa_target_3 || ''
        });
      }
    } catch (error) {
      console.error('Exception loading settings:', error);
    }
  };

  const saveSettings = async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        showToast('Supabase client tidak tersedia', 'error');
        return;
      }

      // Update user metadata
      const { error } = await supabase.auth.updateUser({
        data: {
          wa_target_1: settings.wa_target_1.trim(),
          wa_target_2: settings.wa_target_2.trim(),
          wa_target_3: settings.wa_target_3.trim(),
        }
      });

      if (error) {
        console.error('Error saving settings:', error);
        showToast('Gagal menyimpan pengaturan: ' + error.message, 'error');
        return;
      }

      showToast('Pengaturan berhasil disimpan', 'success');
      navigation.goBack();
    } catch (error) {
      console.error('Exception saving settings:', error);
      showToast('Terjadi kesalahan saat menyimpan pengaturan', 'error');
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field, value) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifikasi WhatsApp</Text>
        <TouchableOpacity 
          style={styles.saveButton}
          onPress={saveSettings}
          disabled={loading}
        >
          <Text style={[styles.saveButtonText, loading && styles.saveButtonTextDisabled]}>
            {loading ? 'Menyimpan...' : 'Simpan'}
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.description}>
              Masukkan nomor WhatsApp (diawali 62) untuk menerima notifikasi otomatis setiap kali ada penjualan baru. Maksimal 3 nomor.
            </Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Target WhatsApp 1 (Utama)</Text>
              <TextInput
                style={styles.input}
                value={settings.wa_target_1}
                onChangeText={(value) => updateField('wa_target_1', value)}
                placeholder="Contoh: 6281234567890"
                placeholderTextColor="#999"
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Target WhatsApp 2 (Opsional)</Text>
              <TextInput
                style={styles.input}
                value={settings.wa_target_2}
                onChangeText={(value) => updateField('wa_target_2', value)}
                placeholder="Contoh: 6281234567890"
                placeholderTextColor="#999"
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Target WhatsApp 3 (Opsional)</Text>
              <TextInput
                style={styles.input}
                value={settings.wa_target_3}
                onChangeText={(value) => updateField('wa_target_3', value)}
                placeholder="Contoh: 6281234567890"
                placeholderTextColor="#999"
                keyboardType="phone-pad"
              />
            </View>
            
            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={20} color="#666" style={{ marginRight: 8 }} />
              <Text style={styles.infoText}>
                Notifikasi akan dikirim dengan jeda 5-10 detik untuk menghindari pembatasan broadcast.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    flex: 1,
    textAlign: 'center',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#007AFF',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  saveButtonTextDisabled: {
    opacity: 0.6,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
    lineHeight: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#E8E8E8',
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
    alignItems: 'center',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
});
