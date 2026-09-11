import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { colors, radius, shadow } from '@/theme/colors';

export default function Card({ style, children, ...rest }: ViewProps) {
  return (
    <View style={[styles.card, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FBFBFF',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.ink[300],
    padding: 12,
    ...shadow.card,
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
});
