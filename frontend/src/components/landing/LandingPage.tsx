import React from "react";
import { LandingNavbar } from "./LandingNavbar";
import { HeroSection } from "./HeroSection";
import { InteractiveDemoPreview } from "./InteractiveDemoPreview";
import { ProductStorySection } from "./ProductStorySection";
import { FeatureShowcaseSection } from "./FeatureShowcaseSection";
import { UseCasesSection } from "./UseCasesSection";
import { SecuritySection } from "./SecuritySection";
import { CTASection } from "./CTASection";
import { LandingFooter } from "./LandingFooter";

interface LandingPageProps {
  onLaunchApp: () => void;
  onOpenAuth: () => void;
  currentUser?: { name?: string; email?: string } | null;
  onNavigateToQueryWithPrompt: (prompt: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onLaunchApp,
  onOpenAuth,
  currentUser,
  onNavigateToQueryWithPrompt,
}) => {
  const handleScrollToDemo = () => {
    const el = document.getElementById("demo");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleDemoQueryLaunch = (query: string) => {
    onNavigateToQueryWithPrompt(query);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-white dark:selection:text-slate-950 overflow-x-hidden transition-colors duration-200">
      {/* Fixed Sticky Header Navigation */}
      <LandingNavbar
        onLaunchApp={onLaunchApp}
        onOpenAuth={onOpenAuth}
        currentUser={currentUser}
      />

      {/* Main Marketing Flow */}
      <main className="flex-1">
        <HeroSection
          onLaunchApp={onLaunchApp}
          onExploreDemo={handleScrollToDemo}
        />

        <InteractiveDemoPreview
          onNavigateToAppWithQuery={handleDemoQueryLaunch}
        />

        <ProductStorySection />

        <FeatureShowcaseSection />

        <UseCasesSection />

        <SecuritySection />

        <CTASection
          onLaunchApp={onLaunchApp}
          onExploreDemo={handleScrollToDemo}
        />
      </main>

      {/* Structured Footer */}
      <LandingFooter onLaunchApp={onLaunchApp} />
    </div>
  );
};

