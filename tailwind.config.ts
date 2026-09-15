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
        // Slightly darker than the original #B5623A -- that measured 4.18:1
        // contrast against off-white/creme, just under WCAG AA's 4.5:1 for
        // normal-size text. This tone keeps the same hue/saturation but
        // clears AA on both backgrounds (~5.2:1 / ~4.7:1).
        terracota: "#9E5533",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
