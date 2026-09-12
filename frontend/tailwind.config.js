/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        /* Orange — teinte principale, drapeau CI */
        primary: {
          50: '#fff4e8',
          100: '#ffe6cc',
          200: '#ffcb99',
          300: '#ffab5c',
          400: '#ff9433',
          500: '#ff8200',
          600: '#e06e00',
          700: '#b85900',
          800: '#8f4500',
          900: '#6b3400',
        },
        /* Vert — accents positifs / succès, drapeau CI */
        success: {
          50: '#e8f7ee',
          100: '#c8ecd6',
          200: '#93d9ae',
          300: '#5cc086',
          400: '#2ba965',
          500: '#009a44',
          600: '#00833a',
          700: '#00682e',
          800: '#005024',
          900: '#00391a',
        },
        danger: {
          50: '#fdf1f1',
          100: '#fbdcdc',
          200: '#f5b8b8',
          300: '#ea8e8e',
          400: '#df6a6a',
          500: '#d64545',
          600: '#b93333',
          700: '#932828',
          800: '#711e1e',
          900: '#521515',
        },
        /* Jaune doré — attention, distinct de l'orange primaire */
        warning: {
          50: '#fdf8e8',
          100: '#f9ecc0',
          200: '#f2da85',
          300: '#e6c150',
          400: '#daa927',
          500: '#c98a00',
          600: '#a87100',
          700: '#805700',
          800: '#5f4100',
          900: '#432e00',
        },
        ink: {
          50: '#f7f7f8',
          100: '#ededf0',
          200: '#dadadf',
          300: '#b9b9c2',
          400: '#8f8f9c',
          500: '#6b6b78',
          600: '#52525e',
          700: '#3f3f4a',
          800: '#292933',
          900: '#18181f',
          950: '#0e0e12',
        },
        /* Couleurs du drapeau, pour tout élément de branding explicite */
        flag: {
          orange: '#ff8200',
          white: '#ffffff',
          green: '#009a44',
        },
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(14, 14, 18, 0.05), 0 1px 6px -1px rgba(14, 14, 18, 0.06)',
        popover: '0 12px 32px -8px rgba(14, 14, 18, 0.16), 0 4px 10px -4px rgba(14, 14, 18, 0.08)',
      },
      borderRadius: {
        xl: '0.5rem',
        '2xl': '0.625rem',
      },
    },
  },
  plugins: [],
}
