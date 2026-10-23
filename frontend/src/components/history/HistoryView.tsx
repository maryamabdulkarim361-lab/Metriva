import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Code2,
  Copy,
  History,
  Play,
  RotateCcw,
  Search,
  ShieldAlert,
} from "lucide-react";
import { api } from "../../services/api";
import { QueryHistoryItem } from "../../types";

interface HistoryViewProps {
  onSelectQueryForReRun: (question: string) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ onSelectQueryForReRun }) => {
  const [history, setHistory] = useState<QueryHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selectedItem, setSelectedItem] = useState<QueryHistoryItem | null>(null);
  const [rerunningId, setRerunningId] = useState<number | null>(null);

  const fetchHistoryData = async () => {
    setLoading(true);
    try {
      const data = await api.getQueryHistory(statusFilter);
      const items = Array.isArray(data) ? data : (data as any)?.results || [];
      setHistory(items);
    } catch (err) {
      console.error("Failed to load query history:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistoryData();
  }, [statusFilter]);

  const handleRerun = async (item: QueryHistoryItem) => {
    setRerunningId(item.id);
    try {
      await api.rerunQuery(item.id);
      fetchHistoryData();
    } catch (err) {
      console.error("Rerun failed:", err);
    } finally {
      setRerunningId(null);
    }
  };

  const filteredHistory = history.filter((item) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      item.natural_language_question.toLowerCase().includes(q) ||
      item.generated_sql.toLowerCase().includes(q)
    );
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "SUCCESS":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
            <CheckCircle2 className="h-3 w-3" />
            SUCCESS
          </span>
        );
      case "BLOCKED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">
            <ShieldAlert className="h-3 w-3" />
            BLOCKED
          </span>
        );
      case "FAILED":
      case "TIMEOUT":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20">
            <AlertCircle className="h-3 w-3" />
            {status}
          </span>
        );
      default:
        return <span>{status}</span>;
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <History className="h-6 w-6 text-cyan-600 dark:text-cyan-400" />
            Query Audit History
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Historical audit log of all natural language queries generated, validated, and executed.
          </p>
        </div>

        <button
          onClick={fetchHistoryData}
          className="self-start sm:self-auto flex items-center gap-1.5 text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 transition"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 text-slate-400 dark:text-slate-500 absolute left-3 top-3" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search queries or SQL statements..."
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-cyan-500"
        >
          <option value="">All Statuses</option>
          <option value="SUCCESS">Success Only</option>
          <option value="BLOCKED">Blocked (Violations)</option>
          <option value="FAILED">Failed</option>
        </select>
      </div>

      {/* History Table Card */}
      <div className="rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-lg transition-colors">
        {loading ? (
          <div className="p-12 text-center text-sm text-slate-500 dark:text-slate-400">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500 mx-auto mb-3"></div>
            Loading audit records...
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">
            No query history entries found. Run a query in the Query tab to populate audit logs.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-semibold uppercase tracking-wider">Status</th>
                  <th className="py-3 px-4 font-semibold uppercase tracking-wider">Question / SQL</th>
                  <th className="py-3 px-4 font-semibold uppercase tracking-wider text-right">Rows</th>
                  <th className="py-3 px-4 font-semibold uppercase tracking-wider text-right">Time</th>
                  <th className="py-3 px-4 font-semibold uppercase tracking-wider">Executed At</th>
                  <th className="py-3 px-4 font-semibold uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 font-sans">
                {filteredHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 whitespace-nowrap">{getStatusBadge(item.execution_status)}</td>
                    <td className="py-3 px-4 max-w-md">
                      <div className="font-medium text-slate-800 dark:text-slate-200 line-clamp-1">{item.natural_language_question}</div>
                      <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                        {item.generated_sql}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-700 dark:text-slate-300">
                      {item.row_count.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-700 dark:text-slate-300">
                      {item.execution_time_ms} ms
                    </td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {new Date(item.created_at).toLocaleDateString()} {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedItem(item)}
                          className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition"
                        >
                          Inspect
                        </button>
                        <button
                          disabled={rerunningId === item.id}
                          onClick={() => onSelectQueryForReRun(item.natural_language_question)}
                          className="px-2.5 py-1 rounded bg-cyan-50 dark:bg-cyan-600/20 hover:bg-cyan-100 dark:hover:bg-cyan-600/30 text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/30 transition flex items-center gap-1 font-medium"
                        >
                          <Play className="h-2.5 w-2.5 fill-current" />
                          <span>Re-ask</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Inspect Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto transition-colors">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Query Details #{selectedItem.id}</h3>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white text-sm"
              >
                ✕ Close
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-500 dark:text-slate-400 block uppercase font-medium">Question:</span>
                <p className="text-slate-800 dark:text-slate-200 text-sm mt-0.5">{selectedItem.natural_language_question}</p>
              </div>

              <div>
                <span className="text-slate-500 dark:text-slate-400 block uppercase font-medium">Generated SQL:</span>
                <pre className="mt-1 p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg font-mono text-xs text-cyan-700 dark:text-cyan-300 overflow-x-auto whitespace-pre-wrap">
                  {selectedItem.generated_sql}
                </pre>
              </div>

              {selectedItem.explanation && (
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block uppercase font-medium">AI Analysis:</span>
                  <div className="mt-1 p-3 bg-cyan-50 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-800/40 rounded-lg text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                    {selectedItem.explanation}
                  </div>
                </div>
              )}

              {selectedItem.error_message && (
                <div>
                  <span className="text-rose-600 dark:text-rose-400 block uppercase font-medium">Error Details:</span>
                  <div className="mt-1 p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 rounded-lg text-rose-800 dark:text-rose-300 font-mono">
                    {selectedItem.error_message}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <div>Status: <span className="text-slate-800 dark:text-white font-medium">{selectedItem.execution_status}</span></div>
                <div>Execution Time: <span className="text-slate-800 dark:text-white font-medium">{selectedItem.execution_time_ms} ms</span></div>
                <div>Rows: <span className="text-slate-800 dark:text-white font-medium">{selectedItem.row_count}</span></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default HistoryView;
