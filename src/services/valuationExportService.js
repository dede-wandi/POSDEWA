import { Platform } from 'react-native';
import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/**
 * Service Class (OOP) to handle Excel (.xlsx) spreadsheet export
 * across Web and Native platforms.
 */
export class ValuationExcelExporter {
  /**
   * Generates and downloads or shares an Excel (.xlsx) file.
   *
   * @param {ValuationProductItem[]} products List of domain model items
   * @param {ValuationSummaryModel} summary Calculated summary instance
   * @param {Object} callbacks Hooks for toast notifications and progress state
   */
  static async export({ products, summary, showToast, setExporting }) {
    if (!products || products.length === 0) {
      showToast?.('Tidak ada data produk untuk diekspor', 'info');
      return;
    }

    try {
      setExporting?.(true);

      const rows = [];
      products.forEach((item, idx) => {
        if (typeof item.toExcelRows === 'function') {
          rows.push(...item.toExcelRows(idx + 1));
        } else {
          rows.push(item.toExcelRow(idx + 1));
        }
      });
      if (summary) {
        rows.push(summary.toExcelSummaryRow());
      }

      const fileName = `Valuasi_Stok_Excel_${new Date().toISOString().slice(0, 10)}.xlsx`;
      const ws = XLSX.utils.json_to_sheet(rows);

      // Define column widths for Excel
      ws['!cols'] = [
        { wch: 6 },  // No
        { wch: 22 }, // Tipe Produk
        { wch: 30 }, // Nama Produk
        { wch: 18 }, // Varian
        { wch: 20 }, // Penitip
        { wch: 14 }, // Stok
        { wch: 18 }, // HPP
        { wch: 16 }, // Harga Jual
        { wch: 20 }, // Total Modal Toko
        { wch: 24 }, // Total Setor
        { wch: 20 }, // Total Jual
        { wch: 20 }, // Potensi Keuntungan
        { wch: 16 }, // Status
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Valuasi Stok');

      // Web platform direct download
      if (Platform.OS === 'web') {
        XLSX.writeFile(wb, fileName);
        showToast?.('File Excel berhasil diunduh', 'success');
        return;
      }

      // Native (iOS / Android) platform file write and sharing
      const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      const uri = FileSystem.cacheDirectory + fileName;

      await FileSystem.writeAsStringAsync(uri, wbout, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (!(await Sharing.isAvailableAsync())) {
        showToast?.('Fitur sharing tidak tersedia di perangkat ini', 'info');
        return;
      }

      await Sharing.shareAsync(uri, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: 'Download Laporan Valuasi Excel',
        UTI: 'com.microsoft.excel.xlsx',
      });
    } catch (err) {
      showToast?.('Gagal ekspor ke Excel: ' + (err.message || 'Error tidak diketahui'), 'error');
    } finally {
      setExporting?.(false);
    }
  }
}
