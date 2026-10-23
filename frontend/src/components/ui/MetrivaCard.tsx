import React from "react";

export interface MetrivaCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "glass" | "elevated";
  glow?: boolean;
  hoverGlow?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
  onClick?: () => void;
}

export const MetrivaCard: React.FC<MetrivaCardProps> = ({
  children,
  className = "",
  variant = "glass",
  glow = false,
  hoverGlow = true,
  padding = "md",
  onClick,
}) => {
  const paddingStyles = {
    none: "",
    sm: "p-3 sm:p-4",
    md: "p-5 sm:p-6",
    lg: "p-6 sm:p-8",
  }[padding];

  const variantStyles = {
    default:
      "border-slate-200/90 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/60 shadow-sm dark:shadow-none text-slate-800 dark:text-slate-100",
    glass:
      "border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/70 backdrop-blur-md shadow-sm dark:shadow-none text-slate-800 dark:text-slate-100",
    elevated:
      "border-cyan-500/30 dark:border-cyan-500/30 bg-white dark:bg-slate-900/90 shadow-xl dark:shadow-metriva-glow backdrop-blur-md text-slate-800 dark:text-slate-100",
  }[variant];

  const glowStyles = glow
    ? "border-cyan-500/40 shadow-lg shadow-cyan-500/10 dark:shadow-metriva-glow bg-white/95 dark:bg-slate-900/80 text-slate-800 dark:text-slate-100"
    : variantStyles;

  const hoverStyles = hoverGlow
    ? "hover:border-cyan-500/50 hover:shadow-md dark:hover:shadow-metriva-glow transition-all duration-300"
    : "";

  const cursorStyles = onClick ? "cursor-pointer" : "";

  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border ${glowStyles} ${hoverStyles} ${cursorStyles} ${paddingStyles} ${className}`}
    >
      {children}
    </div>
  );
};
