
import { getSupabaseClient } from './supabase';

export const sendWhatsAppNotification = async (saleData, items) => {
  const token = 'zXq9ZwXzDF4SpQCcWum2';
  const url = 'https://api.fonnte.com/send';

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

    // 2. Validate Input
    if (!saleData || !items) {
      console.error('❌ WhatsApp Service: Missing saleData or items');
      return;
    }

    // 2.5 Fetch Daily Stats
    let dailyTrxCount = 0;
    let dailyProfitTotal = 0;

    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      if (user) {
        const { data: dailySales, error: dailyError } = await supabase
          .from('sales')
          .select('profit, sale_items(line_profit, price, cost_price, qty)')
          .eq('user_id', user.id)
          .gte('created_at', todayStart.toISOString())
          .lt('created_at', todayEnd.toISOString());

        if (!dailyError && dailySales) {
          dailyTrxCount = dailySales.length;
          
          dailyProfitTotal = dailySales.reduce((sum, sale) => {
            // Try to use item level profit if available for accuracy
            if (sale.sale_items && sale.sale_items.length > 0) {
              const saleProfit = sale.sale_items.reduce((s, i) => {
                const p = i.line_profit !== undefined && i.line_profit !== null 
                  ? i.line_profit 
                  : ((i.price || 0) - (i.cost_price || 0)) * (i.qty || 0);
                return s + p;
              }, 0);
              return sum + saleProfit;
            }
            return sum + (sale.profit || 0);
          }, 0);
        }
      }
    } catch (err) {
      console.error('⚠️ Failed to fetch daily stats for WhatsApp:', err);
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

    // Add Daily Stats
    message += `\n------------------\n`;
    message += `📊 *Statistik Hari Ini*\n`;
    message += `🛒 Total Transaksi: ${dailyTrxCount} trx\n`;
    message += `💰 Total Profit: Rp ${dailyProfitTotal.toLocaleString('id-ID')}\n`;
    
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

    console.log('📤 Sending to Fonnte...', { target, messageLength: message.length });
    
    // 4. Prepare FormData
    const formData = new FormData();
    formData.append('target', target);
    formData.append('message', message);
    formData.append('delay', '5-10'); // Add delay as requested

    // 5. Send Request
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': token,
        // IMPORTANT: Do NOT set Content-Type manually for FormData, 
        // fetch will set it with the correct boundary.
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

  } catch (error) {
    console.error('❌ Error inside sendWhatsAppNotification:', error);
    return null;
  }
};
