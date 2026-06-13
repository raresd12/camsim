/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cam: {
          50: "#eef4fb",
          100: "#d9e6f6",
          500: "#1e5aa8",
          600: "#174a8c",
          700: "#123c73",
          900: "#0a2444",
        },
      },
    },
  },
  plugins: [],
};
