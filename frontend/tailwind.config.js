/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        slate: {
          850: "#151e2e",
          950: "#0b0f19",
        },
        brand: {
          50: "#eff6ff",
          100: "#dbeafe",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
        },
        metriva: {
          darkest: "#070B14",
          navy: "#0B0F19",
          slate: "#0F172A",
          card: "#131C31",
          deep: "#172554",
          cyan: "#06B6D4",
          "cyan-bright": "#22D3EE",
          "cyan-glow": "#00F0FF",
          blue: "#2563EB",
          indigo: "#6366F1",
        },
      },
      boxShadow: {
        "metriva-glow": "0 0 25px -5px rgba(6, 182, 212, 0.35)",
        "metriva-glow-lg": "0 0 45px -8px rgba(6, 182, 212, 0.45)",
        "metriva-card": "0 10px 30px -10px rgba(0, 0, 0, 0.5)",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "metriva-hero": "radial-gradient(ellipse at 50% -20%, rgba(6, 182, 212, 0.22) 0%, rgba(11, 15, 25, 0) 70%)",
        "metriva-cyan-blue": "linear-gradient(135deg, #06B6D4 0%, #2563EB 100%)",
        "metriva-card-glass": "linear-gradient(180deg, rgba(30, 41, 59, 0.4) 0%, rgba(15, 23, 42, 0.6) 100%)",
      },
      animation: {
        "pulse-subtle": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "float-slow": "floatSlow 6s ease-in-out infinite",
      },
      keyframes: {
        floatSlow: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
    },
  },
  plugins: [],
}
