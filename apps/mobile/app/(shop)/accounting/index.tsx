import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { accountingApi } from '../../../api/client';

const TODAY = new Date();
const firstOfMonth = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1)
  .toISOString()
  .slice(0, 10);
const todayStr = TODAY.toISOString().slice(0, 10);

interface PLData {
  period: { from: string; to: string };
  revenue: { total_sales: number; cash: number; upi: number; card: number; credit: number };
  cogs: number;
  gross_profit: number;
  gross_margin_pct: number;
  operating_expenses: { total: number; breakdown: Record<string, number> };
  net_profit: number;
  net_margin_pct: number;
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: string;
  color: string;
}) {
  return (
    <View className="bg-white rounded-xl p-4 flex-1 mx-1 shadow-sm">
      <View className={`w-9 h-9 rounded-full items-center justify-center mb-2 ${color}`}>
        <Ionicons name={icon as any} size={18} color="#fff" />
      </View>
      <Text className="text-gray-500 text-xs">{label}</Text>
      <Text className="text-gray-900 font-bold text-base mt-0.5">{value}</Text>
    </View>
  );
}

function fmt(n: number) {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export default function AccountingDashboard() {
  const router = useRouter();
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(todayStr);

  const { data: pl, isLoading, refetch } = useQuery<PLData>({
    queryKey: ['pl', from, to],
    queryFn: () => accountingApi.getPL(from, to).then((r) => r.data.data),
  });

  const month = TODAY.getMonth() + 1;
  const year = TODAY.getFullYear();

  const { data: sales } = useQuery({
    queryKey: ['sales-summary', month, year],
    queryFn: () => accountingApi.getSalesSummary(month, year).then((r) => r.data.data),
  });

  const navItems = [
    { label: 'Expenses', icon: 'card-outline', route: '/(shop)/accounting/expenses', color: 'bg-red-500' },
    { label: 'Purchases', icon: 'bag-outline', route: '/(shop)/accounting/purchases', color: 'bg-blue-500' },
    { label: 'Suppliers', icon: 'people-outline', route: '/(shop)/accounting/suppliers', color: 'bg-indigo-500' },
    { label: 'Credit', icon: 'time-outline', route: '/(shop)/accounting/credit', color: 'bg-orange-500' },
    { label: 'Cash Register', icon: 'cash-outline', route: '/(shop)/accounting/cash-register', color: 'bg-green-500' },
  ];

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* Header */}
        <View className="bg-violet-600 px-5 pt-4 pb-8">
          <Text className="text-white text-xl font-bold">Accounting</Text>
          <Text className="text-violet-200 text-sm mt-0.5">
            {from} → {to}
          </Text>
        </View>

        {/* P&L Summary Cards */}
        <View className="-mt-4 px-4">
          {isLoading ? (
            <View className="bg-white rounded-xl p-8 items-center shadow-sm">
              <ActivityIndicator color="#8B5CF6" />
            </View>
          ) : (
            <>
              <View className="flex-row mb-3">
                <StatCard
                  label="Total Revenue"
                  value={fmt(pl?.revenue.total_sales ?? 0)}
                  icon="trending-up-outline"
                  color="bg-violet-500"
                />
                <StatCard
                  label="Net Profit"
                  value={fmt(pl?.net_profit ?? 0)}
                  icon="wallet-outline"
                  color={
                    (pl?.net_profit ?? 0) >= 0 ? 'bg-green-500' : 'bg-red-500'
                  }
                />
              </View>
              <View className="flex-row mb-3">
                <StatCard
                  label="COGS"
                  value={fmt(pl?.cogs ?? 0)}
                  icon="cube-outline"
                  color="bg-blue-500"
                />
                <StatCard
                  label="Expenses"
                  value={fmt(pl?.operating_expenses.total ?? 0)}
                  icon="card-outline"
                  color="bg-red-400"
                />
              </View>

              {/* Gross margin bar */}
              <View className="bg-white rounded-xl p-4 shadow-sm mb-3">
                <View className="flex-row justify-between mb-1">
                  <Text className="text-gray-600 text-sm">Gross Margin</Text>
                  <Text className="text-gray-800 font-semibold text-sm">
                    {pl?.gross_margin_pct.toFixed(1) ?? 0}%
                  </Text>
                </View>
                <View className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <View
                    className="h-2 bg-violet-500 rounded-full"
                    style={{ width: `${Math.min(pl?.gross_margin_pct ?? 0, 100)}%` }}
                  />
                </View>
                <View className="flex-row justify-between mt-1">
                  <Text className="text-gray-500 text-xs">Net margin</Text>
                  <Text
                    className={`text-xs font-medium ${
                      (pl?.net_margin_pct ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {pl?.net_margin_pct.toFixed(1) ?? 0}%
                  </Text>
                </View>
              </View>

              {/* Payment breakdown */}
              {pl && (
                <View className="bg-white rounded-xl p-4 shadow-sm mb-3">
                  <Text className="text-gray-700 font-semibold mb-3">Payment Breakdown</Text>
                  {(['cash', 'upi', 'card', 'credit'] as const).map((m) => {
                    const val = pl.revenue[m] ?? 0;
                    const pct =
                      pl.revenue.total_sales > 0
                        ? (val / pl.revenue.total_sales) * 100
                        : 0;
                    const colors: Record<string, string> = {
                      cash: 'bg-green-400',
                      upi: 'bg-blue-400',
                      card: 'bg-indigo-400',
                      credit: 'bg-orange-400',
                    };
                    return (
                      <View key={m} className="mb-2">
                        <View className="flex-row justify-between mb-0.5">
                          <Text className="text-gray-600 text-xs capitalize">{m}</Text>
                          <Text className="text-gray-700 text-xs">
                            {fmt(val)} ({pct.toFixed(0)}%)
                          </Text>
                        </View>
                        <View className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <View
                            className={`h-1.5 rounded-full ${colors[m]}`}
                            style={{ width: `${pct}%` }}
                          />
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </>
          )}
        </View>

        {/* Top medicines this month */}
        {sales?.top_medicines?.length > 0 && (
          <View className="px-4 mb-4">
            <Text className="text-gray-700 font-semibold mb-2">Top Medicines This Month</Text>
            <View className="bg-white rounded-xl overflow-hidden shadow-sm">
              {sales.top_medicines.slice(0, 5).map((med: any, idx: number) => (
                <View
                  key={idx}
                  className={`flex-row justify-between items-center px-4 py-3 ${
                    idx < sales.top_medicines.length - 1 ? 'border-b border-gray-50' : ''
                  }`}
                >
                  <View className="flex-row items-center flex-1">
                    <View className="w-6 h-6 bg-violet-100 rounded-full items-center justify-center mr-3">
                      <Text className="text-violet-600 text-xs font-bold">{idx + 1}</Text>
                    </View>
                    <Text className="text-gray-700 text-sm flex-1" numberOfLines={1}>
                      {med.medicine_name}
                    </Text>
                  </View>
                  <Text className="text-gray-500 text-xs">
                    {med.quantity} units
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Quick nav */}
        <View className="px-4">
          <Text className="text-gray-700 font-semibold mb-3">Manage</Text>
          <View className="flex-row flex-wrap gap-3">
            {navItems.map((item) => (
              <TouchableOpacity
                key={item.route}
                onPress={() => router.push(item.route as any)}
                className="bg-white rounded-xl p-4 shadow-sm items-center"
                style={{ width: '30%' }}
              >
                <View
                  className={`w-10 h-10 rounded-full items-center justify-center mb-2 ${item.color}`}
                >
                  <Ionicons name={item.icon as any} size={20} color="#fff" />
                </View>
                <Text className="text-gray-700 text-xs text-center">{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
