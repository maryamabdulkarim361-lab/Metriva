import React, { useState, useEffect } from "react";
import { ArrowRight, LogIn, Menu, X } from "lucide-react";
import { MetrivaLogo, MetrivaButton, ThemeToggle } from "../ui";

interface LandingNavbarProps {
  onLaunchApp: () => void;
  onOpenAuth?: () => void;
  onLogout?: () => void;
  currentUser?: { name?: string; email?: string } | null;
}

export const LandingNavbar: React.FC<LandingNavbarProps> = ({
  onLaunchApp,
  onOpenAuth,
  onLogout,
  currentUser,
}) => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { label: "Product Story", href: "#story" },
    { label: "Features", href: "#features" },
    { label: "Live Preview", href: "#demo" },
    { label: "Enterprise Security", href: "#security" },
    { label: "Use Cases", href: "#use-cases" },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/85 dark:bg-slate-950/85 backdrop-blur-xl border-b border-slate-200/80 dark:border-cyan-500/15 py-3 shadow-lg shadow-slate-900/5 dark:shadow-black/40"
          : "bg-transparent py-5"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* Logo */}
        <a href="#hero" className="focus:outline-none focus:ring-2 focus:ring-cyan-500 rounded-lg">
          <MetrivaLogo size="md" showTagline={false} />
        </a>

        {/* Desktop Nav Links */}
        <nav className="hidden md:flex items-center gap-7">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Action Buttons */}
        <div className="hidden sm:flex items-center gap-3">
          <ThemeToggle size="sm" />

          {currentUser ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400">Signed in as</span>
              <span className="text-xs font-semibold text-cyan-600 dark:text-cyan-300 max-w-[120px] truncate">
                {currentUser.name || currentUser.email}
              </span>
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="text-xs text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 underline ml-1 cursor-pointer transition-colors"
                  title="Sign out"
                  aria-label="Sign out from landing page"
                >
                  Sign Out
                </button>
              )}
            </div>
          ) : onOpenAuth ? (
            <button
              onClick={onOpenAuth}
              className="text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 transition flex items-center gap-1.5"
            >
              <LogIn className="h-3.5 w-3.5 text-cyan-500 dark:text-cyan-400" />
              <span>Sign In</span>
            </button>
          ) : null}

          <MetrivaButton
            onClick={onLaunchApp}
            size="sm"
            variant="primary"
            icon={<ArrowRight className="h-3.5 w-3.5" />}
            iconPosition="right"
          >
            Launch Platform
          </MetrivaButton>
        </div>

        {/* Mobile Hamburger Toggle */}
        <div className="md:hidden flex items-center gap-2">
          <ThemeToggle size="sm" />
          <MetrivaButton onClick={onLaunchApp} size="sm" variant="primary">
            Launch
          </MetrivaButton>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/80"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 px-4 pt-3 pb-6 space-y-3">
          <nav className="flex flex-col space-y-2">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="text-sm font-medium text-slate-700 dark:text-slate-200 hover:text-cyan-600 dark:hover:text-cyan-400 py-2 border-b border-slate-100 dark:border-slate-900"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="pt-2 flex flex-col gap-2">
            {onOpenAuth && !currentUser && (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenAuth();
                }}
                className="w-full text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-cyan-600 dark:hover:text-cyan-400 py-2.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center gap-1.5"
              >
                <LogIn className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />
                <span>Sign In to Account</span>
              </button>
            )}
            <MetrivaButton
              onClick={() => {
                setMobileMenuOpen(false);
                onLaunchApp();
              }}
              size="md"
              variant="primary"
              className="w-full"
            >
              Launch Platform Now
            </MetrivaButton>
          </div>
        </div>
      )}
    </header>
  );
};
