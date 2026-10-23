import React from "react";
import { Loader2 } from "lucide-react";

export interface MetrivaButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
  loading?: boolean;
}

export const MetrivaButton: React.FC<MetrivaButtonProps> = ({
  children,
  variant = "primary",
  size = "md",
  icon,
  iconPosition = "left",
  loading = false,
  disabled,
  className = "",
  ...props
}) => {
  const baseStyles =
    "inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-950 disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.98]";

  const sizeStyles = {
    sm: "text-xs px-3 py-1.5 gap-1.5",
    md: "text-sm px-4 py-2.5 gap-2",
    lg: "text-base px-6 py-3.5 gap-2.5 font-semibold",
  }[size];

  const variantStyles = {
    primary:
      "bg-gradient-to-r from-cyan-500 via-cyan-600 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 border border-cyan-400/30",
    secondary:
      "bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300/80 dark:bg-slate-900/80 dark:hover:bg-slate-800 dark:text-slate-100 dark:border-slate-700/80 backdrop-blur-md shadow-sm",
    outline:
      "bg-transparent hover:bg-cyan-50 text-cyan-700 border border-cyan-500/50 hover:border-cyan-600 dark:hover:bg-cyan-950/30 dark:text-cyan-400 dark:hover:text-cyan-300 dark:border-cyan-500/40 dark:hover:border-cyan-400/80 backdrop-blur-sm",
    ghost:
      "bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white border border-transparent",
    danger:
      "bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20 border border-rose-500/30",
  }[variant];

  return (
    <button
      className={`${baseStyles} ${sizeStyles} ${variantStyles} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin text-current" />
          <span>Loading...</span>
        </>
      ) : (
        <>
          {icon && iconPosition === "left" && <span className="shrink-0">{icon}</span>}
          {children}
          {icon && iconPosition === "right" && <span className="shrink-0">{icon}</span>}
        </>
      )}
    </button>
  );
};
