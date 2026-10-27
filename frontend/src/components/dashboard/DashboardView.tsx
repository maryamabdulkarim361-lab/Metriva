import React from "react";
import {
  AlertTriangle,
  Database,
  DollarSign,
  Package,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DashboardData } from "../../types";
import { MetrivaBadge, MetrivaButton, MetrivaCard } from "../ui";
import { useTheme } from "../../theme/ThemeContext";

interface DashboardViewProps {
  data: DashboardData | null;
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
  onNavigateToQuery: (sampleQuestion?: string) => void;
}

const METRIVA_CHART_COLORS = ["#06b6d4", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"];

export const DashboardView: React.FC<DashboardViewProps> = ({
  data,
  loading,
  error,
  onRetry,
  onNavigateToQuery,
}) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const tooltipStyle = {
    backgroundColor: isDark ? "#0b0f19" : "#ffffff",
    borderColor: isDark ? "#334155" : "#e2e8f0",
    borderRadius: "12px",
    fontSize: "12px",
    color: isDark ? "#f8fafc" : "#0f172a",
    boxShadow: isDark ? "0 10px 25px -5px rgba(0,0,0,0.5)" : "0 10px 25px -5px rgba(0,0,0,0.1)",
  };
  const gridStroke = isDark ? "#1e293b" : "#e2e8f0";
  const axisStroke = isDark ? "#64748b" : "#94a3b8";

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Loading business metrics...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center space-y-4">
        <div className="p-3.5 bg-rose-100 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800/60 rounded-2xl text-rose-600 dark:text-rose-400">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">Failed to load dashboard metrics</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md">
            {error || "Unable to reach database service or load aggregated KPI statistics."}
          </p>
        </div>
        {onRetry && (
          <MetrivaButton
            onClick={onRetry}
            size="sm"
            variant="primary"
            icon={<RefreshCw className="h-3.5 w-3.5" />}
          >
            Retry Connection
          </MetrivaButton>
        )}
      </div>
    );
  }

  const {
    kpis,
    revenue_by_month,
    revenue_by_country,
    order_status_distribution,
    customer_segmentation,
    top_products,
    top_customers,
  } = data;

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Top Welcome / Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800/80">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Analytics Overview</h2>
            <MetrivaBadge variant="cyan" size="sm" pulse>
              Live
            </MetrivaBadge>
            <MetrivaBadge variant="purple" size="sm">
              Synthetic Demo Dataset
            </MetrivaBadge>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Pre-seeded synthetic enterprise benchmark derived directly from PostgreSQL demo transactions.
          </p>
        </div>

        {/* Quick Analytical Inquiries */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onNavigateToQuery("Show the top 10 customers by revenue.")}
            className="text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-900/80 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-cyan-500/30 transition flex items-center gap-1.5"
          >
            <Sparkles className="h-3 w-3 text-cyan-600 dark:text-cyan-400" />
            <span>Ask Top Customers</span>
          </button>
          <button
            onClick={() => onNavigateToQuery("What was our monthly revenue in 2026?")}
            className="text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-900/80 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-cyan-500/30 transition flex items-center gap-1.5"
          >
            <Sparkles className="h-3 w-3 text-cyan-600 dark:text-cyan-400" />
            <span>Ask Monthly Revenue</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue */}
        <MetrivaCard padding="md" hoverGlow className="relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Revenue
            </span>
            <div className="p-2.5 rounded-xl bg-cyan-100/60 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 border border-cyan-300 dark:border-cyan-500/30">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              $
              {kpis.total_revenue.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
          <div className="mt-2 flex items-center text-xs text-emerald-600 dark:text-emerald-400 gap-1 font-medium">
            <TrendingUp className="h-3.5 w-3.5" />
            <span>Completed settlements</span>
          </div>
        </MetrivaCard>

        {/* Total Orders */}
        <MetrivaCard padding="md" hoverGlow className="relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Orders
            </span>
            <div className="p-2.5 rounded-xl bg-blue-100/60 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-500/30">
              <ShoppingBag className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {kpis.total_orders.toLocaleString()}
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
            {(kpis.completed_orders ?? 0).toLocaleString()} fulfilled
          </div>
        </MetrivaCard>

        {/* Average Order Value */}
        <MetrivaCard padding="md" hoverGlow className="relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Average Order Value
            </span>
            <div className="p-2.5 rounded-xl bg-amber-100/60 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-500/30">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              ${kpis.avg_order_value.toFixed(2)}
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 font-medium">Across all completed orders</div>
        </MetrivaCard>

        {/* Total Customers */}
        <MetrivaCard padding="md" hoverGlow className="relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Customers
            </span>
            <div className="p-2.5 rounded-xl bg-indigo-100/60 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-500/30">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {kpis.total_customers.toLocaleString()}
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 font-medium">Enterprise, SMB & Consumer</div>
        </MetrivaCard>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Revenue Trend Area Chart */}
        <MetrivaCard padding="md" className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Monthly Revenue Trend</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Timeseries aggregation (Month → Total USD)</p>
            </div>
            <span className="text-xs font-mono text-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-200 dark:border-cyan-500/30">
              DATE_TRUNC('month')
            </span>
          </div>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenue_by_month}>
                <defs>
                  <linearGradient id="metrivaRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="month" stroke={axisStroke} fontSize={11} tickLine={false} />
                <YAxis
                  stroke={axisStroke}
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(val: any) => [`$${Number(val).toLocaleString()}`, "Revenue"]}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#06b6d4"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#metrivaRevenueGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </MetrivaCard>

        {/* Order Status Distribution Pie Chart */}
        <MetrivaCard padding="md">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Order Status Distribution</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Order lifecycle health breakdown</p>
          </div>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={order_status_distribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="count"
                  nameKey="status"
                >
                  {order_status_distribution.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={METRIVA_CHART_COLORS[index % METRIVA_CHART_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2 pt-3 border-t border-slate-200 dark:border-slate-800 text-xs">
            {order_status_distribution.map((item, idx) => (
              <div key={item.status} className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{
                    backgroundColor: METRIVA_CHART_COLORS[idx % METRIVA_CHART_COLORS.length],
                  }}
                />
                <span className="text-slate-600 dark:text-slate-400 capitalize">{item.status.toLowerCase()}:</span>
                <span className="font-semibold text-slate-900 dark:text-white">{item.count.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </MetrivaCard>
      </div>

      {/* Second Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Country Bar Chart */}
        <MetrivaCard padding="md">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Top Revenue by Country</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Geographic sales distribution</p>
            </div>
            <span className="text-xs text-slate-500 font-mono">GROUP BY country</span>
          </div>
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenue_by_country} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis
                  type="number"
                  stroke={axisStroke}
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                />
                <YAxis
                  dataKey="country"
                  type="category"
                  stroke={axisStroke}
                  fontSize={11}
                  tickLine={false}
                  width={90}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(val: any) => [`$${Number(val).toLocaleString()}`, "Revenue"]}
                />
                <Bar dataKey="revenue" fill="#06b6d4" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </MetrivaCard>

        {/* Customer Segmentation Distribution */}
        <MetrivaCard padding="md">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Customer Tier Segmentation</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Enterprise vs SMB vs Consumer</p>
            </div>
            <span className="text-xs text-slate-500 font-mono">customer_segment</span>
          </div>
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={customer_segmentation}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="customer_segment" stroke={axisStroke} fontSize={11} tickLine={false} />
                <YAxis stroke={axisStroke} fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(val: any) => [Number(val).toLocaleString(), "Accounts"]}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </MetrivaCard>
      </div>

      {/* Top Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products Table */}
        <MetrivaCard padding="md">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Top 5 Products by Revenue</h3>
            </div>
            <button
              onClick={() => onNavigateToQuery("Which products generated the most revenue?")}
              className="text-xs text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 font-medium"
            >
              Analyze in SQL →
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <th className="pb-2.5 font-semibold">Product</th>
                  <th className="pb-2.5 font-semibold">Category</th>
                  <th className="pb-2.5 font-semibold text-right">Units</th>
                  <th className="pb-2.5 font-semibold text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {top_products.map((p) => (
                  <tr key={p.product_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 font-medium text-slate-800 dark:text-slate-200">{p.product__name}</td>
                    <td className="py-2.5 text-slate-600 dark:text-slate-400">{p.product__category}</td>
                    <td className="py-2.5 text-right text-slate-700 dark:text-slate-300">{p.total_units_sold}</td>
                    <td className="py-2.5 text-right font-semibold text-cyan-600 dark:text-cyan-400">
                      ${p.total_revenue.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </MetrivaCard>

        {/* Top Customers Table */}
        <MetrivaCard padding="md">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Top 5 High-Value Accounts</h3>
            </div>
            <button
              onClick={() => onNavigateToQuery("Show the top 10 customers by revenue.")}
              className="text-xs text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 font-medium"
            >
              Analyze in SQL →
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <th className="pb-2.5 font-semibold">Customer</th>
                  <th className="pb-2.5 font-semibold">Tier</th>
                  <th className="pb-2.5 font-semibold text-right">Orders</th>
                  <th className="pb-2.5 font-semibold text-right">Lifetime Spend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {top_customers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5">
                      <div className="font-medium text-slate-800 dark:text-slate-200">{c.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{c.email}</div>
                    </td>
                    <td className="py-2.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {c.customer_segment}
                      </span>
                    </td>
                    <td className="py-2.5 text-right text-slate-700 dark:text-slate-300">{c.order_count}</td>
                    <td className="py-2.5 text-right font-semibold text-cyan-600 dark:text-cyan-400">
                      ${c.lifetime_revenue.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </MetrivaCard>
      </div>
    </div>
  );
};
