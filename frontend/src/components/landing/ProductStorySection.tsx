import React from "react";
import { ArrowRight, Database, HelpCircle, LineChart, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { MetrivaCard, MetrivaBadge } from "../ui";

export const ProductStorySection: React.FC = () => {
  const steps = [
    {
      number: "01",
      title: "Connect",
      tagline: "Enterprise database integration in seconds",
      description:
        "Point Metriva to your existing PostgreSQL, SQLite, or MySQL database. Schema introspection maps relationships, tables, and constraints automatically. Credentials are safeguarded with Fernet AES-256 encryption.",
      icon: Database,
      accent: "from-blue-500 to-cyan-500",
      pill: "Instant Introspection",
      highlights: [
        "Automated foreign-key & table mapping",
        "Encrypted credential vault",
        "Connection health & latency checks",
      ],
    },
    {
      number: "02",
      title: "Ask",
      tagline: "Natural language questions without SQL bottlenecks",
      description:
        "Team members ask business questions in natural English. Metriva's engine generates optimized SQL, validates it through strict Abstract Syntax Tree (AST) read-only filters, and executes against your database.",
      icon: HelpCircle,
      accent: "from-cyan-400 to-cyan-600",
      pill: "AST Read-Only Guard",
      highlights: [
        "Zero SQL expertise required",
        "Strict mutation blocking (DROP, INSERT, UPDATE)",
        "Deterministic fallback demo mode",
      ],
    },
    {
      number: "03",
      title: "Understand",
      tagline: "Automated charts, executive narratives & ML predictions",
      description:
        "Query results are automatically classified into the optimal visualization: time-series lines, categorical bars, KPI cards, or distribution charts. Run predictive ML models to anticipate customer churn and revenue trajectories.",
      icon: LineChart,
      accent: "from-cyan-500 to-indigo-600",
      pill: "Auto-Chart & Predictive ML",
      highlights: [
        "Smart visualization recommendations",
        "Plain-English data summaries",
        "Automated scheduled email/webhook reports",
      ],
    },
  ];

  return (
    <section id="story" className="py-24 relative border-t border-slate-200 dark:border-slate-800/80 bg-white/40 dark:bg-transparent transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <MetrivaBadge variant="cyan" size="md" className="mb-3">
            How It Works
          </MetrivaBadge>
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-4">
            Connect. Ask.{" "}
            <span className="bg-gradient-to-r from-cyan-500 to-blue-600 dark:from-cyan-400 dark:to-blue-500 bg-clip-text text-transparent">
              Understand.
            </span>
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-base sm:text-lg">
            Empower every team member with direct data insights without waiting weeks for data
            engineering queues or risking database write corruption.
          </p>
        </div>

        {/* 3 Step Flow Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <MetrivaCard
                key={step.number}
                glow={idx === 1}
                padding="lg"
                className="relative flex flex-col justify-between group overflow-hidden"
              >
                {/* Top Number Watermark */}
                <div className="absolute top-4 right-6 text-5xl font-black text-slate-200 dark:text-slate-800/40 select-none group-hover:text-cyan-500/20 transition-colors">
                  {step.number}
                </div>

                <div>
                  <div className="flex items-center gap-3 mb-5">
                    <div
                      className={`h-12 w-12 rounded-xl bg-gradient-to-br ${step.accent} p-0.5 shadow-md`}
                    >
                      <div className="w-full h-full bg-white dark:bg-slate-950/80 rounded-[10px] flex items-center justify-center">
                        <Icon className="h-6 w-6 text-cyan-600 dark:text-cyan-300" />
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 tracking-wide uppercase">
                      {step.pill}
                    </span>
                  </div>

                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">
                    {step.title}
                  </h3>
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-4">{step.tagline}</div>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-6 font-normal">
                    {step.description}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-200 dark:border-slate-800/80 space-y-2">
                  {step.highlights.map((h, hIdx) => (
                    <div key={hIdx} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                      <div className="h-1.5 w-1.5 rounded-full bg-cyan-500 dark:bg-cyan-400 shrink-0" />
                      <span>{h}</span>
                    </div>
                  ))}
                </div>
              </MetrivaCard>
            );
          })}
        </div>
      </div>
    </section>
  );
};

