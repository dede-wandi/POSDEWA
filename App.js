import React from 'react';
import { ActivityIndicator, View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from './src/theme';
import { enableScreens } from 'react-native-screens';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Linking from 'expo-linking';

import ListScreen from './src/screens/Products/ListScreen';
import FormScreen from './src/screens/Products/FormScreen';
import ProductReportScreen from './src/screens/ProductReportScreen';
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
import CustomInvoiceListScreen from './src/screens/Settings/CustomInvoiceListScreen';
import CustomInvoiceFormScreen from './src/screens/Settings/CustomInvoiceFormScreen';
import PaymentChannelsScreen from './src/screens/Settings/PaymentChannelsScreen';
import TopSalesMenuScreen from './src/screens/TopSales/TopSalesMenuScreen';
import TopListScreen from './src/screens/TopSales/TopListScreen';
import ProfitAnalysisScreen from './src/screens/TopSales/ProfitAnalysisScreen';
import TransactionAnalysisScreen from './src/screens/TopSales/TransactionAnalysisScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import MoreMenuScreen from './src/screens/MoreMenuScreen';
import StockManagementScreen from './src/screens/StockManagementScreen';
import SalesAnalyticsScreen from './src/screens/SalesAnalyticsScreen';
import FinanceScreen from './src/screens/FinanceScreen';
import TransactionHistoryScreen from './src/screens/TransactionHistoryScreen';
import SalesReportScreen from './src/screens/SalesReportScreen';
import SplashScreen from './src/screens/SplashScreen';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { CartProvider } from './src/contexts/CartContext';
import { ToastProvider } from './src/contexts/ToastContext';
import ErrorBoundary from './src/components/ErrorBoundary';
import CartScreen from './src/screens/PublicProducts/CartScreen';

enableScreens(true);

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function ProductsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="DaftarProduk" component={ListScreen} options={{ headerShown: false }} />
      <Stack.Screen name="FormProduk" component={FormScreen} options={{ title: 'From Produk' }} />
      <Stack.Screen name="ProductReport" component={ProductReportScreen} options={{ title: 'Report Produk' }} />
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
          marginBottom: 6,
          display: 'flex', // Ensure label is displayed
        },
        tabBarIconStyle: {
          marginTop: 4,
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
            case 'Penjualan':
              iconName = focused ? 'cart' : 'cart-outline'; // Changed to cart for sales
              break;
            case 'Akun':
              iconName = focused ? 'person' : 'person-outline'; // Changed to simpler person icon
              break;
          }
          return <Ionicons name={iconName} size={22} color={color} />;
        },
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#e9ecef',
          // Responsif terhadap safe area di perangkat dengan notch / gesture navigation
          height: 65, // Increased height slightly to accommodate labels
          paddingBottom: Math.max(12, insets.bottom),
          paddingTop: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
          elevation: 5,
        },
        tabBarHideOnKeyboard: true,
        tabBarShowLabel: true, // Explicitly enable labels
      })}
    >
      <Tab.Screen name="Home" component={DashboardScreen} options={{ tabBarLabel: 'Home' }} />
      <Tab.Screen name="Produk" component={ProductsStack} options={{ tabBarLabel: 'Produk' }} />
      <Tab.Screen name="Penjualan" component={SalesStack} options={{ tabBarLabel: 'Penjualan' }} />
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
        name="Finance" 
        component={FinanceScreen}
        options={{
          presentation: 'modal',
          headerShown: true,
          title: 'Keuangan',
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
        name="CustomInvoiceList" 
        component={CustomInvoiceListScreen}
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="CustomInvoiceForm" 
        component={CustomInvoiceFormScreen}
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
        name="ProfitAnalysis" 
        component={ProfitAnalysisScreen}
        options={{
          presentation: 'card',
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="TransactionAnalysis" 
        component={TransactionAnalysisScreen}
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
  const [splashLoading, setSplashLoading] = React.useState(true);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setSplashLoading(false);
    }, 3500); // 3.5 seconds minimum splash
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
        PublicProducts: '',
        PublicProductDetail: 'produk/:id',
        Auth: 'admin',
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
              },
            },
            Penjualan: 'penjualan',
            Akun: 'akun',
          },
        },
        // Modals/routes accessible when logged-in
        Scan: 'scan',
        StockManagement: 'stok',
        Finance: 'keuangan',
        SalesAnalytics: 'analitik',
        History: 'riwayat',
        TransactionHistory: 'riwayat-transaksi',
        InvoiceSettings: 'pengaturan-invoice',
        WhatsAppSettings: 'pengaturan-whatsapp',
        ProfileEdit: 'profil/edit',
      },
    },
  };

  return (
    <NavigationContainer linking={linking}>
      {user ? (
        <MainStack />
      ) : (
        <Stack.Navigator>
          <Stack.Screen
            name="PublicProducts"
            component={PublicProductsPublicListScreen}
            options={{
              title: 'Katalog Produk',
            }}
          />
          <Stack.Screen
            name="PublicProductDetail"
            component={PublicDetailScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Cart"
            component={CartScreen}
            options={{ headerShown: false }}
          />
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
