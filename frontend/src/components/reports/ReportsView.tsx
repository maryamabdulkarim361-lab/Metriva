import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  BarChart,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Database,
  ExternalLink,
  FileText,
  Filter,
  Layers,
  LineChart,
  Play,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { api } from "../../services/api";
import { SavedReport, ScheduledReport } from "../../types";
import { MetrivaCard, MetrivaBadge, MetrivaButton, METRIVA_TOKENS } from "../../design-system";

export const ReportsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"reports" | "schedules">("reports");
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [schedules, setSchedules] = useState<ScheduledReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Refresh Report modal state
  const [refreshingId, setRefreshingId] = useState<number | null>(null);
  const [refreshedResult, setRefreshedResult] = useState<any | null>(null);

  // New Schedule Modal state
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [targetReportForSchedule, setTargetReportForSchedule] = useState<SavedReport | null>(null);
  const [scheduleName, setScheduleName] = useState("");
  const [scheduleFrequency, setScheduleFrequency] = useState<"DAILY" | "WEEKLY" | "MONTHLY">("DAILY");
  const [scheduleTime, setScheduleTime] = useState("08:00");
  const [savingSchedule, setSavingSchedule] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [reps, scheds] = await Promise.all([
        api.getSavedReports(),
        api.getScheduledReports(),
      ]);
      setReports(Array.isArray(reps) ? reps : []);
      setSchedules(Array.isArray(scheds) ? scheds : []);
    } catch (err: any) {
      setError(err.message || "Failed to load reports and schedules.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefreshReport = async (rep: SavedReport) => {
    setRefreshingId(rep.id);
    setRefreshedResult(null);
    try {
      const res = await api.refreshSavedReport(rep.id);
      setRefreshedResult(res);
    } catch (err: any) {
      alert(`Report refresh failed: ${err.message}`);
    } finally {
      setRefreshingId(null);
    }
  };

  const handleDuplicate = async (rep: SavedReport) => {
    try {
      const copy = await api.duplicateSavedReport(rep.id);
      setReports((prev) => [copy, ...prev]);
      setSuccessMsg(`Report duplicated as "${copy.name}".`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      alert(`Duplication failed: ${err.message}`);
    }
  };

  const handleDeleteReport = async (rep: SavedReport) => {
    if (!window.confirm(`Delete saved report "${rep.name}"?`)) return;
    try {
      await api.deleteSavedReport(rep.id);
      setReports((prev) => prev.filter((r) => r.id !== rep.id));
      setSuccessMsg(`Report "${rep.name}" deleted.`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleToggleSchedule = async (sched: ScheduledReport) => {
    try {
      const res: any = await api.toggleSchedule(sched.id);
      const nextActive = res?.data?.is_active !== undefined ? res.data.is_active : res?.is_active;
      setSchedules((prev) =>
        prev.map((s) => (s.id === sched.id ? { ...s, is_active: nextActive ?? !s.is_active } : s))
      );
    } catch (err: any) {
      alert(`Failed to toggle schedule: ${err.message}`);
    }
  };

  const handleTriggerNow = async (sched: ScheduledReport) => {
    try {
      const res = await api.triggerScheduleNow(sched.id);
      alert(`Schedule triggered successfully. Status: ${res.data.status}`);
      loadData();
    } catch (err: any) {
      alert(`Trigger failed: ${err.message}`);
    }
  };

  const handleDeleteSchedule = async (sched: ScheduledReport) => {
    if (!window.confirm(`Delete schedule "${sched.name}"?`)) return;
    try {
      await api.deleteScheduledReport(sched.id);
      setSchedules((prev) => prev.filter((s) => s.id !== sched.id));
      setSuccessMsg(`Schedule deleted.`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const openScheduleModal = (rep: SavedReport) => {
    setTargetReportForSchedule(rep);
    setScheduleName(`Daily ${rep.name}`);
    setScheduleFrequency("DAILY");
    setScheduleTime("08:00");
    setIsScheduleModalOpen(true);
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetReportForSchedule) return;

    setSavingSchedule(true);
    try {
      const newSched = await api.createScheduledReport({
        report: targetReportForSchedule.id,
        name: scheduleName,
        frequency: scheduleFrequency,
        time_of_day: `${scheduleTime}:00`,
        timezone: "UTC",
        delivery_channel: "IN_APP",
      });
      setSchedules((prev) => [newSched, ...prev]);
      setIsScheduleModalOpen(false);
      setSuccessMsg(`Schedule "${scheduleName}" created.`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      alert(`Failed to create schedule: ${err.message}`);
    } finally {
      setSavingSchedule(false);
    }
  };

  const categories = ["All", ...Array.from(new Set(reports.map((r) => r.category || "General")))];

  const filteredReports = reports.filter((r) => {
    const matchesCat = selectedCategory === "All" || r.category === selectedCategory;
    const matchesSearch =
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.natural_language_question.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <MetrivaBadge variant="cyan" size="sm">
              <Sparkles className="h-3 w-3 mr-1 inline" /> BI & Reporting Engine
            </MetrivaBadge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <FileText className="h-6 w-6 text-cyan-600 dark:text-cyan-400" />
            Saved Reports & Automated Schedules
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Access curated business intelligence reports, execute live refreshes, and configure recurring delivery schedules.
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800/80 rounded-xl backdrop-blur-md">
          <button
            onClick={() => setActiveTab("reports")}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "reports"
                ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-sm shadow-cyan-500/20"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            Saved Reports ({reports.length})
          </button>
          <button
            onClick={() => setActiveTab("schedules")}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "schedules"
                ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-sm shadow-cyan-500/20"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            Schedules ({schedules.length})
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Reports Tab */}
      {activeTab === "reports" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 rounded-xl backdrop-blur-sm">
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 text-xs font-medium rounded-lg whitespace-nowrap transition-all ${
                    selectedCategory === cat
                      ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-sm font-semibold"
                      : "bg-white dark:bg-slate-950/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800/60"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder="Search reports..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              />
            </div>
          </div>

          {/* Reports Grid */}
          {filteredReports.length === 0 ? (
            <div className="p-12 text-center text-slate-500 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl bg-slate-50 dark:bg-slate-900/20">
              <FileText className="h-10 w-10 mx-auto mb-2 text-slate-400 dark:text-slate-600" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-400">No saved reports found</p>
              <p className="text-xs text-slate-500 mt-1">
                Save natural language queries as reports from the Query Interface to view them here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredReports.map((rep) => (
                <MetrivaCard
                  key={rep.id}
                  variant="glass"
                  className="p-5 hover:border-cyan-500/30 transition flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <MetrivaBadge variant="cyan" size="sm">
                        {rep.category || "General"}
                      </MetrivaBadge>
                      <span className="text-[11px] font-mono text-slate-600 dark:text-slate-400 uppercase bg-slate-100 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 px-2 py-0.5 rounded">
                        {rep.chart_type}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 dark:text-white line-clamp-1">{rep.name}</h3>

                    {rep.natural_language_question && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 italic">
                        "{rep.natural_language_question}"
                      </p>
                    )}

                    <div className="p-2.5 bg-slate-50 dark:bg-slate-950/80 rounded-lg border border-slate-200 dark:border-slate-800 font-mono text-[11px] text-cyan-700 dark:text-cyan-300/80 line-clamp-2">
                      {rep.sql}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDuplicate(rep)}
                        title="Duplicate Report"
                        className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => openScheduleModal(rep)}
                        title="Schedule this report"
                        className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                      >
                        <Calendar className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteReport(rep)}
                        title="Delete Report"
                        className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <button
                      onClick={() => handleRefreshReport(rep)}
                      disabled={refreshingId === rep.id}
                      className="px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50 shadow-sm shadow-cyan-500/20 transition"
                    >
                      <RefreshCw
                        className={`h-3 w-3 ${refreshingId === rep.id ? "animate-spin" : ""}`}
                      />
                      <span>Refresh</span>
                    </button>
                  </div>
                </MetrivaCard>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Schedules Tab */}
      {activeTab === "schedules" && (
        <div className="space-y-4">
          {schedules.length === 0 ? (
            <div className="p-12 text-center text-slate-500 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl bg-slate-50 dark:bg-slate-900/20">
              <Calendar className="h-10 w-10 mx-auto mb-2 text-slate-400 dark:text-slate-600" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-400">No recurring report schedules</p>
              <p className="text-xs text-slate-500 mt-1">
                Open a saved report and click the calendar icon to configure automated daily, weekly, or monthly delivery.
              </p>
            </div>
          ) : (
            <MetrivaCard variant="glass" className="overflow-hidden shadow-lg p-0">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950/90 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Schedule Name</th>
                    <th className="px-4 py-3 font-semibold">Frequency</th>
                    <th className="px-4 py-3 font-semibold">Delivery Time</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Last Run</th>
                    <th className="px-4 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                  {schedules.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                        <div>{s.name}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">{s.report_name}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-500/20">
                          {s.frequency}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-mono">
                        {s.time_of_day} {s.timezone}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggleSchedule(s)}
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1.5 transition ${
                            s.is_active
                              ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              s.is_active ? "bg-emerald-500 dark:bg-emerald-400 animate-pulse" : "bg-slate-400 dark:bg-slate-500"
                            }`}
                          />
                          {s.is_active ? "Active" : "Paused"}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                        {s.last_run_at ? new Date(s.last_run_at).toLocaleString() : "Never"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleTriggerNow(s)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded text-xs font-semibold inline-flex items-center gap-1 transition"
                          >
                            <Zap className="h-3 w-3 text-amber-500 dark:text-amber-400" />
                            Run Now
                          </button>
                          <button
                            onClick={() => handleDeleteSchedule(s)}
                            className="p-1 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </MetrivaCard>
          )}
        </div>
      )}

      {/* Fresh Refreshed Results Modal */}
      {refreshedResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <MetrivaCard variant="elevated" className="w-full max-w-3xl overflow-hidden shadow-2xl p-5 space-y-4 my-8 border-cyan-500/30 bg-white dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  Report Executed Fresh: {refreshedResult.name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Returned {refreshedResult.row_count} rows in {refreshedResult.execution_time_ms}ms with read-only transaction isolation.
                </p>
              </div>
              <button
                onClick={() => setRefreshedResult(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-x-auto max-h-80 border border-slate-200 dark:border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 sticky top-0 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    {refreshedResult.columns?.map((c: string) => (
                      <th key={c} className="px-4 py-2 font-semibold">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 font-mono">
                  {refreshedResult.rows?.map((row: any[], idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      {row.map((val, cIdx) => (
                        <td key={cIdx} className="px-4 py-2 text-slate-700 dark:text-slate-300">
                          {val === null ? "null" : String(val)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setRefreshedResult(null)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold transition"
              >
                Close
              </button>
            </div>
          </MetrivaCard>
        </div>
      )}

      {/* New Schedule Modal */}
      {isScheduleModalOpen && targetReportForSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <MetrivaCard variant="elevated" className="w-full max-w-md overflow-hidden shadow-2xl p-5 space-y-4 border-cyan-500/30 bg-white dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Calendar className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                Schedule Report: {targetReportForSchedule.name}
              </h3>
              <button
                onClick={() => setIsScheduleModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSchedule} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Schedule Name *</label>
                <input
                  type="text"
                  required
                  value={scheduleName}
                  onChange={(e) => setScheduleName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Frequency</label>
                <select
                  value={scheduleFrequency}
                  onChange={(e) => setScheduleFrequency(e.target.value as any)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="DAILY">Daily</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Time of Day (UTC)</label>
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsScheduleModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingSchedule}
                  className="px-4 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-lg text-xs font-semibold disabled:opacity-50 shadow-sm shadow-cyan-500/20"
                >
                  {savingSchedule ? "Saving..." : "Create Schedule"}
                </button>
              </div>
            </form>
          </MetrivaCard>
        </div>
      )}
    </div>
  );
};
export default ReportsView;
