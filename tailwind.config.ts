// ============================================================
// TAILWIND CONFIG — Design System V2
// Extende Tailwind com tokens proprietários
// ============================================================

import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    // Overrides do container
    container: {
      center: true,
      padding: "16px",
      screens: {
        "2xl": "1280px",
      },
    },

    extend: {
      // ── CORES DO DESIGN SYSTEM ──────────────────────────
      colors: {
        bg:             "var(--bg)",
        surface:        "var(--surface)",
        "surface-hover":"var(--surface-hover)",
        "surface-raised":"var(--surface-raised)",
        border:         "var(--border)",
        "border-subtle":"var(--border-subtle)",

        "text-primary":   "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "text-muted":     "var(--text-muted)",

        primary:        "var(--primary)",
        "primary-hover":"var(--primary-hover)",
        "primary-muted":"var(--primary-muted)",

        success:        "var(--success)",
        "success-muted":"var(--success-muted)",
        danger:         "var(--danger)",
        "danger-muted": "var(--danger-muted)",
        warning:        "var(--warning)",
        "warning-muted":"var(--warning-muted)",
      },

      // ── TIPOGRAFIA ──────────────────────────────────────
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },

      fontSize: {
        xs:   ["11px", { lineHeight: "1.5",  letterSpacing: "0" }],
        sm:   ["13px", { lineHeight: "1.5",  letterSpacing: "0" }],
        base: ["14px", { lineHeight: "1.6",  letterSpacing: "0" }],
        lg:   ["16px", { lineHeight: "1.5",  letterSpacing: "-0.01em" }],
        xl:   ["20px", { lineHeight: "1.3",  letterSpacing: "-0.01em" }],
        "2xl":["24px", { lineHeight: "1.2",  letterSpacing: "-0.02em" }],
        "4xl":["36px", { lineHeight: "1.1",  letterSpacing: "-0.02em" }],
        "5xl":["48px", { lineHeight: "1.0",  letterSpacing: "-0.03em" }],
      },

      // ── BORDAS ──────────────────────────────────────────
      borderRadius: {
        sm:  "6px",
        md:  "8px",
        lg:  "12px",
        xl:  "16px",  // apenas modais
        "2xl":"20px",
      },

      // ── SOMBRAS (minimalistas) ──────────────────────────
      boxShadow: {
        "sm":     "0 1px 3px rgba(0,0,0,0.3)",
        "card":   "0 0 0 1px rgba(91,140,255,0.06)",
        "glow":   "0 0 20px 4px rgba(91,140,255,0.12)",
        "none":   "none",
      },

      // ── LARGURAS FIXAS ──────────────────────────────────
      width: {
        sidebar:            "240px",
        "sidebar-collapsed": "64px",
      },

      // ── ANIMAÇÕES ───────────────────────────────────────
      keyframes: {
        "fade-in": {
          "0%":   { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(91,140,255,0)" },
          "50%":      { boxShadow: "0 0 20px 4px rgba(91,140,255,0.12)" },
        },
        "progress-fill": {
          "0%":   { width: "0%" },
          "100%": { width: "var(--progress-value)" },
        },
        "slide-in-left": {
          "0%":   { opacity: "0", transform: "translateX(-16px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
      },

      animation: {
        "fade-in":      "fade-in 300ms ease-out forwards",
        "glow-pulse":   "glow-pulse 3s ease-in-out infinite",
        "slide-in-left":"slide-in-left 300ms ease-out forwards",
      },

      // ── GRID ────────────────────────────────────────────
      gridTemplateColumns: {
        "dashboard-top":  "repeat(4, 1fr)",
        "dashboard-mid":  "2fr 1fr",
        "sidebar-layout": "240px 1fr",
        "sidebar-collapsed": "64px 1fr",
      },

      // ── TRANSIÇÕES ──────────────────────────────────────
      transitionDuration: {
        "150": "150ms",
        "200": "200ms",
        "300": "300ms",
        "500": "500ms",
      },

      transitionTimingFunction: {
        "out": "ease-out",
      },
    },
  },

  plugins: [],
};

export default config;
