import re

with open('src/screens/DashboardScreen.js', 'r') as f:
    content = f.read()

# 1. Update SaleItem component
new_sale_item = """  const SaleItem = ({ sale }) => (
    <TouchableOpacity
      style={styles.saleItem}
      onPress={() => navigation.navigate('History')}
      activeOpacity={0.7}
    >
      <View style={styles.saleItemLeft}>
        <View style={styles.saleItemIconBg}>
          <Ionicons name="receipt" size={18} color={Colors.primary} />
        </View>
        <View style={styles.saleItemTextContainer}>
          <Text style={styles.saleItemInvoice}>{sale.no_invoice || `#${sale.id.substring(0, 8)}`}</Text>
          <Text style={styles.saleItemDate}>{formatDateString(sale.created_at)}</Text>
        </View>
      </View>
      <View style={styles.saleItemRight}>
        <Text style={styles.saleItemTotal}>{formatCurrency(sale.total)}</Text>
        <Text style={styles.saleItemProfit}>+{formatCurrency(sale.profit)}</Text>
      </View>
    </TouchableOpacity>
  );"""

content = re.sub(r'  const SaleItem = \(\{ sale \}\) => \([\s\S]*?    </TouchableOpacity>\n  \);', new_sale_item, content)

# 2. Update styles
styles_updates = {
    r'  saleItem: \{[\s\S]*?\},': """  saleItem: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 3,
  },
  saleItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  saleItemIconBg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primaryLight || '#FDF2F8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  saleItemTextContainer: {
    justifyContent: 'center',
  },
  saleItemInvoice: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  saleItemDate: {
    fontSize: FontSize.xs,
    color: Colors.muted,
  },
  saleItemRight: {
    alignItems: 'flex-end',
  },
  saleItemTotal: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  saleItemProfit: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: '#03AC0E',
  },""",
    r'  walletCard: \{[\s\S]*?\},': """  walletCard: {
    backgroundColor: Colors.primary,
    borderRadius: 30,
    padding: 24,
    marginHorizontal: Spacing.lg,
    marginTop: 20,
    overflow: 'hidden',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 8,
  },
  walletCardBgCircle1: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.1)',
    top: -50,
    right: -50,
  },
  walletCardBgCircle2: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255,255,255,0.05)',
    bottom: -30,
    left: -30,
  },
  walletContent: {
    position: 'relative',
    zIndex: 1,
  },
  walletTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },""",
    r'  statCard: \{[\s\S]*?\},': """  statCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 3,
  },"""
}

for old, new_s in styles_updates.items():
    content = re.sub(old, new_s, content)

# 3. Update Wallet Card JSX
new_wallet = """        <View style={styles.walletCard}>
          <View style={styles.walletCardBgCircle1} />
          <View style={styles.walletCardBgCircle2} />
          <View style={styles.walletContent}>
            <View style={styles.walletTopRow}>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: FontSize.sm }}>{getBusinessName()}</Text>
              <Ionicons name="ellipsis-horizontal" size={20} color="white" />
            </View>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: FontSize.sm, marginBottom: 4 }}>Total Saldo / Penjualan</Text>
            <Text style={{ color: 'white', fontSize: 32, fontWeight: 'bold', marginBottom: 24 }}>{formatCurrency(stats?.today?.profit)}</Text>
            
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <TouchableOpacity onPress={() => navigation.navigate('Penjualan')} style={{ alignItems: 'center' }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                  <Ionicons name="cart" size={20} color="white" />
                </View>
                <Text style={{ color: 'white', fontSize: FontSize.xs }}>Kasir</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.navigate('AnnualProfitReport')} style={{ alignItems: 'center' }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                  <Ionicons name="trending-up" size={20} color="white" />
                </View>
                <Text style={{ color: 'white', fontSize: FontSize.xs }}>Keuangan</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.navigate('History')} style={{ alignItems: 'center' }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                  <Ionicons name="time" size={20} color="white" />
                </View>
                <Text style={{ color: 'white', fontSize: FontSize.xs }}>Riwayat</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>"""

content = re.sub(r'        \{\/\* GoFood/GoPay Wallet Style Financial Card \*\/\}[\s\S]*?        \{\/\* Menu Grid \(Tokopedia Style Shortcuts\) \*\/\}', new_wallet + '\n\n        {/* Menu Grid (Tokopedia Style Shortcuts) */}', content)

with open('src/screens/DashboardScreen.js', 'w') as f:
    f.write(content)
