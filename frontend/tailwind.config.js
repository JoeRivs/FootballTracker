/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ravens: {
          purple: "#241773",
          deep: "#1a1142",
          gold: "#9E7C0C",
          black: "#000000",
          gray: "#9197a3",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
