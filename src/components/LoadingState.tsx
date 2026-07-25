import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '../theme';

export interface LoadingStateProps {
  message?: string;
  size?: 'small' | 'medium' | 'large';
  fullscreen?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  pulseColor?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading...',
  size = 'medium',
  fullscreen = false,
  style,
  textStyle,
  pulseColor,
}) => {
  const { theme } = useTheme();

  const activePulseColor = pulseColor || theme.colors.primary;

  const pulse = useSharedValue(0.4);
  const scale = useSharedValue(1);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.4, { duration: 800, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    scale.value = withRepeat(
      withSequence(
        withTiming(1.2, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, [pulse, scale]);

  const animatedPulseStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
    transform: [{ scale: scale.value }],
  }));

  const outerPulseStyle = useAnimatedStyle(() => ({
    opacity: pulse.value * 0.4,
    transform: [{ scale: scale.value * 1.3 }],
  }));

  const circleDimensions = {
    small: { outer: 36, inner: 16 },
    medium: { outer: 56, inner: 24 },
    large: { outer: 80, inner: 36 },
  }[size];

  const fontSize = {
    small: theme.typography.sizes.xs,
    medium: theme.typography.sizes.sm,
    large: theme.typography.sizes.md,
  }[size];

  return (
    <View
      style={[
        styles.container,
        { padding: theme.spacing.lg },
        fullscreen && [styles.fullscreen, { backgroundColor: theme.colors.glassOverlay }],
        style,
      ]}
    >
      <View style={[styles.circleWrapper, { width: circleDimensions.outer * 1.5, height: circleDimensions.outer * 1.5 }]}>
        <Animated.View
          style={[
            styles.outerPulse,
            {
              width: circleDimensions.outer,
              height: circleDimensions.outer,
              borderRadius: circleDimensions.outer / 2,
              backgroundColor: activePulseColor,
            },
            outerPulseStyle,
          ]}
        />

        <Animated.View
          style={[
            styles.pulseCircle,
            {
              width: circleDimensions.outer,
              height: circleDimensions.outer,
              borderRadius: circleDimensions.outer / 2,
              borderColor: activePulseColor,
            },
            animatedPulseStyle,
          ]}
        >
          <View
            style={[
              styles.innerDot,
              {
                width: circleDimensions.inner,
                height: circleDimensions.inner,
                borderRadius: circleDimensions.inner / 2,
                backgroundColor: activePulseColor,
                shadowColor: activePulseColor,
              },
            ]}
          />
        </Animated.View>
      </View>

      {message ? (
        <Text style={[styles.message, { color: theme.colors.textSecondary, fontSize, marginTop: theme.spacing.md }, textStyle]}>
          {message}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreen: {
    ...StyleSheet.absoluteFill,
    zIndex: 9999,
  },
  circleWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseCircle: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(14, 165, 233, 0.1)',
  },
  outerPulse: {
    position: 'absolute',
  },
  innerDot: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  message: {
    fontWeight: '500',
    textAlign: 'center',
  },
});
