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
        /* Rouge — recalé sur le rouge du volatile du logo LONACI (#cd2b26) */
        danger: {
          50: '#fdecec',
          100: '#f9d2d1',
          200: '#f2a6a4',
          300: '#e87874',
          400: '#dd4f49',
          500: '#cc2b26',
          600: '#ad211d',
          700: '#8a1a17',
          800: '#671412',
          900: '#450d0c',
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
        /* Vert profond du wordmark LONACI — remplace le noir/anthracite générique
           sur les surfaces "sombres" (sidebar, barres de la carte de suivi) pour
           que ces zones restent dans l'identité de marque plutôt qu'un noir neutre. */
        brand: {
          50: '#e7f3ec',
          100: '#c6e3d3',
          200: '#8fc7a9',
          300: '#4fa377',
          400: '#1f8656',
          500: '#0f6b40',
          600: '#0b5734',
          700: '#0a4429',
          800: '#08331f',
          900: '#062316',
          950: '#041710',
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
