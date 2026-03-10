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
        background:        "var(--background)",
        foreground:        "var(--foreground)",
        surface:           "var(--surface)",
        "surface-2":       "var(--surface-2)",
        border:            "var(--border)",
        "border-light":    "var(--border-light)",
        muted:             "var(--muted)",
        "muted-foreground": "var(--muted-foreground)",
        primary: {
          DEFAULT:    "var(--primary)",
          hover:      "var(--primary-hover)",
          glow:       "var(--primary-glow)",
          foreground: "var(--background)",
        },
        accent: {
          DEFAULT:    "var(--cream)",
          foreground: "var(--background)",
        },
        cream:       "var(--cream)",
        "cream-dim": "var(--muted-foreground)",
        destructive: "var(--destructive)",
        success:     "var(--success)",
        warning:     "var(--warning)",
        /* Legacy aliases */
        ink:         "var(--background)",
        "ink-2":     "var(--surface)",
        "ink-3":     "var(--surface-2)",
        sage:        "var(--primary)",
        "sage-dim":  "var(--primary-hover)",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        sans:    ["var(--font-sans)"],
        mono:    ["var(--font-mono)"],
      },
      borderRadius: {
        lg: "2px",
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
