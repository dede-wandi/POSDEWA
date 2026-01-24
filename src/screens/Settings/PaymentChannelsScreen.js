import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput, Alert, ActivityIndicator, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme';
import { getPaymentChannels, createPaymentChannel, updatePaymentChannel, deletePaymentChannel } from '../../services/financeSupabase';
import { formatIDR } from '../../utils/currency';

export default function PaymentChannelsScreen({ navigation }) {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingChannel, setEditingChannel] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('digital'); // 'cash' or 'digital'
  const [initialBalance, setInitialBalance] = useState('');

  const loadChannels = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getPaymentChannels();
      if (result.success) {
        setChannels(result.data);
      } else {
        Alert.alert('Error', result.error);
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Gagal memuat data channel pembayaran');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  const resetForm = () => {
    setName('');
    setDescription('');
    setType('digital');
    setInitialBalance('');
    setEditingChannel(null);
  };

  const handleAdd = () => {
    resetForm();
    setModalVisible(true);
  };

  const handleEdit = (channel) => {
    setEditingChannel(channel);
    setName(channel.name);
    setDescription(channel.description || '');
    setType(channel.type);
    setInitialBalance(''); // Initial balance cannot be edited once created
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Validasi', 'Nama channel harus diisi');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingChannel) {
        const result = await updatePaymentChannel(editingChannel.id, {
          name,
          description,
          type
        });
        if (result.success) {
          Alert.alert('Sukses', 'Channel pembayaran berhasil diperbarui');
          setModalVisible(false);
          loadChannels();
        } else {
          Alert.alert('Error', result.error);
        }
      } else {
        const result = await createPaymentChannel({
          name,
          description,
          type,
          initialBalance: parseFloat(initialBalance) || 0
        });
        if (result.success) {
          Alert.alert('Sukses', 'Channel pembayaran berhasil ditambahkan');
          setModalVisible(false);
          loadChannels();
        } else {
          Alert.alert('Error', result.error);
        }
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Terjadi kesalahan saat menyimpan data');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (channel) => {
    Alert.alert(
      'Konfirmasi Hapus',
      `Apakah Anda yakin ingin menghapus channel "${channel.name}"?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await deletePaymentChannel(channel.id);
              if (result.success) {
                Alert.alert('Sukses', 'Channel pembayaran berhasil dihapus');
                loadChannels();
              } else {
                Alert.alert('Gagal', result.error);
              }
            } catch (error) {
              console.error(error);
              Alert.alert('Error', 'Terjadi kesalahan saat menghapus data');
            }
          }
        }
      ]
    );
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.iconContainer}>
          <Ionicons 
            name={item.type === 'cash' ? 'cash' : 'card'} 
            size={24} 
            color={Colors.primary} 
          />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle}>{item.name}</Text>
          <Text style={styles.cardSubtitle}>{item.type === 'cash' ? 'Tunai' : 'Digital/Transfer'}</Text>
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity onPress={() => handleEdit(item)} style={styles.actionButton}>
            <Ionicons name="create-outline" size={20} color={Colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDelete(item)} style={styles.actionButton}>
            <Ionicons name="trash-outline" size={20} color={Colors.danger} />
          </TouchableOpacity>
        </View>
      </View>
      
      <View style={styles.divider} />
      
      <View style={styles.cardFooter}>
        <View>
          <Text style={styles.label}>Saldo Saat Ini</Text>
          <Text style={styles.balance}>{formatIDR(item.balance)}</Text>
        </View>
        {item.description ? (
          <View style={{ marginTop: 8 }}>
             <Text style={styles.description}>{item.description}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Channel Pembayaran</Text>
        <TouchableOpacity onPress={handleAdd} style={styles.addButton}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={channels}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="wallet-outline" size={64} color={Colors.muted} />
              <Text style={styles.emptyText}>Belum ada channel pembayaran</Text>
              <Text style={styles.emptySubtext}>Tambahkan channel untuk mengelola metode pembayaran</Text>
            </View>
          }
        />
      )}

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingChannel ? 'Edit Channel' : 'Tambah Channel'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Nama Channel</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Contoh: Kas Tunai, BCA, OVO"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Tipe Channel</Text>
              <View style={styles.typeSelector}>
                <TouchableOpacity 
                  style={[styles.typeOption, type === 'cash' && styles.typeOptionActive]}
                  onPress={() => setType('cash')}
                >
                  <Ionicons name="cash-outline" size={20} color={type === 'cash' ? '#fff' : Colors.text} />
                  <Text style={[styles.typeText, type === 'cash' && styles.typeTextActive]}>Tunai</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.typeOption, type === 'digital' && styles.typeOptionActive]}
                  onPress={() => setType('digital')}
                >
                  <Ionicons name="card-outline" size={20} color={type === 'digital' ? '#fff' : Colors.text} />
                  <Text style={[styles.typeText, type === 'digital' && styles.typeTextActive]}>Digital</Text>
                </TouchableOpacity>
              </View>
            </View>

            {!editingChannel && (
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Saldo Awal (Rp)</Text>
                <TextInput
                  style={styles.input}
                  value={initialBalance}
                  onChangeText={setInitialBalance}
                  placeholder="0"
                  keyboardType="numeric"
                />
              </View>
            )}

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Deskripsi (Opsional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Catatan tambahan..."
                multiline
                numberOfLines={3}
              />
            </View>

            <TouchableOpacity 
              style={[styles.submitButton, isSubmitting && styles.disabledButton]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Simpan</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  backButton: {
    padding: 4,
  },
  addButton: {
    backgroundColor: Colors.primary,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F9FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: 12,
    color: Colors.muted,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 6,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: 12,
  },
  cardFooter: {
    
  },
  label: {
    fontSize: 12,
    color: Colors.muted,
    marginBottom: 4,
  },
  balance: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.success,
  },
  description: {
    fontSize: 12,
    color: Colors.muted,
    fontStyle: 'italic',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.muted,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: Colors.text,
    backgroundColor: Colors.background,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  typeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    gap: 8,
  },
  typeOptionActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  typeText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  typeTextActive: {
    color: '#fff',
  },
  submitButton: {
    backgroundColor: Colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  disabledButton: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
