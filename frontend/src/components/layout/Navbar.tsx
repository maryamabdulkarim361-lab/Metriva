import React from "react";
import { Building2, Compass, Database, LogIn, LogOut, ShieldCheck, Sparkles, Terminal, User } from "lucide-react";
import { AIStatus, CurrentUser } from "../../types";
import { MetrivaLogo, ThemeToggle } from "../ui";

interface NavbarProps {
  aiStatus: AIStatus | null;
  onOpenQuery: () => void;
  currentUser?: CurrentUser | null;
  onOpenAuth?: () => void;
  onLogout?: () => void;
  onNavigateToLanding?: () => void;
  onSelectOrganization?: (orgId: number) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  aiStatus,
  onOpenQuery,
  currentUser,
  onOpenAuth,
  onLogout,
  onNavigateToLanding,
  onSelectOrganization,
}) => {
  return (
    <header className="h-16 border-b border-slate-200 dark:border-slate-800/90 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-40 transition-colors">
      <div className="flex items-center gap-3">
        {/* Metriva Brand Identity */}
        <button
          onClick={onNavigateToLanding}
          className="flex items-center text-left focus:outline-none focus:ring-2 focus:ring-cyan-400 rounded-lg group"
          title="Return to Metriva Overview"
        >
          <MetrivaLogo size="sm" showTagline={false} />
        </button>

        <div className="hidden sm:flex flex-col pl-3 border-l border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              AI Database Assistant
            </span>
            <span className="text-[10px] uppercase font-bold bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-500/30 px-2 py-0.5 rounded-full">
              PostgreSQL 16
            </span>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden lg:block">
            Turn Business Data Into Clarity
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Theme Switcher */}
        <ThemeToggle variant="pill" size="sm" />

        {/* Landing Page Link */}
        {onNavigateToLanding && (
          <button
            onClick={onNavigateToLanding}
            className="hidden md:flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-300 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900 border border-transparent hover:border-slate-200 dark:hover:border-slate-800 transition"
          >
            <Compass className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
            <span>Product Overview</span>
          </button>
        )}

        {/* Security Shield Badge */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-400 text-xs">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Read-Only Guard Active</span>
        </div>

        {/* AI Provider Status Pill */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-md bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-xs">
          <Sparkles className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
          <span className="text-slate-700 dark:text-slate-300">
            {aiStatus?.demo_mode ? "Demo AI (Deterministic)" : `AI: ${aiStatus?.model || "OpenAI"}`}
          </span>
        </div>

        {/* Active Organization & Role Pill */}
        {currentUser?.active_organization && (
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
            <Building2 className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
            {currentUser.organizations && currentUser.organizations.length > 1 && onSelectOrganization ? (
              <select
                aria-label="Active Organization"
                value={currentUser.active_organization.id}
                onChange={(e) => onSelectOrganization(Number(e.target.value))}
                className="bg-transparent font-medium text-slate-800 dark:text-slate-200 text-xs focus:outline-none cursor-pointer"
              >
                {currentUser.organizations.map((org) => (
                  <option key={org.id} value={org.id} className="dark:bg-slate-900 dark:text-white">
                    {org.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="font-medium text-slate-800 dark:text-slate-200 max-w-[120px] truncate" title={currentUser.active_organization.name}>
                {currentUser.active_organization.name}
              </span>
            )}
            <span
              className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                currentUser.active_organization.role === "ADMIN"
                  ? "bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-500/30"
                  : currentUser.active_organization.role === "ANALYST"
                  ? "bg-cyan-100 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-500/30"
                  : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700"
              }`}
            >
              {currentUser.active_organization.role}
            </span>
          </div>
        )}

        {/* Auth status or Sign in */}
        {currentUser ? (
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1 text-xs">
            <User className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
            <span
              className="text-slate-800 dark:text-slate-200 font-medium max-w-[120px] truncate"
              title={currentUser.email}
            >
              {currentUser.name || currentUser.email}
            </span>
            {onLogout && (
              <button
                onClick={onLogout}
                aria-label="Sign out"
                title="Sign out"
                className="p-1 rounded text-slate-500 dark:text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ) : onOpenAuth ? (
          <button
            onClick={onOpenAuth}
            className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 text-xs font-medium px-3 py-1.5 rounded-lg transition"
          >
            <LogIn className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
            <span>Sign In</span>
          </button>
        ) : null}

        {/* Quick Query CTA */}
        <button
          onClick={onOpenQuery}
          className="flex items-center gap-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg transition-all shadow-md shadow-cyan-500/20 active:scale-95 border border-cyan-400/20"
        >
          <Terminal className="h-3.5 w-3.5" />
          <span>Query SQL</span>
        </button>
      </div>
    </header>
  );
};
