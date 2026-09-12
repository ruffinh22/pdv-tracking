/**
 * Design tokens — identité visuelle sobre et professionnelle, inspirée des
 * couleurs du drapeau national de la Côte d'Ivoire (orange / blanc / vert).
 * Fond clair, angles peu arrondis, hiérarchie neutre en gris.
 */
export const colors = {
  // Orange — teinte principale (drapeau CI)
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
  // Vert — accents positifs / succès (drapeau CI)
  success: {
    50: '#e8f7ee',
    100: '#c8ecd6',
    200: '#93d9ae',
    500: '#009a44',
    600: '#00833a',
    700: '#00682e',
  },
  danger: {
    50: '#fdf1f1',
    100: '#fbdcdc',
    500: '#d64545',
    600: '#b93333',
    700: '#932828',
  },
  // Jaune doré — attention (distinct de l'orange primaire)
  warning: {
    50: '#fdf8e8',
    100: '#f9ecc0',
    500: '#c98a00',
    600: '#a87100',
    700: '#805700',
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
  white: '#ffffff',
  // Couleurs du drapeau, pour tout élément de branding explicite (liseré, splash)
  flag: {
    orange: '#ff8200',
    white: '#ffffff',
    green: '#009a44',
  },
} as const;

export const radius = {
  sm: 4,
  md: 6,
  lg: 8,
  xl: 10,
  pill: 6,
};

export const shadow = {
  card: {
    shadowColor: '#0e0e12',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  popover: {
    shadowColor: '#0e0e12',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 6,
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
