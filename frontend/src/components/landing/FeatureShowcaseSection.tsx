import React from "react";
import {
  BarChart2,
  Cpu,
  Database,
  FileSpreadsheet,
  Layers,
  LineChart,
  ShieldAlert,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { MetrivaCard, MetrivaBadge } from "../ui";

export const FeatureShowcaseSection: React.FC = () => {
  const features = [
    {
      icon: Sparkles,
      title: "Natural Language SQL Engine",
      description:
        "Translate English prompts into syntax-accurate, dialect-specific SQL. Metriva models schema relations and provides transparent, step-by-step reasoning for every generated query.",
      badge: "LLM + AST",
      color: "text-cyan-400",
    },
    {
      icon: BarChart2,
      title: "Automated Chart Recommendations",
      description:
        "Never configure manual axes again. Metriva inspects returned dataset shapes, detecting categorical distributions, temporal trends, and single-value KPIs to render optimal charts automatically.",
      badge: "Auto-BI",
      color: "text-blue-400",
    },
    {
      icon: Cpu,
      title: "Predictive Machine Learning Layer",
      description:
        "True statistical ML powered by scikit-learn. Train churn propensity classifiers and demand regression models on authorized database snapshots with full ROC/AUC and MAE monitoring.",
      badge: "scikit-learn",
      color: "text-indigo-400",
    },
    {
      icon: Database,
      title: "Multi-Engine Data Source Manager",
      description:
        "Connect production PostgreSQL, SQLite, or MySQL databases. Manage read-only connection pools with encrypted credentials and latency diagnostics.",
      badge: "Multi-Engine",
      color: "text-emerald-400",
    },
    {
      icon: TrendingUp,
      title: "Period-over-Period Comparisons",
      description:
        "Evaluate MoM, QoQ, and YoY business performance. Automatically compute absolute delta, percentage variance, and momentum indicators across revenue and customer cohorts.",
      badge: "Growth Metrics",
      color: "text-cyan-300",
    },
    {
      icon: FileSpreadsheet,
      title: "Automated Executive Reporting",
      description:
        "Save critical queries into scheduled reports. Deliver structured executive dashboards and recurring summaries without manual export gymnastics.",
      badge: "Schedules",
      color: "text-amber-400",
    },
  ];

  return (
    <section id="features" className="py-24 relative border-t border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-transparent transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <MetrivaBadge variant="cyan" size="md" className="mb-3">
            Core Platform Capabilities
          </MetrivaBadge>
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-4">
            Engineered for Precision, Speed, <br />
            <span className="bg-gradient-to-r from-cyan-500 to-blue-600 dark:from-cyan-400 dark:to-blue-500 bg-clip-text text-transparent">
              and Absolute Data Safety
            </span>
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-base sm:text-lg">
            Everything your organization needs to query, visualize, and forecast from structured
            business data without building complex internal tooling.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, idx) => {
            const Icon = feature.icon;
            return (
              <MetrivaCard
                key={idx}
                padding="md"
                hoverGlow
                className="flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-cyan-600 dark:text-cyan-400 group-hover:border-cyan-500/40 group-hover:text-cyan-500 dark:group-hover:text-cyan-300 transition-colors">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-950 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800">
                      {feature.badge}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 group-hover:text-cyan-600 dark:group-hover:text-cyan-300 transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
                    {feature.description}
                  </p>
                </div>

                <div className="mt-6 pt-3 border-t border-slate-200 dark:border-slate-800/60 flex items-center gap-1.5 text-xs text-cyan-600 dark:text-cyan-400 font-medium">
                  <span>Explore capability</span>
                  <span className="text-slate-400 dark:text-slate-500">→</span>
                </div>
              </MetrivaCard>
            );
          })}
        </div>
      </div>
    </section>
  );
};

