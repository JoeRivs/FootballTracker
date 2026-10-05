/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Set per selected team at runtime (src/lib/theme.js); RGB channels so
        // opacity modifiers like bg-team-accent/20 work.
        team: {
          primary: "rgb(var(--team-primary) / <alpha-value>)",
          deep: "rgb(var(--team-deep) / <alpha-value>)",
          accent: "rgb(var(--team-accent) / <alpha-value>)",
        },
        muted: "#9197a3",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
