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
        background:          "hsl(var(--background))",
        foreground:          "hsl(var(--foreground))",
        surface:             "hsl(var(--surface))",
        "surface-2":         "hsl(var(--surface-2))",
        border:              "hsl(var(--border))",
        "border-subtle":     "hsl(var(--border-subtle))",
        muted:               "hsl(var(--muted))",
        "muted-foreground":  "hsl(var(--muted-foreground))",
        primary: {
          DEFAULT:    "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        accent: {
          DEFAULT:    "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        success:     "hsl(var(--success))",
        warning:     "hsl(var(--warning))",
        destructive: "hsl(var(--destructive))",
      },
      fontFamily: {
        sans:    ["var(--font-sans)"],
        display: ["var(--font-display)"],
        mono:    ["var(--font-mono)"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
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
