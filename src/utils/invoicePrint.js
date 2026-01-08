import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as Linking from 'expo-linking';
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
  const logoUrl = invoiceSettings?.header_logo_url || '';
  const showLogo = invoiceSettings?.show_header_logo || false;

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
        .items-table {
          width: 100%;
          border-collapse: collapse;
          font-size: ${itemDetailsSize};
        }
        .items-table thead th {
          text-align: left;
          border-bottom: 1px dashed #000;
          padding: 2px 0;
          font-size: ${itemNameSize};
        }
        .items-table tbody td {
          padding: 2px 0;
        }
        .col-name { width: 52%; }
        .col-qty { width: 12%; text-align: left; }
        .col-price { width: 16%; text-align: right; }
        .col-total { width: 20%; text-align: right; }
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
          ${showLogo && logoUrl ? `<div style="margin-bottom: 2px;"><img src="${logoUrl}" alt="Logo" style="max-width: 90%; height: auto;" /></div>` : ''}
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
          <table class="items-table">
            <thead>
              <tr>
                <th class="col-name">Produk</th>
                <th class="col-qty">Qty</th>
                <th class="col-price">Harga</th>
                <th class="col-total">Total</th>
              </tr>
            </thead>
            <tbody>
              ${sale.items.map(item => `
                <tr>
                  <td class="col-name">${item.product_name}${item.token_code ? `<div style="font-size: 8px; color: #666;">🔑 ${item.token_code}</div>` : ''}</td>
                  <td class="col-qty">${item.qty}</td>
                  <td class="col-price">${formatIDR(item.price)}</td>
                  <td class="col-total">${formatIDR(item.line_total)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          ` : '<div class="text-center">Tidak ada item</div>'}
        </div>
        
        <div class="divider"></div>
        
        <div class="total-section">
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
    for (const item of sale.items || []) {
      await BluetoothEscposPrinter.printText(`${item.qty}x ${item.product_name}\n`, {});
      await BluetoothEscposPrinter.printColumn(
        [12, 20],
        [BluetoothEscposPrinter.ALIGN.LEFT, BluetoothEscposPrinter.ALIGN.RIGHT],
        [formatIDR(item.price), formatIDR(item.line_total)],
        {}
      );
    }
    await BluetoothEscposPrinter.printText(`------------------------------\n`, {});
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
