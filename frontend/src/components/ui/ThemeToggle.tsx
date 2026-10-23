import React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { ThemeMode, useTheme } from "../../theme/ThemeContext";

interface ThemeToggleProps {
  className?: string;
  variant?: "pill" | "segmented" | "icon";
  size?: "sm" | "md";
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  className = "",
  variant = "pill",
  size = "md",
}) => {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();

  if (variant === "segmented") {
    const options: { mode: ThemeMode; label: string; icon: React.ReactNode }[] = [
      { mode: "light", label: "Light", icon: <Sun className="h-3.5 w-3.5" /> },
      { mode: "dark", label: "Dark", icon: <Moon className="h-3.5 w-3.5" /> },
      { mode: "system", label: "System", icon: <Monitor className="h-3.5 w-3.5" /> },
    ];

    return (
      <div
        role="group"
        aria-label="Theme mode selector"
        className={`inline-flex items-center p-1 rounded-xl bg-slate-200/80 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-800 text-xs ${className}`}
      >
        {options.map((opt) => {
          const isActive = theme === opt.mode;
          return (
            <button
              key={opt.mode}
              type="button"
              onClick={() => setTheme(opt.mode)}
              aria-pressed={isActive}
              aria-label={`Switch to ${opt.label} theme`}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-all duration-200 ${
                isActive
                  ? "bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              {opt.icon}
              <span className="hidden sm:inline">{opt.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  const isDark = resolvedTheme === "dark";
  const sizeClasses = size === "sm" ? "p-1.5 text-xs" : "p-2 text-sm";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? "light" : "dark"} theme (currently ${resolvedTheme})`}
      title={`Switch to ${isDark ? "light" : "dark"} theme`}
      className={`relative inline-flex items-center justify-center rounded-xl border border-slate-300/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 hover:border-cyan-500/40 shadow-sm backdrop-blur-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 ${sizeClasses} ${className}`}
    >
      {isDark ? (
        <Sun className="h-4 w-4 transition-transform duration-300 hover:rotate-45 text-amber-400" />
      ) : (
        <Moon className="h-4 w-4 transition-transform duration-300 hover:-rotate-12 text-slate-700" />
      )}
      <span className="sr-only">Toggle theme</span>
    </button>
  );
};

