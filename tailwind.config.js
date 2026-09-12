/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        'field-cream':  'rgb(var(--color-field-cream) / <alpha-value>)',
        'willow-mist':  'rgb(var(--color-willow-mist) / <alpha-value>)',
        'grain-sand':   'rgb(var(--color-grain-sand) / <alpha-value>)',
        'soil-shadow':  'rgb(var(--color-soil-shadow) / <alpha-value>)',
        'stone-grey':   'rgb(var(--color-stone-grey) / <alpha-value>)',
        'garden-patch': 'rgb(var(--color-garden-patch) / <alpha-value>)',
        'fresh-herb':   'rgb(var(--color-fresh-herb) / <alpha-value>)',
      },
      fontFamily: {
        display: ['Montserrat', 'sans-serif'],
        body:    ['Inter', 'sans-serif'],
      },
      borderRadius: {
        'card': '24px',
        'pill': '1000px',
      },
      boxShadow: {
        'card': 'var(--shadow-card) 3px 3px 32px -10px',
      },
    },
  },
  plugins: [],
}
