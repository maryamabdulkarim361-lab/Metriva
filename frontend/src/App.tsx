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
import { api, getAuthToken, setActiveOrgId } from "./services/api";
import { AIStatus, CurrentUser, DashboardData, UserRole } from "./types";

export interface AppProps {
  initialView?: "landing" | "app";
  initialTab?: NavTab;
}

export const App: React.FC<AppProps> = ({ initialView, initialTab = "dashboard" }) => {
  const [viewMode, setViewMode] = useState<"landing" | "app">(() => {
    if (initialView) return initialView;
    if (typeof window !== "undefined") {
      if (window.location.hash.startsWith("#/app")) {
        // Protected route guard: if user is not authenticated, redirect to landing
        if (!getAuthToken()) {
          window.location.hash = "#/";
          return "landing";
        }
        return "app";
      }
      if (window.location.hash === "#/landing" || window.location.hash === "#/") return "landing";
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
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isExploringSample, setIsExploringSample] = useState<boolean>(false);
  const requestSeqRef = React.useRef<number>(0);

  const activeOrgId = currentUser?.active_organization?.id || null;
  const userRole: UserRole = currentUser?.active_organization?.role || (currentUser?.is_staff ? "ADMIN" : "VIEWER");

  const handleSignOut = () => {
    // 1. Invalidate any in-flight async request callbacks
    requestSeqRef.current += 1;

    // 2. Clear tokens and org keys from browser storage
    api.logout();

    // 3. Clear authenticated user & roles
    setCurrentUser(null);

    // 4. Clear private dashboard & application state from memory
    setDashboardData(null);
    setDashboardError(null);
    setActiveQueryPrompt("");
    setIsExploringSample(false);
    setIsAuthModalOpen(false);

    // 5. Reset active tab to default
    setActiveTab("dashboard");

    // 6. Force immediate redirection to public landing page
    setViewMode("landing");
    if (typeof window !== "undefined") {
      window.location.hash = "#/";
    }
  };

  const handleSelectOrganization = (orgId: number) => {
    setActiveOrgId(orgId);
    setIsExploringSample(false);
    api.getCurrentUser().then((u) => {
      setCurrentUser(u);
      refreshDashboard(false);
    });
  };

  const refreshStatus = () => {
    api
      .getAIStatus()
      .then(setAIStatus)
      .catch((err) => console.error("Failed to fetch AI status:", err));
  };

  const refreshDashboard = (sampleMode: boolean = isExploringSample) => {
    const thisSeq = ++requestSeqRef.current;
    setLoadingDashboard(true);
    setDashboardError(null);
    api
      .getDashboardData({ sample: sampleMode })
      .then((data) => {
        if (thisSeq !== requestSeqRef.current) return;
        setDashboardData(data);
        setDashboardError(null);
      })
      .catch((err) => {
        if (thisSeq !== requestSeqRef.current) return;
        console.error("Failed to fetch dashboard data:", err);
        setDashboardError(err.message || "Failed to load dashboard metrics.");
      })
      .finally(() => {
        if (thisSeq === requestSeqRef.current) {
          setLoadingDashboard(false);
        }
      });
  };

  useEffect(() => {
    refreshStatus();
    refreshDashboard();
    if (getAuthToken()) {
      api
        .getCurrentUser()
        .then(setCurrentUser)
        .catch(() => {
          handleSignOut();
        });
    }

    const onHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith("#/app")) {
        // Protected route guard: if user is not authenticated, redirect to landing
        if (!getAuthToken()) {
          setViewMode("landing");
          if (window.location.hash !== "#/") {
            window.location.hash = "#/";
          }
          return;
        }
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

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "aidb_access_token" && !e.newValue) {
        // Cross-tab logout: another browser tab signed out
        handleSignOut();
      }
    };

    const handleUnauthorized = () => {
      handleSignOut();
    };

    window.addEventListener("hashchange", onHashChange);
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("metriva:unauthorized", handleUnauthorized);

    return () => {
      window.removeEventListener("hashchange", onHashChange);
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("metriva:unauthorized", handleUnauthorized);
    };
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
          onLogout={handleSignOut}
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
            onLogout={handleSignOut}
            onNavigateToLanding={handleNavigateToLanding}
            onSelectOrganization={handleSelectOrganization}
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
                  onRetry={() => refreshDashboard(isExploringSample)}
                  onNavigateToQuery={handleNavigateToQuery}
                  onNavigateToDataSources={() => handleSelectTab("datasources")}
                  onExploreSample={() => {
                    setIsExploringSample(true);
                    refreshDashboard(true);
                  }}
                  onExitSample={() => {
                    setIsExploringSample(false);
                    refreshDashboard(false);
                  }}
                  isExploringSample={isExploringSample}
                />
              )}

              {activeTab === "query" && (
                <QueryView
                  key={activeQueryPrompt}
                  initialQuestion={activeQueryPrompt}
                  userRole={userRole}
                />
              )}

              {activeTab === "datasources" && <DatabaseConnectionsView userRole={userRole} />}

              {activeTab === "reports" && <ReportsView />}

              {activeTab === "comparisons" && (
                <PeriodComparisonView
                  key={activeOrgId || "none"}
                  onNavigateToDataSources={() => handleSelectTab("datasources")}
                />
              )}

              {activeTab === "ml" && (
                <MLDashboardView
                  key={activeOrgId || "none"}
                  onNavigateToDataSources={() => handleSelectTab("datasources")}
                />
              )}

              {activeTab === "history" && (
                <HistoryView onSelectQueryForReRun={handleNavigateToQuery} />
              )}

              {activeTab === "schema" && (
                <SchemaExplorerView onNavigateToDataSources={() => handleSelectTab("datasources")} />
              )}

              {activeTab === "analytics" && (
                <DeepAnalyticsView
                  key={activeOrgId || "none"}
                  onNavigateToDataSources={() => handleSelectTab("datasources")}
                />
              )}

              {activeTab === "settings" && (
                <SettingsView
                  aiStatus={aiStatus}
                  onRefreshStatus={refreshStatus}
                  activeOrgId={activeOrgId}
                  userRole={userRole}
                />
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
          if (user?.active_organization?.id) {
            setActiveOrgId(user.active_organization.id);
          } else {
            setActiveOrgId(null);
          }
          setViewMode("app");
          setActiveTab("dashboard");
          if (typeof window !== "undefined") {
            window.location.hash = "#/app/dashboard";
          }
          refreshDashboard();
        }}
      />
    </div>
  );
};

export default App;
