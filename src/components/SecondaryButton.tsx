import React from 'react';
import {
  Pressable,
  Text,
  ActivityIndicator,
  StyleSheet,
  StyleProp,
  ViewStyle,
  TextStyle,
  View,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '../theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface SecondaryButtonProps {
  title: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'outline' | 'surface';
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  size?: 'sm' | 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export const SecondaryButton: React.FC<SecondaryButtonProps> = ({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'surface',
  icon,
  iconPosition = 'left',
  fullWidth = true,
  size = 'md',
  style,
  textStyle,
}) => {
  const { theme } = useTheme();

  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (!disabled && !loading) {
      scale.value = withSpring(0.96, { damping: 15, stiffness: 300 });
    }
  };

  const handlePressOut = () => {
    if (!disabled && !loading) {
      scale.value = withSpring(1, { damping: 15, stiffness: 300 });
    }
  };

  const isDisabled = disabled || loading;

  const sizeStyles = {
    sm: { paddingVertical: theme.spacing.xs, paddingHorizontal: theme.spacing.md, minHeight: 36 },
    md: { paddingVertical: theme.spacing.sm, paddingHorizontal: theme.spacing.lg, minHeight: 48 },
    lg: { paddingVertical: theme.spacing.md, paddingHorizontal: theme.spacing.xl, minHeight: 56 },
  }[size];

  const fontSize = {
    sm: theme.typography.sizes.sm,
    md: theme.typography.sizes.md,
    lg: theme.typography.sizes.lg,
  }[size];

  const variantContainerStyle =
    variant === 'outline'
      ? {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: theme.colors.primary,
        }
      : {
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.border,
          ...theme.shadows.sm,
        };

  return (
    <AnimatedPressable
      onPress={isDisabled ? undefined : onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={isDisabled}
      style={[
        styles.button,
        { borderRadius: theme.radii.md },
        sizeStyles,
        variantContainerStyle,
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style,
        animatedStyle,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={theme.colors.textSecondary} size="small" />
      ) : (
        <View style={styles.contentContainer}>
          {icon && iconPosition === 'left' && <View style={{ marginRight: theme.spacing.sm }}>{icon}</View>}
          <Text
            style={[
              styles.text,
              {
                color: variant === 'outline' ? theme.colors.primary : theme.colors.text,
                fontSize,
              },
              textStyle,
            ]}
          >
            {title}
          </Text>
          {icon && iconPosition === 'right' && <View style={{ marginLeft: theme.spacing.sm }}>{icon}</View>}
        </View>
      )}
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  button: {
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.4,
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '500',
    textAlign: 'center',
  },
});
