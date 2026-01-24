import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Easing, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme';

const { width, height } = Dimensions.get('window');

export default function SplashScreen() {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const receiptAnim = useRef(new Animated.Value(0)).current;
  
  const [loadingText, setLoadingText] = useState('INITIALIZING SYSTEM...');

  useEffect(() => {
    // Cycling loading text
    const texts = [
      'LOADING PRODUCTS...', 
      'SYNCING DATABASE...', 
      'CHECKING STOCK...', 
      'PREPARING DASHBOARD...'
    ];
    let textIdx = 0;
    const textInterval = setInterval(() => {
      setLoadingText(texts[textIdx % texts.length]);
      textIdx++;
    }, 800);

    // Entrance Animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      })
    ]).start();

    // Scanning Line Animation (Loop)
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scanLineAnim, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        })
      ])
    ).start();

    // Receipt Printing Animation (Slide Down)
    Animated.timing(receiptAnim, {
      toValue: 1,
      duration: 2000,
      delay: 500,
      easing: Easing.out(Easing.back(1.5)),
      useNativeDriver: true,
    }).start();

    return () => clearInterval(textInterval);
  }, []);

  const scanLineTranslateY = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-60, 60], // Moves up and down over the icon
  });

  const receiptTranslateY = receiptAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-50, 20], 
  });

  const receiptOpacity = receiptAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <View style={styles.container}>
      {/* Background POS Patterns */}
      <View style={styles.backgroundDecoration}>
        <View style={[styles.circle, { top: -100, left: -100, width: 300, height: 300, backgroundColor: Colors.primary, opacity: 0.05 }]} />
        <View style={[styles.circle, { bottom: -50, right: -50, width: 200, height: 200, backgroundColor: Colors.success, opacity: 0.05 }]} />
      </View>

      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        
        {/* Main Icon Container with Scanning Effect */}
        <View style={styles.iconWrapper}>
          <View style={styles.iconContainer}>
            <Ionicons name="storefront-outline" size={60} color="#fff" />
          </View>
          
          {/* Scanning Line */}
          <Animated.View 
            style={[
              styles.scanLine, 
              { transform: [{ translateY: scanLineTranslateY }] }
            ]} 
          />
        </View>

        {/* Floating Receipt Icon Animation */}
        <Animated.View 
          style={[
            styles.receiptIcon, 
            { 
              transform: [{ translateY: receiptTranslateY }],
              opacity: receiptOpacity
            }
          ]}
        >
          <Ionicons name="receipt" size={30} color={Colors.primary} />
        </Animated.View>

        <View style={styles.textContainer}>
          <Text style={styles.title}>POS<Text style={styles.highlight}>DEWA</Text></Text>
          <Text style={styles.subtitle}>SMART POINT OF SALE</Text>
        </View>

        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={Colors.primary} style={{ marginRight: 10 }} />
          <Text style={styles.loadingText}>{loadingText}</Text>
        </View>

      </Animated.View>
      
      <View style={styles.footer}>
        <Text style={styles.footerText}>v2.0.45 • Powered by POSDEWA Systems</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff', // Clean white background for POS look
    alignItems: 'center',
    justifyContent: 'center',
  },
  backgroundDecoration: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  circle: {
    position: 'absolute',
    borderRadius: 1000,
  },
  content: {
    alignItems: 'center',
    zIndex: 10,
  },
  iconWrapper: {
    width: 120,
    height: 120,
    marginBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 25,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    zIndex: 2,
  },
  scanLine: {
    position: 'absolute',
    width: 140,
    height: 2,
    backgroundColor: Colors.success,
    shadowColor: Colors.success,
    shadowOpacity: 1,
    shadowRadius: 10,
    zIndex: 3,
  },
  receiptIcon: {
    position: 'absolute',
    top: 80, // Start behind/below the main icon
    right: -20,
    zIndex: 1,
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  textContainer: {
    alignItems: 'center',
    marginTop: 30,
  },
  title: {
    fontSize: 36,
    fontWeight: '900',
    color: Colors.text,
    letterSpacing: 2,
  },
  highlight: {
    color: Colors.primary,
  },
  subtitle: {
    fontSize: 12,
    color: Colors.muted,
    letterSpacing: 4,
    marginTop: 5,
    fontWeight: '600',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 50,
    backgroundColor: Colors.background,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  loadingText: {
    color: Colors.muted,
    fontSize: 12,
    fontWeight: '600',
    width: 160, // Fixed width to prevent jitter
  },
  footer: {
    position: 'absolute',
    bottom: 40,
  },
  footerText: {
    color: Colors.muted,
    fontSize: 10,
  },
});
