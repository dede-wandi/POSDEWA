import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import { Colors } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { 
    getDailyTransactionAnalysis, 
    getMonthlyTransactionAnalysis, 
    getYearlyTransactionAnalysis 
} from '../../services/transactionAnalysisSupabase';

const screenWidth = Dimensions.get("window").width;

export default function TransactionAnalysisScreen({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  
  // viewMode: 'daily' (per tanggal dalam bulan), 'monthly' (per bulan dalam tahun), 'yearly' (per tahun)
  const [viewMode, setViewMode] = useState('monthly'); 
  
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1); // 1-12
  
  const [chartData, setChartData] = useState({
    labels: [],
    datasets: [{ data: [] }]
  });
  
  const [availableYears, setAvailableYears] = useState([]);

  // Load available years
  useEffect(() => {
    const fetchYears = async () => {
        if (user?.id) {
            const { labels } = await getYearlyTransactionAnalysis(user.id);
            if (labels.length > 0) {
                setAvailableYears(labels.map(y => parseInt(y)));
            } else {
                setAvailableYears([new Date().getFullYear()]);
            }
        }
    };
    fetchYears();
  }, [user?.id]);

  const loadData = async () => {
    if (!user?.id) return;
    setLoading(true);
    
    try {
      if (viewMode === 'daily') {
        const { labels, data } = await getDailyTransactionAnalysis(user.id, selectedMonth, selectedYear);
        setChartData({ labels, datasets: [{ data }] });
      } else if (viewMode === 'monthly') {
        const { labels, data } = await getMonthlyTransactionAnalysis(user.id, selectedYear);
        setChartData({ labels, datasets: [{ data }] });
      } else if (viewMode === 'yearly') {
        const { labels, data } = await getYearlyTransactionAnalysis(user.id);
        setChartData({ labels, datasets: [{ data }] });
      }
    } catch (error) {
      console.error('Error loading transaction data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.id, viewMode, selectedYear, selectedMonth]);

  const chartConfig = {
    backgroundGradientFrom: "#ffffff",
    backgroundGradientTo: "#ffffff",
    color: (opacity = 1) => `rgba(33, 150, 243, ${opacity})`, // Blue for transactions
    strokeWidth: 2,
    barPercentage: 0.5,
    useShadowColorFromDataset: false,
    decimalPlaces: 0,
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    propsForDots: {
        r: "4",
        strokeWidth: "2",
        stroke: "#2196F3"
    }
  };

  const months = [
      { id: 1, name: 'Januari' }, { id: 2, name: 'Februari' }, { id: 3, name: 'Maret' },
      { id: 4, name: 'April' }, { id: 5, name: 'Mei' }, { id: 6, name: 'Juni' },
      { id: 7, name: 'Juli' }, { id: 8, name: 'Agustus' }, { id: 9, name: 'September' },
      { id: 10, name: 'Oktober' }, { id: 11, name: 'November' }, { id: 12, name: 'Desember' }
  ];

  const renderFilters = () => {
      return (
          <View style={styles.subFilterContainer}>
              {/* Year Selector for Daily/Monthly */}
              {(viewMode === 'daily' || viewMode === 'monthly') && (
                  <View style={styles.filterRow}>
                      <Text style={styles.filterLabel}>Tahun:</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          {availableYears.map(year => (
                              <TouchableOpacity 
                                  key={year} 
                                  style={[styles.miniChip, selectedYear === year && styles.miniChipActive]}
                                  onPress={() => setSelectedYear(year)}
                              >
                                  <Text style={[styles.miniChipText, selectedYear === year && styles.miniChipTextActive]}>{year}</Text>
                              </TouchableOpacity>
                          ))}
                      </ScrollView>
                  </View>
              )}

              {/* Month Selector for Daily */}
              {viewMode === 'daily' && (
                  <View style={[styles.filterRow, { marginTop: 8 }]}>
                      <Text style={styles.filterLabel}>Bulan:</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          {months.map(m => (
                              <TouchableOpacity 
                                  key={m.id} 
                                  style={[styles.miniChip, selectedMonth === m.id && styles.miniChipActive]}
                                  onPress={() => setSelectedMonth(m.id)}
                              >
                                  <Text style={[styles.miniChipText, selectedMonth === m.id && styles.miniChipTextActive]}>{m.name}</Text>
                              </TouchableOpacity>
                          ))}
                      </ScrollView>
                  </View>
              )}
          </View>
      );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Analisis Transaksi</Text>
      </View>

      <View style={styles.filterContainer}>
        <View style={styles.toggleContainer}>
            <TouchableOpacity 
                style={[styles.toggleButton, viewMode === 'daily' && styles.toggleActive]}
                onPress={() => setViewMode('daily')}
            >
                <Text style={[styles.toggleText, viewMode === 'daily' && styles.toggleTextActive]}>Harian</Text>
            </TouchableOpacity>
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
        </View>

        {renderFilters()}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 50 }} />
        ) : (
          <>
            <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>
                    {viewMode === 'daily' ? `Transaksi ${months.find(m => m.id === selectedMonth)?.name} ${selectedYear}` : 
                     viewMode === 'monthly' ? `Transaksi Tahun ${selectedYear}` :
                     'Transaksi Per Tahun'}
                </Text>
                
                {chartData.datasets[0].data.length > 0 && !chartData.datasets[0].data.every(v => v === 0) ? (
                    <View style={{ flexDirection: 'row', height: 250 }}>
                        {/* Fixed Y-Axis */}
                        <View style={{ 
                            justifyContent: 'space-between', 
                            paddingTop: 10, 
                            paddingBottom: 30,
                            width: 50, 
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
                                        {val.toFixed(0)}
                                    </Text>
                                );
                            })}
                        </View>

                        <ScrollView horizontal={true} showsHorizontalScrollIndicator={false}>
                            <LineChart
                                data={chartData}
                                width={Math.max(screenWidth - 70, chartData.labels.length * 80)}
                                height={250}
                                chartConfig={chartConfig}
                                style={styles.chart}
                                fromZero
                                bezier
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
                                        {indexData.toFixed(0)}
                                    </SvgText>
                                )}
                            />
                        </ScrollView>
                    </View>
                ) : (
                    <View style={styles.noDataContainer}>
                        <Text style={styles.noDataText}>Belum ada data transaksi</Text>
                    </View>
                )}
            </View>

            <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>Ringkasan</Text>
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Total Transaksi</Text>
                    <Text style={styles.summaryValue}>
                        {chartData.datasets[0].data.reduce((a, b) => a + b, 0)}
                    </Text>
                </View>
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Rata-rata Transaksi</Text>
                    <Text style={styles.summaryValue}>
                        {chartData.datasets[0].data.length > 0 
                            ? (chartData.datasets[0].data.reduce((a, b) => a + b, 0) / chartData.datasets[0].data.filter(v => v > 0).length || 1).toFixed(1)
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
  subFilterContainer: {
      marginTop: 4,
  },
  filterRow: {
      flexDirection: 'row',
      alignItems: 'center',
  },
  filterLabel: {
      fontSize: 12,
      color: Colors.muted,
      marginRight: 8,
      width: 45,
  },
  miniChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
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
    fontSize: 12,
    color: Colors.text,
  },
  miniChipTextActive: {
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
