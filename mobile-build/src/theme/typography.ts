import { Platform } from 'react-native';

// Inter est la police du dashboard web. En natif on retombe sur la police
// système (proche d'Inter en gabarit) pour éviter d'embarquer des fontes lourdes ;
// possibilité d'ajouter expo-font + Inter.ttf si une identité pixel-perfect est requise.
export const fontFamily = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: 'Inter, system-ui, sans-serif',
});

export const typography = {
  h1: { fontSize: 26, fontWeight: '800' as const, letterSpacing: -0.3 },
  h2: { fontSize: 20, fontWeight: '700' as const, letterSpacing: -0.2 },
  h3: { fontSize: 17, fontWeight: '700' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  bodyMedium: { fontSize: 15, fontWeight: '600' as const },
  small: { fontSize: 13, fontWeight: '400' as const },
  smallMedium: { fontSize: 13, fontWeight: '600' as const },
  caption: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.4 },
};

export default typography;
