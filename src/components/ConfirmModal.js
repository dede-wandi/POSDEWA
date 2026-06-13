import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Radii, Spacing } from '../theme';

const { width } = Dimensions.get('window');

/**
 * ConfirmModal – themed confirm/alert dialog that replaces window.confirm() & Alert.alert()
 *
 * Props:
 *   visible         boolean           – whether modal is shown
 *   title           string            – heading text
 *   message         string            – body text
 *   confirmText     string            – confirm button label  (default: 'Ya, Hapus')
 *   cancelText      string            – cancel button label   (default: 'Batal')
 *   onConfirm       () => void        – called when user confirms
 *   onCancel        () => void        – called when user cancels / closes
 *   type            'danger'|'warning'|'info'|'success'  (default: 'danger')
 *   icon            Ionicons name     – optional icon name override
 */
export default function ConfirmModal({
  visible,
  title = 'Konfirmasi',
  message = 'Apakah Anda yakin?',
  confirmText = 'Ya, Hapus',
  cancelText = 'Batal',
  onConfirm,
  onCancel,
  type = 'danger',
  icon,
}) {
  const typeConfig = {
    danger: {
      color: Colors.danger,
      bg: Colors.dangerLight,
      icon: icon || 'trash-outline',
      btnBg: Colors.danger,
    },
    warning: {
      color: Colors.warning,
      bg: Colors.warningLight,
      icon: icon || 'warning-outline',
      btnBg: Colors.warning,
    },
    info: {
      color: Colors.info,
      bg: Colors.infoLight,
      icon: icon || 'information-circle-outline',
      btnBg: Colors.info,
    },
    success: {
      color: Colors.success,
      bg: Colors.successLight,
      icon: icon || 'checkmark-circle-outline',
      btnBg: Colors.success,
    },
  };

  const cfg = typeConfig[type] || typeConfig.danger;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Icon badge */}
          <View style={[styles.iconBadge, { backgroundColor: cfg.bg }]}>
            <Ionicons name={cfg.icon} size={32} color={cfg.color} />
          </View>

          {/* Title */}
          <Text style={styles.title}>{title}</Text>

          {/* Message */}
          <Text style={styles.message}>{message}</Text>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Action buttons */}
          <View style={styles.btnRow}>
            <TouchableOpacity
              style={[styles.btn, styles.btnCancel]}
              onPress={onCancel}
              activeOpacity={0.7}
            >
              <Text style={styles.btnCancelText}>{cancelText}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, styles.btnConfirm, { backgroundColor: cfg.btnBg }]}
              onPress={onConfirm}
              activeOpacity={0.8}
            >
              <Ionicons name={cfg.icon} size={16} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.btnConfirmText}>{confirmText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radii.xl || 20,
    padding: Spacing.xxl,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  iconBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSize.title || 18,
    fontWeight: FontWeight.bold || '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  message: {
    fontSize: FontSize.body || 14,
    color: Colors.muted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: Spacing.lg,
  },
  btnRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    width: '100%',
  },
  btn: {
    flex: 1,
    height: 46,
    borderRadius: Radii.lg || 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  btnCancel: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  btnCancelText: {
    fontSize: FontSize.body || 14,
    fontWeight: FontWeight.semiBold || '600',
    color: Colors.text,
  },
  btnConfirm: {
    backgroundColor: Colors.danger,
  },
  btnConfirmText: {
    fontSize: FontSize.body || 14,
    fontWeight: FontWeight.semiBold || '600',
    color: '#fff',
  },
});
