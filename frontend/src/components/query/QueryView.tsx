import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Clock,
  Code2,
  Copy,
  Database,
  Download,
  Lightbulb,
  Play,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal,
} from "lucide-react";
import { api } from "../../services/api";
import { DataSource, QueryExecutionResult } from "../../types";
import { ChartRecommendationView } from "./ChartRecommendationView";
import { MetrivaBadge, MetrivaButton, MetrivaCard } from "../ui";

const DEMO_EXAMPLE_QUERIES = [
  "Show the top 10 customers by revenue.",
  "What was our monthly revenue in 2026?",
  "Which products generated the most revenue?",
  "What is the average order value across all orders?",
  "Show the distribution of orders by status.",
];

interface QueryViewProps {
  initialQuestion?: string;
}

export const QueryView: React.FC<QueryViewProps> = ({ initialQuestion = "" }) => {
  const [question, setQuestion] = useState(initialQuestion);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QueryExecutionResult | null>(null);
  const [error, setError] = useState<{ message: string; code?: string; details?: any } | null>(null);
  const [copied, setCopied] = useState(false);
  const [directMode, setDirectMode] = useState(false);
  const [directSQL, setDirectSQL] = useState("");
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [selectedDsId, setSelectedDsId] = useState<number | null>(() => {
    try {
      const saved = localStorage.getItem("metriva_selected_datasource_id");
      return saved ? Number(saved) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    api
      .getDataSources()
      .then((ds) => {
        const activeList = Array.isArray(ds) ? ds.filter((d) => d.is_active) : [];
        setDataSources(activeList);
        if (selectedDsId && !activeList.some((d) => d.id === selectedDsId)) {
          setSelectedDsId(null);
          localStorage.removeItem("metriva_selected_datasource_id");
        }
      })
      .catch((err) => console.warn("Could not load data sources for query selector:", err));
  }, []);

  const handleSelectDataSource = (id: number | null) => {
    setSelectedDsId(id);
    setResult(null);
    setError(null);
    try {
      if (id !== null) {
        localStorage.setItem("metriva_selected_datasource_id", String(id));
      } else {
        localStorage.removeItem("metriva_selected_datasource_id");
      }
    } catch {
      // Ignore storage errors
    }
  };

  const activeDataSource = dataSources.find((d) => d.id === selectedDsId);

  // Dynamic suggested questions based on active datasource
  const getExampleQueries = () => {
    if (!activeDataSource) {
      return DEMO_EXAMPLE_QUERIES;
    }
    const cachedTables = activeDataSource.cached_schema?.tables?.map((t) => t.name) || [];
    if (cachedTables.includes("accounts")) {
      return [
        "Show accounts",
        "SELECT account_name, mrr_amount FROM accounts ORDER BY mrr_amount DESC LIMIT 3;",
        "SELECT status, COUNT(*) AS total_invoices, SUM(amount) AS total_amount FROM invoices GROUP BY status;",
        "SELECT plan_name, SUM(seats_purchased) AS total_seats FROM subscriptions GROUP BY plan_name;",
      ];
    }
    return DEMO_EXAMPLE_QUERIES;
  };

  const handleAsk = async (qToAsk?: string) => {
    const rawInput = (qToAsk !== undefined ? qToAsk : (directMode ? directSQL : question)).trim();
    if (!rawInput) return;

    // Direct SQL syntax detection: if input starts with SELECT or WITH, route to direct SQL executor
    const isExplicitSQL = /^(SELECT|WITH)\s/i.test(rawInput);
    const useDirectMode = directMode || isExplicitSQL;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      if (useDirectMode) {
        if (!directMode) {
          setDirectMode(true);
          setDirectSQL(rawInput);
        }
        const data = await api.executeDirectSQL(rawInput, "Direct SQL Query", selectedDsId);
        setResult(data);
      } else {
        const data = await api.askQuestion(rawInput, false, selectedDsId);
        setResult(data);
      }
    } catch (err: any) {
      setError({
        message: err.message || "Failed to process query",
        code: err.code,
        details: err.details,
      });
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const exportCSV = () => {
    if (!result || !result.columns || !result.rows.length) return;
    const header = result.columns.join(",");
    const rows = result.rows.map((r) =>
      r
        .map((cell) => {
          if (cell === null || cell === undefined) return "";
          const str = String(cell);
          return str.includes(",") ? `"${str.replace(/"/g, '""')}"` : str;
        })
        .join(",")
    );
    const csvContent = "data:text/csv;charset=utf-8," + [header, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `query_results_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800/80">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <Sparkles className="h-6 w-6 text-cyan-600 dark:text-cyan-400" />
            Natural Language Query Interface
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Ask questions in plain English. The AI generates safe, validated SQL queries with automated execution and analysis.
          </p>
        </div>

        <button
          onClick={() => {
            const nextMode = !directMode;
            setDirectMode(nextMode);
            setError(null);
            setResult(null);
            if (nextMode && !directSQL.trim() && /^(SELECT|WITH)\s/i.test(question.trim())) {
              setDirectSQL(question.trim());
            }
          }}
          className="self-start sm:self-auto text-xs px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900/80 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center gap-2 transition"
        >
          <Code2 className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
          <span>{directMode ? "Switch to Natural Language" : "Direct SQL Mode"}</span>
        </button>
      </div>

      {/* Target Data Source Selector Banner */}
      <MetrivaCard padding="sm" glow={Boolean(selectedDsId)} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-xs flex-wrap">
          <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200">
            <Database className="h-4 w-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
            <span>Target Database:</span>
          </div>

          <select
            value={selectedDsId || ""}
            onChange={(e) => handleSelectDataSource(e.target.value ? Number(e.target.value) : null)}
            className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-cyan-400 font-medium cursor-pointer shadow-sm"
          >
            <option value="">Internal Analytics DB (PostgreSQL - Built-in)</option>
            {dataSources.map((ds) => (
              <option key={ds.id} value={ds.id}>
                {ds.name} ({ds.engine.toUpperCase()})
              </option>
            ))}
          </select>

          {activeDataSource ? (
            <MetrivaBadge variant="cyan" size="sm" pulse>
              External Database: {activeDataSource.name} ({activeDataSource.engine.toUpperCase()})
            </MetrivaBadge>
          ) : (
            <MetrivaBadge variant="blue" size="sm">
              Demo Database (PostgreSQL 16 · Built-in)
            </MetrivaBadge>
          )}
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
          <Shield className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Read-Only Guard Active</span>
        </div>
      </MetrivaCard>

      {/* Main Input Card */}
      <MetrivaCard padding="lg" className="space-y-4">
        {!directMode ? (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Business Question
              </label>
              {activeDataSource && (
                <span className="text-[11px] text-cyan-600 dark:text-cyan-400 font-medium">
                  Routing to: {activeDataSource.name}
                </span>
              )}
            </div>
            <div className="relative">
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    handleAsk();
                  }
                }}
                rows={3}
                placeholder="Ask anything about customers, revenue, products, orders, or clickstream events..."
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none font-sans"
              />
              <div className="absolute right-3 bottom-3 flex items-center gap-2">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 hidden sm:inline">⌘ + Enter to run</span>
                <MetrivaButton
                  disabled={loading || !question.trim()}
                  onClick={() => handleAsk()}
                  size="sm"
                  variant="primary"
                  loading={loading}
                  icon={<Play className="h-3.5 w-3.5 fill-current" />}
                >
                  Generate & Execute
                </MetrivaButton>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Direct SQL Query (Tested against security validator)
              </label>
              <span className="text-[11px] text-cyan-600 dark:text-cyan-400 font-mono">
                Engine: {activeDataSource ? activeDataSource.engine.toUpperCase() : "POSTGRESQL"}
              </span>
            </div>
            <div className="relative">
              <textarea
                value={directSQL}
                onChange={(e) => setDirectSQL(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    handleAsk();
                  }
                }}
                rows={5}
                placeholder="SELECT c.name, SUM(o.total_amount) FROM customers c JOIN orders o ON c.id = o.customer_id GROUP BY c.name LIMIT 10;"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-sm text-slate-900 dark:text-white font-mono placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none"
              />
              <div className="flex items-center justify-between mt-3">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 hidden sm:inline">⌘ + Enter to run</span>
                <MetrivaButton
                  disabled={loading || !directSQL.trim()}
                  onClick={() => handleAsk()}
                  size="sm"
                  variant="primary"
                  loading={loading}
                  icon={<Terminal className="h-3.5 w-3.5" />}
                >
                  Validate & Execute SQL
                </MetrivaButton>
              </div>
            </div>
          </div>
        )}

        {/* Example Query Pills */}
        {!directMode && (
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-2.5">
              <Lightbulb className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
              <span>Suggested Analytical Questions:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {getExampleQueries().map((sample, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setQuestion(sample);
                    handleAsk(sample);
                  }}
                  className="text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-950/70 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-300 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-cyan-500/30 transition text-left flex items-center gap-1.5 active:scale-98"
                >
                  <span>{sample}</span>
                  <ArrowRight className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                </button>
              ))}
            </div>
          </div>
        )}
      </MetrivaCard>

      {/* Error Message Card */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-200 flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">Query Blocked / Failed</span>
              {error.code && (
                <span className="text-[10px] font-mono bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 px-2 py-0.5 rounded border border-rose-300 dark:border-rose-700/50">
                  {error.code}
                </span>
              )}
            </div>
            <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed">{error.message}</p>
            {error.details?.raw_sql && (
              <div className="mt-2 text-xs font-mono bg-white dark:bg-slate-950 p-2.5 rounded-lg border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-400">
                {error.details.raw_sql}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Query Execution Output */}
      {result && (
        <div className="space-y-6">
          {/* Active Data Source Execution Pill */}
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
            <span>
              Target Engine:{" "}
              <strong className="text-cyan-700 dark:text-cyan-300">
                {selectedDsId ? activeDataSource?.name || "External Data Source" : "Internal Analytics DB"}
              </strong>{" "}
              ({selectedDsId ? activeDataSource?.engine?.toUpperCase() || "EXTERNAL" : "POSTGRESQL"})
            </span>
            <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
              <Check className="h-3.5 w-3.5" />
              Verified Read-Only
            </span>
          </div>

          {/* SQL Preview Box */}
          <MetrivaCard padding="none" className="overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800/90 bg-slate-50 dark:bg-slate-950/70 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-200 dark:border-emerald-500/20">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Validated & Safe (Read-Only)</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <Clock className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                  <span>
                    Executed in <strong className="text-slate-800 dark:text-white">{result.execution_time_ms} ms</strong>
                  </span>
                </div>
              </div>
              <button
                onClick={() => copyToClipboard(result.sql)}
                className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-300 transition px-2.5 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>{copied ? "Copied!" : "Copy SQL"}</span>
              </button>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-950 font-mono text-xs text-cyan-800 dark:text-cyan-300 overflow-x-auto leading-relaxed border-t border-slate-200 dark:border-slate-800">
              <pre>{result.sql}</pre>
            </div>
          </MetrivaCard>

          {/* AI Result Explanation Card */}
          {result.explanation && (
            <MetrivaCard padding="md" glow className="space-y-2 border-cyan-500/30">
              <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400 text-xs font-semibold uppercase tracking-wider">
                <Sparkles className="h-4 w-4" />
                <span>AI Business Analysis</span>
              </div>
              <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line prose prose-invert max-w-none">
                {result.explanation}
              </div>
            </MetrivaCard>
          )}

          {/* Interactive Chart & Visualization Recommender */}
          {result.rows.length > 0 && (
            <ChartRecommendationView
              result={result}
              question={question}
              dataSourceId={selectedDsId}
            />
          )}

          {/* Results Table Card */}
          <MetrivaCard padding="none" className="overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800/90 bg-slate-50 dark:bg-slate-950/70 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Execution Result Set</h3>
                <span className="text-xs bg-slate-100 dark:bg-slate-900 text-cyan-700 dark:text-cyan-300 px-2.5 py-0.5 rounded-full border border-cyan-200 dark:border-cyan-500/30 font-medium">
                  {result.row_count} {result.row_count === 1 ? "row" : "rows"} returned
                </span>
              </div>
              {result.rows.length > 0 && (
                <button
                  onClick={exportCSV}
                  className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 transition shadow-sm"
                >
                  <Download className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
                  <span>Export CSV</span>
                </button>
              )}
            </div>

            <div className="overflow-x-auto max-h-[500px]">
              {result.rows.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  No records returned for this query.
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 sticky top-0 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      {result.columns.map((col, idx) => (
                        <th key={idx} className="py-2.5 px-4 font-semibold uppercase tracking-wider">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {result.rows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                        {row.map((val, cIdx) => (
                          <td key={cIdx} className="py-2.5 px-4 text-slate-800 dark:text-slate-200">
                            {val === null || val === undefined ? (
                              <span className="text-slate-400 dark:text-slate-600 italic">null</span>
                            ) : typeof val === "number" ? (
                              <span className="font-mono text-cyan-700 dark:text-cyan-300">
                                {val.toLocaleString()}
                              </span>
                            ) : (
                              String(val)
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </MetrivaCard>
        </div>
      )}
    </div>
  );
};
