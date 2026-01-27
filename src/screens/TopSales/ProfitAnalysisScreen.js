import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { Text as SvgText } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import { Colors } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { getProfitAnalysis, getYearlyProfitAnalysis, getProfitAnalysisByRange } from '../../services/profitAnalysisSupabase';
import { formatIDR } from '../../utils/currency';

const screenWidth = Dimensions.get("window").width;

export default function ProfitAnalysisScreen({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  
  // viewMode: 'monthly' (per tahun), 'yearly' (antar tahun), 'period' (rentang custom/preset)
  const [viewMode, setViewMode] = useState('monthly'); 
  
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  // State for Period Mode
  const [periodType, setPeriodType] = useState('3m'); // '3m' | '6m' | '9m' | 'custom'
  const [customStartYear, setCustomStartYear] = useState(new Date().getFullYear());
  const [customEndYear, setCustomEndYear] = useState(new Date().getFullYear());

  const [chartData, setChartData] = useState({
    labels: [],
    datasets: [{ data: [] }]
  });
  const [availableYears, setAvailableYears] = useState([]);

  const loadData = async () => {
    if (!user?.id) return;
    setLoading(true);
    
    try {
      if (viewMode === 'monthly') {
        const data = await getProfitAnalysis(user.id, selectedYear);
        setChartData({
          labels: ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"],
          datasets: [{ data }]
        });
      } else if (viewMode === 'yearly') {
        const { labels, data } = await getYearlyProfitAnalysis(user.id);
        setChartData({
          labels,
          datasets: [{ data }]
        });
        setAvailableYears(labels.map(y => parseInt(y)));
      } else if (viewMode === 'period') {
        let startDate, endDate;
        const now = new Date();

        if (periodType === 'custom') {
            // Rentang Tahun: Start Jan - End Des
            startDate = `${customStartYear}-01-01`;
            endDate = `${customEndYear}-12-31`;
        } else {
            // Preset N bulan terakhir
            const months = parseInt(periodType); // 3, 6, 9
            // Logic: Dari (Bulan ini - N + 1) sampai (Bulan ini)
            // Contoh: Sekarang Oktober. 3 Bulan -> Agustus, September, Oktober.
            const start = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
            // End date is end of current month
            const end = new Date(now.getFullYear(), now.getMonth() + 1, 0); 
            
            // Format YYYY-MM-DD (Local Time)
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
        setChartData({ labels, datasets: [{ data }] });
      }
    } catch (error) {
      console.error('Error loading chart data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.id, viewMode, selectedYear, periodType, customStartYear, customEndYear]);

  // Load available years initially
  useEffect(() => {
    const fetchYears = async () => {
        if (user?.id) {
            const { labels } = await getYearlyProfitAnalysis(user.id);
            if (labels.length > 0) {
                const years = labels.map(y => parseInt(y));
                setAvailableYears(years);
                // Set default custom years if needed
                if (!years.includes(customStartYear)) setCustomStartYear(Math.min(...years));
                if (!years.includes(customEndYear)) setCustomEndYear(Math.max(...years));
            } else {
                setAvailableYears([new Date().getFullYear()]);
            }
        }
    };
    fetchYears();
  }, [user?.id]);


  const chartConfig = {
    backgroundGradientFrom: "#ffffff",
    backgroundGradientTo: "#ffffff",
    color: (opacity = 1) => `rgba(233, 30, 99, ${opacity})`, // Pink/Red color for profit
    strokeWidth: 2,
    barPercentage: 0.5,
    useShadowColorFromDataset: false,
    decimalPlaces: 0,
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    propsForDots: {
        r: "4",
        strokeWidth: "2",
        stroke: "#E91E63"
    }
  };

  const renderPeriodFilter = () => (
    <View style={styles.periodFilterContainer}>
        <View style={styles.chipContainer}>
            {['3m', '6m', '9m', 'custom'].map((type) => (
                <TouchableOpacity
                    key={type}
                    style={[styles.chip, periodType === type && styles.chipActive]}
                    onPress={() => setPeriodType(type)}
                >
                    <Text style={[styles.chipText, periodType === type && styles.chipTextActive]}>
                        {type === 'custom' ? 'Custom Range' : `${type.replace('m', '')} Bulan`}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>

        {periodType === 'custom' && (
            <View style={styles.customYearContainer}>
                <View style={styles.yearSelectorGroup}>
                    <Text style={styles.yearSelectorLabel}>Dari:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {availableYears.map(year => (
                            <TouchableOpacity
                                key={`start-${year}`}
                                style={[styles.yearMiniChip, customStartYear === year && styles.yearMiniChipActive]}
                                onPress={() => setCustomStartYear(year)}
                            >
                                <Text style={[styles.yearMiniText, customStartYear === year && styles.yearMiniTextActive]}>{year}</Text>
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
                                style={[styles.yearMiniChip, customEndYear === year && styles.yearMiniChipActive]}
                                onPress={() => setCustomEndYear(year)}
                            >
                                <Text style={[styles.yearMiniText, customEndYear === year && styles.yearMiniTextActive]}>{year}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            </View>
        )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Analisis Profit</Text>
      </View>

      <View style={styles.filterContainer}>
        <View style={styles.toggleContainer}>
            <TouchableOpacity 
                style={[styles.toggleButton, viewMode === 'monthly' && styles.toggleActive]}
                onPress={() => setViewMode('monthly')}
            >
                <Text style={[styles.toggleText, viewMode === 'monthly' && styles.toggleTextActive]}>Bulanan</Text>
            </TouchableOpacity>
            <TouchableOpacity 
                style={[styles.toggleButton, viewMode === 'yearly' && styles.toggleActive]}
                onPress={() => setViewMode('yearly')}
            >
                <Text style={[styles.toggleText, viewMode === 'yearly' && styles.toggleTextActive]}>Tahunan</Text>
            </TouchableOpacity>
            <TouchableOpacity 
                style={[styles.toggleButton, viewMode === 'period' && styles.toggleActive]}
                onPress={() => setViewMode('period')}
            >
                <Text style={[styles.toggleText, viewMode === 'period' && styles.toggleTextActive]}>Periode</Text>
            </TouchableOpacity>
        </View>

        {viewMode === 'monthly' && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.yearFilter}>
                {availableYears.map(year => (
                    <TouchableOpacity 
                        key={year} 
                        style={[styles.yearChip, selectedYear === year && styles.yearChipActive]}
                        onPress={() => setSelectedYear(year)}
                    >
                        <Text style={[styles.yearText, selectedYear === year && styles.yearTextActive]}>{year}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        )}

        {viewMode === 'period' && renderPeriodFilter()}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 50 }} />
        ) : (
          <>
            <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>
                    {viewMode === 'monthly' ? `Grafik Profit Tahun ${selectedYear}` : 
                     viewMode === 'yearly' ? 'Grafik Profit Per Tahun' :
                     periodType === 'custom' ? `Grafik Profit ${customStartYear} - ${customEndYear}` :
                     `Grafik Profit ${periodType.replace('m', '')} Bulan Terakhir`}
                </Text>
                
                {chartData.datasets[0].data.length > 0 && !chartData.datasets[0].data.every(v => v === 0) ? (
                    <View style={{ flexDirection: 'row', height: 250 }}>
                        {/* Fixed Y-Axis */}
                        <View style={{ 
                            justifyContent: 'space-between', 
                            paddingTop: 10, 
                            paddingBottom: viewMode === 'period' && chartData.labels.length > 6 ? 55 : 30,
                            width: 60, 
                            alignItems: 'flex-end',
                            paddingRight: 8,
                            borderRightWidth: 1,
                            borderRightColor: Colors.border,
                            backgroundColor: Colors.card,
                            zIndex: 10
                        }}>
                            {[4, 3, 2, 1, 0].map((i) => {
                                const max = Math.max(...chartData.datasets[0].data);
                                const val = (max / 4) * i;
                                return (
                                    <Text key={i} style={{ fontSize: 10, color: Colors.text, textAlign: 'right' }}>
                                        {`Rp ${(val / 1000).toFixed(0)}k`}
                                    </Text>
                                );
                            })}
                        </View>
                        
                        <ScrollView 
                            horizontal={true} 
                            showsHorizontalScrollIndicator={false}
                            style={{ marginLeft: -20 }}
                        >
                            <LineChart
                                data={chartData}
                                width={Math.max(screenWidth - 80, chartData.labels.length * 80)}
                                height={250}
                                verticalLabelRotation={viewMode === 'period' && chartData.labels.length > 6 ? 45 : 0}
                                xLabelsOffset={viewMode === 'period' && chartData.labels.length > 6 ? -10 : 0}
                                chartConfig={chartConfig}
                                bezier
                                style={styles.chart}
                                fromZero
                                withVerticalLabels={true}
                                withHorizontalLabels={false}
                                renderDotContent={({ x, y, index, indexData }) => (
                                    <SvgText
                                        key={index}
                                        x={x}
                                        y={y - 10}
                                        fill={Colors.text}
                                        fontSize="10"
                                        fontWeight="bold"
                                        textAnchor="middle"
                                    >
                                        {(indexData / 1000).toFixed(0)}k
                                    </SvgText>
                                )}
                            />
                        </ScrollView>
                    </View>
                ) : (
                    <View style={styles.noDataContainer}>
                        <Text style={styles.noDataText}>Belum ada data profit untuk periode ini</Text>
                    </View>
                )}
            </View>

            <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>Ringkasan</Text>
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Total Profit Periode Ini</Text>
                    <Text style={styles.summaryValue}>
                        {formatIDR(chartData.datasets[0].data.reduce((a, b) => a + b, 0))}
                    </Text>
                </View>
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Rata-rata Profit</Text>
                    <Text style={styles.summaryValue}>
                        {chartData.datasets[0].data.length > 0 
                            ? formatIDR(chartData.datasets[0].data.reduce((a, b) => a + b, 0) / chartData.datasets[0].data.filter(v => v > 0).length || 1)
                            : formatIDR(0)
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
    padding: 16,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
  },
  filterContainer: {
    backgroundColor: Colors.card,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 4,
    marginBottom: 12,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  toggleActive: {
    backgroundColor: Colors.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleText: {
    fontSize: 14,
    color: Colors.muted,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: Colors.primary,
  },
  yearFilter: {
    flexDirection: 'row',
  },
  yearChip: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.background,
    marginRight: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  yearChipActive: {
    backgroundColor: Colors.primary + '20',
    borderColor: Colors.primary,
  },
  yearText: {
    fontSize: 14,
    color: Colors.text,
  },
  yearTextActive: {
    color: Colors.primary,
    fontWeight: 'bold',
  },
  periodFilterContainer: {
    marginTop: 4,
  },
  chipContainer: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.background,
    marginRight: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.primary + '20',
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: 12,
    color: Colors.text,
  },
  chipTextActive: {
    color: Colors.primary,
    fontWeight: 'bold',
  },
  customYearContainer: {
    backgroundColor: Colors.background,
    padding: 8,
    borderRadius: 8,
  },
  yearSelectorGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  yearSelectorLabel: {
    fontSize: 12,
    color: Colors.muted,
    marginRight: 8,
    width: 50,
  },
  yearMiniChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
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
    fontSize: 12,
    color: Colors.text,
  },
  yearMiniTextActive: {
    color: '#fff',
  },
  content: {
    padding: 16,
  },
  chartCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  noDataContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  noDataText: {
    color: Colors.muted,
  },
  summaryCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  summaryLabel: {
    color: Colors.muted,
    fontSize: 14,
  },
  summaryValue: {
    fontWeight: 'bold',
    color: Colors.success,
    fontSize: 14,
  },
});
