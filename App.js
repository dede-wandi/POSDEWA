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
import DashboardScreen from './src/screens/DashboardScreen';
import MoreMenuScreen from './src/screens/MoreMenuScreen';
import StockManagementScreen from './src/screens/StockManagementScreen';
import SalesAnalyticsScreen from './src/screens/SalesAnalyticsScreen';
import FinanceScreen from './src/screens/FinanceScreen';
import TransactionHistoryScreen from './src/screens/TransactionHistoryScreen';
import TransactionReportScreen from './src/screens/TransactionReportScreen';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { CartProvider } from './src/contexts/CartContext';
import ErrorBoundary from './src/components/ErrorBoundary';
import CartScreen from './src/screens/PublicProducts/CartScreen';

enableScreens(true);

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function ProductsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="DaftarProduk" component={ListScreen} options={{ title: 'Produk' }} />
      <Stack.Screen name="FormProduk" component={FormScreen} options={{ title: 'Form Produk' }} />
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
      <Stack.Screen name="Penjualan" component={SalesScreen} options={{ title: 'Penjualan' }} />
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
          fontSize: 11,
          fontWeight: '600',
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
            case 'Scan':
              iconName = focused ? 'scan' : 'scan-outline';
              break;
            case 'Penjualan':
              iconName = focused ? 'cash' : 'cash-outline';
              break;
            case 'StockManagement':
              iconName = focused ? 'clipboard' : 'clipboard-outline';
              break;
            case 'Finance':
              iconName = focused ? 'card' : 'card-outline';
              break;
            case 'Akun':
              iconName = focused ? 'person-circle' : 'person-circle-outline';
              break;
          }
          return <Ionicons name={iconName} size={24} color={color} />;
        },
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#e9ecef',
          // Responsif terhadap safe area di perangkat dengan notch / gesture navigation
          paddingBottom: Math.max(8, insets.bottom),
          paddingTop: 6,
          minHeight: 56,
        },
        tabBarHideOnKeyboard: true,
      })}
    >
      <Tab.Screen name="Home" component={DashboardScreen} options={{ title: 'Home' }} />
      <Tab.Screen name="Produk" component={ProductsStack} options={{ title: 'Produk' }} />
      <Tab.Screen 
        name="Scan" 
        component={BarcodeScanScreen} 
        options={{ 
          title: 'Scan',
          tabBarLabel: '',
          tabBarButton: (props) => (
            <TouchableOpacity
              {...props}
              style={{
                position: 'relative',
                top: -16,
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: Colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.25,
                shadowRadius: 8,
                elevation: 8,
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="scan" size={28} color="#fff" />
            </TouchableOpacity>
          ),
        }} 
      />
      <Tab.Screen name="Penjualan" component={SalesStack} options={{ title: 'Penjualan' }} />
      <Tab.Screen name="Akun" component={AccountScreen} options={{ title: 'Akun' }} />
    </Tab.Navigator>
  );
}

function MainStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabs} />
      {/* Tetap sediakan screen Stock & Finance, tetapi tidak muncul di Tab Bar */}
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
        name="TransactionReport" 
        component={TransactionReportScreen}
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
  const { user, loading } = useAuth();

  console.log('🏠 App: Navigation state', { hasUser: !!user, userEmail: user?.email, loading });

  if (loading) {
    console.log('⏳ App: Showing loading screen');
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  console.log('🧭 App: Rendering navigation', user ? 'Main Stack' : 'Auth Screen');

  const linking = {
    prefixes: [Linking.createURL('/')],
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
            Scan: 'scan',
          },
        },
        // Modals/routes accessible when logged-in
        StockManagement: 'stok',
        Finance: 'keuangan',
        SalesAnalytics: 'analitik',
        History: 'riwayat',
        TransactionHistory: 'riwayat-transaksi',
        TransactionReport: 'laporan-transaksi',
        InvoiceSettings: 'pengaturan-invoice',
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
      <CartProvider>
        <SafeAreaProvider>
          <ErrorBoundary>
            <AppNavigator />
          </ErrorBoundary>
        </SafeAreaProvider>
      </CartProvider>
    </AuthProvider>
  );
}
