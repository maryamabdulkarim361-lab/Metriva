import React, { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Cell,
} from "recharts";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Code2,
  Copy,
  LineChart as LineChartIcon,
  Play,
  Shield,
  Sparkles,
} from "lucide-react";
import { MetrivaCard, MetrivaBadge, MetrivaButton } from "../ui";
import { useTheme } from "../../theme/ThemeContext";

interface InteractiveDemoPreviewProps {
  onNavigateToAppWithQuery: (query: string) => void;
}

interface DemoScenario {
  id: string;
  title: string;
  category: string;
  question: string;
  tables: string[];
  sql: string;
  recommendedChart: "bar" | "line";
  kpis: { label: string; value: string; change: string; isPositive: boolean }[];
  data: { label: string; value: number; secondary?: number }[];
  explanation: string;
}

const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: "revenue",
    title: "Revenue by Category",
    category: "Financial Analytics",
    question: "What is our total revenue breakdown by product category and order volume?",
    tables: ["products", "orders", "order_items"],
    sql: `SELECT 
  p.category,
  ROUND(SUM(oi.subtotal)::numeric, 2) AS total_revenue,
  COUNT(DISTINCT o.id) AS total_orders
FROM products p
JOIN order_items oi ON p.id = oi.product_id
JOIN orders o ON oi.order_id = o.id
WHERE o.status = 'completed'
GROUP BY p.category
ORDER BY total_revenue DESC;`,
    recommendedChart: "bar",
    kpis: [
      { label: "Total Net Revenue", value: "$412,850", change: "+18.4% YoY", isPositive: true },
      { label: "Top Category", value: "Electronics", change: "42% share", isPositive: true },
      { label: "Avg Order Value", value: "$165.14", change: "+8.2%", isPositive: true },
    ],
    data: [
      { label: "Electronics", value: 173397, secondary: 1050 },
      { label: "Home Goods", value: 94955, secondary: 620 },
      { label: "Apparel", value: 66056, secondary: 410 },
      { label: "Footwear", value: 45413, secondary: 280 },
      { label: "Accessories", value: 33028, secondary: 140 },
    ],
    explanation:
      "Electronics drove 42% ($173.4K) of completed sales. All five product categories showed positive volume growth with an average order value of $165.14.",
  },
  {
    id: "growth",
    title: "Monthly Order Velocity",
    category: "Trend Forecasting",
    question: "Show monthly revenue progression and order volume over the last 6 months",
    tables: ["orders", "payments"],
    sql: `SELECT 
  TO_CHAR(o.created_at, 'Mon YYYY') AS month_label,
  ROUND(SUM(p.amount)::numeric, 2) AS monthly_revenue,
  COUNT(o.id) AS order_volume
FROM orders o
JOIN payments p ON o.id = p.order_id
WHERE p.status = 'successful'
GROUP BY TO_CHAR(o.created_at, 'Mon YYYY'), DATE_TRUNC('month', o.created_at)
ORDER BY DATE_TRUNC('month', o.created_at) ASC;`,
    recommendedChart: "line",
    kpis: [
      { label: "6-Month Growth", value: "+34.2%", change: "Accelerating", isPositive: true },
      { label: "Peak Month", value: "September", change: "$78.4K", isPositive: true },
      { label: "Payment Success Rate", value: "98.8%", change: "+0.4%", isPositive: true },
    ],
    data: [
      { label: "May", value: 48200, secondary: 310 },
      { label: "Jun", value: 52400, secondary: 345 },
      { label: "Jul", value: 59800, secondary: 390 },
      { label: "Aug", value: 68100, secondary: 440 },
      { label: "Sep", value: 78400, secondary: 512 },
      { label: "Oct", value: 83200, secondary: 540 },
    ],
    explanation:
      "Revenue accelerated by 34.2% over two consecutive quarters. Order velocity peaked in September with 512 orders and $78.4K collected with sub-1% payment failure rates.",
  },
  {
    id: "churn",
    title: "Enterprise Churn Radar",
    category: "Predictive ML",
    question: "Which high-value accounts have not ordered in 60+ days with declining velocity?",
    tables: ["customers", "orders"],
    sql: `SELECT 
  c.name AS account_name,
  c.customer_segment,
  COUNT(o.id) AS total_orders,
  ROUND(SUM(o.total_amount)::numeric, 2) AS lifetime_value,
  MAX(o.created_at) AS last_order_date
FROM customers c
LEFT JOIN orders o ON c.id = o.customer_id
WHERE c.customer_segment IN ('Enterprise', 'SMB')
GROUP BY c.id, c.name, c.customer_segment
HAVING MAX(o.created_at) < CURRENT_DATE - INTERVAL '60 days'
ORDER BY lifetime_value DESC
LIMIT 5;`,
    recommendedChart: "bar",
    kpis: [
      { label: "Identified At-Risk Accounts", value: "14 Accounts", change: "-$64K MRR", isPositive: false },
      { label: "Model Recall", value: "94.2%", change: "RFM Logistic", isPositive: true },
      { label: "Average Dormancy", value: "73 Days", change: "+12 days", isPositive: false },
    ],
    data: [
      { label: "Nexus Systems", value: 48500 },
      { label: "Vertex Cloud", value: 36200 },
      { label: "Aura Logistics", value: 29400 },
      { label: "Starlight Corp", value: 21800 },
      { label: "Zenith Retail", value: 18900 },
    ],
    explanation:
      "Identified 14 high-value enterprise and SMB accounts with dormancy exceeding 60 days. Proactive account review is recommended to protect $64K in recurring customer value.",
  },
];

export const InteractiveDemoPreview: React.FC<InteractiveDemoPreviewProps> = ({
  onNavigateToAppWithQuery,
}) => {
  const [selectedScenario, setSelectedScenario] = useState<string>("revenue");
  const [activeTab, setActiveTab] = useState<"chart" | "sql">("chart");
  const [copiedSql, setCopiedSql] = useState(false);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const scenario = DEMO_SCENARIOS.find((s) => s.id === selectedScenario) || DEMO_SCENARIOS[0];

  const handleCopy = () => {
    navigator.clipboard.writeText(scenario.sql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  return (
    <section id="demo" className="py-20 md:py-28 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <MetrivaBadge variant="blue" size="md" icon={<Sparkles className="h-3.5 w-3.5" />}>
            Interactive Product Simulator
          </MetrivaBadge>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-slate-900 dark:text-white mt-4 mb-4">
            Experience Metriva in Action
          </h2>
          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400">
            Choose a live business scenario below. See how Metriva automatically translates questions into safe SQL, extracts intelligence, and recommends optimal visualizations.
          </p>
        </div>

        {/* Scenario Selector Pills */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 mb-8">
          {DEMO_SCENARIOS.map((s) => {
            const isSelected = s.id === selectedScenario;
            return (
              <button
                key={s.id}
                onClick={() => {
                  setSelectedScenario(s.id);
                  setActiveTab("chart");
                }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 border ${
                  isSelected
                    ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white border-cyan-400/50 shadow-md shadow-cyan-500/20"
                    : "bg-white/80 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-cyan-500/40 hover:text-cyan-600 dark:hover:text-cyan-300 backdrop-blur-sm"
                }`}
              >
                <span>{s.title}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded ${
                    isSelected
                      ? "bg-black/20 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {s.category}
                </span>
              </button>
            );
          })}
        </div>

        {/* Simulation Interactive Card */}
        <MetrivaCard glow padding="none" className="overflow-hidden border-cyan-500/30">
          {/* Mock App Browser Bar */}
          <div className="bg-slate-100 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800/90 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono ml-2">
                metriva://query-engine/interactive-session
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 px-2 py-0.5 rounded">
                <Shield className="h-3 w-3" />
                Read-Only AST Guard Active
              </span>
              <span className="text-slate-300 dark:text-slate-500 hidden sm:inline">|</span>
              <span className="text-slate-600 dark:text-slate-400 hidden sm:inline font-mono">PostgreSQL 16</span>
            </div>
          </div>

          <div className="p-5 sm:p-7 space-y-6">
            {/* User Question Bar */}
            <div className="bg-slate-50 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800/80 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 shrink-0">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[11px] font-semibold tracking-wider text-cyan-600 dark:text-cyan-400 uppercase">
                    Natural Language Prompt
                  </div>
                  <div className="text-slate-900 dark:text-white font-medium text-base sm:text-lg mt-0.5">
                    "{scenario.question}"
                  </div>
                </div>
              </div>

              <MetrivaButton
                onClick={() => onNavigateToAppWithQuery(scenario.question)}
                size="sm"
                variant="primary"
                icon={<ArrowRight className="h-3.5 w-3.5" />}
                iconPosition="right"
                className="shrink-0"
              >
                Run Live In App
              </MetrivaButton>
            </div>

            {/* AI Automated Pipeline Steps */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                <span className="text-slate-600 dark:text-slate-300">
                  Tables: <strong className="text-cyan-700 dark:text-cyan-300">{scenario.tables.join(", ")}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                <span className="text-slate-600 dark:text-slate-300">
                  Security: <strong className="text-emerald-600 dark:text-emerald-400">0 Mutations Detected</strong>
                </span>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                <span className="text-slate-600 dark:text-slate-300">
                  Execution: <strong className="text-cyan-700 dark:text-cyan-300">Auto-Recommended Visual</strong>
                </span>
              </div>
            </div>

            {/* KPI Metric Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {scenario.kpis.map((kpi, idx) => (
                <div
                  key={idx}
                  className="bg-white/80 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-xl p-3.5 flex flex-col justify-between shadow-sm"
                >
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">{kpi.label}</div>
                  <div className="flex items-baseline justify-between mt-2">
                    <span className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                      {kpi.value}
                    </span>
                    <span
                      className={`text-xs font-semibold ${
                        kpi.isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                      }`}
                    >
                      {kpi.change}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* View Mode Tabs (Visual Chart vs Validated SQL) */}
            <div>
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2 mb-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab("chart")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      activeTab === "chart"
                        ? "bg-cyan-50 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-500/40"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                    }`}
                  >
                    <BarChart3 className="h-3.5 w-3.5" />
                    <span>Auto-Recommended Chart</span>
                  </button>

                  <button
                    onClick={() => setActiveTab("sql")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      activeTab === "sql"
                        ? "bg-cyan-50 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-500/40"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                    }`}
                  >
                    <Code2 className="h-3.5 w-3.5" />
                    <span>Generated SQL</span>
                  </button>
                </div>

                {activeTab === "sql" && (
                  <button
                    onClick={handleCopy}
                    className="text-xs text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-300 flex items-center gap-1 transition"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    <span>{copiedSql ? "Copied!" : "Copy SQL"}</span>
                  </button>
                )}
              </div>

              {/* Chart Tab Display */}
              {activeTab === "chart" && (
                <div className="h-72 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    {scenario.recommendedChart === "bar" ? (
                      <BarChart data={scenario.data} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#1e293b" : "#e2e8f0"} vertical={false} />
                        <XAxis
                          dataKey="label"
                          stroke={isDark ? "#64748b" : "#94a3b8"}
                          tick={{ fill: isDark ? "#94a3b8" : "#64748b", fontSize: 11 }}
                          tickLine={false}
                        />
                        <YAxis
                          stroke={isDark ? "#64748b" : "#94a3b8"}
                          tick={{ fill: isDark ? "#94a3b8" : "#64748b", fontSize: 11 }}
                          tickLine={false}
                          tickFormatter={(v) => (v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `${v}`)}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: isDark ? "#0f172a" : "#ffffff",
                            borderColor: isDark ? "#334155" : "#cbd5e1",
                            borderRadius: "0.75rem",
                            boxShadow: "0 10px 25px -5px rgba(0,0,0,0.2)",
                            fontSize: "12px",
                            color: isDark ? "#fff" : "#0f172a",
                          }}
                        />
                        <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="#06b6d4">
                          {scenario.data.map((_, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={index === 0 ? "#22d3ee" : index === 1 ? "#06b6d4" : "#3b82f6"}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    ) : (
                      <LineChart data={scenario.data} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#1e293b" : "#e2e8f0"} vertical={false} />
                        <XAxis
                          dataKey="label"
                          stroke={isDark ? "#64748b" : "#94a3b8"}
                          tick={{ fill: isDark ? "#94a3b8" : "#64748b", fontSize: 11 }}
                          tickLine={false}
                        />
                        <YAxis
                          stroke={isDark ? "#64748b" : "#94a3b8"}
                          tick={{ fill: isDark ? "#94a3b8" : "#64748b", fontSize: 11 }}
                          tickLine={false}
                          tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: isDark ? "#0f172a" : "#ffffff",
                            borderColor: isDark ? "#334155" : "#cbd5e1",
                            borderRadius: "0.75rem",
                            fontSize: "12px",
                            color: isDark ? "#fff" : "#0f172a",
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke={isDark ? "#22d3ee" : "#0891b2"}
                          strokeWidth={3}
                          dot={{ fill: "#06b6d4", stroke: isDark ? "#22d3ee" : "#0891b2", strokeWidth: 2, r: 4 }}
                          activeDot={{ r: 6, fill: "#00f0ff" }}
                        />
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                </div>
              )}

              {/* SQL Code Display */}
              {activeTab === "sql" && (
                <div className="bg-slate-900 dark:bg-slate-950 rounded-xl p-4 font-mono text-xs text-slate-200 dark:text-slate-300 border border-slate-200 dark:border-slate-800/80 overflow-x-auto">
                  <pre className="text-cyan-700 dark:text-cyan-300">{scenario.sql}</pre>
                </div>
              )}
            </div>

            {/* AI Explanation Bar */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 flex items-start gap-3 text-xs text-slate-700 dark:text-slate-300">
              <Sparkles className="h-4 w-4 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-900 dark:text-white">AI Synthesis: </span>
                {scenario.explanation}
              </div>
            </div>
          </div>
        </MetrivaCard>
      </div>
    </section>
  );
};
