import React from "react";
import {
  Compass,
  Cpu,
  Database,
  FileText,
  History,
  LayoutDashboard,
  LineChart,
  Settings,
  Sparkles,
  TableProperties,
  TrendingUp,
} from "lucide-react";

export type NavTab =
  | "dashboard"
  | "query"
  | "datasources"
  | "reports"
  | "comparisons"
  | "ml"
  | "history"
  | "schema"
  | "analytics"
  | "settings";

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onNavigateToLanding?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  onNavigateToLanding,
}) => {
  const coreItems: { id: NavTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "query", label: "Natural Language Query", icon: Sparkles },
    { id: "datasources", label: "Database Connections", icon: Database },
  ];

  const intelligenceItems: { id: NavTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "reports", label: "Reports & Schedules", icon: FileText },
    { id: "comparisons", label: "Period Comparisons", icon: TrendingUp },
    { id: "ml", label: "Predictive Analytics (ML)", icon: Cpu },
    { id: "analytics", label: "Deep Analytics", icon: LineChart },
  ];

  const systemItems: { id: NavTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "history", label: "Query History", icon: History },
    { id: "schema", label: "Schema Explorer", icon: TableProperties },
    { id: "settings", label: "Settings & Engine", icon: Settings },
  ];

  const renderNavGroup = (
    title: string,
    items: { id: NavTab; label: string; icon: React.ComponentType<{ className?: string }> }[]
  ) => (
    <div className="space-y-1 mb-4">
      <div className="px-3 py-1.5 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
        {title}
      </div>
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onSelectTab(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
              isActive
                ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20 font-semibold border border-cyan-400/20"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60"
            }`}
          >
            <Icon className={`h-4 w-4 ${isActive ? "text-white" : "text-slate-500 dark:text-slate-400"}`} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <aside className="w-64 border-r border-slate-200 dark:border-slate-800/80 bg-white/70 dark:bg-slate-950/60 p-4 flex flex-col justify-between hidden md:flex shrink-0 overflow-y-auto transition-colors">
      <div>
        {renderNavGroup("Core & Query", coreItems)}
        {renderNavGroup("BI & Machine Learning", intelligenceItems)}
        {renderNavGroup("System & Data", systemItems)}
      </div>

      <div className="space-y-3 mt-4">
        {onNavigateToLanding && (
          <button
            onClick={onNavigateToLanding}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-300 hover:bg-slate-100 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800/80 transition"
          >
            <Compass className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
            <span>Product Overview Page</span>
          </button>
        )}

        <div className="p-3 bg-slate-50 dark:bg-slate-950/80 border border-cyan-500/20 rounded-xl space-y-1.5 shadow-sm">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Engine Status</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
              Connected
            </span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
            host: localhost:5432
            <br />
            db: aidb (PostgreSQL 16)
          </div>
        </div>
      </div>
    </aside>
  );
};
