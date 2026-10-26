import React, { useState } from "react";
import {
  CheckCircle,
  Database,
  Lock,
  RotateCcw,
  Server,
  Settings as SettingsIcon,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { AIStatus, UserRole } from "../../types";
import { MetrivaCard, MetrivaBadge, MetrivaButton, METRIVA_TOKENS } from "../../design-system";
import { TeamAccessView } from "./TeamAccessView";

interface SettingsViewProps {
  aiStatus: AIStatus | null;
  onRefreshStatus: () => void;
  activeOrgId?: number | null;
  userRole?: UserRole;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  aiStatus,
  onRefreshStatus,
  activeOrgId,
  userRole = "VIEWER",
}) => {
  const [tab, setTab] = useState<"system" | "team">("system");

  return (
    <div className="space-y-6 max-w-4xl pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <MetrivaBadge variant="cyan" size="sm">
              <Sparkles className="h-3 w-3 mr-1 inline" /> Configuration
            </MetrivaBadge>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <SettingsIcon className="h-6 w-6 text-cyan-600 dark:text-cyan-400" />
            System & Engine Settings
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Runtime environment, AI provider abstractions, security policies, and team access.
          </p>
        </div>

        {tab === "system" && (
          <button
            onClick={onRefreshStatus}
            className="self-start sm:self-auto flex items-center gap-1.5 text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 transition"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Refresh Config</span>
          </button>
        )}
      </div>

      {/* Sub Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 text-xs font-semibold">
        <button
          onClick={() => setTab("system")}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition ${
            tab === "system"
              ? "bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-500/30"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900"
          }`}
        >
          <Server className="h-3.5 w-3.5" />
          <span>System & Engine</span>
        </button>
        <button
          onClick={() => setTab("team")}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition ${
            tab === "team"
              ? "bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-500/30"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900"
          }`}
        >
          <Users className="h-3.5 w-3.5" />
          <span>Team & Access (RBAC)</span>
        </button>
      </div>

      {tab === "team" ? (
        <TeamAccessView activeOrgId={activeOrgId} userRole={userRole} />
      ) : (
        <>
          {/* AI Provider Section */}
      <MetrivaCard variant="glass" className="p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80 pb-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <Sparkles className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
            <span>AI / LLM Provider Abstraction</span>
          </div>
          <MetrivaBadge variant="cyan" size="sm">
            {aiStatus?.provider || "Deterministic"}
          </MetrivaBadge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-1.5">
            <span className="text-slate-500 font-medium">Active Provider</span>
            <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>{aiStatus?.demo_mode ? "Deterministic Mock Provider" : "OpenAI Compatible"}</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-100 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/20">
                {aiStatus?.provider}
              </span>
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-[11px] mt-1">
              {aiStatus?.demo_mode
                ? "Zero-setup demo mode active. All example queries work deterministically without external API costs."
                : "Live API key detected. Queries will be generated dynamically using remote LLM."}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-1.5">
            <span className="text-slate-500 font-medium">Model Specification</span>
            <div className="text-sm font-bold text-cyan-700 dark:text-cyan-400 font-mono">
              {aiStatus?.model || "gpt-4o-mini"}
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-[11px] mt-1">
              Configured via OPENAI_MODEL environment variable in backend/.env.
            </p>
          </div>
        </div>
      </MetrivaCard>

      {/* Security & Execution Limits */}
      <MetrivaCard variant="glass" className="p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800/80 pb-3">
          <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <span>Security Pipeline & Query Boundaries</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-1">
            <span className="text-slate-500 font-medium">Max Rows Limit</span>
            <div className="text-base font-bold text-slate-900 dark:text-white font-mono">
              {aiStatus?.limits?.max_rows || 1000} rows
            </div>
            <span className="text-[11px] text-slate-500">Auto-clamped on SELECT queries</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-1">
            <span className="text-slate-500 font-medium">Query Timeout</span>
            <div className="text-base font-bold text-slate-900 dark:text-white font-mono">
              {aiStatus?.limits?.max_query_seconds || 10} seconds
            </div>
            <span className="text-[11px] text-slate-500">statement_timeout enforced</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-1">
            <span className="text-slate-500 font-medium">Max SQL Length</span>
            <div className="text-base font-bold text-slate-900 dark:text-white font-mono">
              {aiStatus?.limits?.max_sql_length || 10000} chars
            </div>
            <span className="text-[11px] text-slate-500">AST parser boundary</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 text-xs text-emerald-800 dark:text-emerald-300 space-y-2">
          <div className="flex items-center gap-1.5 font-semibold">
            <Lock className="h-3.5 w-3.5" />
            <span>Strict Read-Only Enforcement</span>
          </div>
          <p className="leading-relaxed text-slate-700 dark:text-slate-300">
            AI queries are strictly restricted to <code>SELECT</code> and <code>WITH</code> statements.
            All DDL (<code>DROP</code>, <code>ALTER</code>, <code>CREATE</code>) and DML (<code>DELETE</code>, <code>UPDATE</code>, <code>INSERT</code>) statements are rejected before execution and audited in query history.
          </p>
        </div>
      </MetrivaCard>

      {/* Database Connection */}
      <MetrivaCard variant="glass" className="p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800/80 pb-3">
          <Database className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
          <span>Database Architecture & Multi-Engine Connectors</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400">Supported Connectors:</span>
            <span className="text-slate-800 dark:text-slate-200 font-mono">PostgreSQL (psycopg3), MySQL (pymysql), SQLite3</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400">ORM / Engine:</span>
            <span className="text-slate-800 dark:text-slate-200 font-mono">Django 5.1 ORM + Native SQL Execution Engine</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400">Demo Database:</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">PostgreSQL (3NF Normalized Business Schema)</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400">Credential Encryption:</span>
            <span className="text-cyan-600 dark:text-cyan-400 font-semibold font-mono">Fernet AES-128-CBC / HMAC-SHA256</span>
          </div>
        </div>
      </MetrivaCard>
    </>
    )}
  </div>
);
};
export default SettingsView;
