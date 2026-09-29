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
          DEFAULT: "rgb(var(--c-bg) / <alpha-value>)",
          subtle: "rgb(var(--c-bg-subtle) / <alpha-value>)",
          panel: "rgb(var(--c-bg-panel) / <alpha-value>)",
          elevated: "rgb(var(--c-bg-elevated) / <alpha-value>)",
        },
        line: {
          DEFAULT: "rgb(var(--c-line) / <alpha-value>)",
          soft: "rgb(var(--c-line-soft) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--c-accent) / <alpha-value>)",
          soft: "rgb(var(--c-accent-soft) / <alpha-value>)",
          glow: "rgb(var(--c-accent-glow) / <alpha-value>)",
          deep: "rgb(var(--c-accent-deep) / <alpha-value>)",
        },
        ink: {
          DEFAULT: "rgb(var(--c-ink) / <alpha-value>)",
          muted: "rgb(var(--c-ink-muted) / <alpha-value>)",
          faint: "rgb(var(--c-ink-faint) / <alpha-value>)",
        },
        // Theme-aware surface overlay (white in dark, near-black in light).
        overlay: "rgb(var(--c-overlay) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "ui-sans-serif", "sans-serif"],
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
        "bubble-in": {
          from: { opacity: "0", transform: "translate(6px, 10px) scale(0.96)" },
          to: { opacity: "1", transform: "translate(0, 0) scale(1)" },
        },
        "send-ripple": {
          "0%": { transform: "scale(0.85)", opacity: "0.7" },
          "100%": { transform: "scale(1.9)", opacity: "0" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.28s cubic-bezier(0.22,1,0.36,1)",
        "scale-in": "scale-in 0.18s cubic-bezier(0.22,1,0.36,1)",
        shimmer: "shimmer 1.4s infinite",
        "glow-pulse": "glow-pulse 4s ease-in-out infinite",
        "bubble-in": "bubble-in 0.32s cubic-bezier(0.22,1,0.36,1) both",
        "send-ripple": "send-ripple 0.6s cubic-bezier(0.22,1,0.36,1) forwards",
      },
    },
  },
  plugins: [],
};

export default config;
