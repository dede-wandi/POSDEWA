import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radii, Shadows } from '../theme';
import { getSupabaseClient } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../utils/currency';

export default function AIAssistantScreen({ navigation }) {
  const { user } = useAuth();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: '1',
      type: 'bot',
      text: 'Halo! Saya asisten AI toko Anda. Tanyakan saya tentang penjualan, stok, atau performa toko.',
      timestamp: new Date()
    }
  ]);
  
  const flatListRef = useRef(null);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = {
      id: Date.now().toString(),
      type: 'user',
      text: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await processQuery(userMessage.text);
      
      const botMessage = {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        text: response.text,
        data: response.data, // Optional structured data
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('AI Error:', error);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        text: 'Maaf, terjadi kesalahan saat memproses permintaan Anda.',
        timestamp: new Date()
      }]);
    } finally {
      setLoading(false);
    }
  };

  const processQuery = async (query) => {
    if (!user || !user.id) {
      return { text: 'Anda belum login. Silakan login terlebih dahulu.' };
    }

    const lowerQuery = query.toLowerCase();
    const supabase = getSupabaseClient();
    
    // 0. Sapaan
    if (lowerQuery === 'hi' || lowerQuery === 'halo' || lowerQuery === 'hello' || lowerQuery === 'selamat pagi' || lowerQuery === 'selamat siang' || lowerQuery === 'selamat malam') {
      return {
        text: 'Halo! Ada yang bisa saya bantu terkait toko Anda hari ini? Coba tanyakan "Omset hari ini" atau "Stok barang".'
      };
    }

    // 1. Cek Omset/Penjualan Hari Ini
    if (lowerQuery.includes('omset') || (lowerQuery.includes('penjualan') && lowerQuery.includes('hari ini'))) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from('sales')
        .select('total, profit')
        .eq('user_id', user.id)
        .gte('created_at', todayStart.toISOString())
        .lt('created_at', todayEnd.toISOString());

      if (error) throw new Error(error.message);

      const totalOmset = data.reduce((sum, item) => sum + (item.total || 0), 0);
      const totalProfit = data.reduce((sum, item) => sum + (item.profit || 0), 0);
      const count = data.length;

      return {
        text: `📊 Laporan Hari Ini:\n\nTotal Transaksi: ${count}\nOmset: ${formatCurrency(totalOmset)}\nProfit: ${formatCurrency(totalProfit)}`
      };
    }

    // 2. Cek Stok Produk
    if (lowerQuery.includes('stok') || lowerQuery.includes('stock')) {
      // Extract product name if possible, simple approach: remove 'stok' word
      const keyword = lowerQuery.replace('stok', '').replace('stock', '').trim();
      
      let queryBuilder = supabase
        .from('products')
        .select('name, stock, price')
        .eq('owner_id', user.id) // Fix: use owner_id instead of user_id
        .order('stock', { ascending: true }) // Show low stock first by default
        .limit(10);

      if (keyword) {
        queryBuilder = queryBuilder.ilike('name', `%${keyword}%`);
      }

      const { data, error } = await queryBuilder;
      if (error) throw new Error(error.message);

      if (!data || data.length === 0) {
        return { text: `Tidak ditemukan produk dengan kata kunci "${keyword}".` };
      }

      const list = data.map(p => `- ${p.name}: ${p.stock} unit`).join('\n');
      return {
        text: keyword 
          ? `📦 Stok untuk "${keyword}":\n\n${list}`
          : `📦 10 Produk dengan stok terendah:\n\n${list}`
      };
    }

    // 3. Produk Terlaris
    if (lowerQuery.includes('laris') || lowerQuery.includes('top')) {
      // Fix: Query sales and then flatten sale_items because sale_items table might not have user_id/owner_id
      const { data, error } = await supabase
        .from('sales')
        .select('sale_items(product_name, qty)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100); // Analyze last 100 sales

      if (error) throw new Error(error.message);

      const summary = {};
      data.forEach(sale => {
        if (sale.sale_items) {
          sale.sale_items.forEach(item => {
            const name = item.product_name || 'Unknown';
            summary[name] = (summary[name] || 0) + (Number(item.qty) || 0);
          });
        }
      });

      const sorted = Object.entries(summary)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      if (sorted.length === 0) return { text: 'Belum ada data penjualan yang cukup.' };

      const list = sorted.map((item, idx) => `${idx + 1}. ${item[0]} (${item[1]} terjual)`).join('\n');
      return {
        text: `🏆 5 Produk Terlaris (dari 100 transaksi terakhir):\n\n${list}`
      };
    }

    // 4. Bantuan / Default
    return {
      text: 'Maaf, saya belum mengerti. Coba tanyakan:\n- "Omset hari ini"\n- "Stok [nama barang]"\n- "Produk terlaris"'
    };
  };

  const renderMessage = ({ item }) => {
    const isUser = item.type === 'user';
    return (
      <View style={[
        styles.messageContainer,
        isUser ? styles.userMessage : styles.botMessage
      ]}>
        <View style={[
          styles.messageBubble,
          isUser ? styles.userBubble : styles.botBubble
        ]}>
          {!isUser && (
            <View style={styles.botIcon}>
              <Ionicons name="sparkles" size={16} color="#fff" />
            </View>
          )}
          <Text style={[
            styles.messageText,
            isUser ? styles.userText : styles.botText
          ]}>{item.text}</Text>
        </View>
        <Text style={[
          styles.timestamp,
          isUser ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' }
        ]}>
          {item.timestamp.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>AI Assistant</Text>
          <Text style={styles.headerSubtitle}>Tanya seputar tokomu</Text>
        </View>
      </View>

      {/* Chat Area */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.chatContent}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      {/* Input Area */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
      >
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Ketik permintaan Anda..."
            placeholderTextColor={Colors.muted}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={200}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!input.trim() || loading) && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={!input.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
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
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    marginRight: Spacing.md,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.muted,
  },
  chatContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  messageContainer: {
    marginBottom: Spacing.lg,
    maxWidth: '85%',
  },
  userMessage: {
    alignSelf: 'flex-end',
  },
  botMessage: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    padding: Spacing.md,
    borderRadius: Radii.lg,
    minWidth: 100,
  },
  userBubble: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 2,
  },
  botBubble: {
    backgroundColor: Colors.card,
    borderBottomLeftRadius: 2,
    ...Shadows.card,
  },
  botIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  userText: {
    color: '#fff',
  },
  botText: {
    color: Colors.text,
  },
  timestamp: {
    fontSize: 10,
    color: Colors.muted,
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: Spacing.md,
    backgroundColor: Colors.card,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: Radii.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 16,
    maxHeight: 100,
    minHeight: 40,
    color: Colors.text,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.sm,
  },
  sendButtonDisabled: {
    backgroundColor: Colors.muted,
  },
});
