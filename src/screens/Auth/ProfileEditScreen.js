import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { getSupabaseClient } from '../../services/supabase';
import { useToast } from '../../contexts/ToastContext';
import { Colors, Shadows } from '../../theme';

export default function ProfileEditScreen({ navigation }) {
  const { user, updateUser } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState({
    full_name: '',
    phone: '',
    address: '',
    business_name: '',
    business_address: '',
    business_phone: ''
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        return;
      }

      // Load current user data
      const { data: { user: currentUser }, error } = await supabase.auth.getUser();
      
      if (error) {
        return;
      }

      if (currentUser && currentUser.user_metadata) {
        setProfile({
          full_name: currentUser.user_metadata.full_name || '',
          phone: currentUser.user_metadata.phone || '',
          address: currentUser.user_metadata.address || '',
          business_name: currentUser.user_metadata.business_name || '',
          business_address: currentUser.user_metadata.business_address || '',
          business_phone: currentUser.user_metadata.business_phone || ''
        });
      }
    } catch (error) {
    }
  };

  const saveProfile = async () => {
    if (!profile.full_name.trim()) {
      showToast('Nama lengkap harus diisi', 'error');
      return;
    }

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
          full_name: profile.full_name.trim(),
          phone: profile.phone.trim(),
          address: profile.address.trim(),
          business_name: profile.business_name.trim(),
          business_address: profile.business_address.trim(),
          business_phone: profile.business_phone.trim(),
        }
      });

      if (error) {
        showToast('Gagal menyimpan profil: ' + error.message, 'error');
        return;
      }

      showToast('Profil berhasil diperbarui', 'success');
      navigation.goBack();
    } catch (error) {
      showToast('Terjadi kesalahan saat menyimpan profil', 'error');
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field, value) => {
    setProfile(prev => ({
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
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profil</Text>
        <TouchableOpacity 
          style={styles.saveButton}
          onPress={saveProfile}
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
          {/* Personal Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>👤 Informasi Pribadi</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nama Lengkap *</Text>
              <TextInput
                style={styles.input}
                value={profile.full_name}
                onChangeText={(value) => updateField('full_name', value)}
                placeholder="Masukkan nama lengkap"
                placeholderTextColor={Colors.placeholder}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nomor Telepon</Text>
              <TextInput
                style={styles.input}
                value={profile.phone}
                onChangeText={(value) => updateField('phone', value)}
                placeholder="Masukkan nomor telepon"
                placeholderTextColor={Colors.placeholder}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Alamat</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={profile.address}
                onChangeText={(value) => updateField('address', value)}
                placeholder="Masukkan alamat lengkap"
                placeholderTextColor={Colors.placeholder}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          </View>

          {/* Business Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🏪 Informasi Bisnis</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nama Bisnis</Text>
              <TextInput
                style={styles.input}
                value={profile.business_name}
                onChangeText={(value) => updateField('business_name', value)}
                placeholder="Masukkan nama bisnis"
                placeholderTextColor={Colors.placeholder}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Alamat Bisnis</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={profile.business_address}
                onChangeText={(value) => updateField('business_address', value)}
                placeholder="Masukkan alamat bisnis"
                placeholderTextColor={Colors.placeholder}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Telepon Bisnis</Text>
              <TextInput
                style={styles.input}
                value={profile.business_phone}
                onChangeText={(value) => updateField('business_phone', value)}
                placeholder="Masukkan telepon bisnis"
                placeholderTextColor={Colors.placeholder}
                keyboardType="phone-pad"
              />
            </View>
          </View>

          {/* Account Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📧 Informasi Akun</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.disabledInput}>
                <Text style={styles.disabledText}>{user.email}</Text>
                <Text style={styles.disabledNote}>Email tidak dapat diubah</Text>
              </View>
            </View>
          </View>

          <View style={styles.bottomPadding} />
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
    borderRadius: 20,
    backgroundColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.darkText,
    flex: 1,
    textAlign: 'center',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.primary,
  },
  saveButtonText: {
    color: Colors.white,
    fontSize: 16,
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
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.darkText,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.black,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  textArea: {
    height: 80,
    paddingTop: 14,
  },
  disabledInput: {
    backgroundColor: Colors.lightBg,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  disabledText: {
    fontSize: 16,
    color: Colors.muted,
    marginBottom: 4,
  },
  disabledNote: {
    fontSize: 12,
    color: Colors.placeholder,
    fontStyle: 'italic',
  },
  bottomPadding: {
    height: 40,
  },
});