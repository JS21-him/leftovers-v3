/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#fff8f0',
          primary: '#f97316',
          text: '#7c2d12',
          muted: '#6b7280',
          surface: '#ffffff',
          border: '#fed7aa',
          danger: '#ef4444',
        },
      },
    },
  },
  plugins: [],
};
