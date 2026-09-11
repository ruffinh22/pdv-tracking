/**
 * Design tokens — alignés sur la charte du dashboard web (Tailwind: primary / ink / success / danger / warning).
 * Toute modification ici doit rester cohérente avec frontend/tailwind.config.js
 */
export const colors = {
  primary: {
    50: '#f2f1fd',
    100: '#e6e4fb',
    200: '#cac5f7',
    300: '#a9a0f0',
    400: '#8a7cea',
    500: '#6d5ce3',
    600: '#5641d6',
    700: '#4732b8',
    800: '#392a92',
    900: '#2e2470',
  },
  success: {
    50: '#f0fdf6',
    100: '#dcfce9',
    200: '#bbf7d5',
    500: '#22c56f',
    600: '#16a35a',
    700: '#15804a',
  },
  danger: {
    50: '#fef2f2',
    100: '#fee2e2',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
  },
  warning: {
    50: '#fffaeb',
    100: '#fef0c7',
    500: '#ef8a0c',
    600: '#d16907',
    700: '#ad4c0a',
  },
  ink: {
    50: '#f7f7f9',
    100: '#eeeef2',
    200: '#dcdce3',
    300: '#bcbcc9',
    400: '#9393a8',
    500: '#71718c',
    600: '#5a5a72',
    700: '#48485c',
    800: '#2f2f3d',
    900: '#1c1c26',
    950: '#121218',
  },
  white: '#ffffff',
} as const;

export const radius = {
  md: 10,
  lg: 12,
  xl: 16,
  pill: 999,
};

export const shadow = {
  card: {
    shadowColor: '#121218',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  popover: {
    shadowColor: '#121218',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 8,
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export default colors;
