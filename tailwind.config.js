/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#0B1F17',
          muted: '#5C6B64',
          inverse: '#FFFFFF',
          dark: '#FAFAFA',
          'dark-muted': '#A1A1AA',
        },
        surface: {
          DEFAULT: '#F4F7F5',
          raised: '#FFFFFF',
          sunken: '#E8EEEA',
          dark: '#0A0A0A',
          'dark-raised': '#111111',
          'dark-sunken': '#171717',
        },
        accent: {
          DEFAULT: '#1A7A4C',
          soft: '#D8F0E4',
          bright: '#3DDB8A',
          dark: '#3DDB8A',
          'dark-soft': '#0F2A1C',
        },
        income: {
          DEFAULT: '#1A7A4C',
          soft: '#D8F0E4',
          dark: '#3DDB8A',
        },
        expense: {
          DEFAULT: '#C43C2C',
          soft: '#F8E0DC',
          dark: '#F87171',
        },
        line: {
          DEFAULT: '#D5DED8',
          dark: '#27272A',
        },
      },
      fontFamily: {
        sans: ['System'],
        display: ['System'],
      },
    },
  },
  plugins: [],
};
