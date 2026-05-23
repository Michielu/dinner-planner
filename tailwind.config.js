/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        'field-cream':  '#f4f3e7',
        'willow-mist':  '#d8e5d6',
        'grain-sand':   '#e8dcc6',
        'soil-shadow':  '#0e150e',
        'stone-grey':   '#8c8c82',
        'garden-patch': '#00473c',
        'fresh-herb':   '#7aaa6a',
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
        'card': 'rgba(14,21,14,0.4) 3px 3px 32px -10px',
      },
    },
  },
  plugins: [],
}

