/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  safelist: [
  "dark:bg-gray-900",
  "dark:text-gray-400"
],
  theme: { extend: {} },
  plugins: [],
}