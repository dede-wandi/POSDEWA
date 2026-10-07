import React from 'react';
import { ActivityIndicator, View, Text, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from './src/theme';
import { enableScreens } from 'react-native-screens';
import { NavigationContainer, getStateFromPath } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Linking from 'expo-linking';

import ListScreen from './src/screens/Products/ListScreen';
import FormScreen from './src/screens/Products/FormScreen';
import ProductReportScreen from './src/screens/ProductReportScreen';
import ProductChangeLogScreen from './src/screens/Products/ProductChangeLogScreen';
import PublicProductsAdminListScreen from './src/screens/PublicProducts/AdminListScreen';
import PublicProductsAdminFormScreen from './src/screens/PublicProducts/AdminFormScreen';
import PublicProductsPublicListScreen from './src/screens/PublicProducts/PublicListScreen';
import PublicDetailScreen from './src/screens/PublicProducts/PublicDetailScreen';
import PublicProductsStockScreen from './src/screens/PublicProducts/PublicProductsStockScreen';
import BarcodeScanScreen from './src/screens/Scan/BarcodeScanScreen';
import SalesScreen from './src/screens/Sales/SalesScreen';
import ProductListScreen from './src/screens/Sales/ProductListScreen';
import PaymentScreen from './src/screens/Sales/PaymentScreen';
import InvoiceScreen from './src/screens/Sales/InvoiceScreen';
import HistoryScreen from './src/screens/Sales/HistoryScreen';
import AuthScreen from './src/screens/Auth/AuthScreen';
import AccountScreen from './src/screens/Auth/AccountScreen';
import ProfileEditScreen from './src/screens/Auth/ProfileEditScreen';
import InvoiceSettingsScreen from './src/screens/Settings/InvoiceSettingsScreen';
import WhatsAppSettingsScreen from './src/screens/Settings/WhatsAppSettingsScreen';
import PaymentChannelsScreen from './src/screens/Settings/PaymentChannelsScreen';
import MenuSettingsScreen from './src/screens/Settings/MenuSettingsScreen';
import TopSalesMenuScreen from './src/screens/TopSales/TopSalesMenuScreen';
import TopListScreen from './src/screens/TopSales/TopListScreen';
import SalesAnalyticsDashboardScreen from './src/screens/TopSales/SalesAnalyticsDashboardScreen';
import AnnualProfitReportScreen from './src/screens/AnnualProfitReportScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import MoreMenuScreen from './src/screens/MoreMenuScreen';

import StockManagementScreen from './src/screens/StockManagementScreen';
import SalesAnalyticsScreen from './src/screens/SalesAnalyticsScreen';
import WalletManagementScreen from './src/screens/Wallets/WalletManagementScreen'; // IMPORT WALLETS

import TransactionHistoryScreen from './src/screens/TransactionHistoryScreen';
import SalesReportScreen from './src/screens/SalesReportScreen';
import SplashScreen from './src/screens/SplashScreen';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { CartProvider } from './src/contexts/CartContext';
import { ToastProvider } from './src/contexts/ToastContext';
import ErrorBoundary from './src/components/ErrorBoundary';
import AntiGoresStockScreen from './src/screens/AntiGoresStockScreen';
import ProductAssetValuationScreen from './src/screens/Products/ProductAssetValuationScreen';
import ExpensesScreen from './src/screens/Finance/ExpensesScreen';
import CashReconciliationScreen from './src/screens/Finance/CashReconciliationScreen';

enableScreens(true);

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function ProductsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="DaftarProduk" component={ListScreen} options={{ headerShown: false }} />
      <Stack.Screen name="FormProduk" component={FormScreen} options={{ title: 'From Produk' }} />
      <Stack.Screen name="ProductReport" component={ProductReportScreen} options={{ title: 'Report Produk' }} />
      <Stack.Screen name="ProductChangeLog" component={ProductChangeLogScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="PublicProductsAdmin"
        component={PublicProductsAdminListScreen}
        options={({ navigation }) => ({
          title: 'Produk Publik',
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={{ paddingHorizontal: 8 }}
            >
              <Ionicons name="arrow-back" size={20} color={Colors.primary} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity
                onPress={() => navigation.navigate('PublicProductsStock')}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: Colors.primary,
                  marginRight: 8,
                  backgroundColor: 'transparent',
                }}
              >
                <Text style={{ color: Colors.primary, fontSize: 12, fontWeight: '600' }}>
                  Stok
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => navigation.navigate('PublicProductForm')}
                style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, backgroundColor: Colors.primary, borderRadius: 16, marginRight: 8 }}
              >
                <Ionicons name="add-circle" size={18} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600', marginLeft: 4 }}>Tambah</Text>
              </TouchableOpacity>
            </View>
          ),
        })}
      />
      <Stack.Screen name="PublicProductForm" component={PublicProductsAdminFormScreen} options={{ title: 'Form Produk Publik', headerShown: false }} />
      <Stack.Screen
        name="PublicProductsStock"
        component={PublicProductsStockScreen}
        options={{ title: 'Stok Produk Publik' }}
      />
    </Stack.Navigator>
  );
}

function SalesStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Penjualan" component={SalesScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ProductList" component={ProductListScreen} options={{ title: 'Pilih Produk' }} />
      <Stack.Screen name="Payment" component={PaymentScreen} options={{ title: 'Pembayaran' }} />
      <Stack.Screen name="Invoice" component={InvoiceScreen} options={{ title: 'Invoice' }} />
    </Stack.Navigator>
  );
}

// Custom Tab Bar Icon Component
// Use Ionicons for a more professional tab bar appearance

function MainTabs() {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.muted,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
        },
        tabBarIconStyle: {
        },
        tabBarIcon: ({ focused, color }) => {
          let iconName = 'ellipse';
          switch (route.name) {
            case 'Home':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'Produk':
              iconName = focused ? 'cube' : 'cube-outline';
              break;
            case 'Stok':
              iconName = focused ? 'layers' : 'layers-outline';
              break;
            case 'Akun':
              iconName = focused ? 'person' : 'person-outline'; // Changed to simpler person icon
              break;
          }

          if (route.name === 'Penjualan') {
            return (
              <View style={{
                position: 'absolute',
                top: Platform.OS === 'android' ? -24 : -20,
                width: 64,
                height: 64,
                backgroundColor: Colors.primary,
                borderRadius: 32,
                justifyContent: 'center',
                alignItems: 'center',
                shadowColor: Colors.primary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 5,
                elevation: 6,
                borderWidth: 4,
                borderColor: '#ffffff',
              }}>
                <Ionicons name="cart" size={30} color="#FFFFFF" />
              </View>
            );
          }
          return <Ionicons name={iconName} size={22} color={color} />;
        },
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#e9ecef',
          // Responsif terhadap safe area di perangkat dengan notch / navigasi tombol
          height: insets.bottom > 0 ? (60 + insets.bottom) : 60,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 5,
          paddingTop: 5,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
          elevation: 5,
        },
        tabBarHideOnKeyboard: true,
        tabBarLabelPosition: 'below-icon',
        tabBarShowLabel: true,
      })}
    >
      <Tab.Screen name="Home" component={DashboardScreen} options={{ tabBarLabel: 'Home' }} />
      <Tab.Screen name="Produk" component={ProductsStack} options={{ tabBarLabel: 'Produk' }} />
      <Tab.Screen name="Penjualan" component={SalesStack} options={{ tabBarLabel: () => null }} />
      <Tab.Screen name="Stok" component={StockManagementScreen} options={{ tabBarLabel: 'Stok' }} />
      <Tab.Screen name="Akun" component={AccountScreen} options={{ tabBarLabel: 'Akun' }} />
    </Tab.Navigator>
  );
}

function MainStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabs} />
      {/* Tetap sediakan screen Stock & Finance, tetapi tidak muncul di Tab Bar */}
      <Stack.Screen
        name="Scan"
        component={BarcodeScanScreen}
        options={{
          title: 'Scan Barcode',
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="MoreMenu"
        component={MoreMenuScreen}
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="StockManagement"
        component={StockManagementScreen}
        options={{
          presentation: 'modal',
          headerShown: false,
          title: 'Manajemen Stok',
        }}
      />
      <Stack.Screen
        name="SalesAnalytics"
        component={SalesAnalyticsScreen}
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="History"
        component={HistoryScreen}
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="TransactionHistory"
        component={TransactionHistoryScreen}
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="WalletManagement"
        component={WalletManagementScreen}
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="SalesReport"
        component={SalesReportScreen}
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="InvoiceSettings"
        component={InvoiceSettingsScreen}
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="WhatsAppSettings"
        component={WhatsAppSettingsScreen}
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="MenuSettings"
        component={MenuSettingsScreen}
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="PaymentChannels"
        component={PaymentChannelsScreen}
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="TopSales"
        component={TopSalesMenuScreen}
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="TopList"
        component={TopListScreen}
        options={{
          presentation: 'card',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="SalesAnalyticsDashboard"
        component={SalesAnalyticsDashboardScreen}
        options={{
          presentation: 'card',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="AnnualProfitReport"
        component={AnnualProfitReportScreen}
        options={{
          presentation: 'card',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="AntiGoresStock"
        component={AntiGoresStockScreen}
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="ProductAssetValuation"
        component={ProductAssetValuationScreen}
        options={{
          presentation: 'card',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Expenses"
        component={ExpensesScreen}
        options={{
          presentation: 'card',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Finance"
        component={ExpensesScreen}
        options={{
          presentation: 'card',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="CashReconciliation"
        component={CashReconciliationScreen}
        options={{
          presentation: 'card',
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="ProfileEdit"
        component={ProfileEditScreen}
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
}

function AppNavigator() {
  const { user, loading: authLoading } = useAuth();
  const [splashLoading, setSplashLoading] = React.useState(Platform.OS !== 'web');

  React.useEffect(() => {
    if (Platform.OS === 'web') {
      setSplashLoading(false);
      return;
    }
    const timer = setTimeout(() => {
      setSplashLoading(false);
    }, 3500); // 3.5 seconds minimum splash on mobile only
    return () => clearTimeout(timer);
  }, []);

  const isLoading = authLoading || splashLoading;

  console.log('🏠 App: Navigation state', { hasUser: !!user, userEmail: user?.email, authLoading, splashLoading });

  if (isLoading) {
    console.log('⏳ App: Showing loading screen');
    return <SplashScreen />;
  }

  console.log('🧭 App: Rendering navigation', user ? 'Main Stack' : 'Auth Screen');

  const linking = {
    prefixes: [Linking.createURL('/'), 'posdewa://'],
    config: {
      screens: {
        // Not logged-in stack
        Auth: '',
        // Logged-in stack and nested tabs
        MainTabs: {
          screens: {
            Home: 'dashboard',
            Produk: {
              screens: {
                DaftarProduk: 'produk-admin',
                PublicProductsAdmin: 'produk-publik-admin',
                PublicProductForm: 'produk-publik-admin/form',
                ProductReport: 'produk/report/:id?',
                FormProduk: 'produk/form/:id?',
                ProductChangeLog: 'produk/log',
              },
            },
            Penjualan: 'penjualan',
            Akun: 'akun',
          },
        },
        // Modals/routes accessible when logged-in
        Scan: 'scan',
        StockManagement: 'stok',
        SalesAnalytics: 'analitik',
        History: 'riwayat',
        AnnualProfitReport: 'laporan-profit-tahunan',
        SalesAnalyticsDashboard: 'analisis-dashboard',
        TransactionHistory: 'riwayat-transaksi',
        InvoiceSettings: 'pengaturan-invoice',
        WhatsAppSettings: 'pengaturan-whatsapp',
        MenuSettings: 'pengaturan-menu',
        ProfileEdit: 'profil/edit',
        ProductAssetValuation: 'ProductAssetValuation',
        Expenses: 'Expenses',
        Finance: 'Finance',
        CashReconciliation: 'CashReconciliation',
        SalesReport: 'SalesReport',
        AntiGoresStock: 'AntiGoresStock',
        PaymentChannels: 'PaymentChannels',
        TopSales: 'TopSales',
        TopList: 'TopList',
        MoreMenu: 'MoreMenu',
      },
    },
    getStateFromPath(path, options) {
      const cleanPath = (path || '').replace(/^\/+/, '').split('?')[0].split('#')[0];
      const lower = cleanPath.toLowerCase();

      if (
        lower === 'productassetvaluation' ||
        lower === 'product-asset-valuation' ||
        lower === 'valuasi-produk' ||
        lower === 'valuasi-stok'
      ) {
        return {
          routes: [{ name: 'ProductAssetValuation' }],
        };
      }
      if (lower === 'expenses' || lower === 'pengeluaran') {
        return {
          routes: [{ name: 'Expenses' }],
        };
      }
      if (lower === 'finance' || lower === 'keuangan') {
        return {
          routes: [{ name: 'Finance' }],
        };
      }
      if (
        lower === 'cashreconciliation' ||
        lower === 'cash-reconciliation' ||
        lower === 'rekonsiliasi-kas'
      ) {
        return {
          routes: [{ name: 'CashReconciliation' }],
        };
      }
      if (
        lower === 'salesreport' ||
        lower === 'sales-report' ||
        lower === 'laporan-penjualan'
      ) {
        return {
          routes: [{ name: 'SalesReport' }],
        };
      }

      return getStateFromPath(path, options);
    },
  };

  return (
    <NavigationContainer linking={linking}>
      {user ? (
        <MainStack />
      ) : (
        <Stack.Navigator>
          <Stack.Screen
            name="Auth"
            component={AuthScreen}
            options={{ headerShown: false }}
          />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <CartProvider>
          <SafeAreaProvider>
            <ErrorBoundary>
              <AppNavigator />
            </ErrorBoundary>
          </SafeAreaProvider>
        </CartProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
