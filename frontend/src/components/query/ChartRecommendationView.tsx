import React, { useMemo, useState } from "react";
import {
  BarChart as BarChartIcon,
  Check,
  ChevronDown,
  Download,
  Gauge,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  Plus,
  Save,
  ScatterChart as ScatterChartIcon,
  Table as TableIcon,
  TrendingUp,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../../services/api";
import { ChartType, QueryExecutionResult, SavedReport } from "../../types";
import { useTheme } from "../../theme/ThemeContext";

interface ChartRecommendationViewProps {
  result: QueryExecutionResult;
  question: string;
  dataSourceId?: number | null;
  onReportSaved?: (report: SavedReport) => void;
}

const PALETTE = ["#06b6d4", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#f43f5e"];

export const ChartRecommendationView: React.FC<ChartRecommendationViewProps> = ({
  result,
  question,
  dataSourceId,
  onReportSaved,
}) => {
  const { columns, rows } = result;
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const tooltipStyle = {
    backgroundColor: isDark ? "#0f172a" : "#ffffff",
    borderColor: isDark ? "#334155" : "#e2e8f0",
    borderRadius: "10px",
    fontSize: "12px",
    color: isDark ? "#f8fafc" : "#0f172a",
    boxShadow: isDark ? "0 10px 25px -5px rgba(0,0,0,0.5)" : "0 10px 25px -5px rgba(0,0,0,0.1)",
  };
  const gridStroke = isDark ? "#1e293b" : "#e2e8f0";
  const axisStroke = isDark ? "#64748b" : "#94a3b8";

  // 1. Analyze Columns & Data Types
  const analysis = useMemo(() => {
    if (!columns || !rows || rows.length === 0) {
      return {
        dateCol: null,
        numericCols: [],
        categoricalCols: [],
        recommendedType: "table" as ChartType,
      };
    }

    let dateCol: string | null = null;
    const numericCols: string[] = [];
    const categoricalCols: string[] = [];

    columns.forEach((col, idx) => {
      const colLower = col.toLowerCase();
      const sampleVal = rows[0][idx];

      // Check date
      const isDateName = /date|month|year|day|quarter|period|time/i.test(colLower);
      const isDateVal =
        typeof sampleVal === "string" && /^\d{4}-\d{2}/.test(sampleVal.trim());

      if (isDateName || isDateVal) {
        if (!dateCol) dateCol = col;
        return;
      }

      // Check numeric
      const isNum =
        typeof sampleVal === "number" ||
        (!isNaN(Number(sampleVal)) && sampleVal !== null && sampleVal !== "");

      if (isNum) {
        numericCols.push(col);
      } else {
        categoricalCols.push(col);
      }
    });

    // Heuristics for Recommended Type
    let recommended: ChartType = "table";
    if (rows.length === 1 && numericCols.length >= 1) {
      recommended = "kpi";
    } else if (dateCol && numericCols.length >= 1) {
      recommended = "line";
    } else if (categoricalCols.length >= 1 && numericCols.length >= 1) {
      if (rows.length <= 7) {
        recommended = "pie";
      } else {
        recommended = "bar";
      }
    } else if (numericCols.length >= 2) {
      recommended = "scatter";
    }

    return {
      dateCol,
      numericCols,
      categoricalCols,
      recommendedType: recommended,
    };
  }, [columns, rows]);

  // 2. Local State
  const [activeChartType, setActiveChartType] = useState<ChartType>(analysis.recommendedType);
  const [xAxisCol, setXAxisCol] = useState<string>(
    analysis.dateCol || analysis.categoricalCols[0] || columns[0] || ""
  );
  const [yAxisCol, setYAxisCol] = useState<string>(
    analysis.numericCols[0] || columns[1] || columns[0] || ""
  );

  // Modal State for Saving
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [reportName, setReportName] = useState(question ? `Report: ${question.slice(0, 40)}` : "Saved Query Analysis");
  const [reportCategory, setReportCategory] = useState("General");
  const [savingReport, setSavingReport] = useState(false);
  const [savedSuccessMsg, setSavedSuccessMsg] = useState<string | null>(null);

  // 3. Format Data for Recharts
  const chartData = useMemo(() => {
    if (!columns || !rows) return [];
    return rows.map((row) => {
      const obj: Record<string, any> = {};
      columns.forEach((col, idx) => {
        const val = row[idx];
        obj[col] = !isNaN(Number(val)) && val !== null && val !== "" ? Number(val) : val;
      });
      return obj;
    });
  }, [columns, rows]);

  const handleSaveReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportName.trim()) return;
    setSavingReport(true);
    try {
      const newRep = await api.createReport({
        name: reportName,
        category: reportCategory,
        natural_language_question: question,
        sql: result.sql,
        chart_type: activeChartType,
        chart_config: {
          x_axis: xAxisCol,
          y_axis: yAxisCol,
          title: reportName,
        },
        data_source: dataSourceId || null,
      });
      setSavedSuccessMsg(`Report "${reportName}" saved successfully.`);
      setIsSaveModalOpen(false);
      if (onReportSaved) onReportSaved(newRep);
      setTimeout(() => setSavedSuccessMsg(null), 3000);
    } catch (err: any) {
      alert(`Failed to save report: ${err.message}`);
    } finally {
      setSavingReport(false);
    }
  };

  const chartTabs: { type: ChartType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { type: "table", label: "Table", icon: TableIcon },
    { type: "bar", label: "Bar Chart", icon: BarChartIcon },
    { type: "line", label: "Trend Line", icon: LineChartIcon },
    { type: "pie", label: "Donut / Pie", icon: PieChartIcon },
    { type: "scatter", label: "Scatter", icon: ScatterChartIcon },
    { type: "kpi", label: "KPI Card", icon: Gauge },
  ];

  return (
    <div className="space-y-4 pt-2">
      {/* Visual Navigation & Recommender Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-xl transition-colors">
        <div className="flex items-center gap-1.5 flex-wrap">
          {chartTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeChartType === tab.type;
            const isRec = analysis.recommendedType === tab.type;

            return (
              <button
                key={tab.type}
                onClick={() => setActiveChartType(tab.type)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all ${
                  isActive
                    ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-sm"
                    : "bg-white dark:bg-slate-950/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-transparent"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
                {isRec && !isActive && (
                  <span className="text-[10px] bg-cyan-100 dark:bg-cyan-950/50 text-cyan-700 dark:text-cyan-300 px-1.5 py-0.2 rounded font-normal border border-cyan-200 dark:border-cyan-500/30">
                    Auto
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={() => setIsSaveModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold transition-all border border-slate-200 dark:border-slate-700 shadow-sm"
          >
            <Save className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
            Save as Report
          </button>
        </div>
      </div>

      {savedSuccessMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
          <Check className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
          <span>{savedSuccessMsg}</span>
        </div>
      )}

      {/* Axis Configuration Bar (for Charts) */}
      {activeChartType !== "table" && activeChartType !== "kpi" && (
        <div className="p-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center gap-4 text-xs flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Dimension (X):</span>
            <select
              value={xAxisCol}
              onChange={(e) => setXAxisCol(e.target.value)}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-slate-800 dark:text-slate-200"
            >
              {columns.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Metric (Y):</span>
            <select
              value={yAxisCol}
              onChange={(e) => setYAxisCol(e.target.value)}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-slate-800 dark:text-slate-200"
            >
              {columns.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Chart Canvas */}
      <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-5 min-h-[360px] flex items-center justify-center transition-colors">
        {activeChartType === "kpi" && (
          <div className="text-center p-8 space-y-3">
            <div className="text-xs uppercase font-semibold tracking-wider text-slate-500 dark:text-slate-400">
              {yAxisCol || columns[0]}
            </div>
            <div className="text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {typeof rows[0]?.[columns.indexOf(yAxisCol)] === "number"
                ? rows[0][columns.indexOf(yAxisCol)].toLocaleString()
                : rows[0]?.[0]}
            </div>
            <div className="text-xs text-cyan-600 dark:text-cyan-400 font-medium flex items-center justify-center gap-1">
              <TrendingUp className="h-3.5 w-3.5" />
              <span>Grounded business performance KPI</span>
            </div>
          </div>
        )}

        {activeChartType === "bar" && (
          <div className="w-full h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey={xAxisCol} stroke={axisStroke} tick={{ fontSize: 11 }} />
                <YAxis stroke={axisStroke} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey={yAxisCol} fill="#06b6d4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {activeChartType === "line" && (
          <div className="w-full h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                <defs>
                  <linearGradient id="areaColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey={xAxisCol} stroke={axisStroke} tick={{ fontSize: 11 }} />
                <YAxis stroke={axisStroke} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey={yAxisCol} stroke="#06b6d4" strokeWidth={2} fillOpacity={1} fill="url(#areaColor)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {activeChartType === "pie" && (
          <div className="w-full h-80 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: "11px", color: axisStroke }} />
                <Pie
                  data={chartData}
                  dataKey={yAxisCol}
                  nameKey={xAxisCol}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  innerRadius={50}
                  paddingAngle={3}
                >
                  {chartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={PALETTE[index % PALETTE.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {activeChartType === "scatter" && (
          <div className="w-full h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey={xAxisCol} stroke={axisStroke} tick={{ fontSize: 11 }} name={xAxisCol} />
                <YAxis dataKey={yAxisCol} stroke={axisStroke} tick={{ fontSize: 11 }} name={yAxisCol} />
                <Tooltip contentStyle={tooltipStyle} />
                <Scatter data={chartData} fill="#10b981" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        )}

        {activeChartType === "table" && (
          <div className="w-full overflow-x-auto max-h-96">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-950/90 text-slate-500 dark:text-slate-400 sticky top-0 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  {columns.map((col) => (
                    <th key={col} className="px-4 py-2.5 font-semibold">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {rows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                    {row.map((cell: any, cIdx: number) => (
                      <td key={cIdx} className="px-4 py-2 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {cell === null ? <span className="text-slate-400 dark:text-slate-600">NULL</span> : String(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Save Report Modal */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Save className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                Save Report to Repository
              </h3>
              <button onClick={() => setIsSaveModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveReport} className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Report Name *</label>
                <input
                  type="text"
                  required
                  value={reportName}
                  onChange={(e) => setReportName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Category</label>
                <select
                  value={reportCategory}
                  onChange={(e) => setReportCategory(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="General">General</option>
                  <option value="Revenue">Revenue & Finance</option>
                  <option value="Customers">Customers & Churn</option>
                  <option value="Products">Products & Inventory</option>
                  <option value="Operations">Operations & Fulfillment</option>
                  <option value="Executive">Executive Overview</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSaveModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingReport || !reportName.trim()}
                  className="px-4 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-lg text-xs font-semibold disabled:opacity-50 shadow-sm"
                >
                  {savingReport ? "Saving..." : "Save Report"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
