import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, Switch, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme';
import { createCustomInvoice, updateCustomInvoice } from '../../services/customInvoiceSupabase';
import { useToast } from '../../contexts/ToastContext';

export default function CustomInvoiceFormScreen({ navigation, route }) {
  const { invoice } = route.params || {};
  const isEdit = !!invoice;
  const { showToast } = useToast();

  const [title, setTitle] = useState(invoice?.title || '');
  const [paperSize, setPaperSize] = useState(invoice?.paper_size || '58mm');
  const [headerContent, setHeaderContent] = useState(invoice?.header_content || '');
  const [footerContent, setFooterContent] = useState(invoice?.footer_content || '');
  const [showLogo, setShowLogo] = useState(invoice?.show_logo ?? true);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) {
      showToast('Nama template harus diisi', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title,
        paper_size: paperSize,
        header_content: headerContent,
        footer_content: footerContent,
        show_logo: showLogo,
      };

      if (isEdit) {
        await updateCustomInvoice(invoice.id, payload);
        showToast('Invoice berhasil diperbarui', 'success');
      } else {
        await createCustomInvoice(payload);
        showToast('Invoice berhasil dibuat', 'success');
      }
      navigation.goBack();
    } catch (error) {
      console.error('Error saving invoice:', error);
      showToast('Gagal menyimpan invoice', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEdit ? 'Edit Template' : 'Template Baru'}</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.saveButton}>
          <Text style={styles.saveButtonText}>{saving ? 'Menyimpan...' : 'Simpan'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Nama Template</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Contoh: Struk Standar"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Ukuran Kertas</Text>
          <View style={styles.paperSizeContainer}>
            {['58mm', '80mm'].map((size) => (
              <TouchableOpacity
                key={size}
                style={[
                  styles.paperSizeOption,
                  paperSize === size && styles.paperSizeSelected,
                ]}
                onPress={() => setPaperSize(size)}
              >
                <Text
                  style={[
                    styles.paperSizeText,
                    paperSize === size && styles.paperSizeTextSelected,
                  ]}
                >
                  {size}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.inputGroup}>
          <View style={styles.switchRow}>
            <Text style={styles.label}>Tampilkan Logo Toko</Text>
            <Switch
              value={showLogo}
              onValueChange={setShowLogo}
              trackColor={{ false: '#767577', true: Colors.primary }}
              thumbColor={showLogo ? '#fff' : '#f4f3f4'}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Konten Header (Atas)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={headerContent}
            onChangeText={setHeaderContent}
            placeholder="Teks tambahan di bagian atas struk..."
            multiline
            textAlignVertical="top"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Konten Footer (Bawah)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={footerContent}
            onChangeText={setFooterContent}
            placeholder="Teks ucapan terima kasih, info wifi, dll..."
            multiline
            textAlignVertical="top"
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFF',
    elevation: 2,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  saveButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  content: {
    padding: 16,
  },
  inputGroup: {
    marginBottom: 20,
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 8,
    elevation: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#555',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: Colors.text,
  },
  textArea: {
    height: 100,
  },
  paperSizeContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  paperSizeOption: {
    flex: 1,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    alignItems: 'center',
  },
  paperSizeSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  paperSizeText: {
    fontSize: 16,
    color: '#555',
  },
  paperSizeTextSelected: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
