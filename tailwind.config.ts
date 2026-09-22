import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#161211",
        raise: "#221C1A",
        line: "#3A312E",
        ink: "#F3EDE4",
        muted: "#B7A79E",
        accent: "#FF5C54",
        band: "#D92B21",
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
      maxWidth: {
        page: "54rem",
      },
      borderRadius: {
        lg: "8px",
      },
    },
  },
  plugins: [],
};

export default config;
