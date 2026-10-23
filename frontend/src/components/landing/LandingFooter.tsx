import React from "react";
import { Database, Github, Heart, ShieldCheck } from "lucide-react";
import { MetrivaLogo } from "../ui";
import { METRIVA_BRAND } from "../../theme/tokens";

interface LandingFooterProps {
  onLaunchApp: () => void;
}

export const LandingFooter: React.FC<LandingFooterProps> = ({ onLaunchApp }) => {
  return (
    <footer className="border-t border-slate-200 dark:border-slate-800/90 bg-white dark:bg-slate-950 py-16 text-slate-500 dark:text-slate-400 text-xs transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          {/* Brand Info */}
          <div className="space-y-4 md:col-span-1">
            <MetrivaLogo size="md" showTagline />
            <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed font-normal">
              {METRIVA_BRAND.positioning}. Transform complex PostgreSQL and relational datasets into
              instant executive decisions.
            </p>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] text-emerald-600 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse-subtle" />
              <span>All Systems Operational</span>
            </div>
          </div>

          {/* Product Navigation */}
          <div>
            <div className="text-xs font-semibold text-slate-900 dark:text-white uppercase tracking-wider mb-4">
              Platform
            </div>
            <ul className="space-y-2.5">
              <li>
                <button
                  onClick={onLaunchApp}
                  className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors text-left"
                >
                  Live Analytics Dashboard
                </button>
              </li>
              <li>
                <button
                  onClick={onLaunchApp}
                  className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors text-left"
                >
                  Natural Language Query
                </button>
              </li>
              <li>
                <button
                  onClick={onLaunchApp}
                  className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors text-left"
                >
                  Database Connections
                </button>
              </li>
              <li>
                <button
                  onClick={onLaunchApp}
                  className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors text-left"
                >
                  Predictive ML Models
                </button>
              </li>
              <li>
                <button
                  onClick={onLaunchApp}
                  className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors text-left"
                >
                  Scheduled Reports
                </button>
              </li>
            </ul>
          </div>

          {/* Architecture & Tech Stack */}
          <div>
            <div className="text-xs font-semibold text-slate-900 dark:text-white uppercase tracking-wider mb-4">
              Architecture & Stack
            </div>
            <ul className="space-y-2.5 text-slate-600 dark:text-slate-400">
              <li>Engine: PostgreSQL 16 Alpine</li>
              <li>Backend: Django REST Framework</li>
              <li>Validation: SQL AST Analyzer</li>
              <li>Machine Learning: scikit-learn</li>
              <li>Frontend: React 18 & TypeScript</li>
              <li>Containerization: Docker Compose</li>
            </ul>
          </div>

          {/* Security & Compliance */}
          <div>
            <div className="text-xs font-semibold text-slate-900 dark:text-white uppercase tracking-wider mb-4">
              Security & Compliance
            </div>
            <ul className="space-y-2.5 text-slate-600 dark:text-slate-400">
              <li className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Strict Read-Only Enforcement</span>
              </li>
              <li>Zero Plaintext Credentials</li>
              <li>AST Injection Guard</li>
              <li>Tenant Partitioning & Auth</li>
              <li>Rate Limiting & Audit Logging</li>
            </ul>
          </div>
        </div>

        {/* Legal Disclaimer & Attribution */}
        <div className="pt-8 border-t border-slate-200 dark:border-slate-800/80 flex flex-col md:flex-row items-center justify-between gap-4 text-slate-500 text-[11px]">
          <div>
            © {new Date().getFullYear()} {METRIVA_BRAND.name}. All rights reserved. Metriva is an
            independent AI business intelligence platform. PostgreSQL, Python, React, and related
            trademarks remain the property of their respective owners.
          </div>

          <div className="flex items-center gap-4">
            <span className="font-mono text-slate-600 dark:text-slate-400">Candidate Release v1.0</span>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <span className="text-slate-600 dark:text-slate-400">Production-Hardened</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
