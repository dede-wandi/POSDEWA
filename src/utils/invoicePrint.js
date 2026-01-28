import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { formatIDR } from './currency';
import { getItemAsync, setItemAsync } from '../utils/storage';
let BluetoothManager = null;
let BluetoothEscposPrinter = null;
try {
  const bt = require('react-native-bluetooth-escpos-printer');
  BluetoothManager = bt.BluetoothManager;
  BluetoothEscposPrinter = bt.BluetoothEscposPrinter;
} catch (e) {
  BluetoothManager = null;
  BluetoothEscposPrinter = null;
}
import { getInvoiceSettings } from '../services/invoiceSettingsSupabase';

// Generate HTML template for invoice (Receipt format)
export const generateInvoiceHTML = async (sale, userId, receiptSize = '58mm') => {
  const saleDate = new Date(sale.created_at);
  const formattedDate = saleDate.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: '2-digit', 
    year: 'numeric'
  });
  const formattedTime = saleDate.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  const totalQty = (sale.items || []).reduce((acc, it) => acc + (Number(it.qty) || 0), 0);
  
  // Get invoice settings from database
  let invoiceSettings = null;
  if (userId) {
    const settingsResult = await getInvoiceSettings(userId);
    if (settingsResult.success) {
      invoiceSettings = settingsResult.data;
    }
  }
  
  // Use default values if no settings found
  const businessName = invoiceSettings?.business_name || 'TOKO SAYA';
  const businessAddress = invoiceSettings?.business_address || 'Jl. Alamat Toko No. 123, Kota';
  const businessPhone = invoiceSettings?.business_phone || '';
  const footerText = invoiceSettings?.footer_text || '*** THANK YOU ***';
  const showBusinessInfo = invoiceSettings?.show_business_info !== false;
  const showFooterText = invoiceSettings?.show_footer_text !== false;
  const headerText = invoiceSettings?.header_text || '';

  // Determine sizes based on receipt size
  const is80mm = receiptSize === '80mm';
  const pageWidth = is80mm ? '80mm' : '58mm';
  const bodyPadding = is80mm ? '6px' : '4px';
  const baseFontSize = is80mm ? '11px' : '9px';
  const businessNameSize = is80mm ? '14px' : '11px';
  const businessAddressSize = is80mm ? '10px' : '8px';
  const infoLineSize = is80mm ? '10px' : '8px';
  const itemNameSize = is80mm ? '11px' : '9px';
  const itemDetailsSize = is80mm ? '10px' : '8px';
  const totalLineSize = is80mm ? '11px' : '9px';
  const totalLineBoldSize = is80mm ? '12px' : '10px';
  const footerSize = is80mm ? '10px' : '8px';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Struk ${sale.no_invoice || sale.id}</title>
      <style>
        @page {
          size: ${pageWidth} auto;
          margin: 0;
          padding: 0;
        }
        * {
          box-sizing: border-box;
        }
        html, body {
          margin: 0;
          padding: 0;
          width: 100%;
          height: auto;
        }
        body {
          font-family: 'Courier New', monospace;
          margin: 0;
          padding: ${bodyPadding};
          font-size: ${baseFontSize};
          line-height: 1.0;
          width: ${pageWidth};
          max-width: ${pageWidth};
          background: white;
          min-height: auto;
        }
        .receipt {
          width: 100%;
          margin: 0;
          padding: 0;
        }
        .header {
          text-align: center;
          margin-bottom: 2px;
        }
        .business-name {
          font-size: ${businessNameSize};
          font-weight: bold;
          margin-bottom: 0px;
          line-height: 1.0;
        }
        .business-address {
          font-size: ${businessAddressSize};
          margin-bottom: 1px;
          line-height: 1.0;
        }
        .divider {
          border-top: 1px dashed #000;
          margin: 1px 0;
        }
        .info-line {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0px;
          font-size: ${infoLineSize};
          line-height: 1.0;
        }
        .items-section { margin: 2px 0; }
        .item-line { margin-bottom: 1px; }
        .line {
          display: flex;
          justify-content: space-between;
          font-size: ${itemDetailsSize};
          line-height: 1.0;
        }
        .name {
          font-size: ${itemNameSize};
          line-height: 1.0;
        }
        .total-section {
          margin-top: 1px;
        }
        .total-line {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0px;
          font-size: ${totalLineSize};
          line-height: 1.0;
        }
        .total-line.bold {
          font-weight: bold;
          font-size: ${totalLineBoldSize};
          line-height: 1.0;
        }
        .footer {
          text-align: center;
          margin-top: 2px;
          font-size: ${footerSize};
          line-height: 1.0;
        }
        .text-right {
          text-align: right;
        }
        .text-center {
          text-align: center;
        }
      </style>
    </head>
    <body>
      <div class="receipt">
        <div class="header">
          <div class="business-name">${businessName}</div>
          ${showBusinessInfo ? `<div class="business-address">${businessAddress}${businessPhone ? ' • ' + businessPhone : ''}</div>` : ''}
          ${headerText && invoiceSettings?.show_header_text ? `<div style="font-size: ${infoLineSize}; margin-top: 1px;">${headerText}</div>` : ''}
        </div>
        
        <div class="divider"></div>
        
        <div class="info-line">
          <span>Tanggal</span>
          <span>: ${formattedDate}</span>
        </div>
        <div class="info-line">
          <span>${sale.no_invoice || sale.id}</span>
          <span>- ${formattedTime}</span>
        </div>
        
        <div class="divider"></div>
        
        <div class="items-section">
          ${Array.isArray(sale.items) && sale.items.length > 0 ? `
            ${sale.items.map((item, idx) => {
              const unit = '${formatIDR(0)}'.replace('Rp', '').trim();
              const unitPrice = '${formatIDR(item.price)}'.replace('Rp', '').trim();
              return `
              <div class="item-line">
                <div class="name">${idx + 1}. ${item.product_name}</div>
                ${item.token_code ? `<div style="font-size: 8px; color: #666;">🔑 ${item.token_code}</div>` : ''}
                <div class="line">
                  <span>${item.qty} x ${unitPrice}</span>
                  <span>${formatIDR(item.line_total)}</span>
                </div>
              </div>
              `;
            }).join('')}
          ` : '<div class="text-center">Tidak ada item</div>'}
        </div>
        
        <div class="divider"></div>
        
        <div class="total-section">
          <div class="total-line">
            <span>Total QTY</span>
            <span>${totalQty}</span>
          </div>
          <div class="total-line">
            <span>Sub Total</span>
            <span>${formatIDR((sale.items || []).reduce((sum, it) => sum + (Number(it.line_total) || 0), 0))}</span>
          </div>
          <div class="total-line bold">
            <span>Total</span>
            <span>${formatIDR(sale.total)}</span>
          </div>
        </div>
        
        ${sale.payment_method === 'cash' && sale.cash_amount ? `
        <div class="total-line">
          <span>Tunai</span>
          <span>${formatIDR(sale.cash_amount)}</span>
        </div>
        <div class="total-line">
          <span>Kembalian</span>
          <span>${formatIDR(sale.change_amount || 0)}</span>
        </div>
        ` : ''}
        
        ${sale.payment_method && sale.payment_method !== 'cash' ? `
        <div class="total-line">
          <span>Metode</span>
          <span>${(sale.payment_method || '').toUpperCase()}${sale.payment_channel ? ` - ${sale.payment_channel.name}` : ''}</span>
        </div>
        ${sale.change_amount > 0 ? `
        <div class="total-line">
          <span>Kembalian</span>
          <span>${formatIDR(sale.change_amount)}</span>
        </div>
        ` : ''}
        ` : ''}
        
        ${showFooterText ? `
        <div class="footer">
          <div>${footerText}</div>
        </div>
        ` : ''}
      </div>
    </body>
    </html>
  `;
};

export const detectPairedPrinters = async () => {
  if (!BluetoothManager) return [];
  try {
    const result = await BluetoothManager.enableBluetooth();
    const paired = [];
    if (result && result.length > 0) {
      for (let i = 0; i < result.length; i++) {
        try {
          paired.push(JSON.parse(result[i]));
        } catch {}
      }
    }
    return paired;
  } catch {
    return [];
  }
};

export const connectBluetoothPrinter = async (address) => {
  if (!BluetoothManager) return { success: false, error: 'Bluetooth tidak tersedia' };
  try {
    await BluetoothManager.connect(address);
    await setItemAsync('printer.address', address);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
};

export const printToBluetoothPrinter = async (sale, receiptSize = '58mm') => {
  if (!BluetoothEscposPrinter) return { success: false, error: 'Bluetooth printer tidak tersedia' };
  try {
    const addr = await getItemAsync('printer.address');
    if (addr) {
      await BluetoothManager.connect(addr);
    }
    await BluetoothEscposPrinter.init({
      encoding: 'GBK',
      codepage: 0,
      width: receiptSize === '80mm' ? 576 : 384
    });
    await BluetoothEscposPrinter.printText(`${sale.no_invoice || sale.id}\n`, {});
    const saleDate = new Date(sale.created_at);
    const header = saleDate.toLocaleDateString('id-ID') + ' ' + saleDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    await BluetoothEscposPrinter.printText(`${header}\n`, {});
    await BluetoothEscposPrinter.printText(`------------------------------\n`, {});
    for (let i = 0; i < (sale.items || []).length; i++) {
      const item = sale.items[i];
      await BluetoothEscposPrinter.printText(`${i + 1}. ${item.product_name}\n`, {});
      const unitPrice = formatIDR(item.price).replace('Rp', '').trim();
      await BluetoothEscposPrinter.printColumn(
        [20, 12],
        [BluetoothEscposPrinter.ALIGN.LEFT, BluetoothEscposPrinter.ALIGN.RIGHT],
        [`${item.qty} x ${unitPrice}`, formatIDR(item.line_total)],
        {}
      );
    }
    await BluetoothEscposPrinter.printText(`------------------------------\n`, {});
    const totalQty = (sale.items || []).reduce((acc, it) => acc + (Number(it.qty) || 0), 0);
    await BluetoothEscposPrinter.printColumn(
      [20, 12],
      [BluetoothEscposPrinter.ALIGN.LEFT, BluetoothEscposPrinter.ALIGN.RIGHT],
      ['Total QTY', String(totalQty)],
      {}
    );
    const subTotal = (sale.items || []).reduce((sum, it) => sum + (Number(it.line_total) || 0), 0);
    await BluetoothEscposPrinter.printColumn(
      [12, 20],
      [BluetoothEscposPrinter.ALIGN.LEFT, BluetoothEscposPrinter.ALIGN.RIGHT],
      ['Sub Total', formatIDR(subTotal)],
      {}
    );
    await BluetoothEscposPrinter.printColumn(
      [12, 20],
      [BluetoothEscposPrinter.ALIGN.LEFT, BluetoothEscposPrinter.ALIGN.RIGHT],
      ['Total', formatIDR(sale.total)],
      { bold: true }
    );
    if (sale.payment_method === 'cash' && sale.cash_amount) {
      await BluetoothEscposPrinter.printColumn(
        [12, 20],
        [BluetoothEscposPrinter.ALIGN.LEFT, BluetoothEscposPrinter.ALIGN.RIGHT],
        ['Tunai', formatIDR(sale.cash_amount)],
        {}
      );
      await BluetoothEscposPrinter.printColumn(
        [12, 20],
        [BluetoothEscposPrinter.ALIGN.LEFT, BluetoothEscposPrinter.ALIGN.RIGHT],
        ['Kembalian', formatIDR(sale.change_amount || 0)],
        {}
      );
    }
    await BluetoothEscposPrinter.printText(`\n`, {});
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
};
// Print invoice to PDF
export const printInvoiceToPDF = async (sale, userId = null, receiptSize = '58mm') => {
  try {
    console.log('🖨️ Generating PDF for sale:', sale.id);
    
    const htmlContent = await generateInvoiceHTML(sale, userId, receiptSize);
    
    const { uri } = await Print.printToFileAsync({
      html: htmlContent,
      base64: false,
      width: 612,
      height: 792,
    });

    console.log('✅ PDF generated successfully:', uri);
    return { success: true, uri };
  } catch (error) {
    console.error('❌ Error generating PDF:', error);
    return { success: false, error: error.message };
  }
};

// Share invoice PDF
export const shareInvoicePDF = async (sale, userId = null, receiptSize = '58mm') => {
  try {
    console.log('📤 Sharing PDF for sale:', sale.id);
    
    const pdfResult = await printInvoiceToPDF(sale, userId, receiptSize);
    if (!pdfResult.success) {
      return pdfResult;
    }

    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      return { success: false, error: 'Sharing tidak tersedia di perangkat ini' };
    }

    await Sharing.shareAsync(pdfResult.uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Invoice ${sale.no_invoice || sale.id}`,
      UTI: 'com.adobe.pdf'
    });

    console.log('✅ PDF shared successfully');
    return { success: true };
  } catch (error) {
    console.error('❌ Error sharing PDF:', error);
    return { success: false, error: error.message };
  }
};

// Share to WhatsApp
export const shareToWhatsApp = async (sale, userId = null, receiptSize = '58mm') => {
  try {
    console.log('📱 Sharing to WhatsApp for sale:', sale.id);
    
    const pdfResult = await printInvoiceToPDF(sale, userId, receiptSize);
    if (!pdfResult.success) {
      return pdfResult;
    }

    // Create WhatsApp message
    const saleDate = new Date(sale.created_at);
    const formattedDate = saleDate.toLocaleDateString('id-ID');
    const message = `Struk Pembelian\nNo: ${sale.no_invoice || sale.id}\nTanggal: ${formattedDate}\nTotal: ${formatIDR(sale.total)}`;
    
    // WhatsApp URL scheme
    const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(message)}`;
    
    // Check if WhatsApp is available
    const canOpen = await Linking.canOpenURL(whatsappUrl);
    
    if (canOpen) {
      await Linking.openURL(whatsappUrl);
      console.log('✅ WhatsApp opened successfully');
      
      // Also share the PDF file
      if (await Sharing.isAvailableAsync()) {
        setTimeout(async () => {
          await Sharing.shareAsync(pdfResult.uri, {
            mimeType: 'application/pdf',
            dialogTitle: `Struk ${sale.no_invoice || sale.id}`,
            UTI: 'com.adobe.pdf'
          });
        }, 1000);
      }
      
      return { success: true, uri: pdfResult.uri };
    } else {
      console.log('❌ WhatsApp not available, sharing PDF instead');
      return await shareInvoicePDF(sale, userId, receiptSize);
    }
  } catch (error) {
    console.error('❌ Error sharing to WhatsApp:', error);
    return { success: false, error: error.message };
  }
};

export const printToSelectedPrinter = async (sale, userId = null, receiptSize = '58mm') => {
  try {
    const htmlContent = await generateInvoiceHTML(sale, userId, receiptSize);
    const printerUrl = await getItemAsync('printer.url');
    if (printerUrl) {
      await Print.printAsync({ html: htmlContent, printerUrl });
      return { success: true };
    } else {
      await Print.printAsync({ html: htmlContent });
      return { success: true };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const getSelectedPrinterInfo = async () => {
  const name = await getItemAsync('printer.name');
  const address = await getItemAsync('printer.address');
  const url = await getItemAsync('printer.url');
  return { name: name || '', address: address || '', url: url || '' };
};

export const checkPrinterConnection = async () => {
  const info = await getSelectedPrinterInfo();
  if (!BluetoothManager || !info.address) {
    return { connected: false, ...info };
  }
  try {
    await BluetoothManager.connect(info.address);
    return { connected: true, ...info };
  } catch (e) {
    return { connected: false, ...info, error: e.message };
  }
};

export const testBluetoothPrint = async (receiptSize = '58mm') => {
  if (!BluetoothEscposPrinter) return { success: false, error: 'Bluetooth printer tidak tersedia' };
  try {
    const addr = await getItemAsync('printer.address');
    if (addr) {
      await BluetoothManager.connect(addr);
    }
    await BluetoothEscposPrinter.init({
      encoding: 'GBK',
      codepage: 0,
      width: receiptSize === '80mm' ? 576 : 384
    });
    await BluetoothEscposPrinter.printText('Uji Cetak 58mm\n', {});
    await BluetoothEscposPrinter.printText('POSDEWA\n', {});
    await BluetoothEscposPrinter.printText('------------------------------\n', {});
    await BluetoothEscposPrinter.printText('Berhasil mencetak uji coba.\n\n', {});
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
};

export const testWebPrint = async (receiptSize = '58mm') => {
  try {
    const is80mm = receiptSize === '80mm';
    const pageWidth = is80mm ? '80mm' : '58mm';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Uji Cetak</title>
        <style>
          @page { size: ${pageWidth} auto; margin: 0; }
          body { font-family: 'Courier New', monospace; width: ${pageWidth}; margin: 0; padding: 4px; }
        </style>
      </head>
      <body>
        <div>Uji Cetak ${receiptSize}</div>
        <div>POSDEWA</div>
        <div>------------------------------</div>
        <div>Berhasil mencetak uji coba via browser.</div>
      </body>
      </html>
    `;
    await Print.printAsync({ html });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
};

// --- CUSTOM INVOICE PRINTING ---

export const generateCustomInvoiceHTML = async (invoice, userId) => {
  const { 
    title, 
    customer_name, 
    paper_size = '58mm', 
    header_content, 
    footer_content, 
    show_logo,
    items,
    details = [], // Default to empty array
    total_amount,
    created_at
  } = invoice;

  const saleDate = new Date(created_at || Date.now());
  const formattedDate = saleDate.toLocaleDateString('id-ID', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
  const formattedTime = saleDate.toLocaleTimeString('id-ID', {
    hour: '2-digit', minute: '2-digit'
  });

  // Get invoice settings if logo is needed
  let businessName = '';
  let businessAddress = '';
  let businessPhone = '';
  
  if (show_logo && userId) {
    const settingsResult = await getInvoiceSettings(userId);
    if (settingsResult.success && settingsResult.data) {
      const s = settingsResult.data;
      if (s.show_business_info) {
        businessName = s.business_name || '';
        businessAddress = s.business_address || '';
        businessPhone = s.business_phone || '';
      }
    }
  }

  const is80mm = paper_size === '80mm';
  const pageWidth = is80mm ? '80mm' : '58mm';
  const bodyPadding = is80mm ? '6px' : '4px';
  const baseFontSize = is80mm ? '11px' : '9px';
  const headerFontSize = is80mm ? '14px' : '12px';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>
        @page { size: ${pageWidth} auto; margin: 0; padding: 0; }
        * { box-sizing: border-box; }
        body {
          font-family: 'Courier New', monospace;
          margin: 0;
          padding: ${bodyPadding};
          font-size: ${baseFontSize};
          line-height: 1.2;
          width: ${pageWidth};
          background: white;
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .bold { font-weight: bold; }
        .divider { border-top: 1px dashed #000; margin: 4px 0; }
        .header-section { margin-bottom: 8px; }
        .business-name { font-size: ${headerFontSize}; font-weight: bold; }
        .row { display: flex; justify-content: space-between; }
        .item-row { margin-bottom: 2px; }
        .detail-row { margin-bottom: 2px; font-size: ${is80mm ? '11px' : '9px'}; }
        .total-row { font-size: ${is80mm ? '12px' : '10px'}; margin-top: 4px; }
        .custom-header { white-space: pre-wrap; margin-bottom: 8px; }
        .custom-footer { white-space: pre-wrap; margin-top: 8px; }
      </style>
    </head>
    <body>
      <div class="header-section text-center">
        ${show_logo && businessName ? `<div class="business-name">${businessName}</div>` : ''}
        ${show_logo && businessAddress ? `<div>${businessAddress}</div>` : ''}
        ${show_logo && businessPhone ? `<div>${businessPhone}</div>` : ''}
        
        ${header_content ? `<div class="custom-header">${header_content}</div>` : ''}
        
        <div class="divider"></div>
        <div class="bold">${title}</div>
        <div>${formattedDate} ${formattedTime}</div>
        ${customer_name ? `<div>Pelanggan: ${customer_name}</div>` : ''}
        <div class="divider"></div>
      </div>

      <div class="items-section">
        ${items.map(item => `
          <div class="item-row">
            <div class="bold">${item.name}</div>
            <div class="row">
              <span>${item.qty} x ${formatIDR(item.price)}</span>
              <span>${formatIDR(item.qty * item.price)}</span>
            </div>
          </div>
        `).join('')}
      </div>

      <div class="divider"></div>

      <div class="row total-row bold">
        <span>TOTAL</span>
        <span>${formatIDR(total_amount)}</span>
      </div>

      <div class="footer-section text-center">
        ${footer_content ? `<div class="custom-footer">${footer_content}</div>` : ''}
      </div>
    </body>
    </html>
  `;
};

export const printCustomInvoiceToBluetooth = async (invoice, userId) => {
  if (!BluetoothEscposPrinter) return { success: false, error: 'Bluetooth printer tidak tersedia' };
  try {
    const addr = await getItemAsync('printer.address');
    if (addr) {
      await BluetoothManager.connect(addr);
    }
    
    const is80mm = invoice.paper_size === '80mm';
    await BluetoothEscposPrinter.init({
      encoding: 'GBK',
      codepage: 0,
      width: is80mm ? 576 : 384
    });

    // Fetch Settings
    if (invoice.show_logo && userId) {
      try {
        const settings = await getInvoiceSettings(userId);
        if (settings) {
          if (settings.business_name) {
             await BluetoothEscposPrinter.printText(`${settings.business_name}\n`, { align: BluetoothEscposPrinter.ALIGN.CENTER, fonttype: 1 });
          }
          if (settings.business_address) {
             await BluetoothEscposPrinter.printText(`${settings.business_address}\n`, { align: BluetoothEscposPrinter.ALIGN.CENTER });
          }
          if (settings.business_phone) {
             await BluetoothEscposPrinter.printText(`${settings.business_phone}\n`, { align: BluetoothEscposPrinter.ALIGN.CENTER });
          }
        }
      } catch (e) {
        console.warn('Failed to fetch settings for BT print', e);
      }
    }

    // Header
    if (invoice.header_content) {
      await BluetoothEscposPrinter.printText(`${invoice.header_content}\n`, { align: BluetoothEscposPrinter.ALIGN.CENTER });
    }
    
    await BluetoothEscposPrinter.printText(`------------------------------\n`, {});
    await BluetoothEscposPrinter.printText(`${invoice.title}\n`, { align: BluetoothEscposPrinter.ALIGN.CENTER });
    
    const saleDate = new Date(invoice.created_at || Date.now());
    const dateStr = saleDate.toLocaleDateString('id-ID') + ' ' + saleDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    await BluetoothEscposPrinter.printText(`${dateStr}\n`, { align: BluetoothEscposPrinter.ALIGN.CENTER });
    
    if (invoice.customer_name) {
      await BluetoothEscposPrinter.printText(`Pelanggan: ${invoice.customer_name}\n`, { align: BluetoothEscposPrinter.ALIGN.CENTER });
    }
    
    await BluetoothEscposPrinter.printText(`------------------------------\n`, {});

    // Details
    if (invoice.details && invoice.details.length > 0) {
      for (const detail of invoice.details) {
        await BluetoothEscposPrinter.printColumn(
          [12, 20],
          [BluetoothEscposPrinter.ALIGN.LEFT, BluetoothEscposPrinter.ALIGN.RIGHT],
          [detail.key, detail.value],
          {}
        );
      }
      await BluetoothEscposPrinter.printText(`------------------------------\n`, {});
    }

    // Items
    for (const item of invoice.items) {
      await BluetoothEscposPrinter.printText(`${item.name}\n`, {});
      const unitPrice = formatIDR(item.price).replace('Rp', '').trim();
      await BluetoothEscposPrinter.printColumn(
        [20, 12],
        [BluetoothEscposPrinter.ALIGN.LEFT, BluetoothEscposPrinter.ALIGN.RIGHT],
        [`${item.qty} x ${unitPrice}`, formatIDR(item.qty * item.price)],
        {}
      );
    }

    await BluetoothEscposPrinter.printText(`------------------------------\n`, {});
    
    // Total
    await BluetoothEscposPrinter.printColumn(
      [12, 20],
      [BluetoothEscposPrinter.ALIGN.LEFT, BluetoothEscposPrinter.ALIGN.RIGHT],
      ['TOTAL', formatIDR(invoice.total_amount)],
      { bold: true }
    );

    // Footer
    if (invoice.footer_content) {
      await BluetoothEscposPrinter.printText(`\n${invoice.footer_content}\n`, { align: BluetoothEscposPrinter.ALIGN.CENTER });
    }
    
    await BluetoothEscposPrinter.printText(`\n\n`, {});
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
};

export const printCustomInvoice = async (invoice, userId) => {
  try {
    console.log('🖨️ printCustomInvoice called for user:', userId);
    
    // 1. Try Bluetooth first if configured (and not Web)
    const printerAddress = await getItemAsync('printer.address');
    const isWeb = Platform.OS === 'web';
    
    if (printerAddress && !isWeb) {
      console.log('Attempting Bluetooth print to:', printerAddress);
      // Check if actually connected or try to connect
      const btResult = await printCustomInvoiceToBluetooth(invoice, userId);
      if (btResult.success) {
        console.log('Bluetooth print success');
        return { success: true, method: 'bluetooth' };
      }
      
      console.log('Bluetooth print failed, falling back to system print:', btResult.error);
    }

    // 2. System Print (Web or Native Share/Print)
    console.log('Generating HTML for system print...');
    const htmlContent = await generateCustomInvoiceHTML(invoice, userId);
    console.log('HTML generated, length:', htmlContent?.length);
    
    if (!htmlContent) {
      throw new Error('Gagal membuat format struk (HTML kosong)');
    }

    // On Web, Print.printAsync works.
    // On Native, it opens system print dialog.
    const printerUrl = await getItemAsync('printer.url');
    console.log('Calling Print.printAsync with HTML...');
    
    if (printerUrl) {
      await Print.printAsync({ html: htmlContent, printerUrl });
    } else {
      await Print.printAsync({ html: htmlContent });
    }
    
    return { success: true, method: 'system', error: isWeb ? null : 'Bluetooth tidak terhubung, beralih ke sistem print (PDF).' };
  } catch (error) {
    console.error('Error printing custom invoice:', error);
    // If we fail here, try to print just a simple text as a last resort
    try {
      if (Platform.OS !== 'web') {
        const simpleHtml = `<html><body><h1>Error Printing</h1><p>${error.message}</p></body></html>`;
        await Print.printAsync({ html: simpleHtml });
      }
    } catch (e) {}
    
    return { success: false, error: error.message };
  }
};
