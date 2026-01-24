import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, Dimensions, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radii, Typography, Shadows } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../contexts/ToastContext';

const { width } = Dimensions.get('window');

export default function AuthScreen() {
  const { signIn, signOut } = useAuth();
  const { showToast } = useToast();
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  // Simple login animation: fade + slide-in
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 450,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 550,
        useNativeDriver: true,
      }),
    ]).start();
  }, [mode]);

  const submit = async () => {
    console.log('🔐 AuthScreen: Submit started', { mode, email });
    
    if (!email.trim() || !password.trim()) {
      console.log('❌ AuthScreen: Empty fields');
      showToast('Email dan password harus diisi', 'error');
      return;
    }
    
    try {
      setBusy(true);
      console.log('🔄 AuthScreen: Attempting', mode);
      
      if (mode === 'login') {
        console.log('🔑 AuthScreen: Calling signIn function');
        const { data, error } = await signIn(email, password);
        
        if (error) {
          console.log('❌ AuthScreen: Login error', error);
          showToast(error.message || 'Login gagal', 'error');
          setBusy(false);
        } else {
          console.log('✅ AuthScreen: Login success', data.user?.email);
          // Navigation akan otomatis terjadi karena AuthContext akan update user state
          // Don't set busy to false here, let the auth state change handle it
        }
      } else {
        // For now, just show register is not implemented
        showToast('Registrasi belum diimplementasikan. Gunakan akun admin@gmail.com dengan password admin123', 'info');
        setBusy(false);
      }
    } catch (e) {
      console.log('❌ AuthScreen: Error occurred', e);
      showToast(e?.message || String(e), 'error');
      setBusy(false); // Ensure busy is set to false on error
    }
  };

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ 
            width: 80, 
            height: 80, 
            borderRadius: 20, 
            backgroundColor: Colors.primary + '15', 
            alignItems: 'center', 
            justifyContent: 'center',
            marginBottom: 16
          }}>
            <Ionicons name="receipt" size={48} color={Colors.primary} />
          </View>
          <Text style={styles.title}>POSDEWA</Text>
          <Text style={styles.subtitle}>
            {mode === 'login' ? 'Masuk ke Akun Anda' : 'Buat Akun Baru'}
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Email Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              placeholder="Masukkan email Anda"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
              placeholderTextColor="#999"
            />
          </View>

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                placeholder="Masukkan password Anda"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                style={styles.passwordInput}
                placeholderTextColor={Colors.muted}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
              >
                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={Colors.muted} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, busy && styles.submitButtonDisabled]}
            onPress={submit}
            disabled={busy}
          >
            <Text style={styles.submitButtonText}>
              {busy ? 'Memproses...' : (mode === 'login' ? 'Masuk' : 'Daftar')}
            </Text>
          </TouchableOpacity>

          {/* Switch Mode */}
          <TouchableOpacity
            style={styles.switchButton}
            onPress={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setPassword(''); // Clear password when switching modes
            }}
          >
            <Text style={styles.switchButtonText}>
              {mode === 'login' 
                ? 'Belum punya akun? Daftar di sini' 
                : 'Sudah punya akun? Masuk di sini'
              }
            </Text>
          </TouchableOpacity>
        </View>

      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radii.lg,
    padding: Spacing.xxl,
    ...Shadows.card,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  title: {
    ...Typography.heading,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.muted,
    textAlign: 'center',
  },
  form: {
    gap: Spacing.lg,
  },
  inputContainer: {
    gap: Spacing.sm,
  },
  label: {
    ...Typography.label,
    color: Colors.text,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    ...Typography.body,
    backgroundColor: Colors.background,
    color: Colors.text,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.md,
    backgroundColor: Colors.background,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    ...Typography.body,
    color: Colors.text,
  },
  eyeButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radii.md,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#C7C7CC',
  },
  submitButtonText: {
    color: '#ffffff',
    ...Typography.label,
  },
  switchButton: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  switchButtonText: {
    color: Colors.primary,
    ...Typography.label,
  },
  errorContainer: {
    marginTop: Spacing.xl,
    padding: Spacing.lg,
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  errorText: {
    color: '#856404',
    ...Typography.small,
    lineHeight: 20,
  },
});