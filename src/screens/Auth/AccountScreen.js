import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { getSupabaseClient } from '../../services/supabase';

const { width } = Dimensions.get('window');

export default function AccountScreen({ navigation }) {
  const { user, signOut } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => {
    loadUserProfile();
  }, [user]);

  const loadUserProfile = async () => {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) return;

      const { data: { user: currentUser }, error } = await supabase.auth.getUser();
      
      if (error) {
        console.error('Error loading user profile:', error);
        return;
      }

      if (currentUser) {
        setUserProfile(currentUser);
      }
    } catch (error) {
      console.error('Exception loading user profile:', error);
    }
  };

  const handleSignOut = () => {
    signOut();
  };

  const onRefresh = async () => {
    console.log('🔄 AccountScreen: Manual refresh triggered');
    setRefreshing(true);
    await loadUserProfile();
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  const getDisplayName = () => {
    if (userProfile?.user_metadata?.full_name) {
      return userProfile.user_metadata.full_name;
    }
    return user?.email?.split('@')[0] || 'User';
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header dihapus sesuai permintaan agar tampilan lebih bersih dan konsisten */}
      
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
      >
        {user ? (
          <View style={styles.content}>
          {/* Profile Card */}
          <View style={styles.profileCard}>
            <View style={styles.avatarContainer}>
              <Text style={styles.avatarText}>
                {user.email?.charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>
                {getDisplayName()}
              </Text>
              <Text style={styles.profileEmail}>{user.email}</Text>
              {userProfile?.user_metadata?.business_name && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                  <Ionicons name="storefront-outline" size={14} color={Colors.primary} style={{ marginRight: 4 }} />
                  <Text style={styles.businessName}>
                    {userProfile.user_metadata.business_name}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Account Details */}
          <View style={styles.detailsSection}>
            <Text style={styles.sectionTitle}>DETAIL AKUN</Text>
            
            <View style={styles.detailCard}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Email</Text>
                <Text style={styles.detailValue}>{user.email}</Text>
              </View>
              
              {userProfile?.user_metadata?.phone && (
                <>
                  <View style={styles.separator} />
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Telepon</Text>
                    <Text style={styles.detailValue}>{userProfile.user_metadata.phone}</Text>
                  </View>
                </>
              )}
              
              <View style={styles.separator} />
              
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Status</Text>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>Aktif</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Actions Section */}
          <View style={styles.actionsSection}>
            <Text style={styles.sectionTitle}>PENGATURAN</Text>
            
            <TouchableOpacity 
              style={styles.actionButton} 
              onPress={() => navigation.navigate('ProfileEdit')}
            >
              <View style={styles.actionContent}>
                <Ionicons name="create-outline" size={18} color={Colors.text} style={{ marginRight: 12 }} />
                <Text style={styles.actionTextNormal}>Edit Profil</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.muted} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton} 
              onPress={() => navigation.navigate('InvoiceSettings')}
            >
              <View style={styles.actionContent}>
                <Ionicons name="document-text-outline" size={18} color={Colors.text} style={{ marginRight: 12 }} />
                <Text style={styles.actionTextNormal}>Pengaturan Invoice</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.muted} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionButton} 
              onPress={() => navigation.navigate('WhatsAppSettings')}
            >
              <View style={styles.actionContent}>
                <Ionicons name="logo-whatsapp" size={18} color={Colors.text} style={{ marginRight: 12 }} />
                <Text style={styles.actionTextNormal}>Notifikasi WhatsApp</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.muted} />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionButton} onPress={handleSignOut}>
              <View style={styles.actionContent}>
                <Ionicons name="log-out-outline" size={18} color={Colors.danger} style={{ marginRight: 12 }} />
                <Text style={styles.actionText}>Keluar dari Akun</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.muted} />
            </TouchableOpacity>
          </View>

          {/* App Info */}
          <View style={styles.appInfoSection}>
            <Text style={styles.appInfoTitle}>POSDEWA</Text>
            <Text style={styles.appInfoSubtitle}>Point of Sale System</Text>
            <Text style={styles.appInfoVersion}>Version 1.0.0</Text>
          </View>
        </View>
      ) : (
        <View style={styles.notLoggedIn}>
          <Ionicons name="lock-closed-outline" size={64} color={Colors.muted} style={styles.notLoggedInIcon} />
          <Text style={styles.notLoggedInTitle}>Belum Login</Text>
          <Text style={styles.notLoggedInSubtitle}>
            Silakan login untuk mengakses fitur akun
          </Text>
        </View>
      )}
      </ScrollView>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  scrollView: {
    flex: 1,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatarContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
    textTransform: 'capitalize',
  },
  profileEmail: {
    fontSize: 13,
    color: Colors.muted,
  },
  businessName: {
    fontSize: 12,
    color: Colors.primary,
    marginTop: 2,
    fontWeight: '500',
  },
  detailsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.muted,
    marginBottom: 8,
    marginLeft: 4,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  detailCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  detailLabel: {
    fontSize: 13,
    color: Colors.muted,
    flex: 1,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    flex: 2,
    textAlign: 'right',
  },
  separator: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 2,
  },
  statusBadge: {
    backgroundColor: '#e8f5e8',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#c3e6c3',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.success,
  },
  actionsSection: {
    marginBottom: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.danger,
  },
  actionTextNormal: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  appInfoSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  appInfoTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.primary,
    marginBottom: 2,
  },
  appInfoSubtitle: {
    fontSize: 12,
    color: Colors.muted,
    marginBottom: 4,
  },
  appInfoVersion: {
    fontSize: 11,
    color: Colors.muted,
  },
  notLoggedIn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  notLoggedInTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  notLoggedInSubtitle: {
    fontSize: 16,
    color: Colors.muted,
    textAlign: 'center',
    lineHeight: 24,
  },
});