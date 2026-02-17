import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radii, Shadows } from '../theme';
import { getSupabaseClient } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../utils/currency';
import { getAIConfig, setAIConfig, chatCompletion, AVAILABLE_MODELS } from '../services/aiClient';
import { logAIInteraction, addAIMemory } from '../services/aiSupabase';

export default function AIAssistantScreen({ navigation }) {
  const { user, getBusinessName } = useAuth();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [modelInput, setModelInput] = useState('');
  const [lastIntent, setLastIntent] = useState(null);
  const [messages, setMessages] = useState([
    {
      id: '1',
      type: 'bot',
      text: 'Halo! Saya asisten AI toko Anda. Tanyakan saya tentang penjualan, stok, atau performa toko.',
      timestamp: new Date()
    }
  ]);
  
  const flatListRef = useRef(null);

  useEffect(() => {
    (async () => {
      const cfg = await getAIConfig();
      setApiKeyInput(cfg.apiKey || '');
      setModelInput(cfg.model || '');
    })();
  }, []);

  const saveSettings = async () => {
    await setAIConfig({ apiKey: apiKeyInput.trim(), model: modelInput.trim() || AVAILABLE_MODELS[0] });
    setShowSettings(false);
  };

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
    const cfg = await getAIConfig();
    if (!cfg.apiKey) {
      return { text: 'Setel API Key AI terlebih dahulu di Pengaturan (ikon roda gigi).' };
    }
    
    if (lowerQuery.startsWith('ingat:') || lowerQuery.startsWith('tambah memori:')) {
      const raw = query.split(':').slice(1).join(':').trim();
      if (!raw) {
        return { text: 'Format menambah memori: ingat: [judul] - [konten]' };
      }
      let title = '';
      let content = '';
      if (raw.includes(' - ')) {
        const parts = raw.split(' - ');
        title = String(parts.shift() || '').trim();
        content = String(parts.join(' - ') || '').trim();
      } else {
        title = raw.slice(0, 40).trim();
        content = raw;
      }
      const res = await addAIMemory({ userId: user.id, title, content, tags: null });
      if (res.success) {
        await logAIInteraction({ userId: user.id, query, response: 'Memori disimpan', intent: 'memory:add', context: '', model: cfg.model, status: 'answered' });
        return { text: `Memori disimpan: ${title}` };
      }
      await logAIInteraction({ userId: user.id, query, response: res.error || 'Gagal menyimpan memori', intent: 'memory:add', context: '', model: cfg.model, status: 'error' });
      return { text: 'Gagal menyimpan memori.' };
    }
    
    // Follow-up handler: if user continues without "stok/stock", reuse last stock intent
    const numberMatch = lowerQuery.match(/\b(\d{1,3})\b/);
    const requestedLimit = numberMatch ? Math.min(Math.max(parseInt(numberMatch[1], 10), 1), 100) : null;
    const followupKeywords = ['lanjut', 'lanjutkan', 'lanjutin', 'tambah', 'tambahkan', 'sampe', 'sampai', 'lebih', 'perbanyak', 'kasih', 'kasihin', 'lagi', 'ada lagi', 'masih'];
    const containsFollowupWord = followupKeywords.some(w => lowerQuery.includes(w));
    if (!lowerQuery.includes('stok') && !lowerQuery.includes('stock')) {
      if (lastIntent && (lastIntent.kind === 'stockList' || lastIntent.kind === 'stockSearch') && (containsFollowupWord || requestedLimit)) {
        const keyword = lastIntent.keyword || '';
        const limit = requestedLimit || Math.min((lastIntent.limit || 10) + 10, 100);
        let queryBuilder = supabase
          .from('products')
          .select('name, stock')
          .eq('owner_id', user.id)
          .order('stock', { ascending: true })
          .limit(limit);
        if (keyword) {
          queryBuilder = queryBuilder.ilike('name', `%${keyword}%`);
        }
        const { data, error } = await queryBuilder;
        if (error) {
          return { text: 'Gagal memuat data stok.' };
        }
        setLastIntent({ kind: lastIntent.kind, keyword, limit });
        if (data && data.length > 0) {
          return {
            text: `📦 ${keyword ? `Stok untuk "${keyword}"` : 'Daftar stok paling sedikit'} (max ${limit}):\n\n${data.map(p => `- ${p.name}: ${p.stock} unit`).join('\n')}`
          };
        }
        return { text: 'Tidak ada data tambahan yang ditemukan.' };
      } else if (lastIntent && lastIntent.kind === 'todayTxList' && (containsFollowupWord || requestedLimit)) {
        const limit = requestedLimit ? Math.min(requestedLimit, 100) : Math.min((lastIntent.limit || 10) + 10, 100);
        const todayStart = new Date(); todayStart.setHours(0,0,0,0);
        const todayEnd = new Date(); todayEnd.setHours(23,59,59,999);
        const { data, error } = await supabase
          .from('sales')
          .select('id, created_at, total, profit, no_invoice, sale_items(product_name, qty, price)')
          .eq('user_id', user.id)
          .gte('created_at', todayStart.toISOString())
          .lt('created_at', todayEnd.toISOString())
          .order('created_at', { ascending: false })
          .limit(limit);
        if (error) {
          return { text: 'Gagal memuat transaksi.' };
        }
        setLastIntent({ kind: 'todayTxList', limit });
        if (data && data.length) {
          const lines = data.map(s => {
            const ts = new Date(s.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
            const inv = s.no_invoice || `#${String(s.id).slice(0,8)}`;
            return `${inv} • ${ts} • ${formatCurrency(s.total)} • Profit ${formatCurrency(s.profit)}`;
          }).join('\n');
          return { text: `🧾 Transaksi hari ini (max ${limit}):\n\n${lines}` };
        }
        return { text: 'Hari ini belum ada transaksi.' };
      } else if (lastIntent && lastIntent.kind === 'unsoldList' && (containsFollowupWord || requestedLimit)) {
        const limit = requestedLimit ? Math.min(requestedLimit, 100) : Math.min((lastIntent.limit || 10) + 10, 100);
        const { data: products, error: pErr } = await supabase
          .from('products')
          .select('name, stock, barcode')
          .eq('owner_id', user.id);
        if (pErr) {
          return { text: 'Gagal memuat data produk.' };
        }
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        const { data: sales, error: sErr } = await supabase
          .from('sales')
          .select('created_at, sale_items(product_name, barcode)')
          .eq('user_id', user.id)
          .gte('created_at', oneYearAgo.toISOString())
          .order('created_at', { ascending: false })
          .limit(5000);
        if (sErr) {
          return { text: 'Gagal memuat data penjualan.' };
        }
        const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/gi, '');
        const soldNames = new Set();
        const soldBarcodes = new Set();
        (sales || []).forEach(sale => {
          (sale.sale_items || []).forEach(item => {
            const n = norm(item.product_name);
            const b = String(item.barcode || '').trim();
            if (n) soldNames.add(n);
            if (b) soldBarcodes.add(b);
          });
        });
        const unsold = (products || []).filter(p => {
          const b = String(p.barcode || '').trim();
          const n = norm(p.name);
          const soldByBarcode = b && soldBarcodes.has(b);
          const soldByName = n && soldNames.has(n);
          return !(soldByBarcode || soldByName);
        });
        unsold.sort((a, b) => (Number(b.stock || 0) - Number(a.stock || 0)));
        const list = unsold.slice(0, limit);
        setLastIntent({ kind: 'unsoldList', limit });
        if (list.length > 0) {
          return {
            text: `📉 Produk yang belum terjual (max ${limit}):\n\n${list.map(p => `- ${p.name}: ${p.stock} unit`).join('\n')}`
          };
        }
        return { text: 'Semua produk pernah terjual dalam periode 1 tahun terakhir.' };
      } else if (lastIntent && lastIntent.kind === 'topList' && (containsFollowupWord || requestedLimit)) {
        const limit = requestedLimit ? Math.min(requestedLimit, 50) : Math.min((lastIntent.limit || 5) + 5, 50);
        const { data, error } = await supabase
          .from('sales')
          .select('sale_items(product_name, qty)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(100);
        if (error) {
          return { text: 'Gagal memuat data penjualan.' };
        }
        const summary = {};
        (data || []).forEach(sale => {
          (sale.sale_items || []).forEach(item => {
            const name = item.product_name || 'Unknown';
            summary[name] = (summary[name] || 0) + (Number(item.qty) || 0);
          });
        });
        const sorted = Object.entries(summary).sort((a, b) => b[1] - a[1]).slice(0, limit);
        const list = sorted.map((it, idx) => `${idx + 1}. ${it[0]} terjual ${it[1]}`).join('\n');
        setLastIntent({ kind: 'topList', limit });
        if (list) {
          return { text: `🏆 ${limit} Produk Paling Laku (dari 100 transaksi terakhir):\n\n${list}` };
        }
        return { text: 'Belum ada data penjualan yang cukup.' };
      }
    }
    
    let contextParts = [];
    const logAndReturn = async (text, intent, status = 'answered') => {
      const ctx = contextParts.join('\n');
      await logAIInteraction({ userId: user.id, query, response: text, intent, context: ctx, model: cfg.model, status });
      return { text };
    };
    if (lowerQuery === 'hi' || lowerQuery === 'halo' || lowerQuery === 'hello' || lowerQuery.includes('selamat pagi') || lowerQuery.includes('selamat siang') || lowerQuery.includes('selamat malam')) {
      contextParts.push('Salam: Pengguna menyapa.');
    }
    try {
      const { data: udata } = await supabase.auth.getUser();
      const fullName = udata?.user?.user_metadata?.full_name || udata?.user?.user_metadata?.name || '';
      const business = typeof getBusinessName === 'function' ? getBusinessName() : '';
      const identityLine = `Pengguna: ${fullName || business || user.email} • Email: ${user.email} • Toko: ${business || '-'}`;
      contextParts.push(identityLine);
    } catch (_) {}
    
    try {
      const stop = new Set(['apa','yang','itu','ini','minta','tolong','dong','nih','sih','deh','dan','atau','pada','untuk','hari','ini','saya','kamu','saya']);
      const tokens = lowerQuery.split(/\s+/).filter(w => w && w.length >= 4 && !stop.has(w));
      const key = tokens[0] || '';
      if (key) {
        const { data: mem } = await supabase
          .from('ai_memory')
          .select('title, content')
          .eq('user_id', user.id)
          .or(`title.ilike.%${key}%,content.ilike.%${key}%`)
          .order('created_at', { ascending: false })
          .limit(3);
        if (mem && mem.length) {
          const memoText = mem.map(m => `- ${m.title}: ${m.content}`).join('\n');
          contextParts.push(`Memori:\n${memoText}`);
        }
      }
    } catch (_) {}

    // Quick intent: “siapa saya”, “data saya”, “profil”
    if (lowerQuery.includes('siapa saya') || lowerQuery.includes('data saya') || lowerQuery.includes('profil') || lowerQuery.includes('nama saya') || lowerQuery.includes('toko saya')) {
      try {
        const { data: udata } = await supabase.auth.getUser();
        const fullName = udata?.user?.user_metadata?.full_name || udata?.user?.user_metadata?.name || '';
        const business = typeof getBusinessName === 'function' ? getBusinessName() : '';
        // products count
        const { count: prodCount } = await supabase
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('owner_id', user.id);
        // today sales summary
        const todayStart = new Date(); todayStart.setHours(0,0,0,0);
        const todayEnd = new Date(); todayEnd.setHours(23,59,59,999);
        const { data: todaySales } = await supabase
          .from('sales')
          .select('total, profit, created_at')
          .eq('user_id', user.id)
          .gte('created_at', todayStart.toISOString())
          .lt('created_at', todayEnd.toISOString());
        const totalOmset = (todaySales || []).reduce((s, it) => s + (it.total || 0), 0);
        const totalProfit = (todaySales || []).reduce((s, it) => s + (it.profit || 0), 0);
        const countTrans = todaySales?.length || 0;
        // last transaction
        const { data: lastTx } = await supabase
          .from('sales')
          .select('created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1);
        const lastTxStr = lastTx && lastTx[0]?.created_at
          ? new Date(lastTx[0].created_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
          : '-';
        return await logAndReturn(
          `👤 Profil Singkat\nNama: ${fullName || '-'}\nEmail: ${user.email}\nToko: ${business || '-'}\n\n📦 Produk: ${prodCount || 0}\n🧾 Transaksi hari ini: ${countTrans}\n💰 Omset hari ini: ${formatCurrency(totalOmset)}\n📈 Profit hari ini: ${formatCurrency(totalProfit)}\n🕒 Transaksi terakhir: ${lastTxStr}`,
          'profile:summary'
        );
      } catch (e) {
        // fallback minimal
        return await logAndReturn(`👤 Profil Singkat\nEmail: ${user.email}`, 'profile:summary');
      }
    }
    try {
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
        const totalOmset = (data || []).reduce((sum, item) => sum + (item.total || 0), 0);
        const totalProfit = (data || []).reduce((sum, item) => sum + (item.profit || 0), 0);
        const count = data?.length || 0;
        contextParts.push(`Ringkasan Hari Ini: transaksi=${count}, omset=${totalOmset}, profit=${totalProfit}`);
      }
      if (lowerQuery.includes('transaksi') && lowerQuery.includes('hari ini')) {
        const limitMatch = lowerQuery.match(/\b(\d{1,3})\b/);
        const desiredLimit = limitMatch ? Math.min(Math.max(parseInt(limitMatch[1], 10), 1), 100) : 10;
        const todayStart = new Date(); todayStart.setHours(0,0,0,0);
        const todayEnd = new Date(); todayEnd.setHours(23,59,59,999);
        const { data, error } = await supabase
          .from('sales')
          .select('id, created_at, total, profit, no_invoice, sale_items(product_name, qty, price)')
          .eq('user_id', user.id)
          .gte('created_at', todayStart.toISOString())
          .lt('created_at', todayEnd.toISOString())
          .order('created_at', { ascending: false })
          .limit(desiredLimit);
        if (!error && data && data.length) {
          const lines = data.map(s => {
            const ts = new Date(s.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
            const inv = s.no_invoice || `#${String(s.id).slice(0,8)}`;
            return `${inv} • ${ts} • ${formatCurrency(s.total)} • Profit ${formatCurrency(s.profit)}`;
          }).join('\n');
          setLastIntent({ kind: 'todayTxList', limit: desiredLimit });
          return await logAndReturn(`🧾 Transaksi hari ini (max ${desiredLimit}):\n\n${lines}`, 'sales:today:list');
        }
      }
      if (lowerQuery.includes('stok') || lowerQuery.includes('stock')) {
        const raw = lowerQuery.replace(/stok|stock/gi, ' ').replace(/[^\p{L}\p{N}\s]/gu, ' ').trim();
        const stop = new Set(['paling','sedikit','terendah','terkecil','apa','saja','yang','berapa','mohon','tolong','daftar','list','min','minimum','cek','informasi','info','itu','ini','aja','ya','saat','sekarang','hari','kondisi','nih','dong','sih','lah','deh','bang','mas','mbak','kak','ada']);
        const tokens = raw.split(/\s+/).filter(t => t && t.length >= 2 && !stop.has(t));
        const keyword = tokens.join(' ').trim();
        const limitMatch = lowerQuery.match(/\b(\d{1,3})\b/);
        const desiredLimit = limitMatch ? Math.min(Math.max(parseInt(limitMatch[1], 10), 1), 100) : 10;
        let query = supabase
          .from('products')
          .select('name, stock')
          .eq('owner_id', user.id)
          .order('stock', { ascending: true })
          .limit(desiredLimit);
        if (keyword) {
          query = query.ilike('name', `%${keyword}%`);
        }
        const { data, error } = await query;
        if (error) throw new Error(error.message);
        if (data && data.length > 0) {
          setLastIntent({ kind: keyword ? 'stockSearch' : 'stockList', keyword, limit: desiredLimit });
          if (!keyword) {
            return await logAndReturn(`📦 ${desiredLimit} produk dengan stok paling sedikit:\n\n${data.map(p => `- ${p.name}: ${p.stock} unit`).join('\n')}`, 'stock:list');
          }
          return await logAndReturn(`📦 Stok untuk "${keyword}" (max ${desiredLimit}):\n\n${data.map(p => `- ${p.name}: ${p.stock} unit`).join('\n')}`, 'stock:search');
        }
        return await logAndReturn(keyword ? `Tidak ditemukan produk dengan kata "${keyword}".` : 'Tidak ada data stok.', 'stock:none', 'unknown');
      }
      if (lowerQuery.includes('harga') || lowerQuery.includes('modal') || lowerQuery.includes('profit') || lowerQuery.includes('untung')) {
        const cleaned = lowerQuery.replace(/(berapa|harga|modal|profit|untung|stok|stock|produk|yang|itu|ini)/g, ' ').replace(/\s+/g, ' ').trim();
        if (cleaned && cleaned.length >= 2) {
          const { data, error } = await supabase
            .from('products')
            .select('name, price, cost_price, stock')
            .eq('owner_id', user.id)
            .ilike('name', `%${cleaned}%`)
            .limit(10);
          if (!error) {
            const list = (data || []).map(p => {
              const margin = (Number(p.price || 0) - Number(p.cost_price || 0));
              return `${p.name} | jual=${p.price} | modal=${p.cost_price} | stok=${p.stock} | margin=${margin}`;
            }).join('\n');
            if (list) contextParts.push(`Data Produk terkait "${cleaned}":\n${list}`);
          }
        }
      }
      if (lowerQuery.includes('belum terjual') || lowerQuery.includes('belum laku') || lowerQuery.includes('tidak terjual') || lowerQuery.includes('tidak laku') || lowerQuery.includes('blm terjual')) {
        const limitMatch = lowerQuery.match(/\b(\d{1,3})\b/);
        const desiredLimit = limitMatch ? Math.min(Math.max(parseInt(limitMatch[1], 10), 1), 100) : 10;
        const { data: products, error: pErr } = await supabase
          .from('products')
          .select('name, stock, barcode')
          .eq('owner_id', user.id);
        if (pErr) throw new Error(pErr.message);
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        const { data: sales, error: sErr } = await supabase
          .from('sales')
          .select('created_at, sale_items(product_name, barcode)')
          .eq('user_id', user.id)
          .gte('created_at', oneYearAgo.toISOString())
          .order('created_at', { ascending: false })
          .limit(5000);
        if (sErr) throw new Error(sErr.message);
        const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/gi, '');
        const soldNames = new Set();
        const soldBarcodes = new Set();
        (sales || []).forEach(sale => {
          (sale.sale_items || []).forEach(item => {
            const n = norm(item.product_name);
            const b = String(item.barcode || '').trim();
            if (n) soldNames.add(n);
            if (b) soldBarcodes.add(b);
          });
        });
        const unsold = (products || []).filter(p => {
          const b = String(p.barcode || '').trim();
          const n = norm(p.name);
          const soldByBarcode = b && soldBarcodes.has(b);
          const soldByName = n && soldNames.has(n);
          return !(soldByBarcode || soldByName);
        });
        unsold.sort((a, b) => (Number(b.stock || 0) - Number(a.stock || 0)));
        const list = unsold.slice(0, desiredLimit);
        if (list.length > 0) {
          setLastIntent({ kind: 'unsoldList', limit: desiredLimit });
          return await logAndReturn(`📉 Produk yang belum terjual (max ${desiredLimit}):\n\n${list.map(p => `- ${p.name}: ${p.stock} unit`).join('\n')}`, 'unsold:list');
        }
        return await logAndReturn('Semua produk pernah terjual dalam periode 1 tahun terakhir.', 'unsold:none', 'answered');
      }
      if (lowerQuery.includes('laris') || lowerQuery.includes('top') || lowerQuery.includes('laku') || lowerQuery.includes('terlaris')) {
        const { data, error } = await supabase
          .from('sales')
          .select('sale_items(product_name, qty)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(100);
        if (!error) {
          const summary = {};
          (data || []).forEach(sale => {
            if (sale.sale_items) {
              sale.sale_items.forEach(item => {
                const name = item.product_name || 'Unknown';
                summary[name] = (summary[name] || 0) + (Number(item.qty) || 0);
              });
            }
          });
          const limitMatch = lowerQuery.match(/\b(\d{1,2})\b/);
          const desiredLimit = limitMatch ? Math.min(Math.max(parseInt(limitMatch[1], 10), 1), 50) : 5;
          const sorted = Object.entries(summary).sort((a, b) => b[1] - a[1]).slice(0, desiredLimit);
          const list = sorted.map((it, idx) => `${idx + 1}. ${it[0]} terjual ${it[1]}`).join('\n');
          if (list) contextParts.push(`Top ${desiredLimit} Produk Terlaris:\n${list}`);
          if (list) {
            setLastIntent({ kind: 'topList', limit: desiredLimit });
            return await logAndReturn(`🏆 ${desiredLimit} Produk Paling Laku (dari 100 transaksi terakhir):\n\n${list}`, 'top:list');
          }
        }
      }
    } catch (e) {}

    const systemPrompt = [
      'Anda adalah asisten AI untuk pemilik toko.',
      'Jawab hanya seputar produk, stok, harga modal, harga jual, penjualan, dan profit.',
      'Gunakan data pada KONTEKS untuk menghitung dan menjawab.',
      'Jangan membahas sistem, kode, database schema, kredensial, atau celah keamanan.',
      'Jika data tidak ada di KONTEKS, katakan tidak ada datanya.',
      'Jawab singkat, jelas, dalam bahasa Indonesia.'
    ].join(' ');

    const contextBlock = contextParts.length ? `KONTEKS:\n${contextParts.join('\n')}\n` : 'KONTEKS:\n(tidak ada data tambahan)\n';
    try {
      const { content } = await chatCompletion({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `${contextBlock}\nPERTANYAAN:\n${query}` }
        ],
        model: cfg.model,
        temperature: 0.3,
        max_tokens: 400
      });
      return await logAndReturn(content?.trim() || 'Tidak ada jawaban.', 'ai:chat');
    } catch (e) {
      try {
        if (lowerQuery.includes('omset') || (lowerQuery.includes('penjualan') && lowerQuery.includes('hari ini'))) {
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          const todayEnd = new Date();
          todayEnd.setHours(23, 59, 59, 999);
          const { data } = await supabase
            .from('sales')
            .select('total, profit')
            .eq('user_id', user.id)
            .gte('created_at', todayStart.toISOString())
            .lt('created_at', todayEnd.toISOString());
          const totalOmset = (data || []).reduce((sum, item) => sum + (item.total || 0), 0);
          const totalProfit = (data || []).reduce((sum, item) => sum + (item.profit || 0), 0);
          const count = data?.length || 0;
          return await logAndReturn(`📊 Laporan Hari Ini:\n\nTotal Transaksi: ${count}\nOmset: ${formatCurrency(totalOmset)}\nProfit: ${formatCurrency(totalProfit)}`, 'sales:today');
        }
      } catch (_) {}
      return await logAndReturn('Maaf, terjadi kesalahan saat memproses permintaan Anda.', 'error', 'error');
    }
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
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>AI Assistant</Text>
          <Text style={styles.headerSubtitle}>Tanya seputar tokomu</Text>
        </View>
        <TouchableOpacity onPress={() => setShowSettings(s => !s)} style={styles.settingsButton}>
          <Ionicons name="settings-outline" size={20} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {showSettings && (
        <View style={styles.settingsPanel}>
          <Text style={styles.settingsTitle}>Pengaturan AI</Text>
          <TextInput
            style={styles.settingsInput}
            placeholder="API Key"
            placeholderTextColor={Colors.muted}
            value={apiKeyInput}
            onChangeText={setApiKeyInput}
            secureTextEntry
          />
          <View style={styles.modelRow}>
            <TextInput
              style={[styles.settingsInput, { flex: 1 }]}
              placeholder="Model"
              placeholderTextColor={Colors.muted}
              value={modelInput}
              onChangeText={setModelInput}
            />
          </View>
          <View style={styles.modelChips}>
            {AVAILABLE_MODELS.map(m => (
              <TouchableOpacity key={m} style={[styles.modelChip, modelInput === m && styles.modelChipActive]} onPress={() => setModelInput(m)}>
                <Text style={[styles.modelChipText, modelInput === m && styles.modelChipTextActive]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity onPress={saveSettings} style={styles.saveButton}>
            <Text style={styles.saveButtonText}>Simpan</Text>
          </TouchableOpacity>
        </View>
      )}

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
  settingsButton: {
    padding: Spacing.sm,
    marginLeft: Spacing.md
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
  settingsPanel: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    backgroundColor: Colors.card,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border
  },
  settingsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm
  },
  settingsInput: {
    backgroundColor: Colors.background,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: Colors.text,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border
  },
  modelRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  modelChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginVertical: Spacing.xs
  },
  modelChip: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginRight: 8,
    marginTop: 6
  },
  modelChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary
  },
  modelChipText: {
    color: Colors.text,
    fontSize: 12
  },
  modelChipTextActive: {
    color: '#fff'
  },
  saveButton: {
    marginTop: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: Radii.md,
    alignItems: 'center',
    paddingVertical: Spacing.sm
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '700'
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
