import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { getSupabaseClient } from '../../services/supabase';
import { useToast } from '../../contexts/ToastContext';
import { getWaConfig, upsertWaConfig } from '../../services/waNotifSupabase';
import { Colors, Spacing, Radii, Shadows, Typography } from '../../theme';

export default function WhatsAppSettingsScreen({ navigation }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({
    wa_target_1: '',
    wa_target_2: '',
    wa_target_3: ''
  });
  const [waCfg, setWaCfg] = useState({
    provider: 'fonnte',
    token: '',
    appkey: '',
    authkey: ''
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
      
      const cfg = await getWaConfig({ ownerId: currentUser.id });
      if (cfg) {
        setWaCfg({
          provider: cfg.provider || 'fonnte',
          token: cfg.token || '',
          appkey: cfg.appkey || '',
          authkey: cfg.authkey || ''
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
      
      await upsertWaConfig({
        ownerId: user.id,
        provider: waCfg.provider || 'fonnte',
        token: (waCfg.token || '').trim(),
        appkey: (waCfg.appkey || '').trim(),
        authkey: (waCfg.authkey || '').trim()
      });

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
  const updateCfg = (field, value) => {
    setWaCfg(prev => ({
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
          <Ionicons name="arrow-back" size={24} color={Colors.darkText} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifikasi WhatsApp</Text>
        <TouchableOpacity 
          style={styles.saveButton}
          onPress={saveSettings}
          disabled={loading}
        >
          <Text style={[styles.saveButtonText, loading ? styles.saveButtonTextDisabled : null]}>
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
                placeholderTextColor={Colors.placeholder}
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
                placeholderTextColor={Colors.placeholder}
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
                placeholderTextColor={Colors.placeholder}
                keyboardType="phone-pad"
              />
            </View>
            
            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={20} color={Colors.muted} style={{ marginRight: 8 }} />
              <Text style={styles.infoText}>
                Notifikasi akan dikirim dengan jeda 5-10 detik untuk menghindari pembatasan broadcast.
              </Text>
            </View>

            <View style={[styles.separatorLine]} />

            {/* Provider Selector */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Provider WhatsApp</Text>
              <View style={styles.providerSelector}>
                <TouchableOpacity
                  style={[
                    styles.providerTab,
                    (waCfg.provider || 'fonnte') === 'fonnte' && styles.providerTabActive
                  ]}
                  onPress={() => updateCfg('provider', 'fonnte')}
                >
                  <Text style={[
                    styles.providerTabText,
                    (waCfg.provider || 'fonnte') === 'fonnte' && styles.providerTabTextActive
                  ]}>Fonnte</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.providerTab,
                    waCfg.provider === 'wapanels' && styles.providerTabActive
                  ]}
                  onPress={() => updateCfg('provider', 'wapanels')}
                >
                  <Text style={[
                    styles.providerTabText,
                    waCfg.provider === 'wapanels' && styles.providerTabTextActive
                  ]}>Wapanels</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Conditionally rendered credentials */}
            {(waCfg.provider || 'fonnte') === 'fonnte' ? (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Token API Fonnte</Text>
                <TextInput
                  style={styles.input}
                  value={waCfg.token}
                  onChangeText={(v) => updateCfg('token', v)}
                  placeholder="Masukkan token Fonnte"
                  placeholderTextColor={Colors.placeholder}
                  secureTextEntry
                />
              </View>
            ) : (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>App Key Wapanels</Text>
                  <TextInput
                    style={styles.input}
                    value={waCfg.appkey}
                    onChangeText={(v) => updateCfg('appkey', v)}
                    placeholder="Masukkan App Key Wapanels"
                    placeholderTextColor={Colors.placeholder}
                    secureTextEntry
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Auth Key Wapanels</Text>
                  <TextInput
                    style={styles.input}
                    value={waCfg.authkey}
                    onChangeText={(v) => updateCfg('authkey', v)}
                    placeholder="Masukkan Auth Key Wapanels"
                    placeholderTextColor={Colors.placeholder}
                    secureTextEntry
                  />
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: Radii.pill,
    backgroundColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.darkText,
    flex: 1,
    textAlign: 'center',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radii.pill,
    backgroundColor: Colors.primary,
  },
  saveButtonText: {
    color: Colors.white,
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
    color: Colors.muted,
    marginBottom: 24,
    lineHeight: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.darkText,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.card,
    borderRadius: Radii.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.card,
  },
  providerSelector: {
    flexDirection: 'row',
    backgroundColor: Colors.borderLight,
    borderRadius: Radii.md,
    padding: 3,
    marginBottom: 10,
  },
  providerTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: Radii.sm,
  },
  providerTabActive: {
    backgroundColor: Colors.card,
    ...Shadows.card,
  },
  providerTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.muted,
  },
  providerTabTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: Colors.lightBg,
    padding: 12,
    borderRadius: Radii.sm,
    marginTop: 10,
    alignItems: 'center',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: Colors.muted,
    lineHeight: 18,
  },
  separatorLine: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: 20,
  }
});

