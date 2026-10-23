import React, { useEffect, useState } from "react";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  Calendar,
  CheckCircle,
  CheckCircle2,
  ChevronRight,
  Clock,
  Cpu,
  DollarSign,
  HelpCircle,
  Lightbulb,
  Play,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
  UserX,
  Users,
} from "lucide-react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../../services/api";
import {
  MLAnomalyAlert,
  MLAnomalyScanResult,
  MLChurnResult,
  MLForecastResult,
  MLInsights,
  MLJob,
  MLModel,
} from "../../types";
import { MetrivaCard, MetrivaBadge, MetrivaButton, METRIVA_TOKENS } from "../../design-system";
import { useTheme } from "../../theme/ThemeContext";

export const MLDashboardView: React.FC = () => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const tooltipStyle = {
    backgroundColor: isDark ? "#0f172a" : "#ffffff",
    borderColor: isDark ? "#334155" : "#e2e8f0",
    borderRadius: "10px",
    color: isDark ? "#f8fafc" : "#0f172a",
    fontSize: "12px",
    boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)",
  };
  const gridStroke = isDark ? "#1e293b" : "#e2e8f0";
  const axisStroke = isDark ? "#64748b" : "#94a3b8";

  const [activeSubTab, setActiveSubTab] = useState<"forecast" | "churn" | "anomalies" | "registry">("forecast");

  // Executive Insights
  const [insights, setInsights] = useState<MLInsights | null>(null);
  const [loadingInsights, setLoadingInsights] = useState<boolean>(true);

  // Revenue Forecasting State
  const [forecastAggregation, setForecastAggregation] = useState<string>("monthly");
  const [forecastHorizon, setForecastHorizon] = useState<number>(6);
  const [forecastData, setForecastData] = useState<MLForecastResult | null>(null);
  const [loadingForecast, setLoadingForecast] = useState<boolean>(true);

  // Churn State
  const [churnInactivityDays, setChurnInactivityDays] = useState<number>(90);
  const [churnData, setChurnData] = useState<MLChurnResult | null>(null);
  const [loadingChurn, setLoadingChurn] = useState<boolean>(true);

  // Anomaly State
  const [anomalyZThreshold, setAnomalyZThreshold] = useState<number>(2.5);
  const [anomalyScan, setAnomalyScan] = useState<MLAnomalyScanResult | null>(null);
  const [anomalyAlerts, setAnomalyAlerts] = useState<MLAnomalyAlert[]>([]);
  const [loadingAnomalies, setLoadingAnomalies] = useState<boolean>(true);

  // Registry & Jobs State
  const [models, setModels] = useState<MLModel[]>([]);
  const [jobs, setJobs] = useState<MLJob[]>([]);
  const [loadingRegistry, setLoadingRegistry] = useState<boolean>(true);
  const [triggeringJob, setTriggeringJob] = useState<boolean>(false);
  const [selectedJobType, setSelectedJobType] = useState<string>("TRAIN_FORECAST");

  // Load Executive Insights
  const fetchInsights = async () => {
    setLoadingInsights(true);
    try {
      const data = await api.getMLInsights();
      setInsights(data);
    } catch (err) {
      console.error("Failed to load ML insights:", err);
    } finally {
      setLoadingInsights(false);
    }
  };

  // Load Forecast
  const fetchForecast = async () => {
    setLoadingForecast(true);
    try {
      const data = await api.getRevenueForecast({
        aggregation: forecastAggregation,
        horizon: forecastHorizon,
      });
      setForecastData(data);
    } catch (err) {
      console.error("Failed to load forecast:", err);
    } finally {
      setLoadingForecast(false);
    }
  };

  // Load Churn
  const fetchChurn = async () => {
    setLoadingChurn(true);
    try {
      const data = await api.getCustomerChurn(churnInactivityDays);
      setChurnData(data);
    } catch (err) {
      console.error("Failed to load churn prediction:", err);
    } finally {
      setLoadingChurn(false);
    }
  };

  // Load Anomalies
  const fetchAnomalies = async () => {
    setLoadingAnomalies(true);
    try {
      const [scanRes, alertsRes] = await Promise.all([
        api.getAnomalyScan(anomalyZThreshold),
        api.getAnomalyAlerts(),
      ]);
      setAnomalyScan(scanRes);
      setAnomalyAlerts(alertsRes);
    } catch (err) {
      console.error("Failed to load anomalies:", err);
    } finally {
      setLoadingAnomalies(false);
    }
  };

  // Load Model Registry
  const fetchRegistry = async () => {
    setLoadingRegistry(true);
    try {
      const [modelsRes, jobsRes] = await Promise.all([api.getMLModels(), api.getMLJobs()]);
      setModels(modelsRes);
      setJobs(jobsRes);
    } catch (err) {
      console.error("Failed to load ML registry:", err);
    } finally {
      setLoadingRegistry(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, []);

  useEffect(() => {
    if (activeSubTab === "forecast") fetchForecast();
    if (activeSubTab === "churn") fetchChurn();
    if (activeSubTab === "anomalies") fetchAnomalies();
    if (activeSubTab === "registry") fetchRegistry();
  }, [activeSubTab, forecastAggregation, forecastHorizon, churnInactivityDays, anomalyZThreshold]);

  const handleAcknowledgeAlert = async (id: number) => {
    try {
      await api.acknowledgeAnomalyAlert(id);
      setAnomalyAlerts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, is_acknowledged: true } : a))
      );
    } catch (err) {
      console.error("Failed to acknowledge alert:", err);
    }
  };

  const handleTriggerJob = async () => {
    setTriggeringJob(true);
    try {
      await api.triggerMLJob(selectedJobType);
      await fetchRegistry();
    } catch (err) {
      console.error("Failed to trigger job:", err);
    } finally {
      setTriggeringJob(false);
    }
  };

  const handleApproveVersion = async (modelId: number, versionId: number) => {
    try {
      await api.approveModelVersion(modelId, versionId);
      await fetchRegistry();
    } catch (err) {
      console.error("Failed to approve model version:", err);
    }
  };

  const formatCurrency = (val?: number | null) => {
    if (val === undefined || val === null) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Format combined timeline data for forecasting chart
  const combinedForecastChartData = React.useMemo(() => {
    if (!forecastData || !forecastData.historical_data) return [];
    interface ForecastChartPoint {
      date: string;
      historicalRevenue: number | null;
      forecastRevenue: number | null;
      intervalLower: number | null;
      intervalUpper: number | null;
    }

    const hist: ForecastChartPoint[] = forecastData.historical_data.map((h) => ({
      date: h.date,
      historicalRevenue: h.revenue,
      forecastRevenue: null,
      intervalLower: null,
      intervalUpper: null,
    }));

    const future: ForecastChartPoint[] = (forecastData.forecast_data || []).map((f) => ({
      date: f.date,
      historicalRevenue: null,
      forecastRevenue: f.forecast,
      intervalLower: f.prediction_interval_lower,
      intervalUpper: f.prediction_interval_upper,
    }));

    if (hist.length > 0 && future.length > 0) {
      const lastHist = hist[hist.length - 1];
      future[0].historicalRevenue = lastHist.historicalRevenue;
    }

    return [...hist, ...future];
  }, [forecastData]);

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <MetrivaBadge variant="cyan" size="sm">
              <Sparkles className="h-3 w-3 mr-1 inline" /> Machine Intelligence
            </MetrivaBadge>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Cpu className="h-6 w-6 text-cyan-600 dark:text-cyan-400" />
            Predictive Analytics & Machine Learning Engine
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Statistical time-series forecasting, leak-free RFM churn classification, and Tukey IQR / Z-score anomaly alerting.
          </p>
        </div>

        {/* Sub-tab Switcher */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800/80 p-1 rounded-xl backdrop-blur-md">
          <button
            onClick={() => setActiveSubTab("forecast")}
            className={`text-xs px-3.5 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
              activeSubTab === "forecast"
                ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-sm shadow-cyan-500/20 font-semibold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            <span>Forecasting</span>
          </button>
          <button
            onClick={() => setActiveSubTab("churn")}
            className={`text-xs px-3.5 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
              activeSubTab === "churn"
                ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-sm shadow-cyan-500/20 font-semibold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <UserX className="h-3.5 w-3.5" />
            <span>Customer Churn</span>
          </button>
          <button
            onClick={() => setActiveSubTab("anomalies")}
            className={`text-xs px-3.5 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
              activeSubTab === "anomalies"
                ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-sm shadow-cyan-500/20 font-semibold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>Anomalies</span>
          </button>
          <button
            onClick={() => setActiveSubTab("registry")}
            className={`text-xs px-3.5 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
              activeSubTab === "registry"
                ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-sm shadow-cyan-500/20 font-semibold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <BrainCircuit className="h-3.5 w-3.5" />
            <span>Model Registry</span>
          </button>
        </div>
      </div>

      {/* Structured Executive AI Insights Briefing */}
      {insights?.executive_summary && (
        <div className="rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 p-5 shadow-xl space-y-4 transition-colors">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Executive Predictive Briefing & Epistemic Taxonomy
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
              Grounded Evidence Matrix
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Verified Historical Facts */}
            <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 space-y-2">
              <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-semibold text-xs uppercase tracking-wider">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Observed Historical Facts</span>
              </div>
              <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                {(insights.executive_summary?.observed_historical_facts || []).map((fact, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-blue-600 dark:text-blue-400 font-bold">•</span>
                    <span>{fact}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 2. Predictive Estimates */}
            <div className="p-3.5 rounded-xl bg-purple-50/70 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/40 space-y-2">
              <div className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400 font-semibold text-xs uppercase tracking-wider">
                <TrendingUp className="h-3.5 w-3.5" />
                <span>Predictive Estimates</span>
              </div>
              <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                {(insights.executive_summary?.predictive_estimates || []).map((pred, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-purple-600 dark:text-purple-400 font-bold">•</span>
                    <span>{pred}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 3. Statistical Associations */}
            <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 space-y-2">
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold text-xs uppercase tracking-wider">
                <Activity className="h-3.5 w-3.5" />
                <span>Statistical Associations</span>
              </div>
              <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                {(insights.executive_summary?.statistical_associations || []).map((assoc, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">•</span>
                    <span>{assoc}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 4. Investigation Hypotheses */}
            <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 space-y-2">
              <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold text-xs uppercase tracking-wider">
                <Lightbulb className="h-3.5 w-3.5" />
                <span>Investigation Hypotheses</span>
              </div>
              <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                {(insights.executive_summary?.investigation_hypotheses || []).map((hyp, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-amber-600 dark:text-amber-400 font-bold">•</span>
                    <span>{hyp}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 1: REVENUE FORECASTING */}
      {/* ========================================================================= */}
      {activeSubTab === "forecast" && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Granularity:</span>
                <div className="flex bg-white dark:bg-slate-950 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
                  {(["daily", "weekly", "monthly"] as const).map((g) => (
                    <button
                      key={g}
                      onClick={() => setForecastAggregation(g)}
                      className={`px-3 py-1 text-xs font-medium rounded capitalize transition ${
                        forecastAggregation === g
                          ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Horizon:</span>
                <select
                  value={forecastHorizon}
                  onChange={(e) => setForecastHorizon(Number(e.target.value))}
                  className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500"
                >
                  <option value={3}>3 periods</option>
                  <option value={6}>6 periods</option>
                  <option value={12}>12 periods</option>
                  <option value={24}>24 periods</option>
                </select>
              </div>
            </div>

            <button
              onClick={fetchForecast}
              disabled={loadingForecast}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 rounded-lg transition shadow-sm"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingForecast ? "animate-spin" : ""}`} />
              <span>Recalculate Forecast</span>
            </button>
          </div>

          {loadingForecast ? (
            <div className="flex items-center justify-center min-h-[300px] rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800">
              <div className="flex flex-col items-center gap-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
                <span className="text-xs text-slate-500 dark:text-slate-400">Estimating exponential smoothing parameters...</span>
              </div>
            </div>
          ) : !forecastData?.success ? (
            <div className="p-8 text-center rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-rose-600 dark:text-rose-400 text-xs">
              {forecastData?.error || "Unable to compute forecast for the selected parameters"}
            </div>
          ) : (
            <>
              {/* Telemetry / Model Metrics Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-1">
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Model Architecture</div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white font-mono">{forecastData.model_name}</div>
                  <div className="text-[11px] text-cyan-600 dark:text-cyan-400 font-mono">v{forecastData.model_version}</div>
                </div>

                <div className="p-4 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-1">
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">In-Sample Accuracy</div>
                  <div className="text-base font-bold text-slate-900 dark:text-white font-mono">
                    MAE: {formatCurrency(forecastData.evaluation_metrics.mae)}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    RMSE: {formatCurrency(forecastData.evaluation_metrics.rmse)}
                  </div>
                </div>

                {forecastData.baseline_comparison && (
                  <div className="p-4 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-1">
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Baseline Benchmark</div>
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      {forecastData.baseline_comparison.baseline_type}
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      Baseline MAE: {formatCurrency(forecastData.baseline_comparison.baseline_mae)}
                    </div>
                  </div>
                )}

                {forecastData.baseline_comparison && (
                  <div className="p-4 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-1 flex flex-col justify-center">
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Evaluation Status</div>
                    {forecastData.baseline_comparison.outperforms_baseline ? (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
                        <CheckCircle className="h-3.5 w-3.5" />
                        <span>Outperforms Baseline</span>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/80 text-amber-700 dark:text-amber-300 text-xs font-semibold">
                        <HelpCircle className="h-3.5 w-3.5" />
                        <span>Parity With Baseline</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Time-Series Forecast Chart */}
              <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                      Revenue Trajectory & 95% Confidence Bounds
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Solid line denotes historical records; dashed purple denotes point forecast with upper/lower bounds.
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-full bg-cyan-500"></span> Actual
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-full bg-purple-500"></span> Forecast
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2.5 w-5 bg-purple-500/20 border border-purple-500/40 rounded"></span> 95% Interval
                    </span>
                  </div>
                </div>

                <div className="h-[360px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={combinedForecastChartData}
                      margin={{ top: 10, right: 20, left: 20, bottom: 25 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                      <XAxis
                        dataKey="date"
                        stroke={axisStroke}
                        fontSize={11}
                        tickFormatter={(v) => String(v).substring(0, 10)}
                      />
                      <YAxis
                        stroke={axisStroke}
                        fontSize={11}
                        tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(value: any, name: string) => {
                          if (value === null || value === undefined) return ["—", name];
                          const labelMap: Record<string, string> = {
                            historicalRevenue: "Historical Revenue",
                            forecastRevenue: "Point Forecast",
                            intervalLower: "95% Lower Bound",
                            intervalUpper: "95% Upper Bound",
                          };
                          return [formatCurrency(Number(value)), labelMap[name] || name];
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px", color: axisStroke }} />
                      <Line
                        type="monotone"
                        dataKey="historicalRevenue"
                        name="Historical Revenue"
                        stroke="#06b6d4"
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: "#06b6d4" }}
                      />
                      <Line
                        type="monotone"
                        dataKey="forecastRevenue"
                        name="Point Forecast"
                        stroke="#a855f7"
                        strokeWidth={2.5}
                        strokeDasharray="5 5"
                        dot={{ r: 4, fill: "#a855f7" }}
                      />
                      <Area
                        type="monotone"
                        dataKey="intervalUpper"
                        name="Upper Bound (95%)"
                        stroke="#a855f7"
                        strokeOpacity={0.3}
                        fill="#a855f7"
                        fillOpacity={0.12}
                      />
                      <Area
                        type="monotone"
                        dataKey="intervalLower"
                        name="Lower Bound (95%)"
                        stroke="#a855f7"
                        strokeOpacity={0.3}
                        fill={isDark ? "#0f172a" : "#ffffff"}
                        fillOpacity={0}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Forecast Points Table */}
              <div className="rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Projected Revenue Schedule ({forecastHorizon} periods forward)
                  </h4>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    Additive Holt-Winters Model
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-2.5 px-4 font-semibold uppercase tracking-wider">Step</th>
                        <th className="py-2.5 px-4 font-semibold uppercase tracking-wider">Period Date</th>
                        <th className="py-2.5 px-4 font-semibold uppercase tracking-wider text-right">Point Forecast</th>
                        <th className="py-2.5 px-4 font-semibold uppercase tracking-wider text-right">95% Lower Bound</th>
                        <th className="py-2.5 px-4 font-semibold uppercase tracking-wider text-right">95% Upper Bound</th>
                        <th className="py-2.5 px-4 font-semibold uppercase tracking-wider text-right">Band Spread</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 font-mono">
                      {forecastData.forecast_data.map((pt, idx) => {
                        const spread = pt.prediction_interval_upper - pt.prediction_interval_lower;
                        return (
                          <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                            <td className="py-2.5 px-4 text-slate-500 dark:text-slate-400 font-sans">+{pt.horizon_step}</td>
                            <td className="py-2.5 px-4 font-semibold text-slate-800 dark:text-slate-200">
                              {String(pt.date).substring(0, 10)}
                            </td>
                            <td className="py-2.5 px-4 text-right font-bold text-cyan-700 dark:text-cyan-300">
                              {formatCurrency(pt.forecast)}
                            </td>
                            <td className="py-2.5 px-4 text-right text-slate-500 dark:text-slate-400">
                              {formatCurrency(pt.prediction_interval_lower)}
                            </td>
                            <td className="py-2.5 px-4 text-right text-slate-500 dark:text-slate-400">
                              {formatCurrency(pt.prediction_interval_upper)}
                            </td>
                            <td className="py-2.5 px-4 text-right text-slate-500">
                              ±{formatCurrency(spread / 2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 2: CUSTOMER CHURN RADAR */}
      {/* ========================================================================= */}
      {activeSubTab === "churn" && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Inactivity Definition:</span>
              <div className="flex bg-white dark:bg-slate-950 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
                {[60, 90, 120, 180].map((d) => (
                  <button
                    key={d}
                    onClick={() => setChurnInactivityDays(d)}
                    className={`px-3 py-1 text-xs font-medium rounded transition ${
                      churnInactivityDays === d
                        ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                    }`}
                  >
                    {d} days
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={fetchChurn}
              disabled={loadingChurn}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 rounded-lg transition"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingChurn ? "animate-spin" : ""}`} />
              <span>Re-evaluate Churn</span>
            </button>
          </div>

          {loadingChurn ? (
            <div className="flex items-center justify-center min-h-[300px] rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800">
              <div className="flex flex-col items-center gap-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
                <span className="text-xs text-slate-500 dark:text-slate-400">Engineering leak-free RFM features...</span>
              </div>
            </div>
          ) : !churnData?.success ? (
            <div className="p-8 text-center rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-rose-600 dark:text-rose-400 text-xs">
              {churnData?.error || "Unable to compute churn prediction"}
            </div>
          ) : (
            <>
              {/* Churn Metrics Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-1">
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Cohort Churn Rate</div>
                  <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 font-mono">
                    {churnData.churn_rate_pct.toFixed(1)}%
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {churnData.total_cohort_customers} total analyzed customers
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-1">
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Model Precision & Recall</div>
                  <div className="text-base font-bold text-slate-900 dark:text-white font-mono">
                    P: {(churnData.evaluation_metrics.precision * 100).toFixed(1)}% | R:{" "}
                    {(churnData.evaluation_metrics.recall * 100).toFixed(1)}%
                  </div>
                  <div className="text-[11px] text-cyan-600 dark:text-cyan-400 font-mono">
                    F1 Score: {(churnData.evaluation_metrics.f1_score * 100).toFixed(1)}%
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-1">
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Confusion Matrix</div>
                  <div className="text-xs font-mono text-slate-700 dark:text-slate-300">
                    TP: {churnData.evaluation_metrics.confusion_matrix.tp} | FP:{" "}
                    {churnData.evaluation_metrics.confusion_matrix.fp}
                  </div>
                  <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                    TN: {churnData.evaluation_metrics.confusion_matrix.tn} | FN:{" "}
                    {churnData.evaluation_metrics.confusion_matrix.fn}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-1">
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Risk Distribution</div>
                  <div className="flex items-center gap-2 pt-1">
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                      High: {churnData.risk_distribution.high_risk_count}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                      Med: {churnData.risk_distribution.medium_risk_count}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      Low: {churnData.risk_distribution.low_risk_count}
                    </span>
                  </div>
                </div>
              </div>

              {/* Feature Importance Weights */}
              {churnData.feature_importance && (
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-3">
                  <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Model Feature Importance Weights (Calibrated Logistic Classifier)
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {Object.entries(churnData.feature_importance).map(([k, weight]) => (
                      <div key={k} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium capitalize">
                          {k.replace("_", " ")}
                        </div>
                        <div className="text-sm font-bold text-cyan-700 dark:text-cyan-300 font-mono">
                          {Number(weight).toFixed(3)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* At-Risk Customers Ledger */}
              <div className="rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Top At-Risk Customer Cohort</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Evaluated on cutoff date to strictly prevent lookahead target contamination
                    </p>
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    {churnData.top_at_risk_customers.length} prioritized
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-2.5 px-4 font-semibold uppercase tracking-wider">Customer</th>
                        <th className="py-2.5 px-4 font-semibold uppercase tracking-wider">Segment</th>
                        <th className="py-2.5 px-4 font-semibold uppercase tracking-wider text-right">Recency</th>
                        <th className="py-2.5 px-4 font-semibold uppercase tracking-wider text-right">Orders</th>
                        <th className="py-2.5 px-4 font-semibold uppercase tracking-wider text-right">Total Spend</th>
                        <th className="py-2.5 px-4 font-semibold uppercase tracking-wider text-right">Risk Score</th>
                        <th className="py-2.5 px-4 font-semibold uppercase tracking-wider text-center">Risk Level</th>
                        <th className="py-2.5 px-4 font-semibold uppercase tracking-wider">Primary Drivers</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 font-mono">
                      {churnData.top_at_risk_customers.map((c) => (
                        <tr key={c.customer_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                          <td className="py-2.5 px-4 font-sans">
                            <div className="font-semibold text-slate-800 dark:text-slate-200">{c.customer_name}</div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">{c.customer_email}</div>
                          </td>
                          <td className="py-2.5 px-4 font-sans text-cyan-700 dark:text-cyan-300 font-medium">
                            {c.customer_segment || "Standard"}
                          </td>
                          <td className="py-2.5 px-4 text-right text-slate-700 dark:text-slate-300">
                            {c.recency_days} days
                          </td>
                          <td className="py-2.5 px-4 text-right text-slate-700 dark:text-slate-300">{c.order_frequency}</td>
                          <td className="py-2.5 px-4 text-right font-medium text-slate-900 dark:text-slate-200">
                            {formatCurrency(c.total_spend)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-bold text-rose-600 dark:text-rose-300">
                            {c.risk_score.toFixed(1)}%
                          </td>
                          <td className="py-2.5 px-4 text-center font-sans">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                c.risk_level === "HIGH"
                                  ? "bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                                  : c.risk_level === "MEDIUM"
                                  ? "bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                                  : "bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                              }`}
                            >
                              {c.risk_level}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 font-sans text-[11px] text-slate-500 dark:text-slate-400">
                            {Object.entries(c.primary_drivers || {})
                              .slice(0, 2)
                              .map(([k, v]) => `${k.replace("_", " ")}: ${v.toFixed(2)}`)
                              .join(" | ") || "Inactivity drift"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 3: ANOMALY DETECTION */}
      {/* ========================================================================= */}
      {activeSubTab === "anomalies" && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Sensitivity Threshold (Z-Score):</span>
              <div className="flex bg-white dark:bg-slate-950 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
                {[2.0, 2.5, 3.0, 3.5].map((z) => (
                  <button
                    key={z}
                    onClick={() => setAnomalyZThreshold(z)}
                    className={`px-3 py-1 text-xs font-medium rounded transition ${
                      anomalyZThreshold === z
                        ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                    }`}
                  >
                    {z}σ
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={fetchAnomalies}
              disabled={loadingAnomalies}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 rounded-lg transition"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingAnomalies ? "animate-spin" : ""}`} />
              <span>Run Immediate Scan</span>
            </button>
          </div>

          {loadingAnomalies ? (
            <div className="flex items-center justify-center min-h-[300px] rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800">
              <div className="flex flex-col items-center gap-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
                <span className="text-xs text-slate-500 dark:text-slate-400">Computing Tukey IQR fences and Z-scores...</span>
              </div>
            </div>
          ) : (
            <>
              {/* Baseline Summary Matrix */}
              {anomalyScan?.metric_baselines && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(anomalyScan.metric_baselines).map(([metric, stats]) => (
                    <div key={metric} className="p-4 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-1">
                      <div className="text-xs text-slate-500 dark:text-slate-400 font-medium capitalize">
                        {metric.replace("_", " ")}
                      </div>
                      <div className="text-base font-bold text-slate-900 dark:text-white font-mono">
                        Mean: {stats.mean.toFixed(1)}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                        σ: {stats.std.toFixed(1)} | Anomalies: {stats.anomalies_count}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Detected Anomalies Feed */}
              <div className="rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl space-y-3 p-5">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-rose-500" />
                    Active Anomaly Alerts Feed
                  </h4>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    {anomalyAlerts.length} persisted alerts
                  </span>
                </div>

                {!anomalyAlerts.length ? (
                  <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                    No active anomalies detected above {anomalyZThreshold} standard deviations.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {anomalyAlerts.map((alert) => (
                      <div
                        key={alert.id}
                        className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
                          alert.is_acknowledged
                            ? "bg-slate-100/50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800/60 opacity-60"
                            : alert.severity === "CRITICAL"
                            ? "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60"
                            : "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/50"
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                alert.severity === "CRITICAL"
                                  ? "bg-rose-100 dark:bg-rose-900/80 text-rose-800 dark:text-rose-200"
                                  : alert.severity === "HIGH"
                                  ? "bg-amber-100 dark:bg-amber-900/80 text-amber-800 dark:text-amber-200"
                                  : "bg-blue-100 dark:bg-blue-900/80 text-blue-800 dark:text-blue-200"
                              }`}
                            >
                              {alert.severity}
                            </span>
                            <span className="text-xs font-semibold text-slate-900 dark:text-white capitalize">
                              {alert.metric_name.replace("_", " ")}
                            </span>
                            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                              {new Date(alert.alert_timestamp).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-xs text-slate-700 dark:text-slate-300">{alert.context_summary}</p>
                          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                            Observed: {alert.observed_value.toFixed(1)} vs Baseline:{" "}
                            {alert.baseline_value.toFixed(1)} (Deviation: {alert.deviation_score.toFixed(2)}σ)
                          </div>
                        </div>

                        <div>
                          {alert.is_acknowledged ? (
                            <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Acknowledged
                            </span>
                          ) : (
                            <button
                              onClick={() => handleAcknowledgeAlert(alert.id)}
                              className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition"
                            >
                              Acknowledge
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 4: MODEL REGISTRY & ASYNC JOBS */}
      {/* ========================================================================= */}
      {activeSubTab === "registry" && (
        <div className="space-y-6">
          {/* Action Header */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Trigger Training Job:</span>
              <select
                value={selectedJobType}
                onChange={(e) => setSelectedJobType(e.target.value)}
                className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500"
              >
                <option value="TRAIN_FORECAST">Retrain Revenue Forecast Model</option>
                <option value="TRAIN_CHURN">Retrain Churn Classifier Model</option>
                <option value="ANOMALY_SCAN">Execute Complete Anomaly Scan</option>
              </select>

              <button
                onClick={handleTriggerJob}
                disabled={triggeringJob}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 rounded-lg transition shadow-md shadow-cyan-500/20 disabled:opacity-50"
              >
                <Play className={`h-3.5 w-3.5 ${triggeringJob ? "animate-spin" : ""}`} />
                <span>Trigger Job</span>
              </button>
            </div>

            <button
              onClick={fetchRegistry}
              disabled={loadingRegistry}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg transition"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingRegistry ? "animate-spin" : ""}`} />
              <span>Refresh Registry</span>
            </button>
          </div>

          {loadingRegistry ? (
            <div className="flex items-center justify-center min-h-[300px] rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Registered Models Card */}
              <div className="rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <BrainCircuit className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                    Model Artifact Registry
                  </h4>
                  <span className="text-xs font-mono text-slate-500 dark:text-slate-400">{models.length} registered models</span>
                </div>

                {!models.length ? (
                  <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                    No models registered. Run a training job to initialize artifacts.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {models.map((model) => (
                      <div key={model.id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900 dark:text-white font-mono">{model.name}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-50 dark:bg-cyan-950/80 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
                            {model.model_type}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400">{model.description}</p>

                        <div className="pt-2 border-t border-slate-200 dark:border-slate-800/60 space-y-2">
                          <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Model Versions:</div>
                          {model.versions?.map((ver) => (
                            <div
                              key={ver.id}
                              className="flex items-center justify-between text-xs p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/60"
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-cyan-700 dark:text-cyan-300 font-semibold">{ver.version}</span>
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                    ver.approval_status === "APPROVED"
                                      ? "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                                  }`}
                                >
                                  {ver.approval_status}
                                </span>
                              </div>
                              {ver.approval_status !== "APPROVED" && (
                                <button
                                  onClick={() => handleApproveVersion(model.id, ver.id)}
                                  className="text-[11px] px-2 py-0.5 rounded font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition"
                                >
                                  Approve & Activate
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Background Training Jobs Card */}
              <div className="rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Clock className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                    Background Job Execution Log
                  </h4>
                  <span className="text-xs font-mono text-slate-500 dark:text-slate-400">{jobs.length} jobs</span>
                </div>

                {!jobs.length ? (
                  <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                    No background jobs recorded yet.
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                    {jobs.map((job) => (
                      <div
                        key={job.id}
                        className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            #{job.id} - {job.job_type}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              job.status === "SUCCESS"
                                ? "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                                : job.status === "RUNNING"
                                ? "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                                : job.status === "FAILED"
                                ? "bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                            }`}
                          >
                            {job.status} ({job.progress_pct}%)
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-1.5 rounded-full ${
                              job.status === "FAILED" ? "bg-rose-500" : "bg-cyan-500"
                            }`}
                            style={{ width: `${job.progress_pct}%` }}
                          ></div>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                          <span>
                            Triggered: {new Date(job.created_at).toLocaleTimeString()}
                          </span>
                          <span>
                            {job.started_at && job.completed_at
                              ? `${Math.max(0, new Date(job.completed_at).getTime() - new Date(job.started_at).getTime())}ms`
                              : "—"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
export default MLDashboardView;
