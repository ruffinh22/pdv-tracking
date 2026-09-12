import React from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, radius } from '@/theme/colors';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  fullWidth?: boolean;
  haptics?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
  fullWidth = true,
  haptics = true,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    if (haptics && Platform.OS !== 'web') {
      Haptics.impactAsync(
        variant === 'danger' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light
      );
    }
    onPress();
  };

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={() => {
        scale.value = withTiming(0.97, { duration: 90 });
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: 140 });
      }}
      disabled={isDisabled}
      style={[
        styles.base,
        variantStyles[variant],
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        animatedStyle,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' || variant === 'ghost' ? colors.primary[600] : '#fff'} />
      ) : (
        <Text style={[styles.text, textVariantStyles[variant]]}>{title}</Text>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: radius.sm,
  },
  fullWidth: { width: '100%' },
  disabled: { opacity: 0.5 },
  text: { fontSize: 15, fontWeight: '700', letterSpacing: 0.1 },
});

const variantStyles: Record<Variant, ViewStyle> = {
  primary: { backgroundColor: colors.primary[700] },
  secondary: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.ink[200],
  },
  danger: { backgroundColor: colors.danger[600] },
  success: { backgroundColor: colors.success[600] },
  ghost: { backgroundColor: 'transparent' },
};

const textVariantStyles: Record<Variant, { color: string }> = {
  primary: { color: '#fff' },
  secondary: { color: colors.ink[700] },
  danger: { color: '#fff' },
  success: { color: '#fff' },
  ghost: { color: colors.ink[600] },
};
