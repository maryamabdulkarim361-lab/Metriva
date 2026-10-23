import React, { useEffect, useState } from "react";
import {
  Activity,
  AlertCircle,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Download,
  Filter,
  Lightbulb,
  Minus,
  RefreshCw,
  Sparkles,
  Table as TableIcon,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../../services/api";
import { PeriodComparisonResult } from "../../types";
import { MetrivaCard, MetrivaBadge, MetrivaButton, METRIVA_TOKENS } from "../../design-system";
import { useTheme } from "../../theme/ThemeContext";

export const PeriodComparisonView: React.FC = () => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const [periodType, setPeriodType] = useState<string>("MOM");
  const [dimension, setDimension] = useState<string>("");
  const [limit, setLimit] = useState<number>(12);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [comparisonData, setComparisonData] = useState<PeriodComparisonResult | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "chart">("table");

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getPeriodComparison({
        period: periodType,
        dimension: dimension || undefined,
        limit,
      });
      setComparisonData(res);
    } catch (err: any) {
      console.error("Error loading period comparisons:", err);
      setError(err?.message || "Failed to calculate period comparisons");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [periodType, dimension, limit]);

  const formatCurrency = (val?: number | null) => {
    if (val === undefined || val === null) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(val);
  };

  const exportCSV = () => {
    if (!comparisonData?.data?.length) return;
    const headers = Object.keys(comparisonData.data[0]);
    const csvContent = [
      headers.join(","),
      ...comparisonData.data.map((row) =>
        headers.map((h) => JSON.stringify(row[h] ?? "")).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `period_comparison_${periodType.toLowerCase()}_${Date.now()}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <MetrivaBadge variant="cyan" size="sm">
              <Sparkles className="h-3 w-3 mr-1 inline" /> Time Series Analytics
            </MetrivaBadge>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-cyan-600 dark:text-cyan-400" />
            Period-over-Period Performance & Hypotheses
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Compare growth trajectories across periods with SQL window functions (MoM, QoQ, YoY) and grounded business hypotheses.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 p-1 rounded-xl backdrop-blur-md">
            <button
              onClick={() => setViewMode("table")}
              className={`p-1.5 rounded-lg text-xs flex items-center gap-1 font-medium transition ${
                viewMode === "table"
                  ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-sm shadow-cyan-500/20"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
              title="Table view"
            >
              <TableIcon className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("chart")}
              className={`p-1.5 rounded-lg text-xs flex items-center gap-1 font-medium transition ${
                viewMode === "chart"
                  ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-sm shadow-cyan-500/20"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
              title="Visual chart"
            >
              <BarChart3 className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={exportCSV}
            disabled={!comparisonData?.data?.length}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900/80 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg transition disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export</span>
          </button>

          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 rounded-lg transition shadow-md shadow-cyan-500/20"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter / Dimension Bar */}
      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 backdrop-blur-md flex flex-wrap items-center gap-4">
        {/* Period Selector */}
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Period:</span>
          <div className="flex bg-white dark:bg-slate-950/80 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
            {(["MOM", "QOQ", "YOY"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriodType(p)}
                className={`px-3 py-1 text-xs font-medium rounded transition ${
                  periodType === p
                    ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                {p === "MOM" ? "Month-over-Month" : p === "QOQ" ? "Quarter-over-Quarter" : "Year-over-Year"}
              </button>
            ))}
          </div>
        </div>

        {/* Dimension Breakdown */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-500 dark:text-slate-400" />
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Breakdown:</span>
          <select
            value={dimension}
            onChange={(e) => setDimension(e.target.value)}
            className="bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500"
          >
            <option value="">Overall Total</option>
            <option value="category">Product Category</option>
            <option value="customer_segment">Customer Segment</option>
            <option value="country">Country</option>
          </select>
        </div>

        {/* Limit */}
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Rows:</span>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-cyan-500"
          >
            <option value={6}>6</option>
            <option value={12}>12</option>
            <option value={24}>24</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Structured Executive Briefing / Summary */}
      {comparisonData?.summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Observed Historical Facts */}
          <MetrivaCard variant="glass" className="p-4 space-y-2.5 border-blue-200 dark:border-blue-900/40 bg-blue-50/40 dark:bg-transparent">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-semibold text-xs uppercase tracking-wider">
              <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span>Observed Historical Facts</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Grounded, verifiable metrics computed from confirmed historical database records.
            </p>
            <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-200">
              {comparisonData.summary.observed_facts.length > 0 ? (
                comparisonData.summary.observed_facts.map((fact, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-blue-600 dark:text-blue-400 font-bold">•</span>
                    <span>{fact}</span>
                  </li>
                ))
              ) : (
                <li className="text-slate-500 text-xs italic">No specific anomaly observed in selected periods.</li>
              )}
            </ul>
          </MetrivaCard>

          {/* Statistical Associations */}
          <MetrivaCard variant="glass" className="p-4 space-y-2.5 border-purple-200 dark:border-purple-900/40 bg-purple-50/40 dark:bg-transparent">
            <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-semibold text-xs uppercase tracking-wider">
              <Activity className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              <span>Statistical Associations</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Correlations and comparative trajectory patterns observed across consecutive windows.
            </p>
            <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-200">
              {comparisonData.summary.statistical_associations.length > 0 ? (
                comparisonData.summary.statistical_associations.map((assoc, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-purple-600 dark:text-purple-400 font-bold">•</span>
                    <span>{assoc}</span>
                  </li>
                ))
              ) : (
                <li className="text-slate-500 text-xs italic">Insufficient variance to establish statistical trends.</li>
              )}
            </ul>
          </MetrivaCard>

          {/* Investigation Hypotheses */}
          <MetrivaCard variant="glass" className="p-4 space-y-2.5 border-amber-200 dark:border-amber-900/40 bg-amber-50/40 dark:bg-transparent">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-semibold text-xs uppercase tracking-wider">
              <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span>Investigation Hypotheses</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Potential operational drivers to verify. Not confirmed causality.
            </p>
            <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-200">
              {comparisonData.summary.investigation_hypotheses.length > 0 ? (
                comparisonData.summary.investigation_hypotheses.map((hyp, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-amber-600 dark:text-amber-400 font-bold">•</span>
                    <span>{hyp}</span>
                  </li>
                ))
              ) : (
                <li className="text-slate-500 text-xs italic">Metrics remain stable within normal operating thresholds.</li>
              )}
            </ul>
          </MetrivaCard>
        </div>
      )}

      {/* Main Content Pane */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[320px] rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800">
          <div className="flex flex-col items-center gap-3">
            <div
              className="animate-spin rounded-full h-8 w-8 border-b-2"
              style={{ borderColor: METRIVA_TOKENS.colors.cyanPrimary }}
            />
            <span className="text-xs text-slate-500 dark:text-slate-400">Computing windowed comparisons...</span>
          </div>
        </div>
      ) : !comparisonData?.data?.length ? (
        <div className="p-12 text-center rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs">
          No comparison data available for the chosen filters.
        </div>
      ) : viewMode === "chart" ? (
        <MetrivaCard variant="glass" className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Revenue by Period ({comparisonData.period_label})
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              {comparisonData.periods_analyzed} periods analyzed
            </span>
          </div>
          <div className="h-[360px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[...comparisonData.data].reverse()}
                margin={{ top: 10, right: 20, left: 20, bottom: 25 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#1e293b" : "#e2e8f0"} />
                <XAxis
                  dataKey="period_date"
                  stroke={isDark ? "#64748b" : "#94a3b8"}
                  fontSize={11}
                  tickFormatter={(val) => String(val).substring(0, 10)}
                />
                <YAxis
                  stroke={isDark ? "#64748b" : "#94a3b8"}
                  fontSize={11}
                  tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? "#0f172a" : "#ffffff",
                    borderColor: isDark ? "#334155" : "#e2e8f0",
                    borderRadius: "8px",
                    color: isDark ? "#f8fafc" : "#0f172a",
                    fontSize: "12px",
                    boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                  }}
                  formatter={(value: any) => [formatCurrency(Number(value)), "Revenue"]}
                />
                <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px", color: isDark ? "#cbd5e1" : "#475569" }} />
                <Bar
                  dataKey="revenue"
                  name="Current Revenue"
                  fill="#06b6d4"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="prev_revenue"
                  name="Prior Period Revenue"
                  fill={isDark ? "#64748b" : "#94a3b8"}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </MetrivaCard>
      ) : (
        /* Table View */
        <MetrivaCard variant="glass" className="overflow-hidden shadow-xl p-0">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Period Comparison Ledger ({comparisonData.period_label})
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Sorted chronologically descending with SQL LAG window variance
              </p>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              {comparisonData.data.length} records
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950/90 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-semibold uppercase tracking-wider">Period Date</th>
                  {dimension && (
                    <th className="py-3 px-4 font-semibold uppercase tracking-wider">
                      {dimension.replace("_", " ")}
                    </th>
                  )}
                  <th className="py-3 px-4 font-semibold uppercase tracking-wider text-right">Orders</th>
                  <th className="py-3 px-4 font-semibold uppercase tracking-wider text-right">Revenue</th>
                  <th className="py-3 px-4 font-semibold uppercase tracking-wider text-right">Prior Revenue</th>
                  <th className="py-3 px-4 font-semibold uppercase tracking-wider text-right">Absolute Change</th>
                  <th className="py-3 px-4 font-semibold uppercase tracking-wider text-right">% Change</th>
                  <th className="py-3 px-4 font-semibold uppercase tracking-wider text-right">
                    {comparisonData.data[0]?.gross_profit !== undefined ? "Gross Profit" : "AOV"}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 font-mono">
                {comparisonData.data.map((row, idx) => {
                  const pct = row.percentage_change;
                  const isPositive = pct !== null && pct !== undefined && pct > 0;
                  const isNegative = pct !== null && pct !== undefined && pct < 0;

                  return (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                        {String(row.period_date).substring(0, 10)}
                      </td>
                      {dimension && (
                        <td className="py-3 px-4 text-cyan-600 dark:text-cyan-300 font-sans font-medium">
                          {row.dimension_value || "—"}
                        </td>
                      )}
                      <td className="py-3 px-4 text-right text-slate-700 dark:text-slate-300">
                        {row.order_count?.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-900 dark:text-slate-100">
                        {formatCurrency(row.revenue)}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-500 dark:text-slate-400">
                        {row.prev_revenue !== null && row.prev_revenue !== undefined
                          ? formatCurrency(row.prev_revenue)
                          : "—"}
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-medium ${
                          isPositive
                            ? "text-emerald-600 dark:text-emerald-400"
                            : isNegative
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        {row.absolute_change !== null && row.absolute_change !== undefined ? (
                          <>
                            {row.absolute_change > 0 ? "+" : ""}
                            {formatCurrency(row.absolute_change)}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {pct !== null && pct !== undefined ? (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                              isPositive
                                ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60"
                                : isNegative
                                ? "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                            }`}
                          >
                            {isPositive ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : isNegative ? (
                              <TrendingDown className="h-3 w-3" />
                            ) : (
                              <Minus className="h-3 w-3" />
                            )}
                            {pct > 0 ? "+" : ""}
                            {pct.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-700 dark:text-slate-300">
                        {formatCurrency(row.gross_profit ?? row.avg_order_value)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </MetrivaCard>
      )}
    </div>
  );
};
export default PeriodComparisonView;
