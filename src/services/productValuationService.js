import { getProducts } from './products';
import { getSupabaseClient } from './supabase';
import { getProductTypesMap, detectProductType, isConsignmentProduct } from './productTypeService';

/**
 * Service to calculate complete physical product valuation,
 * inventory asset value, cost of goods (HPP), consignment breakdown,
 * and comparison with realized sales.
 */
export async function getProductValuation(userId) {
  try {
    const [products, typeMeta] = await Promise.all([
      getProducts(userId),
      getProductTypesMap(userId || 'guest'),
    ]);

    const productList = Array.isArray(products) ? products : [];

    let totalStockUnits = 0;         // Total unit fisik di toko (Fisik Toko + Voucher + Titipan)
    let totalCostValue = 0;          // Total Modal Barang Milik Toko Tertanam di Rak (Fisik Toko + Voucher)
    let totalRetailValue = 0;        // Total Nilai Jual Seluruh Barang
    let outOfStockCount = 0;
    let lowStockCount = 0;
    let safeStockCount = 0;

    // Breakdown kategori tipe produk
    let physicalCount = 0;
    let physicalUnits = 0;
    let physicalCostValue = 0;

    let consignmentCount = 0;
    let consignmentUnits = 0;
    let consignmentPayoutDue = 0;       // Total yang wajib disetor ke penitip
    let consignmentPotentialProfit = 0; // Komisi keuntungan toko dari barang titipan

    let voucherCount = 0;
    let voucherUnits = 0;
    let voucherCostValue = 0;

    let digitalCount = 0;
    let digitalPotentialProfit = 0;

    let serviceCount = 0;
    let servicePotentialProfit = 0;

    const enrichedProducts = [];

    productList.forEach(item => {
      const pType = detectProductType(item, typeMeta);
      const isPhysical = pType === 'physical';
      const isConsignment = pType === 'consignment';
      const isVoucher = pType === 'voucher';
      const isDigital = pType === 'digital';
      const isService = pType === 'financial_service';
      const isShelfStock = isPhysical || isVoucher || isConsignment;
      const consignorName = typeMeta[item.id]?.consignorName || item.consignor_name || '';

      let variantsList = item.variants;
      if (typeof variantsList === 'string') {
        try {
          variantsList = JSON.parse(variantsList);
        } catch {
          variantsList = [];
        }
      }
      if (variantsList && typeof variantsList === 'object' && !Array.isArray(variantsList)) {
        variantsList = Object.values(variantsList);
      }
      const hasVariants = Array.isArray(variantsList) && variantsList.length > 0;

      // Sub-fungsi untuk memproses setiap baris item/varian ke dalam agregat & daftar valuasi
      const processItemRow = ({
        rowId,
        rowName,
        rowBarcode,
        variantName,
        hasVariant,
        stockVal,
        costVal,
        sellVal,
      }) => {
        const stock = Math.max(0, Number(stockVal || 0));
        const costPrice = Number(costVal || 0);
        const sellPrice = Number(sellVal || 0);
        const profitPerUnit = Math.max(0, sellPrice - costPrice);

        const totalItemRetail = isShelfStock ? stock * sellPrice : 0;
        const totalItemCost = isShelfStock ? stock * costPrice : 0;
        const itemPotentialProfit = isShelfStock ? stock * profitPerUnit : 0;
        const marginPercent = sellPrice > 0 ? (profitPerUnit / sellPrice) * 100 : 0;
        const profitPerTrx = profitPerUnit;

        let storeItemCapital = 0;
        let isPhysicalStock = false;

        if (isPhysical) {
          physicalCount++;
          physicalUnits += stock;
          physicalCostValue += totalItemCost;
          storeItemCapital = totalItemCost;
          isPhysicalStock = true;

          totalCostValue += totalItemCost;
          totalStockUnits += stock;
          totalRetailValue += totalItemRetail;
        } else if (isVoucher) {
          voucherCount++;
          voucherUnits += stock;
          voucherCostValue += totalItemCost;
          storeItemCapital = totalItemCost;
          isPhysicalStock = true;

          totalCostValue += totalItemCost;
          totalStockUnits += stock;
          totalRetailValue += totalItemRetail;
        } else if (isConsignment) {
          consignmentCount++;
          consignmentUnits += stock;
          consignmentPayoutDue += totalItemCost;
          consignmentPotentialProfit += itemPotentialProfit;
          storeItemCapital = 0; // MODAL TOKO = Rp 0 (Barang Titipan dari orang lain)
          isPhysicalStock = true;

          totalStockUnits += stock;
          totalRetailValue += totalItemRetail;
        } else if (isDigital) {
          digitalCount++;
          storeItemCapital = 0; // NON-FISIK (Modal di Saldo Server PPOB)
          isPhysicalStock = false;
        } else if (isService) {
          serviceCount++;
          storeItemCapital = 0; // Jasa Keuangan (Modal kas/bank)
          isPhysicalStock = false;
        }

        if (isPhysicalStock) {
          if (stock === 0) {
            outOfStockCount++;
          } else if (stock <= 5) {
            lowStockCount++;
          } else {
            safeStockCount++;
          }
        }

        enrichedProducts.push({
          ...item,
          id: rowId,
          productId: item.id,
          name: rowName,
          parentName: item.name,
          variantName,
          hasVariant,
          hasVariants: Boolean(hasVariant),
          barcode: rowBarcode,
          stock,
          costPrice,
          sellPrice,
          profitPerTrx,
          productType: pType,
          isPhysical,
          isConsignment,
          isVoucher,
          isDigital,
          isService,
          isPhysicalStock,
          consignorName,
          totalItemCost,
          storeItemCapital,
          totalItemRetail,
          itemPotentialProfit,
          marginPercent: Math.max(0, marginPercent),
        });
      };

      if (hasVariants && variantsList.length >= 1) {
        // Produk dengan varian: Hitung total gabungan untuk parent + rincian per varian
        let parentStock = 0;
        let parentTotalCost = 0;
        let parentTotalRetail = 0;
        let parentPotentialProfit = 0;
        let costMin = Infinity;
        let costMax = -Infinity;
        let sellMin = Infinity;
        let sellMax = -Infinity;

        const variantRows = variantsList.map((rawV, vIdx) => {
          const v = typeof rawV === 'string' ? { name: rawV } : (rawV || {});
          const varName = String(v.name || v.variantName || v.label || `Varian #${vIdx + 1}`).trim();
          const varBarcode = v.barcode || item.barcode || '';
          const varCost =
            v.costPrice !== undefined && v.costPrice !== null && v.costPrice !== ''
              ? Number(v.costPrice)
              : (v.cost_price !== undefined && v.cost_price !== null && v.cost_price !== ''
                ? Number(v.cost_price)
                : Number(item.cost_price || item.costPrice || 0));
          const varPrice =
            v.price !== undefined && v.price !== null && v.price !== ''
              ? Number(v.price)
              : (v.sellPrice !== undefined && v.sellPrice !== null && v.sellPrice !== ''
                ? Number(v.sellPrice)
                : Number(item.price || 0));
          const varStock = Math.max(0, Number(v.stock !== undefined && v.stock !== null && v.stock !== '' ? v.stock : 0));
          const profitPerUnit = Math.max(0, varPrice - varCost);
          const totalVarCost = isShelfStock ? varStock * varCost : 0;
          const totalVarRetail = isShelfStock ? varStock * varPrice : 0;
          const varPotentialProfit = isShelfStock ? varStock * profitPerUnit : 0;

          parentStock += varStock;
          parentTotalCost += totalVarCost;
          parentTotalRetail += totalVarRetail;
          parentPotentialProfit += varPotentialProfit;

          if (varCost < costMin) costMin = varCost;
          if (varCost > costMax) costMax = varCost;
          if (varPrice < sellMin) sellMin = varPrice;
          if (varPrice > sellMax) sellMax = varPrice;

          return {
            id: `${item.id}-var-${v.id || vIdx}`,
            parentId: item.id,
            name: `${item.name} (${varName})`,
            parentName: item.name,
            variantName: varName,
            barcode: varBarcode,
            stock: varStock,
            costPrice: varCost,
            sellPrice: varPrice,
            totalItemCost: totalVarCost,
            totalItemRetail: totalVarRetail,
            itemPotentialProfit: varPotentialProfit,
            profitPerTrx: profitPerUnit,
            isConsignment,
            isDigital,
            isService,
            isPhysicalStock: isShelfStock,
            consignorName,
          };
        });

        // Fallback jika semua variant stock = 0 tetapi item.stock memiliki angka
        if (parentStock === 0 && Number(item.stock || 0) > 0 && variantRows.length === 1) {
          variantRows[0].stock = Number(item.stock);
          const varCost = variantRows[0].costPrice;
          const varPrice = variantRows[0].sellPrice;
          const profitPerUnit = Math.max(0, varPrice - varCost);
          variantRows[0].totalItemCost = isShelfStock ? variantRows[0].stock * varCost : 0;
          variantRows[0].totalItemRetail = isShelfStock ? variantRows[0].stock * varPrice : 0;
          variantRows[0].itemPotentialProfit = isShelfStock ? variantRows[0].stock * profitPerUnit : 0;
          parentStock = variantRows[0].stock;
          parentTotalCost = variantRows[0].totalItemCost;
          parentTotalRetail = variantRows[0].totalItemRetail;
          parentPotentialProfit = variantRows[0].itemPotentialProfit;
        }

        if (costMin === Infinity) { costMin = 0; costMax = 0; }
        if (sellMin === Infinity) { sellMin = 0; sellMax = 0; }

        let parentStoreItemCapital = 0;
        if (isPhysical) {
          physicalCount++;
          physicalUnits += parentStock;
          physicalCostValue += parentTotalCost;
          parentStoreItemCapital = parentTotalCost;

          totalCostValue += parentTotalCost;
          totalStockUnits += parentStock;
          totalRetailValue += parentTotalRetail;
        } else if (isVoucher) {
          voucherCount++;
          voucherUnits += parentStock;
          voucherCostValue += parentTotalCost;
          parentStoreItemCapital = parentTotalCost;

          totalCostValue += parentTotalCost;
          totalStockUnits += parentStock;
          totalRetailValue += parentTotalRetail;
        } else if (isConsignment) {
          consignmentCount++;
          consignmentUnits += parentStock;
          consignmentPayoutDue += parentTotalCost;
          consignmentPotentialProfit += parentPotentialProfit;
          parentStoreItemCapital = 0;

          totalStockUnits += parentStock;
          totalRetailValue += parentTotalRetail;
        } else if (isDigital) {
          digitalCount++;
        } else if (isService) {
          serviceCount++;
        }

        if (isShelfStock) {
          if (parentStock === 0) {
            outOfStockCount++;
          } else if (parentStock <= 5) {
            lowStockCount++;
          } else {
            safeStockCount++;
          }
        }

        enrichedProducts.push({
          ...item,
          id: item.id,
          productId: item.id,
          name: item.name,
          parentName: item.name,
          variantName: '',
          hasVariant: true,
          hasVariants: true,
          variants: variantRows,
          barcode: item.barcode || '',
          stock: parentStock,
          costPrice: costMin,
          costPriceMin: costMin,
          costPriceMax: costMax,
          sellPrice: sellMin,
          sellPriceMin: sellMin,
          sellPriceMax: sellMax,
          profitPerTrx: Math.max(0, sellMin - costMin),
          productType: pType,
          isPhysical,
          isConsignment,
          isVoucher,
          isDigital,
          isService,
          isPhysicalStock: isShelfStock,
          consignorName,
          totalItemCost: parentTotalCost,
          storeItemCapital: parentStoreItemCapital,
          totalItemRetail: parentTotalRetail,
          itemPotentialProfit: parentPotentialProfit,
        });
      } else {
        // Produk tunggal tanpa varian
        processItemRow({
          rowId: item.id,
          rowName: item.name,
          rowBarcode: item.barcode || '',
          variantName: '',
          hasVariant: false,
          stockVal: item.stock,
          costVal: item.cost_price || item.costPrice || 0,
          sellVal: item.price || 0,
        });
      }
    });

    // Potensi keuntungan stok fisik & titipan di toko:
    // (Laba dari barang toko sendiri) + (Komisi dari barang titipan)
    const storePotentialProfit = Math.max(
      0,
      (totalRetailValue - consignmentPayoutDue) - totalCostValue
    );
    const overallMargin = totalRetailValue > 0 ? (storePotentialProfit / totalRetailValue) * 100 : 0;

    // Sort products by highest asset value
    const sortedByAsset = [...enrichedProducts].sort((a, b) => b.storeItemCapital - a.storeItemCapital);

    // Fetch realized sales summary to compare with inventory value
    let realizedSales = {
      totalRevenue: 0,
      totalCostSold: 0,
      totalProfitRealized: 0,
      totalQuantitySold: 0,
    };

    const supabase = getSupabaseClient();
    if (supabase && userId) {
      try {
        const { data: salesData, error: salesError } = await supabase
          .from('sales')
          .select('id, total, profit, sale_items (qty, price, cost_price, line_profit)')
          .eq('user_id', userId);

        if (!salesError && Array.isArray(salesData)) {
          salesData.forEach(sale => {
            const saleTotal = Number(sale.total || 0);
            realizedSales.totalRevenue += saleTotal;

            const items = sale.sale_items || [];
            if (items.length > 0) {
              items.forEach(it => {
                const q = Number(it.qty || 1);
                const cp = Number(it.cost_price || 0);
                const p = Number(it.price || 0);
                const lineProf = typeof it.line_profit === 'number' ? it.line_profit : (p - cp) * q;
                realizedSales.totalQuantitySold += q;
                realizedSales.totalCostSold += (cp * q);
                realizedSales.totalProfitRealized += lineProf;
              });
            } else {
              realizedSales.totalProfitRealized += Number(sale.profit || 0);
            }
          });
        }
      } catch {
        // continue
      }
    }

    return {
      success: true,
      data: {
        totalProducts: productList.length,
        totalStockUnits,
        totalCostValue,      // Modal toko tertanam (MURNI uang toko, konsinyasi = 0)
        totalRetailValue,    // Total nilai jual seluruh barang
        potentialProfit: storePotentialProfit, // Potensi laba toko
        overallMargin,
        outOfStockCount,
        lowStockCount,
        safeStockCount,

        // Statistik khusus Barang Titipan / Konsinyasi
        consignmentStats: {
          count: consignmentCount,
          totalUnits: consignmentUnits,
          storeCapital: 0,                  // Modal toko = 0
          payoutDue: consignmentPayoutDue,  // Nilai hak milik penitip
          potentialProfit: consignmentPotentialProfit, // Hak komisi toko
        },

        // Statistik Voucher
        voucherStats: {
          count: voucherCount,
          totalUnits: voucherUnits,
          costValue: voucherCostValue,
        },

        products: enrichedProducts,
        topValuedProducts: sortedByAsset.slice(0, 10),
        realizedSales,
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
