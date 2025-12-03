import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme';

export default function BarcodeScanScreen({ navigation, route }) {
  const videoRef = useRef(null);
  const codeReaderRef = useRef(null);

  const mode = route?.params?.mode || 'sale';
  const returnTo = route?.params?.returnTo;
  const returnParams = route?.params?.returnParams || {};

  useEffect(() => {
    const codeReader = new BrowserMultiFormatReader();
    codeReaderRef.current = codeReader;

    let active = true;
    (async () => {
      try {
        await codeReader.decodeFromVideoDevice(undefined, videoRef.current, (result, err) => {
          if (!active) return;
          if (result) {
            const data = String(result.getText());
            if (mode === 'pick' && returnTo) {
              if (returnTo === 'DaftarProduk' || returnTo === 'FormProduk' || returnTo === 'ProductReport') {
                navigation.navigate('Produk', { screen: returnTo, params: { pickedBarcode: data, ...returnParams } });
              } else {
                navigation.navigate(returnTo, { pickedBarcode: data, ...returnParams });
              }
            } else {
              navigation.navigate('Penjualan', { screen: 'Penjualan', params: { scannedBarcode: data } });
            }
          }
        });
      } catch (e) {
        console.error('Web scan error', e);
      }
    })();

    return () => {
      active = false;
      try {
        codeReaderRef.current?.reset();
      } catch {}
    };
  }, [navigation, mode, returnTo, returnParams]);

  return (
    <View style={styles.container}>
      <video ref={videoRef} style={styles.video} autoPlay playsInline muted />
      <View style={styles.overlay}>
        <View style={styles.scanArea} />
        <Text style={styles.hint}>Arahkan barcode ke kotak</Text>
        <View style={styles.actions}>
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
  video: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
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
  hint: { color: '#fff', fontSize: 14, marginTop: '65%', marginBottom: 12 },
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
});
