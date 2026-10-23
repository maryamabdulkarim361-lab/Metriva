import React from "react";
import { ArrowRight, Database, Play, ShieldCheck, Sparkles, Terminal } from "lucide-react";
import { MetrivaButton, MetrivaBadge } from "../ui";
import { MetrivaHeroCanvas } from "./MetrivaHeroCanvas";

interface HeroSectionProps {
  onLaunchApp: () => void;
  onExploreDemo: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onLaunchApp,
  onExploreDemo,
}) => {
  return (
    <section id="hero" className="relative pt-28 pb-20 md:pt-36 md:pb-32 overflow-hidden min-h-[92vh] flex items-center justify-center">
      {/* 3D Animated Wireframe & Perspective Grid Canvas */}
      <MetrivaHeroCanvas />

      {/* Atmospheric radial glow and ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[850px] h-[550px] bg-gradient-to-b from-cyan-500/20 via-blue-600/10 to-transparent rounded-full blur-[140px] -z-10 pointer-events-none" />

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 w-full z-10">
        {/* Floating Central Glass Panel with Illuminated Border */}
        <div className="relative rounded-3xl p-6 sm:p-10 md:p-14 bg-white/75 dark:bg-slate-900/65 backdrop-blur-xl border border-cyan-500/30 dark:border-cyan-400/30 shadow-2xl shadow-cyan-950/20 dark:shadow-cyan-900/30 text-center transition-all duration-300">
          {/* Subtle Corner Glow Highlights */}
          <div className="absolute -top-px left-10 right-10 h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />
          <div className="absolute -bottom-px left-16 right-16 h-px bg-gradient-to-r from-transparent via-blue-500 to-transparent" />

          {/* Eyebrow Pill */}
          <div className="inline-flex items-center justify-center mb-6">
            <MetrivaBadge variant="cyan" size="md" pulse icon={<Sparkles className="h-3.5 w-3.5" />}>
              METRIVA · ENTERPRISE AI BUSINESS INTELLIGENCE
            </MetrivaBadge>
          </div>

          {/* Main Brand Headline */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-6 leading-[1.08]">
            Turn Business Data <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-blue-600 dark:from-cyan-400 dark:via-cyan-300 dark:to-blue-500 bg-clip-text text-transparent">
              Into Clarity.
            </span>
          </h1>

          {/* Canonical Value Statement */}
          <p className="text-lg sm:text-2xl font-medium text-slate-700 dark:text-slate-200 max-w-3xl mx-auto mb-4 leading-snug">
            Connect your tools. Ask your questions. Discover what drives your business.
          </p>

          <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed font-normal">
            Autonomous SQL generation, defense-in-depth AST query security, automated visualization recommendations, and predictive ML forecasting for PostgreSQL, MySQL, and SQLite.
          </p>

          {/* Call to Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <MetrivaButton
              onClick={onLaunchApp}
              size="lg"
              variant="primary"
              icon={<ArrowRight className="h-5 w-5" />}
              iconPosition="right"
              className="w-full sm:w-auto shadow-metriva-glow hover:scale-[1.02] transition-transform"
            >
              Launch Metriva
            </MetrivaButton>

            <MetrivaButton
              onClick={onExploreDemo}
              size="lg"
              variant="secondary"
              icon={<Play className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />}
              className="w-full sm:w-auto hover:scale-[1.02] transition-transform"
            >
              Explore Interactive Demo
            </MetrivaButton>
          </div>

          {/* Trust Badges & Verified Engine Tags */}
          <div className="pt-8 border-t border-slate-200/80 dark:border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-100/60 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/60">
              <ShieldCheck className="h-4 w-4 text-emerald-500 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-semibold text-slate-900 dark:text-white">Read-Only Guard</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Strict AST query validator</div>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-100/60 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/60">
              <Database className="h-4 w-4 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-semibold text-slate-900 dark:text-white">Multi-Engine DB</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">PostgreSQL, SQLite, MySQL</div>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-100/60 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/60">
              <Terminal className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-semibold text-slate-900 dark:text-white">Zero SQL Required</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Natural English queries</div>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-100/60 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/60">
              <Sparkles className="h-4 w-4 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-semibold text-slate-900 dark:text-white">Predictive ML</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Forecasting & Churn Radar</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
