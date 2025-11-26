import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./providers/**/*.{ts,tsx}",
    "../../packages/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        card: "hsl(var(--card) / <alpha-value>)",
        "card-foreground": "hsl(var(--card-foreground) / <alpha-value>)",
        surface: "hsl(var(--surface) / <alpha-value>)",
        "surface-alt": "hsl(var(--surface-alt) / <alpha-value>)",
        muted: "hsl(var(--muted) / <alpha-value>)",
        "muted-foreground": "hsl(var(--muted-foreground) / <alpha-value>)",
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",
        primary: "hsl(var(--primary) / <alpha-value>)",
        "primary-foreground": "hsl(var(--primary-foreground) / <alpha-value>)",
        secondary: "hsl(var(--secondary) / <alpha-value>)",
        "secondary-foreground":
          "hsl(var(--secondary-foreground) / <alpha-value>)",
        accent: "hsl(var(--accent) / <alpha-value>)",
        "accent-foreground": "hsl(var(--accent-foreground) / <alpha-value>)",
        destructive: "hsl(var(--destructive) / <alpha-value>)",
        "destructive-foreground":
          "hsl(var(--destructive-foreground) / <alpha-value>)",
        success: "hsl(var(--success) / <alpha-value>)",
        warning: "hsl(var(--warning) / <alpha-value>)",
        danger: "hsl(var(--danger) / <alpha-value>)"
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", '"JetBrains Mono"', "monospace"],
        display: ["var(--font-display)", '"Space Grotesk"', "sans-serif"]
      },
      letterSpacing: {
        hud: "0.35em"
      },
      maxWidth: {
        card: "480px"
      },
      borderRadius: {
        base: "var(--radius)",
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)"
      },
      boxShadow: {
        hud: "0 30px 80px rgba(0,0,0,0.65)",
        glow: "0 0 30px rgba(235, 104, 150, 0.35)"
      },
      backgroundImage: {
        "hud-grid":
          "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)"
      },
      animation: {
        "scan-slow": "scan 10s linear infinite",
        "pulse-soft": "pulseSoft 3s ease-in-out infinite",
        toastProgress: "toastProgress var(--toast-duration,5s) linear forwards"
      },
      keyframes: {
        scan: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" }
        },
        pulseSoft: {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "1" }
        },
        toastProgress: {
          "0%": { width: "0%" },
          "100%": { width: "100%" }
        }
      }
    }
  },
  plugins: []
};

export default config;
