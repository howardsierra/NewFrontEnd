import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#0a0b10",
          subtle: "#0d0f17",
          panel: "#12141f",
          elevated: "#191c2a",
          hover: "#20243440",
        },
        line: {
          DEFAULT: "#22263a",
          soft: "#191c2b",
        },
        accent: {
          DEFAULT: "#7c6cff",
          soft: "#a99bff",
          glow: "#5b8cff",
          deep: "#5b3df0",
        },
        ink: {
          DEFAULT: "#eaebf4",
          muted: "#969db4",
          faint: "#5c6382",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(124,108,255,0.35), 0 10px 40px -12px rgba(124,108,255,0.5)",
        soft: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 12px 32px -16px rgba(0,0,0,0.7)",
        panel: "0 24px 70px -28px rgba(0,0,0,0.85)",
      },
      backgroundImage: {
        "accent-grad": "linear-gradient(135deg, #7c6cff 0%, #5b8cff 100%)",
        "accent-grad-soft":
          "linear-gradient(135deg, rgba(124,108,255,0.18) 0%, rgba(91,140,255,0.14) 100%)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.97) translateY(4px)" },
          to: { opacity: "1", transform: "scale(1) translateY(0)" },
        },
        shimmer: { "100%": { transform: "translateX(100%)" } },
        "glow-pulse": {
          "0%, 100%": { opacity: "0.5" },
          "50%": { opacity: "0.9" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.28s cubic-bezier(0.22,1,0.36,1)",
        "scale-in": "scale-in 0.18s cubic-bezier(0.22,1,0.36,1)",
        shimmer: "shimmer 1.4s infinite",
        "glow-pulse": "glow-pulse 4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
