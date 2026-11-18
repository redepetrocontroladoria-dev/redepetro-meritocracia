import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "#B01F24",
          secondary: "#1A1A1A",
          accent: "#FFFFFF",
          background: "#F8FAFC",
        },
      },
    },
  },
  plugins: [],
};

export default config;
