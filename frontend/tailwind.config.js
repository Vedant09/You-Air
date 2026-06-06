/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        sky: {
          950: '#0c1a2e',
          900: '#0f2342',
        },
        glass: {
          DEFAULT: 'rgba(15, 35, 66, 0.7)',
          light: 'rgba(255, 255, 255, 0.05)',
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
};
