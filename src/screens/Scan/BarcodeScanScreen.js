import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme';

export default function BarcodeScanScreen({ navigation, route }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [torch, setTorch] = useState(false);
  const mode = route?.params?.mode || 'sale';
  const returnTo = route?.params?.returnTo;
  const returnParams = route?.params?.returnParams || {};

  const onScanned = ({ data }) => {
    if (scanned) return;
    setScanned(true);
    const barcode = String(data);
    if (mode === 'pick' && returnTo) {
      // Navigasi ke screen di navigator bertingkat (Produk Stack)
      if (returnTo === 'DaftarProduk' || returnTo === 'FormProduk' || returnTo === 'ProductReport') {
        navigation.navigate('Produk', { screen: returnTo, params: { pickedBarcode: barcode, ...returnParams } });
      } else {
        navigation.navigate(returnTo, { pickedBarcode: barcode, ...returnParams });
      }
    } else {
      // Navigasi ke tab Penjualan dan teruskan param ke screen dalam SalesStack
      navigation.navigate('Penjualan', { screen: 'Penjualan', params: { scannedBarcode: barcode } });
    }
    setTimeout(() => setScanned(false), 500);
  };

  if (!permission) {
    return (
      <View style={styles.center}>
        <Text style={styles.info}>Menyiapkan izin kamera…</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Ionicons name="camera" size={48} color={Colors.muted} />
        <Text style={styles.info}>Izin kamera belum diberikan.</Text>
        <TouchableOpacity style={styles.backButton} onPress={requestPermission}>
          <Text style={styles.backButtonText}>Izinkan Kamera</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.backButton, { marginTop: 8 }]} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Kembali</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        enableTorch={torch}
        autofocus="on"
        onBarcodeScanned={onScanned}
      />

      <View style={styles.overlay}>
        <View style={styles.scanArea} />
        <Text style={styles.hint}>Arahkan barcode ke kotak</Text>
        <View style={styles.actions}>
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: torch ? '#FFD700' : Colors.primary }]} 
            onPress={() => setTorch(!torch)}
          >
            <Ionicons name={torch ? "flash" : "flash-off"} size={20} color={torch ? "#000" : "#fff"} />
            <Text style={[styles.actionText, { color: torch ? '#000' : '#fff' }]}>
              {torch ? 'Flash On' : 'Flash Off'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={20} color="#fff" />
            <Text style={styles.actionText}>Kembali</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  info: { marginTop: 12, fontSize: 16, color: Colors.text },
  subInfo: { marginTop: 4, fontSize: 14, color: Colors.muted },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 32,
  },
  scanArea: {
    position: 'absolute',
    top: '20%',
    width: '70%',
    aspectRatio: 1,
    borderWidth: 2,
    borderColor: '#00e676',
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  hint: {
    color: '#fff',
    fontSize: 14,
    marginTop: '65%',
    marginBottom: 12,
  },
  actions: { flexDirection: 'row', gap: 12 },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  actionText: { color: '#fff', marginLeft: 8, fontWeight: '600' },
  backButton: { marginTop: 12, backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  backButtonText: { color: '#fff', fontWeight: '600' },
});
