/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#0EA5E9',   // sky-500
        secondary: '#10B981', // emerald-500
        accent: '#8B5CF6',    // violet-500
      },
    },
  },
  plugins: [],
};
