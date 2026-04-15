/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          ink: "#08111f",
          panel: "#0f1d33",
          accent: "#f97316",
          signal: "#22c55e"
        }
      }
    }
  },
  plugins: []
};
