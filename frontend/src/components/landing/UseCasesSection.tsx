import React from "react";
import { Check, ShoppingBag, Laptop, Building2, TrendingUp, Users, DollarSign } from "lucide-react";
import { MetrivaCard, MetrivaBadge } from "../ui";

export const UseCasesSection: React.FC = () => {
  const useCases = [
    {
      category: "E-Commerce & DTC Brands",
      icon: ShoppingBag,
      title: "Optimize Inventory & Customer Lifetime Value",
      summary:
        "Understand exactly which product categories drive repeat orders and which customer cohorts are losing momentum.",
      metrics: [
        { label: "Cohort Retention", value: "+22%" },
        { label: "AOV Insights", value: "Real-time" },
      ],
      sampleQuestions: [
        "What are our top 10 highest margin products this quarter?",
        "Compare average order value between first-time and repeat buyers.",
        "Which payment methods had a failure rate higher than 3% in October?",
      ],
    },
    {
      category: "B2B SaaS & Tech",
      icon: Laptop,
      title: "Predict Churn & Accelerate Expansion",
      summary:
        "Identify enterprise accounts with declining platform engagement before they reach annual contract renewal.",
      metrics: [
        { label: "Churn Accuracy", value: "89.2% ROC" },
        { label: "Alert Latency", value: "< 200ms" },
      ],
      sampleQuestions: [
        "Which accounts with >$10k ACV had fewer than 5 logins last week?",
        "Predict customer churn probability across enterprise customer tiers.",
        "Show quarterly expansion revenue by customer signup cohort.",
      ],
    },
    {
      category: "Finance & Operations",
      icon: Building2,
      title: "Eliminate Reporting Bottlenecks",
      summary:
        "Give financial controllers and business executives immediate answers without waiting in BI engineering backlogs.",
      metrics: [
        { label: "Time-to-Insight", value: "3 Seconds" },
        { label: "SQL Hand-offs", value: "Zero" },
      ],
      sampleQuestions: [
        "Break down monthly gross revenue vs refunded payments for 2026.",
        "Compare regional operating expenses against budget allocations.",
        "Generate a 90-day linear regression sales forecast.",
      ],
    },
  ];

  return (
    <section id="use-cases" className="py-24 relative border-t border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-transparent transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <MetrivaBadge variant="cyan" size="md" className="mb-3">
            Real-World Impact
          </MetrivaBadge>
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-4">
            Tailored for High-Growth <br />
            <span className="bg-gradient-to-r from-cyan-500 to-blue-600 dark:from-cyan-400 dark:to-blue-500 bg-clip-text text-transparent">
              Data-Driven Teams
            </span>
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-base sm:text-lg">
            See how non-technical leaders across departments turn raw tabular data into immediate,
            actionable operational clarity.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {useCases.map((uc, idx) => {
            const Icon = uc.icon;
            return (
              <MetrivaCard
                key={idx}
                padding="lg"
                hoverGlow
                className="flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 rounded-xl bg-cyan-100/60 dark:bg-cyan-950/40 border border-cyan-300 dark:border-cyan-500/30 text-cyan-600 dark:text-cyan-400">
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {uc.category}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3 tracking-tight">{uc.title}</h3>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-6 font-normal">
                    {uc.summary}
                  </p>

                  <div className="mb-6 p-3 rounded-xl bg-slate-100 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 flex items-center justify-around">
                    {uc.metrics.map((m, mIdx) => (
                      <div key={mIdx} className="text-center">
                        <div className="text-xs text-slate-500 dark:text-slate-400">{m.label}</div>
                        <div className="text-base font-bold text-cyan-600 dark:text-cyan-300 mt-0.5">{m.value}</div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2.5">
                    <div className="text-[11px] font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
                      Typical Inquiries
                    </div>
                    {uc.sampleQuestions.map((q, qIdx) => (
                      <div key={qIdx} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
                        <Check className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />
                        <span className="italic font-normal">"{q}"</span>
                      </div>
                    ))}
                  </div>
                </div>
              </MetrivaCard>
            );
          })}
        </div>
      </div>
    </section>
  );
};

