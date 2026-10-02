/** @type {import('tailwindcss').Config} */
import forms from '@tailwindcss/forms';

/*
 * Identité LONACI
 * - Logo      : vert #008840 · rouge #C82828 · noir #000
 * - Drapeau CI: orange #FF8200 · blanc · vert #009A44
 */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans Variable"', '"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Bricolage Grotesque Variable"', '"Bricolage Grotesque"', '"Plus Jakarta Sans Variable"', 'ui-sans-serif', 'sans-serif'],
      },
      colors: {
        /* Orange du drapeau — actions, éléments actifs */
        primary: {
          50: '#fff6ec', 100: '#ffe8cf', 200: '#ffd0a0', 300: '#ffb066', 400: '#ff9533',
          500: '#ff8200', 600: '#ee7000', 700: '#c85d00', 800: '#9a4700', 900: '#6e3300',
        },
        /* Vert du logo LONACI (#008840) — succès, croissance, identité */
        success: {
          50: '#e9f8ef', 100: '#c9eed8', 200: '#94dcb2', 300: '#5cc78a', 400: '#24ab62',
          500: '#009a4a', 600: '#008840', 700: '#006d34', 800: '#00552a', 900: '#003d1e',
        },
        /* Rouge du volatile du logo (#C82828) */
        danger: {
          50: '#fdeeee', 100: '#fad6d5', 200: '#f4aaa8', 300: '#ea7b78', 400: '#dc4f4a',
          500: '#c82828', 600: '#b02020', 700: '#8f1a1a', 800: '#6e1515', 900: '#4a0e0e',
        },
        warning: {
          50: '#fffbe6', 100: '#fff3b8', 200: '#ffe680', 300: '#ffd447', 400: '#f5be16',
          500: '#dba200', 600: '#b38000', 700: '#8a6200', 800: '#634600', 900: '#443000',
        },
        /* Neutres — gris très légèrement chauds */
        ink: {
          50: '#f6f7f6', 100: '#eceeed', 200: '#dcdfdd', 300: '#bcc1be', 400: '#8d9490',
          500: '#646b67', 600: '#4a504d', 700: '#363b38', 800: '#232725', 900: '#141716', 950: '#0a0c0b',
        },
        /* Noir du logo avec une pointe de vert : surfaces sombres (menu, en-têtes de tableau) */
        brand: {
          50: '#eef2f0', 100: '#d5dcd8', 200: '#aab6b0', 300: '#7b8a83', 400: '#52615a',
          500: '#37433d', 600: '#27312c', 700: '#1c2420', 800: '#141a17', 900: '#0d1210', 950: '#070a09',
        },
        zebra: '#e8ebe9',
        flag: { orange: '#ff8200', white: '#ffffff', green: '#009a44' },
        logo: { green: '#008840', red: '#c82828', black: '#000000' },
      },
      boxShadow: {
        card: '0 1px 2px rgba(10,12,11,.05), 0 2px 8px -2px rgba(10,12,11,.06)',
        lift: '0 2px 4px rgba(10,12,11,.05), 0 12px 28px -10px rgba(10,12,11,.16)',
        ring: '0 0 0 3px rgba(0,136,64,.10)',
        popover: '0 16px 40px -8px rgba(10,12,11,.24), 0 4px 12px -4px rgba(10,12,11,.1)',
        glow: '0 6px 16px -4px rgba(255,130,0,.45)',
        'glow-green': '0 6px 16px -4px rgba(0,136,64,.4)',
      },
      borderRadius: { xl: '0.75rem', '2xl': '1rem', '3xl': '1.5rem' },
      backgroundImage: {
      },
      keyframes: {
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        floaty: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
      },
      animation: { floaty: 'floaty 7s ease-in-out infinite' },
    },
  },
  plugins: [forms({ strategy: 'class' })],
}
