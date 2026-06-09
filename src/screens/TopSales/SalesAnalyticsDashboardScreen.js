import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { Text as SvgText } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import { Colors, FontSize, FontWeight, Spacing, Radii } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { getProfitAnalysis, getYearlyProfitAnalysis, getProfitAnalysisByRange } from '../../services/profitAnalysisSupabase';
import { 
    getDailyTransactionAnalysis, 
    getMonthlyTransactionAnalysis, 
    getYearlyTransactionAnalysis 
} from '../../services/transactionAnalysisSupabase';
import { formatIDR } from '../../utils/currency';

const screenWidth = Dimensions.get("window").width;

export default function SalesAnalyticsDashboardScreen({ navigation, route }) {
  const { user } = useAuth();
  const initialTab = route.params?.initialTab || 'profit'; // 'profit' | 'transaction'
  
  const [activeTab, setActiveTab] = useState(initialTab);
  const [loading, setLoading] = useState(true);
  const [availableYears, setAvailableYears] = useState([]);

  // --- PROFIT TAB STATE ---
  const [profitViewMode, setProfitViewMode] = useState('monthly'); // 'monthly' | 'yearly' | 'period'
  const [profitSelectedYear, setProfitSelectedYear] = useState(new Date().getFullYear());
  const [profitPeriodType, setProfitPeriodType] = useState('3m'); // '3m' | '6m' | '9m' | 'custom'
  const [profitCustomStartYear, setProfitCustomStartYear] = useState(new Date().getFullYear());
  const [profitCustomEndYear, setProfitCustomEndYear] = useState(new Date().getFullYear());
  const [profitChartData, setProfitChartData] = useState({
    labels: [],
    datasets: [{ data: [] }]
  });

  // --- TRANSACTION TAB STATE ---
  const [transViewMode, setTransViewMode] = useState('monthly'); // 'daily' | 'monthly' | 'yearly'
  const [transSelectedYear, setTransSelectedYear] = useState(new Date().getFullYear());
  const [transSelectedMonth, setTransSelectedMonth] = useState(new Date().getMonth() + 1); // 1-12
  const [transChartData, setTransChartData] = useState({
    labels: [],
    datasets: [{ data: [] }]
  });

  const months = [
    { id: 1, name: 'Jan' }, { id: 2, name: 'Feb' }, { id: 3, name: 'Mar' },
    { id: 4, name: 'Apr' }, { id: 5, name: 'Mei' }, { id: 6, name: 'Jun' },
    { id: 7, name: 'Jul' }, { id: 8, name: 'Ags' }, { id: 9, name: 'Sep' },
    { id: 10, name: 'Okt' }, { id: 11, name: 'Nov' }, { id: 12, name: 'Des' }
  ];

  const fullMonths = [
    { id: 1, name: 'Januari' }, { id: 2, name: 'Februari' }, { id: 3, name: 'Maret' },
    { id: 4, name: 'April' }, { id: 5, name: 'Mei' }, { id: 6, name: 'Juni' },
    { id: 7, name: 'Juli' }, { id: 8, name: 'Agustus' }, { id: 9, name: 'September' },
    { id: 10, name: 'Oktober' }, { id: 11, name: 'November' }, { id: 12, name: 'Desember' }
  ];

  // Sync initialTab if route parameters change
  useEffect(() => {
    if (route.params?.initialTab) {
      setActiveTab(route.params.initialTab);
    }
  }, [route.params?.initialTab]);

  // Load available years initially based on sales data
  useEffect(() => {
    const fetchYears = async () => {
      if (!user?.id) return;
      try {
        const { labels } = await getYearlyProfitAnalysis(user.id);
        if (labels && labels.length > 0) {
          const years = labels.map(y => parseInt(y));
          setAvailableYears(years);
          
          const currentYear = new Date().getFullYear();
          if (!years.includes(profitCustomStartYear)) setProfitCustomStartYear(Math.min(...years));
          if (!years.includes(profitCustomEndYear)) setProfitCustomEndYear(Math.max(...years));
        } else {
          setAvailableYears([new Date().getFullYear()]);
        }
      } catch (err) {
        setAvailableYears([new Date().getFullYear()]);
      }
    };
    fetchYears();
  }, [user?.id]);

  // Load Profit data
  const loadProfitData = async () => {
    if (!user?.id) return;
    try {
      if (profitViewMode === 'monthly') {
        const data = await getProfitAnalysis(user.id, profitSelectedYear);
        setProfitChartData({
          labels: ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"],
          datasets: [{ data }]
        });
      } else if (profitViewMode === 'yearly') {
        const { labels, data } = await getYearlyProfitAnalysis(user.id);
        setProfitChartData({
          labels,
          datasets: [{ data }]
        });
      } else if (profitViewMode === 'period') {
        let startDate, endDate;
        const now = new Date();

        if (profitPeriodType === 'custom') {
          startDate = `${profitCustomStartYear}-01-01`;
          endDate = `${profitCustomEndYear}-12-31`;
        } else {
          const monthsCount = parseInt(profitPeriodType);
          const start = new Date(now.getFullYear(), now.getMonth() - monthsCount + 1, 1);
          const end = new Date(now.getFullYear(), now.getMonth() + 1, 0); 
          
          const formatDate = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
          };
          startDate = formatDate(start);
          endDate = formatDate(end);
        }

        const { labels, data } = await getProfitAnalysisByRange(user.id, startDate, endDate);
        setProfitChartData({ labels, datasets: [{ data }] });
      }
    } catch (error) {
      console.error('Error loading profit data:', error);
    }
  };

  // Load Transaction data
  const loadTransactionData = async () => {
    if (!user?.id) return;
    try {
      if (transViewMode === 'daily') {
        const { labels, data } = await getDailyTransactionAnalysis(user.id, transSelectedMonth, transSelectedYear);
        setTransChartData({ labels, datasets: [{ data }] });
      } else if (transViewMode === 'monthly') {
        const { labels, data } = await getMonthlyTransactionAnalysis(user.id, transSelectedYear);
        setTransChartData({ labels, datasets: [{ data }] });
      } else if (transViewMode === 'yearly') {
        const { labels, data } = await getYearlyTransactionAnalysis(user.id);
        setTransChartData({ labels, datasets: [{ data }] });
      }
    } catch (error) {
      console.error('Error loading transaction data:', error);
    }
  };

  // Main data loader trigger
  const loadData = async () => {
    if (!user?.id) return;
    setLoading(true);
    if (activeTab === 'profit') {
      await loadProfitData();
    } else {
      await loadTransactionData();
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [
    user?.id, 
    activeTab, 
    profitViewMode, 
    profitSelectedYear, 
    profitPeriodType, 
    profitCustomStartYear, 
    profitCustomEndYear,
    transViewMode,
    transSelectedYear,
    transSelectedMonth
  ]);

  // Chart configuration presets
  const profitChartConfig = {
    backgroundGradientFrom: "#ffffff",
    backgroundGradientTo: "#ffffff",
    color: (opacity = 1) => `rgba(3, 172, 14, ${opacity})`, // Tokopedia Green for profit
    strokeWidth: 2.5,
    barPercentage: 0.5,
    useShadowColorFromDataset: false,
    decimalPlaces: 0,
    labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
    propsForDots: {
      r: "4",
      strokeWidth: "2",
      stroke: Colors.primary
    }
  };

  const transChartConfig = {
    backgroundGradientFrom: "#ffffff",
    backgroundGradientTo: "#ffffff",
    color: (opacity = 1) => `rgba(10, 132, 255, ${opacity})`, // Secondary Blue for transactions
    strokeWidth: 2.5,
    barPercentage: 0.5,
    useShadowColorFromDataset: false,
    decimalPlaces: 0,
    labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
    propsForDots: {
      r: "4",
      strokeWidth: "2",
      stroke: Colors.secondary
    }
  };

  // --- RENDER PROFIT PERIOD FILTER SUB-COMPONENT ---
  const renderProfitPeriodFilter = () => (
    <View style={styles.periodFilterContainer}>
      <View style={styles.chipContainer}>
        {['3m', '6m', '9m', 'custom'].map((type) => (
          <TouchableOpacity
            key={type}
            style={[styles.chip, profitPeriodType === type && styles.chipActive]}
            onPress={() => setProfitPeriodType(type)}
          >
            <Text style={[styles.chipText, profitPeriodType === type && styles.chipTextActive]}>
              {type === 'custom' ? 'Custom Range' : `${type.replace('m', '')} Bulan`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {profitPeriodType === 'custom' && (
        <View style={styles.customYearContainer}>
          <View style={styles.yearSelectorGroup}>
            <Text style={styles.yearSelectorLabel}>Dari:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {availableYears.map(year => (
                <TouchableOpacity
                  key={`start-${year}`}
                  style={[styles.yearMiniChip, profitCustomStartYear === year && styles.yearMiniChipActive]}
                  onPress={() => setProfitCustomStartYear(year)}
                >
                  <Text style={[styles.yearMiniText, profitCustomStartYear === year && styles.yearMiniTextActive]}>{year}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          <View style={[styles.yearSelectorGroup, { marginTop: 8 }]}>
            <Text style={styles.yearSelectorLabel}>Sampai:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {availableYears.map(year => (
                <TouchableOpacity
                  key={`end-${year}`}
                  style={[styles.yearMiniChip, profitCustomEndYear === year && styles.yearMiniChipActive]}
                  onPress={() => setProfitCustomEndYear(year)}
                >
                  <Text style={[styles.yearMiniText, profitCustomEndYear === year && styles.yearMiniTextActive]}>{year}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  );

  // --- RENDER TRANSACTION FILTERS SUB-COMPONENT ---
  const renderTransactionFilters = () => (
    <View style={styles.subFilterContainer}>
      {(transViewMode === 'daily' || transViewMode === 'monthly') && (
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>Tahun:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {availableYears.map(year => (
              <TouchableOpacity 
                key={year} 
                style={[styles.miniChip, transSelectedYear === year && styles.miniChipActive]}
                onPress={() => setTransSelectedYear(year)}
              >
                <Text style={[styles.miniChipText, transSelectedYear === year && styles.miniChipTextActive]}>{year}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {transViewMode === 'daily' && (
        <View style={[styles.filterRow, { marginTop: 8 }]}>
          <Text style={styles.filterLabel}>Bulan:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {fullMonths.map(m => (
              <TouchableOpacity 
                key={m.id} 
                style={[styles.miniChip, transSelectedMonth === m.id && styles.miniChipActive]}
                onPress={() => setTransSelectedMonth(m.id)}
              >
                <Text style={[styles.miniChipText, transSelectedMonth === m.id && styles.miniChipTextActive]}>{m.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Analisis Grafik</Text>
        <TouchableOpacity onPress={loadData} style={styles.refreshButton}>
          <Ionicons name="refresh" size={20} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Main Tab Segmented Controller */}
      <View style={styles.tabBar}>
        <TouchableOpacity 
          style={[styles.tabItem, activeTab === 'profit' && styles.tabItemActive]}
          onPress={() => {
            setActiveTab('profit');
            loadData();
          }}
        >
          <Ionicons 
            name="trending-up-outline" 
            size={18} 
            color={activeTab === 'profit' ? Colors.primary : Colors.muted} 
            style={{ marginRight: 6 }} 
          />
          <Text style={[styles.tabText, activeTab === 'profit' && styles.tabTextActive]}>Analisis Profit</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tabItem, activeTab === 'transaction' && styles.tabItemActive]}
          onPress={() => {
            setActiveTab('transaction');
            loadData();
          }}
        >
          <Ionicons 
            name="receipt-outline" 
            size={18} 
            color={activeTab === 'transaction' ? Colors.secondary : Colors.muted} 
            style={{ marginRight: 6 }} 
          />
          <Text style={[styles.tabText, activeTab === 'transaction' && styles.tabTextActive]}>Analisis Transaksi</Text>
        </TouchableOpacity>
      </View>

      {/* View Mode Filters Selector */}
      <View style={styles.filterSection}>
        {activeTab === 'profit' ? (
          <View>
            <View style={styles.toggleContainer}>
              <TouchableOpacity 
                style={[styles.toggleButton, profitViewMode === 'monthly' && styles.toggleActive]}
                onPress={() => setProfitViewMode('monthly')}
              >
                <Text style={[styles.toggleText, profitViewMode === 'monthly' && styles.toggleTextActive]}>Bulanan</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.toggleButton, profitViewMode === 'yearly' && styles.toggleActive]}
                onPress={() => setProfitViewMode('yearly')}
              >
                <Text style={[styles.toggleText, profitViewMode === 'yearly' && styles.toggleTextActive]}>Tahunan</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.toggleButton, profitViewMode === 'period' && styles.toggleActive]}
                onPress={() => setProfitViewMode('period')}
              >
                <Text style={[styles.toggleText, profitViewMode === 'period' && styles.toggleTextActive]}>Periode</Text>
              </TouchableOpacity>
            </View>

            {profitViewMode === 'monthly' && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.yearFilter}>
                {availableYears.map(year => (
                  <TouchableOpacity 
                    key={year} 
                    style={[styles.yearChip, profitSelectedYear === year && styles.yearChipActive]}
                    onPress={() => setProfitSelectedYear(year)}
                  >
                    <Text style={[styles.yearText, profitSelectedYear === year && styles.yearTextActive]}>{year}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {profitViewMode === 'period' && renderProfitPeriodFilter()}
          </View>
        ) : (
          <View>
            <View style={styles.toggleContainer}>
              <TouchableOpacity 
                style={[styles.toggleButton, transViewMode === 'daily' && styles.toggleActive]}
                onPress={() => setTransViewMode('daily')}
              >
                <Text style={[styles.toggleText, transViewMode === 'daily' && styles.toggleTextActive]}>Harian</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.toggleButton, transViewMode === 'monthly' && styles.toggleActive]}
                onPress={() => setTransViewMode('monthly')}
              >
                <Text style={[styles.toggleText, transViewMode === 'monthly' && styles.toggleTextActive]}>Bulanan</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.toggleButton, transViewMode === 'yearly' && styles.toggleActive]}
                onPress={() => setTransViewMode('yearly')}
              >
                <Text style={[styles.toggleText, transViewMode === 'yearly' && styles.toggleTextActive]}>Tahunan</Text>
              </TouchableOpacity>
            </View>

            {renderTransactionFilters()}
          </View>
        )}
      </View>

      {/* Main Content Area */}
      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={activeTab === 'profit' ? Colors.primary : Colors.secondary} />
            <Text style={styles.loadingText}>Memuat analisis grafik...</Text>
          </View>
        ) : activeTab === 'profit' ? (
          // --- PROFIT TAB LAYOUT ---
          <>
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>
                {profitViewMode === 'monthly' ? `Grafik Profit Tahun ${profitSelectedYear}` : 
                 profitViewMode === 'yearly' ? 'Grafik Profit Per Tahun' :
                 profitPeriodType === 'custom' ? `Grafik Profit ${profitCustomStartYear} - ${profitCustomEndYear}` :
                 `Grafik Profit ${profitPeriodType.replace('m', '')} Bulan Terakhir`}
              </Text>
              
              {profitChartData.datasets[0].data.length > 0 && !profitChartData.datasets[0].data.every(v => v === 0) ? (
                <View style={{ flexDirection: 'row', height: 260 }}>
                  {/* Fixed Y-Axis */}
                  <View style={styles.yAxisContainer}>
                    {[4, 3, 2, 1, 0].map((i) => {
                      const max = Math.max(...profitChartData.datasets[0].data);
                      const val = (max / 4) * i;
                      return (
                        <Text key={i} style={styles.yAxisLabel}>
                          {`Rp ${(val / 1000).toFixed(0)}k`}
                        </Text>
                      );
                    })}
                  </View>
                  
                  <ScrollView 
                    horizontal={true} 
                    showsHorizontalScrollIndicator={false}
                    style={{ marginLeft: -15 }}
                  >
                    <LineChart
                      data={profitChartData}
                      width={Math.max(screenWidth - 85, profitChartData.labels.length * 68)}
                      height={250}
                      verticalLabelRotation={profitViewMode === 'period' && profitChartData.labels.length > 6 ? 45 : 0}
                      xLabelsOffset={profitViewMode === 'period' && profitChartData.labels.length > 6 ? -10 : 0}
                      chartConfig={profitChartConfig}
                      bezier
                      style={styles.chart}
                      fromZero
                      withVerticalLabels={true}
                      withHorizontalLabels={false}
                      renderDotContent={({ x, y, index, indexData }) => (
                        <SvgText
                          key={index}
                          x={x}
                          y={y - 12}
                          fill={Colors.textPrimary}
                          fontSize="9"
                          fontWeight={FontWeight.bold}
                          textAnchor="middle"
                          fontFamily="Poppins"
                        >
                          {indexData >= 1000 ? `${(indexData / 1000).toFixed(0)}k` : indexData}
                        </SvgText>
                      )}
                    />
                  </ScrollView>
                </View>
              ) : (
                <View style={styles.noDataContainer}>
                  <Ionicons name="bar-chart-outline" size={48} color={Colors.muted} style={{ marginBottom: 8 }} />
                  <Text style={styles.noDataText}>Belum ada data profit untuk periode ini</Text>
                </View>
              )}
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Ringkasan Profit</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Profit Periode Ini</Text>
                <Text style={[styles.summaryValue, { color: Colors.success }]}>
                  {formatIDR(profitChartData.datasets[0].data.reduce((a, b) => a + b, 0))}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Rata-rata Profit</Text>
                <Text style={[styles.summaryValue, { color: Colors.success }]}>
                  {profitChartData.datasets[0].data.length > 0 
                    ? formatIDR(profitChartData.datasets[0].data.reduce((a, b) => a + b, 0) / (profitChartData.datasets[0].data.filter(v => v > 0).length || 1))
                    : formatIDR(0)
                  }
                </Text>
              </View>
            </View>
          </>
        ) : (
          // --- TRANSACTION TAB LAYOUT ---
          <>
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>
                {transViewMode === 'daily' ? `Transaksi ${fullMonths.find(m => m.id === transSelectedMonth)?.name} ${transSelectedYear}` : 
                 transViewMode === 'monthly' ? `Transaksi Tahun ${transSelectedYear}` :
                 'Transaksi Per Tahun'}
              </Text>
              
              {transChartData.datasets[0].data.length > 0 && !transChartData.datasets[0].data.every(v => v === 0) ? (
                <View style={{ flexDirection: 'row', height: 260 }}>
                  {/* Fixed Y-Axis */}
                  <View style={styles.yAxisContainer}>
                    {[4, 3, 2, 1, 0].map((i) => {
                      const max = Math.max(...transChartData.datasets[0].data);
                      const val = (max / 4) * i;
                      return (
                        <Text key={i} style={styles.yAxisLabel}>
                          {val.toFixed(0)}
                        </Text>
                      );
                    })}
                  </View>

                  <ScrollView 
                    horizontal={true} 
                    showsHorizontalScrollIndicator={false}
                    style={{ marginLeft: -15 }}
                  >
                    <LineChart
                      data={transChartData}
                      width={Math.max(screenWidth - 85, transChartData.labels.length * 55)}
                      height={250}
                      chartConfig={transChartConfig}
                      style={styles.chart}
                      fromZero
                      bezier
                      withVerticalLabels={true}
                      withHorizontalLabels={false}
                      renderDotContent={({ x, y, index, indexData }) => (
                        <SvgText
                          key={index}
                          x={x}
                          y={y - 12}
                          fill={Colors.textPrimary}
                          fontSize="9"
                          fontWeight={FontWeight.bold}
                          textAnchor="middle"
                          fontFamily="Poppins"
                        >
                          {indexData.toFixed(0)}
                        </SvgText>
                      )}
                    />
                  </ScrollView>
                </View>
              ) : (
                <View style={styles.noDataContainer}>
                  <Ionicons name="receipt-outline" size={48} color={Colors.muted} style={{ marginBottom: 8 }} />
                  <Text style={styles.noDataText}>Belum ada data transaksi untuk periode ini</Text>
                </View>
              )}
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Ringkasan Transaksi</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Transaksi</Text>
                <Text style={[styles.summaryValue, { color: Colors.secondary }]}>
                  {transChartData.datasets[0].data.reduce((a, b) => a + b, 0)}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Rata-rata Transaksi</Text>
                <Text style={[styles.summaryValue, { color: Colors.secondary }]}>
                  {transChartData.datasets[0].data.length > 0 
                    ? (transChartData.datasets[0].data.reduce((a, b) => a + b, 0) / (transChartData.datasets[0].data.filter(v => v > 0).length || 1)).toFixed(1)
                    : 0
                  }
                </Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    padding: 4,
  },
  refreshButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    fontFamily: 'Poppins',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.medium,
    color: Colors.muted,
    fontFamily: 'Poppins',
  },
  tabTextActive: {
    color: Colors.textPrimary,
    fontWeight: FontWeight.bold,
  },
  filterSection: {
    backgroundColor: Colors.card,
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: Radii.sm,
    padding: 4,
    marginBottom: Spacing.md,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: Radii.xs,
  },
  toggleActive: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  toggleText: {
    fontSize: FontSize.caption,
    color: Colors.muted,
    fontWeight: FontWeight.semibold,
    fontFamily: 'Poppins',
  },
  toggleTextActive: {
    color: Colors.textPrimary,
  },
  yearFilter: {
    flexDirection: 'row',
  },
  yearChip: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: Radii.pill,
    backgroundColor: Colors.background,
    marginRight: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  yearChipActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  yearText: {
    fontSize: FontSize.caption,
    color: Colors.text,
    fontFamily: 'Poppins',
  },
  yearTextActive: {
    color: Colors.primary,
    fontWeight: FontWeight.bold,
  },
  periodFilterContainer: {
    marginTop: 4,
  },
  chipContainer: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radii.pill,
    backgroundColor: Colors.background,
    marginRight: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: FontSize.xs,
    color: Colors.text,
    fontFamily: 'Poppins',
  },
  chipTextActive: {
    color: Colors.primary,
    fontWeight: FontWeight.bold,
  },
  customYearContainer: {
    backgroundColor: Colors.background,
    padding: 8,
    borderRadius: Radii.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  yearSelectorGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  yearSelectorLabel: {
    fontSize: FontSize.xs,
    color: Colors.muted,
    marginRight: 8,
    width: 50,
    fontFamily: 'Poppins',
  },
  yearMiniChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.xs,
    backgroundColor: Colors.card,
    marginRight: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  yearMiniChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  yearMiniText: {
    fontSize: FontSize.xs,
    color: Colors.text,
    fontFamily: 'Poppins',
  },
  yearMiniTextActive: {
    color: Colors.white,
  },
  subFilterContainer: {
    marginTop: 4,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterLabel: {
    fontSize: FontSize.caption,
    color: Colors.muted,
    marginRight: 8,
    width: 48,
    fontFamily: 'Poppins',
  },
  miniChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radii.sm,
    backgroundColor: Colors.background,
    marginRight: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  miniChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  miniChipText: {
    fontSize: FontSize.caption,
    color: Colors.text,
    fontFamily: 'Poppins',
  },
  miniChipTextActive: {
    color: Colors.white,
    fontWeight: FontWeight.bold,
  },
  content: {
    padding: Spacing.lg,
  },
  chartCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chartTitle: {
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.lg,
    fontFamily: 'Poppins',
  },
  chart: {
    marginVertical: 8,
    borderRadius: 12,
  },
  yAxisContainer: {
    justifyContent: 'space-between', 
    paddingTop: 10, 
    paddingBottom: 30,
    width: 65, 
    alignItems: 'flex-end',
    paddingRight: 8,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    backgroundColor: Colors.card,
    zIndex: 10,
  },
  yAxisLabel: {
    fontSize: 9, 
    color: Colors.muted, 
    textAlign: 'right',
    fontFamily: 'Poppins',
  },
  noDataContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  noDataText: {
    color: Colors.muted,
    fontSize: FontSize.body,
    fontFamily: 'Poppins',
    textAlign: 'center',
  },
  summaryCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  summaryTitle: {
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
    fontFamily: 'Poppins',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  summaryLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.body,
    fontFamily: 'Poppins',
  },
  summaryValue: {
    fontWeight: FontWeight.bold,
    fontSize: FontSize.bodyLg,
    fontFamily: 'Poppins',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: Spacing.sm,
    color: Colors.muted,
    fontSize: FontSize.body,
    fontFamily: 'Poppins',
  },
});
