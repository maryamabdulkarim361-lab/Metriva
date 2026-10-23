import React from "react";
import { ArrowRight, Database, Play, Sparkles } from "lucide-react";
import { MetrivaButton, MetrivaBadge } from "../ui";

interface CTASectionProps {
  onLaunchApp: () => void;
  onExploreDemo: () => void;
}

export const CTASection: React.FC<CTASectionProps> = ({
  onLaunchApp,
  onExploreDemo,
}) => {
  return (
    <section className="py-24 relative overflow-hidden border-t border-slate-200 dark:border-slate-800/80 transition-colors">
      {/* Background glow mesh */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-gradient-to-r from-cyan-500/10 to-blue-600/10 dark:from-cyan-500/15 dark:to-blue-600/15 blur-[120px] -z-10 pointer-events-none" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="rounded-3xl p-8 sm:p-14 bg-gradient-to-b from-white to-slate-50 dark:from-slate-900/90 dark:to-slate-950/95 border border-cyan-400/30 dark:border-cyan-500/30 shadow-metriva-glow-lg relative overflow-hidden">
          <div className="inline-flex items-center justify-center mb-6">
            <MetrivaBadge variant="cyan" size="md" pulse icon={<Sparkles className="h-3.5 w-3.5" />}>
              Get Started In Seconds
            </MetrivaBadge>
          </div>

          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-6 leading-tight">
            Ready to Turn Your Business Data <br />
            <span className="bg-gradient-to-r from-cyan-600 via-cyan-500 to-blue-600 dark:from-cyan-400 dark:via-cyan-300 dark:to-blue-400 bg-clip-text text-transparent">
              Into Instant Clarity?
            </span>
          </h2>

          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed font-normal">
            Experience autonomous SQL intelligence on our live pre-seeded PostgreSQL enterprise
            database. No setup fees, no complex engineering pipelines.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <MetrivaButton
              onClick={onLaunchApp}
              size="lg"
              variant="primary"
              icon={<ArrowRight className="h-5 w-5" />}
              iconPosition="right"
              className="w-full sm:w-auto shadow-metriva-glow"
            >
              Launch Metriva Platform
            </MetrivaButton>

            <MetrivaButton
              onClick={onExploreDemo}
              size="lg"
              variant="secondary"
              icon={<Play className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />}
              className="w-full sm:w-auto"
            >
              Explore Live Simulator
            </MetrivaButton>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
              Pre-seeded with 2,500 real orders
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 dark:bg-cyan-400" />
              Instant interactive access
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500 dark:bg-blue-400" />
              Zero installation required
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};

