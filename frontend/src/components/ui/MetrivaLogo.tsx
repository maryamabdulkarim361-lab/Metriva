import React from "react";

interface MetrivaLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  showTagline?: boolean;
}

export const MetrivaLogo: React.FC<MetrivaLogoProps> = ({
  className = "",
  size = "md",
  showTagline = false,
}) => {
  const iconSize = {
    sm: "h-7 w-7",
    md: "h-9 w-9",
    lg: "h-11 w-11",
  }[size];

  const titleSize = {
    sm: "text-base",
    md: "text-lg",
    lg: "text-2xl",
  }[size];

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Metriva Geometric Converging Nodes Icon */}
      <div
        className={`relative ${iconSize} rounded-xl bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-700 p-0.5 shadow-lg shadow-cyan-500/20 flex items-center justify-center shrink-0 group`}
      >
        <div className="w-full h-full bg-white/90 dark:bg-slate-950/80 rounded-[10px] flex items-center justify-center backdrop-blur-sm">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-5/6 h-5/6"
          >
            <defs>
              <linearGradient id="metriva-grad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                <stop stopColor="#22D3EE" />
                <stop offset="0.5" stopColor="#06B6D4" />
                <stop offset="1" stopColor="#3B82F6" />
              </linearGradient>
              <filter id="cyan-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="1.5" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>
            {/* Geometric stylized M with data convergence nodes */}
            <path
              d="M4 19V6L12 14L20 6V19"
              stroke="url(#metriva-grad)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Central Intelligence Node */}
            <circle cx="12" cy="14" r="2.2" fill="#22D3EE" filter="url(#cyan-glow)" />
            <circle cx="4" cy="6" r="1.5" fill="#38BDF8" />
            <circle cx="20" cy="6" r="1.5" fill="#38BDF8" />
          </svg>
        </div>
      </div>

      <div className="flex flex-col">
        <span
          className={`font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5 ${titleSize}`}
        >
          <span>Metriva</span>
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-500 dark:bg-cyan-400 animate-pulse-subtle" />
        </span>
        {showTagline && (
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium tracking-wide">
            Turn Business Data Into Clarity
          </span>
        )}
      </div>
    </div>
  );
};

