/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#0F131C',
          secondary: '#3B4650',
          muted: '#5B6670',
          inverse: '#FFFFFF',
          dark: '#DFE2EE',
          'dark-secondary': '#BDC8D1',
          'dark-muted': '#8F9AA3',
          'dark-inverse': '#04141F',
        },
        surface: {
          DEFAULT: '#F5F7FA',
          raised: '#FFFFFF',
          sunken: '#E9EDF2',
          overlay: '#FFFFFF',
          high: '#E3E8EE',
          dark: '#0F131C',
          'dark-raised': '#181C24',
          'dark-sunken': '#0A0E16',
          'dark-overlay': '#1F242D',
          'dark-high': '#262A33',
        },
        accent: {
          DEFAULT: '#0369A1',
          soft: '#E6F0F6',
          dark: '#38BDF8',
          'dark-soft': '#1D3646',
        },
        income: {
          DEFAULT: '#065F46',
          soft: '#D9F4E8',
          dark: '#00F59B',
          'dark-soft': '#153A35',
        },
        expense: {
          DEFAULT: '#BE123C',
          soft: '#F8E1E7',
          dark: '#FB7185',
          'dark-soft': '#3C2A34',
        },
        warning: {
          DEFAULT: '#92400E',
          soft: '#F4EBD9',
          dark: '#F59E0B',
          'dark-soft': '#3B3120',
        },
        line: {
          DEFAULT: '#D9DFE6',
          strong: '#7A8590',
          dark: '#2B3038',
          'dark-strong': '#66727C',
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
