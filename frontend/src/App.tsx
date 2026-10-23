import React, { useEffect, useState } from "react";
import { DeepAnalyticsView } from "./components/analytics/DeepAnalyticsView";
import { PeriodComparisonView } from "./components/analytics/PeriodComparisonView";
import { DashboardView } from "./components/dashboard/DashboardView";
import { DatabaseConnectionsView } from "./components/datasources/DatabaseConnectionsView";
import { HistoryView } from "./components/history/HistoryView";
import { LandingPage } from "./components/landing/LandingPage";
import { Navbar } from "./components/layout/Navbar";
import { NavTab, Sidebar } from "./components/layout/Sidebar";
import { MLDashboardView } from "./components/ml/MLDashboardView";
import { QueryView } from "./components/query/QueryView";
import { ReportsView } from "./components/reports/ReportsView";
import { SchemaExplorerView } from "./components/schema/SchemaExplorerView";
import { SettingsView } from "./components/settings/SettingsView";
import { AuthModal } from "./components/auth/AuthModal";
import { api, getAuthToken } from "./services/api";
import { AIStatus, DashboardData } from "./types";

export interface AppProps {
  initialView?: "landing" | "app";
  initialTab?: NavTab;
}

export const App: React.FC<AppProps> = ({ initialView, initialTab = "dashboard" }) => {
  const [viewMode, setViewMode] = useState<"landing" | "app">(() => {
    if (initialView) return initialView;
    if (typeof window !== "undefined") {
      if (window.location.hash.startsWith("#/app")) return "app";
      if (window.location.hash === "#/landing" || window.location.hash === "#/") return "landing";
    }
    const isTestEnv =
      (typeof import.meta !== "undefined" && (import.meta as any).env?.MODE === "test") ||
      (typeof globalThis !== "undefined" && (globalThis as any).process?.env?.NODE_ENV === "test");

    if (isTestEnv) {
      return "app";
    }
    return "landing";
  });

  const getTabFromHash = (): NavTab | null => {
    if (typeof window !== "undefined" && window.location.hash.startsWith("#/app/")) {
      const candidate = window.location.hash.replace("#/app/", "").split("?")[0] as NavTab;
      const validTabs: NavTab[] = [
        "dashboard",
        "query",
        "datasources",
        "reports",
        "comparisons",
        "ml",
        "history",
        "schema",
        "analytics",
        "settings",
      ];
      if (validTabs.includes(candidate)) return candidate;
    }
    return null;
  };

  const [activeTab, setActiveTab] = useState<NavTab>(() => getTabFromHash() || initialTab);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [aiStatus, setAIStatus] = useState<AIStatus | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState<boolean>(true);
  const [activeQueryPrompt, setActiveQueryPrompt] = useState<string>("");
  const [currentUser, setCurrentUser] = useState<{ name?: string; email?: string } | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const refreshStatus = () => {
    api
      .getAIStatus()
      .then(setAIStatus)
      .catch((err) => console.error("Failed to fetch AI status:", err));
  };

  const refreshDashboard = () => {
    setLoadingDashboard(true);
    setDashboardError(null);
    api
      .getDashboardData()
      .then((data) => {
        setDashboardData(data);
        setDashboardError(null);
      })
      .catch((err) => {
        console.error("Failed to fetch dashboard data:", err);
        setDashboardError(err.message || "Failed to load dashboard metrics.");
      })
      .finally(() => setLoadingDashboard(false));
  };

  useEffect(() => {
    refreshStatus();
    refreshDashboard();
    if (getAuthToken()) {
      api
        .getCurrentUser()
        .then(setCurrentUser)
        .catch(() => {
          api.logout();
          setCurrentUser(null);
        });
    }

    const onHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith("#/app")) {
        setViewMode("app");
        const tab = getTabFromHash();
        if (tab) {
          setActiveTab(tab);
        }
      } else if (
        hash === "#/landing" ||
        hash === "#/" ||
        hash === ""
      ) {
        setViewMode("landing");
      }
    };

    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const handleSelectTab = (tab: NavTab) => {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      window.location.hash = `#/app/${tab}`;
    }
  };

  const handleLaunchApp = () => {
    setViewMode("app");
    if (typeof window !== "undefined" && window.location.hash !== "#/app") {
      window.location.hash = "#/app";
    }
  };

  const handleNavigateToLanding = () => {
    setViewMode("landing");
    if (typeof window !== "undefined" && window.location.hash !== "#/") {
      window.location.hash = "#/";
    }
  };

  const handleNavigateToQuery = (question?: string) => {
    if (question) {
      setActiveQueryPrompt(question);
    }
    setActiveTab("query");
    handleLaunchApp();
  };

  const handleNavigateToQueryWithPrompt = (question: string) => {
    setActiveQueryPrompt(question);
    setActiveTab("query");
    handleLaunchApp();
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-white dark:selection:text-slate-950 transition-colors duration-200">
      {viewMode === "landing" ? (
        <LandingPage
          onLaunchApp={handleLaunchApp}
          onOpenAuth={() => setIsAuthModalOpen(true)}
          currentUser={currentUser}
          onNavigateToQueryWithPrompt={handleNavigateToQueryWithPrompt}
        />
      ) : (
        <>
          <Navbar
            aiStatus={aiStatus}
            onOpenQuery={() => handleNavigateToQuery()}
            currentUser={currentUser}
            onOpenAuth={() => setIsAuthModalOpen(true)}
            onLogout={() => {
              api.logout();
              setCurrentUser(null);
            }}
            onNavigateToLanding={handleNavigateToLanding}
          />

          <div className="flex-1 flex overflow-hidden">
            <Sidebar
              activeTab={activeTab}
              onSelectTab={handleSelectTab}
              onNavigateToLanding={handleNavigateToLanding}
            />

            {/* Mobile Navigation Bar */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur border-t border-slate-200 dark:border-slate-800 flex justify-around py-2 px-1 text-[10px] overflow-x-auto">
              <button
                onClick={handleNavigateToLanding}
                className="p-2 rounded shrink-0 text-cyan-600 dark:text-cyan-400 font-medium"
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab("dashboard")}
                className={`p-2 rounded shrink-0 ${activeTab === "dashboard" ? "text-cyan-600 dark:text-cyan-400 font-bold" : "text-slate-500 dark:text-slate-400"}`}
              >
                Dashboard
              </button>
              <button
                onClick={() => setActiveTab("query")}
                className={`p-2 rounded shrink-0 ${activeTab === "query" ? "text-cyan-600 dark:text-cyan-400 font-bold" : "text-slate-500 dark:text-slate-400"}`}
              >
                Query
              </button>
              <button
                onClick={() => setActiveTab("reports")}
                className={`p-2 rounded shrink-0 ${activeTab === "reports" ? "text-cyan-600 dark:text-cyan-400 font-bold" : "text-slate-500 dark:text-slate-400"}`}
              >
                Reports
              </button>
              <button
                onClick={() => setActiveTab("comparisons")}
                className={`p-2 rounded shrink-0 ${activeTab === "comparisons" ? "text-cyan-600 dark:text-cyan-400 font-bold" : "text-slate-500 dark:text-slate-400"}`}
              >
                Comparisons
              </button>
              <button
                onClick={() => setActiveTab("ml")}
                className={`p-2 rounded shrink-0 ${activeTab === "ml" ? "text-cyan-600 dark:text-cyan-400 font-bold" : "text-slate-500 dark:text-slate-400"}`}
              >
                Predictive ML
              </button>
              <button
                onClick={() => setActiveTab("datasources")}
                className={`p-2 rounded shrink-0 ${activeTab === "datasources" ? "text-cyan-600 dark:text-cyan-400 font-bold" : "text-slate-500 dark:text-slate-400"}`}
              >
                Connections
              </button>
              <button
                onClick={() => setActiveTab("analytics")}
                className={`p-2 rounded shrink-0 ${activeTab === "analytics" ? "text-cyan-600 dark:text-cyan-400 font-bold" : "text-slate-500 dark:text-slate-400"}`}
              >
                Analytics
              </button>
              <button
                onClick={() => setActiveTab("settings")}
                className={`p-2 rounded shrink-0 ${activeTab === "settings" ? "text-cyan-600 dark:text-cyan-400 font-bold" : "text-slate-500 dark:text-slate-400"}`}
              >
                Settings
              </button>
            </div>

            {/* Main Content Pane */}
            <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
              {activeTab === "dashboard" && (
                <DashboardView
                  data={dashboardData}
                  loading={loadingDashboard}
                  error={dashboardError}
                  onRetry={refreshDashboard}
                  onNavigateToQuery={handleNavigateToQuery}
                />
              )}

              {activeTab === "query" && (
                <QueryView key={activeQueryPrompt} initialQuestion={activeQueryPrompt} />
              )}

              {activeTab === "datasources" && <DatabaseConnectionsView />}

              {activeTab === "reports" && <ReportsView />}

              {activeTab === "comparisons" && <PeriodComparisonView />}

              {activeTab === "ml" && <MLDashboardView />}

              {activeTab === "history" && (
                <HistoryView onSelectQueryForReRun={handleNavigateToQuery} />
              )}

              {activeTab === "schema" && <SchemaExplorerView />}

              {activeTab === "analytics" && <DeepAnalyticsView />}

              {activeTab === "settings" && (
                <SettingsView aiStatus={aiStatus} onRefreshStatus={refreshStatus} />
              )}
            </main>
          </div>
        </>
      )}

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={(user) => {
          setCurrentUser(user);
          refreshDashboard();
        }}
      />
    </div>
  );
};

export default App;
