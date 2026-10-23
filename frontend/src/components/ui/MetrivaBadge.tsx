import React from "react";

export interface MetrivaBadgeProps {
  children: React.ReactNode;
  variant?: "cyan" | "emerald" | "blue" | "amber" | "purple" | "rose" | "slate";
  size?: "sm" | "md";
  pulse?: boolean;
  icon?: React.ReactNode;
  className?: string;
}

export const MetrivaBadge: React.FC<MetrivaBadgeProps> = ({
  children,
  variant = "cyan",
  size = "md",
  pulse = false,
  icon,
  className = "",
}) => {
  const sizeStyles = {
    sm: "text-[11px] px-2 py-0.5 gap-1",
    md: "text-xs px-2.5 py-1 gap-1.5",
  }[size];

  const variantStyles = {
    cyan: "bg-cyan-50 border-cyan-200 text-cyan-800 dark:bg-cyan-950/40 dark:border-cyan-500/30 dark:text-cyan-300 shadow-sm shadow-cyan-500/5 dark:shadow-cyan-950/50",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-500/30 dark:text-emerald-300 shadow-sm shadow-emerald-500/5 dark:shadow-emerald-950/50",
    blue: "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/40 dark:border-blue-500/30 dark:text-blue-300 shadow-sm shadow-blue-500/5 dark:shadow-blue-950/50",
    amber: "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/40 dark:border-amber-500/30 dark:text-amber-300 shadow-sm shadow-amber-500/5 dark:shadow-amber-950/50",
    purple: "bg-purple-50 border-purple-200 text-purple-800 dark:bg-purple-950/40 dark:border-purple-500/30 dark:text-purple-300 shadow-sm shadow-purple-500/5 dark:shadow-purple-950/50",
    rose: "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-500/30 dark:text-rose-300 shadow-sm shadow-rose-500/5 dark:shadow-rose-950/50",
    slate: "bg-slate-100 border-slate-300 text-slate-800 dark:bg-slate-900/60 dark:border-slate-700/60 dark:text-slate-300",
  }[variant];

  const pulseColor = {
    cyan: "bg-cyan-500 dark:bg-cyan-400",
    emerald: "bg-emerald-500 dark:bg-emerald-400",
    blue: "bg-blue-500 dark:bg-blue-400",
    amber: "bg-amber-500 dark:bg-amber-400",
    purple: "bg-purple-500 dark:bg-purple-400",
    rose: "bg-rose-500 dark:bg-rose-400",
    slate: "bg-slate-500 dark:bg-slate-400",
  }[variant];

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border backdrop-blur-sm ${sizeStyles} ${variantStyles} ${className}`}
    >
      {pulse && (
        <span className="relative flex h-2 w-2">
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${pulseColor}`}
          />
          <span className={`relative inline-flex rounded-full h-2 w-2 ${pulseColor}`} />
        </span>
      )}
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
};
