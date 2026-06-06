
import { getSupabaseClient } from './supabase';
import { getWaConfig } from './waNotifSupabase';

export const sendWhatsAppNotification = async (saleData, items) => {
  console.log('🚀 Starting WhatsApp notification service...');

  try {
    // 1. Get Target Numbers from Database
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    let target = '6282125910120'; // Default fallback
    
    if (user && user.user_metadata) {
      const targets = [];
      if (user.user_metadata.wa_target_1) targets.push(user.user_metadata.wa_target_1);
      if (user.user_metadata.wa_target_2) targets.push(user.user_metadata.wa_target_2);
      if (user.user_metadata.wa_target_3) targets.push(user.user_metadata.wa_target_3);
      
      if (targets.length > 0) {
        target = targets.join(',');
      }
    }

    console.log('🎯 Notification Targets:', target);
    
    // 1.1 Get Provider Config
    let waConfig = null;
    try {
      waConfig = await getWaConfig({ ownerId: user?.id });
    } catch (e) {
      console.warn('⚠️ WA config not found or error loading:', e);
    }

    const provider = waConfig?.provider || 'fonnte';

    // 2. Validate Input
    if (!saleData || !items) {
      console.error('❌ WhatsApp Service: Missing saleData or items');
      return { status: false, message: 'Data transaksi atau item kosong' };
    }
    
    if (provider === 'wapanels') {
      if (!waConfig?.appkey || !waConfig?.authkey) {
        console.warn('⚠️ Wapanels appkey or authkey not set. Skip sending notification.');
        return { status: false, message: 'Konfigurasi Wapanels belum lengkap (App Key / Auth Key kosong)' };
      }
    } else {
      if (!waConfig?.token) {
        console.warn('⚠️ Fonnte token not set. Skip sending notification.');
        return { status: false, message: 'Token Fonnte belum dikonfigurasi' };
      }
    }

    // 2.5 Fetch Daily & Monthly Stats
    let dailyTrxCount = 0;
    let dailyProfitTotal = 0;
    let monthlyProfitTotal = 0;

    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      if (user) {
        const { data: monthSales, error: dbError } = await supabase
          .from('sales')
          .select('created_at, profit, sale_items(line_profit, price, cost_price, qty)')
          .eq('user_id', user.id)
          .gte('created_at', monthStart.toISOString())
          .lt('created_at', todayEnd.toISOString());

        if (!dbError && monthSales) {
          monthSales.forEach((sale) => {
            let saleProfit = 0;
            if (sale.sale_items && sale.sale_items.length > 0) {
              saleProfit = sale.sale_items.reduce((s, i) => {
                const p = i.line_profit !== undefined && i.line_profit !== null 
                  ? i.line_profit 
                  : ((i.price || 0) - (i.cost_price || 0)) * (i.qty || 0);
                return s + p;
              }, 0);
            } else {
              saleProfit = sale.profit || 0;
            }

            monthlyProfitTotal += saleProfit;

            const saleDate = new Date(sale.created_at);
            if (saleDate >= todayStart && saleDate <= todayEnd) {
              dailyTrxCount++;
              dailyProfitTotal += saleProfit;
            }
          });
        }
      }
    } catch (err) {
      console.error('⚠️ Failed to fetch stats for WhatsApp:', err);
    }

    // 3. Construct Message
    const businessName = user?.user_metadata?.business_name || user?.user_metadata?.full_name || 'POSDEWA';
    let message = `*🔔 ${businessName.toUpperCase()} - PENJUALAN BARU*\n\n`;
    
    // Format date safely
    const dateStr = new Date().toLocaleString('id-ID', { 
      year: 'numeric', month: 'long', day: 'numeric', 
      hour: '2-digit', minute: '2-digit' 
    });
    message += `📅 ${dateStr}\n`;
    
    // Format currency safely
    const totalStr = Number(saleData.total || 0).toLocaleString('id-ID');
    message += `💰 Total: Rp ${totalStr}\n`;
    
    const method = saleData.payment_method === 'cash' ? 'Tunai' : 'Transfer';
    message += `💳 Metode: ${method}\n`;
    
    message += `\n*📝 Detail Item:*\n`;

    const itemsArray = Array.isArray(items) ? items : [];
    itemsArray.forEach((item, index) => {
      const name = item.product_name || item.name || 'Produk';
      const qty = Number(item.qty || 0);
      const price = Number(item.price || 0);
      const subtotal = price * qty;
      const itemProfit = item.line_profit !== undefined 
        ? item.line_profit 
        : ((price - (item.cost_price || item.costPrice || 0)) * qty);
      
      message += `${index + 1}. ${name} (${qty}x)\n`;
      message += `   Rp ${subtotal.toLocaleString('id-ID')} (Profit: Rp ${itemProfit.toLocaleString('id-ID')})\n`;
    });

    // Add Daily & Monthly Stats
    message += `\n------------------\n`;
    message += `📊 *Statistik Hari Ini*\n`;
    message += `🛒 Total Transaksi: ${dailyTrxCount} trx\n`;
    message += `💰 Total Profit: Rp ${dailyProfitTotal.toLocaleString('id-ID')}\n`;
    message += `📈 Profit Bulan Ini: Rp ${monthlyProfitTotal.toLocaleString('id-ID')}\n`;
    
    // Get sender name (business name or user name)
    let senderName = 'POSDEWA';
    if (user && user.user_metadata) {
      const meta = user.user_metadata;
      senderName = meta.business_name || meta.full_name || 'POSDEWA';
    } else if (user && user.email) {
       const emailName = user.email.split('@')[0];
       senderName = emailName.charAt(0).toUpperCase() + emailName.slice(1);
    }
    
    message += `\n_Dikirim otomatis dari ${senderName}_`;

    const sanitizePhoneNumber = (num) => {
      let cleaned = num.replace(/[^0-9]/g, '');
      if (cleaned.startsWith('0')) {
        cleaned = '62' + cleaned.slice(1);
      } else if (cleaned.startsWith('8')) {
        cleaned = '62' + cleaned;
      }
      return cleaned;
    };

    if (provider === 'wapanels') {
      const appkey = waConfig.appkey;
      const authkey = waConfig.authkey;
      const targetNumbers = target.split(',').map(num => num.trim()).filter(Boolean).map(sanitizePhoneNumber);
      
      console.log('📤 Sending to Wapanels...', { targetNumbers, messageLength: message.length });
      
      const results = [];
      for (const num of targetNumbers) {
        console.log(`📤 Sending to Wapanels receiver: ${num}`);
        const formData = new FormData();
        formData.append('appkey', appkey);
        formData.append('authkey', authkey);
        formData.append('to', num);
        formData.append('message', message);

        try {
          const response = await fetch('https://app.wapanels.com/api/create-message', {
            method: 'POST',
            body: formData,
            redirect: 'follow'
          });

          console.log(`📡 Response status for ${num}:`, response.status);
          const textResult = await response.text();
          console.log(`📦 Raw response for ${num}:`, textResult);

          try {
            const jsonResult = JSON.parse(textResult);
            results.push(jsonResult);
          } catch (e) {
            results.push({ success: false, raw: textResult });
          }
        } catch (err) {
          console.error(`❌ Fetch error sending to Wapanels receiver ${num}:`, err);
          results.push({ success: false, error: err.message });
        }
      }
      return results[0];
    } else {
      // 4. Prepare FormData for Fonnte
      const url = 'https://api.fonnte.com/send';
      const token = waConfig.token;
      const targetNumbers = target.split(',').map(num => num.trim()).filter(Boolean).map(sanitizePhoneNumber);
      const sanitizedTarget = targetNumbers.join(',');
      
      console.log('📤 Sending to Fonnte...', { target: sanitizedTarget, messageLength: message.length });
      
      const formData = new FormData();
      formData.append('target', sanitizedTarget);
      formData.append('message', message);
      formData.append('delay', '5-10');

      // 5. Send Request
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': token,
        },
        body: formData,
        redirect: 'follow'
      });

      console.log('📡 Response status:', response.status);
      
      // 6. Handle Response
      const textResult = await response.text();
      console.log('📦 Raw response:', textResult);

      try {
        const jsonResult = JSON.parse(textResult);
        if (jsonResult.status) {
          console.log('✅ WhatsApp sent successfully!');
        } else {
          console.warn('⚠️ WhatsApp API returned error:', jsonResult);
        }
        return jsonResult;
      } catch (e) {
        console.warn('⚠️ Could not parse response as JSON');
        return { success: false, raw: textResult };
      }
    }

  } catch (error) {
    console.error('❌ Error inside sendWhatsAppNotification:', error);
    return null;
  }
};
