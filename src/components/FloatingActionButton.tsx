import React, { useEffect } from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  StyleProp,
  ViewStyle,
  View,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '../theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface FloatingActionButtonProps {
  onPress: () => void;
  icon?: React.ReactNode;
  label?: string;
  position?: 'bottom-right' | 'bottom-left' | 'bottom-center';
  pulsating?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  backgroundColor?: string;
}

export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  onPress,
  icon,
  label,
  position = 'bottom-right',
  pulsating = false,
  disabled = false,
  style,
  backgroundColor,
}) => {
  const { theme } = useTheme();

  const activeBgColor = backgroundColor || theme.colors.primary;

  const scale = useSharedValue(1);
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.6);

  useEffect(() => {
    if (pulsating && !disabled) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.35, { duration: 1200, easing: Easing.out(Easing.ease) }),
          withTiming(1, { duration: 0 })
        ),
        -1,
        false
      );
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 1200, easing: Easing.out(Easing.ease) }),
          withTiming(0.6, { duration: 0 })
        ),
        -1,
        false
      );
    } else {
      pulseScale.value = 1;
      pulseOpacity.value = 0;
    }
  }, [pulsating, disabled, pulseScale, pulseOpacity]);

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const pulseAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const handlePressIn = () => {
    if (!disabled) {
      scale.value = withSpring(0.92, { damping: 15, stiffness: 300 });
    }
  };

  const handlePressOut = () => {
    if (!disabled) {
      scale.value = withSpring(1, { damping: 15, stiffness: 300 });
    }
  };

  const positionStyle = {
    'bottom-right': { bottom: theme.spacing.lg, right: theme.spacing.lg },
    'bottom-left': { bottom: theme.spacing.lg, left: theme.spacing.lg },
    'bottom-center': { bottom: theme.spacing.lg, alignSelf: 'center' as const },
  }[position];

  const defaultIcon = icon || <Text style={[styles.plusIcon, { color: theme.colors.text }]}>+</Text>;

  return (
    <View style={[styles.wrapper, positionStyle, style]} pointerEvents="box-none">
      {pulsating && !disabled && (
        <Animated.View
          style={[
            styles.pulseRing,
            { backgroundColor: activeBgColor, borderRadius: theme.radii.pill },
            label ? styles.pulseRingExtended : styles.pulseRingCircle,
            pulseAnimatedStyle,
          ]}
        />
      )}

      <AnimatedPressable
        onPress={disabled ? undefined : onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={[
          styles.button,
          { backgroundColor: activeBgColor, borderRadius: theme.radii.pill },
          theme.shadows.glowPrimary,
          label ? [styles.extendedButton, { paddingHorizontal: theme.spacing.lg }] : styles.circleButton,
          disabled && {
            backgroundColor: theme.colors.surfaceHighlight,
            opacity: 0.5,
            shadowOpacity: 0,
            elevation: 0,
          },
          buttonAnimatedStyle,
        ]}
      >
        <View style={styles.content}>
          <View style={styles.iconContainer}>{defaultIcon}</View>
          {label && (
            <Text
              style={[
                styles.label,
                {
                  color: theme.colors.text,
                  fontSize: theme.typography.sizes.md,
                  marginLeft: theme.spacing.sm,
                },
              ]}
            >
              {label}
            </Text>
          )}
        </View>
      </AnimatedPressable>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  pulseRing: {
    position: 'absolute',
    zIndex: -1,
  },
  pulseRingCircle: {
    width: 56,
    height: 56,
  },
  pulseRingExtended: {
    width: '100%',
    height: '100%',
    paddingHorizontal: 16,
  },
  button: {
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
  },
  circleButton: {
    width: 56,
    height: 56,
  },
  extendedButton: {
    height: 52,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusIcon: {
    fontSize: 24,
    fontWeight: 'bold',
    lineHeight: 26,
  },
  label: {
    fontWeight: '600',
  },
});
