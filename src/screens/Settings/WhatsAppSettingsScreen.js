import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { getSupabaseClient } from '../../services/supabase';
import { useToast } from '../../contexts/ToastContext';
import { checkWaConfigReady, getWaConfig, upsertWaConfig } from '../../services/waNotifSupabase';

export default function WhatsAppSettingsScreen({ navigation }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({
    wa_target_1: '',
    wa_target_2: '',
    wa_target_3: ''
  });
  const [waCfg, setWaCfg] = useState({ token: '' });
  const [schemaReady, setSchemaReady] = useState(true);
  const [schemaMsg, setSchemaMsg] = useState('');

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
      const chk = await checkWaConfigReady();
      if (!chk.ready) {
        setSchemaReady(false);
        setSchemaMsg(chk.message || '');
      } else {
        setSchemaReady(true);
        setSchemaMsg('');
        const cfg = await getWaConfig({ ownerId: currentUser.id });
        if (cfg) setWaCfg({ token: cfg.token || '' });
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
      if (schemaReady) {
        await upsertWaConfig({
          ownerId: user.id,
          token: waCfg.token.trim()
        });
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
  const updateCfg = (field, value) => {
    setWaCfg(prev => ({
      ...prev,
      [field]: value
    }));
  };
  const WA_SCHEMA_SQL = `
create table if not exists public.wa_notif_config (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  token text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.wa_notif_config enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='wa_notif_config' and policyname='wa_notif_select_own') then
    create policy wa_notif_select_own on public.wa_notif_config for select using (auth.uid() = owner_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='wa_notif_config' and policyname='wa_notif_mod_own') then
    create policy wa_notif_mod_own on public.wa_notif_config for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
  end if;
end $$;
`;
  const copySql = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(WA_SCHEMA_SQL);
        showToast('SQL schema disalin ke clipboard', 'success');
        return;
      }
      const ta = document.createElement('textarea');
      ta.value = WA_SCHEMA_SQL;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast('SQL schema disalin ke clipboard', 'success');
    } catch {
      showToast('Gagal menyalin SQL schema', 'error');
    }
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

            <View style={[styles.separatorLine]} />

            {!schemaReady ? (
              <View style={styles.schemaBox}>
                <Ionicons name="alert-circle-outline" size={20} color="#b00020" style={{ marginRight: 8 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.schemaTitle}>Skema WA Notif belum tersedia</Text>
                  <Text style={styles.schemaMsg}>{schemaMsg}</Text>
                </View>
              </View>
            ) : null}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Token API</Text>
              <TextInput
                style={styles.input}
                value={waCfg.token}
                onChangeText={(v) => updateCfg('token', v)}
                placeholder="Masukkan token WA provider"
                placeholderTextColor="#999"
                secureTextEntry
              />
            </View>

            {!schemaReady ? (
              <TouchableOpacity style={styles.sqlButton} onPress={copySql}>
                <Ionicons name="copy-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.sqlButtonText}>Salin SQL Skema WA Notif</Text>
              </TouchableOpacity>
            ) : null}
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
  separatorLine: {
    height: 1,
    backgroundColor: '#E5E5EA',
    marginVertical: 20,
  },
  schemaBox: {
    flexDirection: 'row',
    backgroundColor: '#FDECEE',
    borderColor: '#F9CADA',
    borderWidth: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12
  },
  schemaTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#b00020',
    marginBottom: 4
  },
  schemaMsg: {
    fontSize: 12,
    color: '#b00020'
  },
  sqlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 10
  },
  sqlButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600'
  }
});
