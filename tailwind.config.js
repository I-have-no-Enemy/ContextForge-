/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx,html}",
    "./app/**/*.{js,ts,jsx,tsx,mdx,html}",
    "./components/**/*.{js,ts,jsx,tsx,mdx,html}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx,html}",
    "./specs/**/*.md",
    "./*.html",
  ],
  theme: {
    extend: {
      colors: {
        obsidian: "var(--color-obsidian, #101010)",
        carbon: "var(--color-carbon, #080808)",
        chalk: "var(--color-chalk, #f3f3f3)",
        smoke: "var(--color-smoke, #9c9c9c)",
        ash: "var(--color-ash, #c1c1c1)",
        graphite: "var(--color-graphite, #212121)",
        iron: "var(--color-iron, #474747)",
        "signal-white": "var(--color-signal-white, #ffffff)",
        "compass-gold": "var(--color-compass-gold, #6f6759)",
        "card-slate": "var(--color-card-slate, #3b3d45)",
      },
      fontFamily: {
        aeonik: ["Aeonik", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
        input: ["Input", "ui-monospace", "monospace"],
      },
      borderRadius: {
        tag: "4px",
        card: "8px",
        pill: "9999px",
      },
    },
  },
  plugins: [],
};
