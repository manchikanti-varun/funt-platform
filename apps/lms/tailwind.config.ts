import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        "brand-learn": ["var(--font-brand-learn)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        funt: {
          paper: "#fffdf7",
          ink: "#0a0a0a",
          gold: "#f5c400",
          "gold-hover": "#e6b800",
          "gold-deep": "#ca8a04",
          honey: "#fef3c7",
          butter: "#fffbeb",
          muted: "#404040",
        },
        brand: {
          teal: "#0d9488",
          violet: "#7c3aed",
          amber: "#d97706",
          sky: "#0284c7",
          emerald: "#059669",
        },
      },
      boxShadow: {
        soft: "0 2px 15px -3px rgba(0,0,0,0.07), 0 10px 20px -2px rgba(0,0,0,0.04)",
        card: "0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.04)",
      },
    },
  },
  plugins: [],
};
export default config;
