/**
 * Metriva Design Tokens & Branding Constants
 * Brand: Metriva
 * Positioning: AI-powered business intelligence for non-technical businesses
 * Tagline: "Turn Business Data Into Clarity."
 */

export const METRIVA_BRAND = {
  name: "Metriva",
  tagline: "Turn Business Data Into Clarity.",
  positioning: "AI-powered business intelligence for non-technical businesses",
  shortDescription:
    "Ask natural-language questions, receive safe SQL-verified intelligence, automated BI visualizations, and predictive machine learning forecasts.",
  version: "1.0.0",
} as const;

export const METRIVA_TOKENS = {
  colors: {
    // Midnight Navy & Deep Backgrounds
    bgDarkest: "#070B14",
    bgDeep: "#0B0F19",
    bgSurface: "#0F172A",
    bgCard: "rgba(15, 23, 42, 0.75)",
    bgCardHover: "rgba(30, 41, 59, 0.8)",

    // Electric Cyan & Glow Accents
    cyanPrimary: "#06B6D4",
    cyanBright: "#22D3EE",
    cyanGlow: "#00F0FF",
    cyanMuted: "rgba(6, 182, 212, 0.15)",
    cyanBorder: "rgba(34, 211, 238, 0.25)",

    // Deep Blue & Indigo Structure
    bluePrimary: "#2563EB",
    blueVibrant: "#3B82F6",
    blueDark: "#172554",
    indigoAccent: "#6366F1",

    // Functional & Semantic
    emeraldSuccess: "#10B981",
    amberWarning: "#F59E0B",
    roseDanger: "#F43F5E",
    slateText: "#F8FAFC",
    slateMuted: "#94A3B8",
    slateBorder: "rgba(51, 65, 85, 0.6)",
  },
  typography: {
    fontSans: "'Inter', system-ui, -apple-system, sans-serif",
    fontMono: "'JetBrains Mono', monospace",
  },
  gradients: {
    hero: "radial-gradient(ellipse at 50% -20%, rgba(6, 182, 212, 0.25) 0%, rgba(15, 23, 42, 0) 70%)",
    cyanBlue: "linear-gradient(135deg, #06B6D4 0%, #2563EB 100%)",
    glowCyan: "radial-gradient(circle, rgba(34, 211, 238, 0.18) 0%, rgba(0, 0, 0, 0) 70%)",
    cardGlass: "linear-gradient(180deg, rgba(30, 41, 59, 0.4) 0%, rgba(15, 23, 42, 0.6) 100%)",
  },
  shadows: {
    cyanGlow: "0 0 25px -5px rgba(6, 182, 212, 0.35)",
    cyanGlowLg: "0 0 45px -10px rgba(6, 182, 212, 0.45)",
    cardDepth: "0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)",
  },
} as const;

