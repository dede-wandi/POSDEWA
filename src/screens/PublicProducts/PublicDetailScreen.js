import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Dimensions,
  TouchableOpacity,
  Linking,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme';
import { getPublicProductByIdPublic } from '../../services/publicProductsSupabase';

const { width } = Dimensions.get('window');

export default function PublicDetailScreen({ navigation, route }) {
  const { id, product: initialProduct } = route.params || {};
  const [product, setProduct] = useState(initialProduct || null);
  const [loading, setLoading] = useState(!initialProduct);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const scrollRef = useRef(null);
  const [descImageRatios, setDescImageRatios] = useState({});

  useEffect(() => {
    if (id && (!product || !product.description)) {
      loadProduct();
    }
  }, [id]);

  const loadProduct = async () => {
    setLoading(true);
    const result = await getPublicProductByIdPublic(id);
    if (result.success && result.data) {
      setProduct(result.data);
    }
    setLoading(false);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Cek produk ini: ${product.title} - Rp ${Number(product.price).toLocaleString('id-ID')}`,
      });
    } catch (error) {
      console.log(error.message);
    }
  };

  const handleBuy = () => {
    const message = `Halo, saya tertarik dengan produk ${product.title} (Rp ${Number(product.price).toLocaleString('id-ID')}).`;
    const url = `https://wa.me/6282125910120?text=${encodeURIComponent(message)}`;
    Linking.openURL(url).catch(() => {});
  };
  const handleChat = () => {
    const message = `Halo Admin, saya ingin menanyakan tentang produk ${product.title}.`;
    const url = `https://wa.me/6282125910120?text=${encodeURIComponent(message)}`;
    Linking.openURL(url).catch(() => {});
  };

  const images = Array.isArray(product?.image_urls) && product.image_urls.length > 0
    ? product.image_urls
    : null;

  const handlePrevImage = () => {
    if (!images || images.length <= 1) return;
    const nextIndex = Math.max(0, activeImageIndex - 1);
    if (nextIndex !== activeImageIndex) {
      setActiveImageIndex(nextIndex);
      scrollRef.current?.scrollTo({ x: nextIndex * width, animated: true });
    }
  };

  const handleNextImage = () => {
    if (!images || images.length <= 1) return;
    const nextIndex = Math.min(images.length - 1, activeImageIndex + 1);
    if (nextIndex !== activeImageIndex) {
      setActiveImageIndex(nextIndex);
      scrollRef.current?.scrollTo({ x: nextIndex * width, animated: true });
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Memuat...</Text>
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.errorContainer}>
        <Text>Produk tidak ditemukan</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={{ color: Colors.primary, marginTop: 10 }}>Kembali</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollContainer}>
        {/* Header Navigation Overlay */}
        <View style={styles.headerOverlay}>
          <TouchableOpacity style={styles.circleButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.circleButton} onPress={handleShare}>
            <Ionicons name="share-social-outline" size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>

        {/* Image Carousel */}
        <View style={styles.imageContainer}>
          {images ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={(e) => {
                const slide = Math.round(
                  e.nativeEvent.contentOffset.x / e.nativeEvent.layoutMeasurement.width
                );
                if (slide !== activeImageIndex) setActiveImageIndex(slide);
              }}
              scrollEventThrottle={16}
              ref={scrollRef}
            >
              {images.map((img, index) => (
                <Image key={index} source={{ uri: img }} style={styles.productImage} resizeMode="cover" />
              ))}
            </ScrollView>
          ) : (
            <View style={[styles.productImage, styles.imagePlaceholder]}>
              <Ionicons name="image-outline" size={64} color={Colors.muted} />
            </View>
          )}

          {images && images.length > 1 && (
            <>
              <TouchableOpacity
                style={[styles.arrowButton, styles.arrowLeft]}
                onPress={handlePrevImage}
                disabled={activeImageIndex === 0}
              >
                <Ionicons
                  name="chevron-back"
                  size={24}
                  color={activeImageIndex === 0 ? Colors.muted : Colors.text}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.arrowButton, styles.arrowRight]}
                onPress={handleNextImage}
                disabled={activeImageIndex === images.length - 1}
              >
                <Ionicons
                  name="chevron-forward"
                  size={24}
                  color={activeImageIndex === images.length - 1 ? Colors.muted : Colors.text}
                />
              </TouchableOpacity>
            </>
          )}
          
          {/* Pagination Dots */}
          {images && images.length > 1 && (
            <View style={styles.pagination}>
              {images.map((_, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.paginationDot,
                    index === activeImageIndex ? styles.paginationDotActive : null,
                  ]}
                  activeOpacity={0.7}
                  onPress={() => {
                    setActiveImageIndex(index);
                    scrollRef.current?.scrollTo({ x: index * width, animated: true });
                  }}
                />
              ))}
            </View>
          )}
        </View>

        {/* Content */}
        <View style={styles.contentContainer}>
          <View style={styles.priceRow}>
            <Text style={styles.price}>Rp {Number(product.price).toLocaleString('id-ID')}</Text>
          </View>

          <Text style={styles.title}>{product.title}</Text>

          <View style={styles.ratingRow}>
            <View style={styles.ratingLeft}>
              <Ionicons name="star" size={16} color="#FFD700" />
              <Text style={styles.ratingText}>5.0</Text>
              <Text style={styles.reviewCount}>(0 ulasan)</Text>
            </View>
            <View style={styles.soldPill}>
              <Text style={styles.soldPillText}>Terjual 1000+</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Detail Produk</Text>
          <View style={styles.specRow}>
            <Text style={styles.specLabel}>Kategori</Text>
            <Text style={styles.specValue}>{product.category?.name || '-'}</Text>
          </View>
          <View style={styles.specRow}>
            <Text style={styles.specLabel}>Brand</Text>
            <Text style={styles.specValue}>{product.brand?.name || '-'}</Text>
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Deskripsi</Text>
          <View style={styles.descriptionBlock}>
            {Array.isArray(product.image_urls) && product.image_urls.length === 0 && !product.description ? (
              <Text style={styles.description}>Tidak ada deskripsi.</Text>
            ) : (
              (() => {
                let imageCount = 0;
                const maxImages = 5;
                return String(product.description || '')
                .split('\n')
                .filter((line) => line.trim().length > 0)
                .map((line, idxLine) => {
                  const tokens = line.split(',').map(t => t.trim()).filter(Boolean);
                  const hasMultipleUrls = tokens.length > 1 && tokens.every(t => /^https?:\/\/\S+/i.test(t));
                  return (
                    <View key={`desc-line-${idxLine}`} style={hasMultipleUrls ? styles.descLineNoSpace : styles.descLineSpaced}>
                      {tokens.map((tok, idxTok) => {
                        const isUrl = /^https?:\/\/\S+/i.test(tok);
                        if (isUrl) {
                          if (imageCount >= maxImages) return null;
                          imageCount += 1;
                          const ratio = descImageRatios[tok];
                          const baseStyle = hasMultipleUrls ? styles.descImageFull : styles.descImageSpaced;
                          const imgStyle = ratio ? [baseStyle, { aspectRatio: ratio }] : baseStyle;
                          return (
                            <Image
                              key={`desc-img-${idxLine}-${idxTok}`}
                              source={{ uri: tok }}
                              style={imgStyle}
                              resizeMode="cover"
                              onLoad={() => {
                                if (!descImageRatios[tok]) {
                                  Image.getSize(
                                    tok,
                                    (w, h) => {
                                      if (!w || !h) return;
                                      setDescImageRatios(prev => ({
                                        ...prev,
                                        [tok]: w / h,
                                      }));
                                    },
                                    () => {}
                                  );
                                }
                              }}
                            />
                          );
                        }
                        return (
                          <Text key={`desc-text-${idxLine}-${idxTok}`} style={styles.description}>
                            {tok}
                          </Text>
                        );
                      })}
                    </View>
                  );
                });
              })()
            )}
          </View>
        </View>
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.chatButton} onPress={handleChat}>
          <Ionicons name="chatbubble-ellipses-outline" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.buyButton} onPress={handleBuy}>
          <Text style={styles.buyButtonText}>Beli Sekarang</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContainer: {
    flex: 1,
  },
  headerOverlay: {
    position: 'absolute',
    top: 10,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  circleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  imageContainer: {
    width: width,
    height: width, // Square image
    position: 'relative',
    backgroundColor: '#f5f5f5',
  },
  productImage: {
    width: width,
    height: width,
  },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pagination: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  paginationDotActive: {
    backgroundColor: Colors.primary,
    width: 24,
  },
  arrowButton: {
    position: 'absolute',
    top: '50%',
    marginTop: -24,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  arrowLeft: {
    left: 12,
  },
  arrowRight: {
    right: 12,
  },
  contentContainer: {
    padding: 16,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  price: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.danger || '#e91e63',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    lineHeight: 24,
    marginBottom: 8,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  ratingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 4,
    color: Colors.text,
  },
  reviewCount: {
    fontSize: 14,
    color: Colors.muted,
    marginLeft: 4,
  },
  soldPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#f2f2f7',
  },
  soldPillText: {
    fontSize: 12,
    color: Colors.muted,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: Colors.text,
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  specLabel: {
    fontSize: 14,
    color: Colors.muted,
  },
  specValue: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500',
  },
  description: {
    fontSize: 14,
    lineHeight: 22,
    color: Colors.text,
  },
  descriptionBlock: {
    gap: 0,
  },
  descLineNoSpace: {
    marginVertical: 0,
  },
  descLineSpaced: {
    marginVertical: 8,
  },
  descImageFull: {
    width: '100%',
    marginVertical: 0,
  },
  descImageSpaced: {
    width: '100%',
    marginVertical: 8,
  },
  bottomBar: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: '#fff',
    paddingBottom: 24, // for safe area bottom
  },
  chatButton: {
    width: 48,
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  buyButton: {
    flex: 1,
    height: 48,
    backgroundColor: Colors.primary,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
