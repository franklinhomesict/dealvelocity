import type { Config } from "tailwindcss";

const c = (v: string) => `rgb(var(--${v}) / <alpha-value>)`;

export default {
  darkMode: ["class", '[data-theme="dark"]'],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        app: c("bg-app"),
        sidebar: c("bg-sidebar"),
        surface: { DEFAULT: c("bg-surface"), 2: c("bg-surface-2"), 3: c("bg-surface-3") },
        line: { DEFAULT: c("border"), strong: c("border-strong") },
        fg: { DEFAULT: c("fg"), 2: c("fg-2"), 3: c("fg-3"), inverse: c("fg-inverse") },
        pos: { DEFAULT: c("positive"), bg: c("positive-bg") },
        warn: { DEFAULT: c("warning"), bg: c("warning-bg") },
        neg: { DEFAULT: c("negative"), bg: c("negative-bg") },
        info: { DEFAULT: c("info"), bg: c("info-bg") },
        focus: c("focus"),
        primary: { DEFAULT: c("primary"), fg: c("primary-fg") },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      fontSize: {
        "2xs": ["10.5px", { lineHeight: "14px", letterSpacing: "0.01em" }],
        xs: ["11.5px", { lineHeight: "16px" }],
        sm: ["12.5px", { lineHeight: "18px" }],
        base: ["13.5px", { lineHeight: "20px" }],
        md: ["14.5px", { lineHeight: "22px" }],
        lg: ["16px", { lineHeight: "24px", letterSpacing: "-0.01em" }],
        xl: ["19px", { lineHeight: "26px", letterSpacing: "-0.015em" }],
        "2xl": ["23px", { lineHeight: "30px", letterSpacing: "-0.02em" }],
      },
      borderRadius: { sm: "4px", DEFAULT: "6px", md: "7px", lg: "9px" },
      spacing: { "4.5": "18px", row: "36px", topbar: "48px" },
      boxShadow: {
        pop: "0 0 0 1px rgb(var(--border-strong)), 0 12px 32px -8px rgb(0 0 0 / 0.45)",
        drawer: "-1px 0 0 rgb(var(--border)), -24px 0 48px -12px rgb(0 0 0 / 0.35)",
      },
      keyframes: {
        shimmer: { "100%": { transform: "translateX(100%)" } },
        "slide-in": { from: { transform: "translateX(16px)", opacity: "0" }, to: { transform: "none", opacity: "1" } },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "pop-in": { from: { transform: "scale(.98) translateY(-4px)", opacity: "0" }, to: { transform: "none", opacity: "1" } },
      },
      animation: {
        shimmer: "shimmer 1.4s infinite",
        "slide-in": "slide-in 160ms cubic-bezier(.2,.8,.2,1)",
        "fade-in": "fade-in 120ms ease-out",
        "pop-in": "pop-in 140ms cubic-bezier(.2,.8,.2,1)",
      },
    },
  },
  plugins: [],
} satisfies Config;
