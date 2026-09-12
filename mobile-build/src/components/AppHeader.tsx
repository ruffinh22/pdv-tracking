import React, { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, radius } from '@/theme/colors';
import { useApp } from '@/context/AppContext';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function AppHeader({ subtitle }: { subtitle?: string }) {
  const { syncNow, syncStatus, pendingVentes } = useApp();

  const rotation = useSharedValue(0);
  const statusProgress = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (syncStatus === 'syncing') {
      rotation.value = 0;
      rotation.value = withRepeat(withTiming(360, { duration: 850 }), -1, false);
    } else {
      rotation.value = withTiming(0, { duration: 200 });
    }

    if (syncStatus === 'success') {
      statusProgress.value = withTiming(1, { duration: 180 });
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const t = setTimeout(() => {
        statusProgress.value = withTiming(0, { duration: 260 });
      }, 1600);
      return () => clearTimeout(t);
    } else if (syncStatus === 'error') {
      statusProgress.value = withTiming(2, { duration: 180 });
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const t = setTimeout(() => {
        statusProgress.value = withTiming(0, { duration: 260 });
      }, 1600);
      return () => clearTimeout(t);
    } else {
      statusProgress.value = withTiming(0, { duration: 200 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncStatus]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const buttonStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      statusProgress.value,
      [0, 1, 2],
      [colors.primary[700], colors.success[600], colors.danger[600]]
    ),
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    syncNow();
  };

  return (
    <View>
      <View style={styles.flagStripe}>
        <View style={[styles.flagBand, { backgroundColor: colors.flag.orange }]} />
        <View style={[styles.flagBand, { backgroundColor: colors.flag.white }]} />
        <View style={[styles.flagBand, { backgroundColor: colors.flag.green }]} />
      </View>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Tracking PDV</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>

        <AnimatedPressable
          style={[styles.syncButton, buttonStyle]}
          onPress={handlePress}
          onPressIn={() => {
            scale.value = withTiming(0.94, { duration: 90 });
          }}
          onPressOut={() => {
            scale.value = withTiming(1, { duration: 140 });
          }}
        >
          <Animated.View style={iconStyle}>
            <Ionicons
              name={syncStatus === 'success' ? 'checkmark' : syncStatus === 'error' ? 'alert' : 'sync'}
              size={16}
              color="#fff"
            />
          </Animated.View>
          <Text style={styles.syncText}>
            {syncStatus === 'syncing'
              ? 'Sync…'
              : syncStatus === 'success'
                ? 'Synchronisé'
                : syncStatus === 'error'
                  ? 'Échec'
                  : pendingVentes.length > 0
                    ? `Sync (${pendingVentes.length})`
                    : 'Sync'}
          </Text>
        </AnimatedPressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flagStripe: {
    flexDirection: 'row',
    height: 3,
    paddingTop: 44,
  },
  flagBand: { flex: 1 },
  header: {
    backgroundColor: colors.white,
    paddingTop: 12,
    paddingBottom: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.ink[100],
  },
  title: { color: colors.ink[900], fontSize: 17, fontWeight: '800' },
  subtitle: { color: colors.ink[500], fontSize: 11.5, marginTop: 2 },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary[700],
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.sm,
    minWidth: 74,
    justifyContent: 'center',
  },
  syncText: { color: '#fff', fontSize: 11.5, fontWeight: '700' },
});
