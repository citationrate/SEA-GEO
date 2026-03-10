/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink:               "var(--ink)",
        "ink-2":           "var(--ink-2)",
        "ink-3":           "var(--ink-3)",
        background:        "var(--background)",
        foreground:        "var(--foreground)",
        surface:           "var(--surface)",
        "surface-2":       "var(--ink-3)",
        border:            "var(--line)",
        "border-subtle":   "var(--line)",
        muted:             "var(--muted)",
        "muted-foreground": "var(--muted-foreground)",
        primary: {
          DEFAULT:    "var(--sage)",
          foreground: "var(--ink)",
        },
        accent: {
          DEFAULT:    "var(--cream)",
          foreground: "var(--ink)",
        },
        sage:        "var(--sage)",
        "sage-dim":  "var(--sage-dim)",
        cream:       "var(--cream)",
        "cream-dim": "var(--cream-dim)",
        success:     "var(--success)",
        warning:     "var(--warning)",
        destructive: "var(--destructive)",
      },
      fontFamily: {
        sans:    ["var(--font-sans)"],
        display: ["var(--font-display)"],
        mono:    ["var(--font-mono)"],
      },
      borderRadius: {
        lg: "4px",
        md: "2px",
        sm: "2px",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in-fast": {
          from: { opacity: "0" },
          to:   { opacity: "1" },
        },
        shimmer: {
          from: { backgroundPosition: "200% 0" },
          to:   { backgroundPosition: "-200% 0" },
        },
        "slide-in-right": {
          from: { transform: "translateX(100%)" },
          to:   { transform: "translateX(0)" },
        },
      },
      animation: {
        "fade-in":        "fade-in 0.35s ease-out",
        "fade-in-fast":   "fade-in-fast 0.2s ease-out",
        shimmer:          "shimmer 1.8s linear infinite",
        "slide-in-right": "slide-in-right 0.25s ease-out",
      },
    },
  },
  plugins: [],
};
