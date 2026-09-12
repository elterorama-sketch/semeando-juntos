import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        "verde-profundo": "#1F3D2B",
        "verde-oliva": "#5C6B3B",
        creme: "#F3ECDD",
        "off-white": "#FBF9F3",
        terracota: "#B5623A",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
