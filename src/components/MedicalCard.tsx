import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '../theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface MedicalCardProps {
  title?: string;
  subtitle?: string;
  headerRight?: React.ReactNode;
  footer?: React.ReactNode;
  children?: React.ReactNode;
  variant?: 'default' | 'glass' | 'outlined';
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  headerStyle?: StyleProp<ViewStyle>;
  bodyStyle?: StyleProp<ViewStyle>;
  footerStyle?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  subtitleStyle?: StyleProp<TextStyle>;
}

export const MedicalCard: React.FC<MedicalCardProps> = ({
  title,
  subtitle,
  headerRight,
  footer,
  children,
  variant = 'default',
  onPress,
  style,
  headerStyle,
  bodyStyle,
  footerStyle,
  titleStyle,
  subtitleStyle,
}) => {
  const { theme } = useTheme();

  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (onPress) {
      scale.value = withSpring(0.98, { damping: 15, stiffness: 300 });
    }
  };

  const handlePressOut = () => {
    if (onPress) {
      scale.value = withSpring(1, { damping: 15, stiffness: 300 });
    }
  };

  const variantStyle = {
    default: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      ...theme.shadows.md,
    },
    glass: theme.glassmorphism.glassCard,
    outlined: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.colors.borderHighlight,
    },
  }[variant];

  const content = (
    <>
      {(title || subtitle || headerRight) && (
        <View style={[styles.header, { marginBottom: theme.spacing.sm }, headerStyle]}>
          <View style={styles.titleContainer}>
            {title && (
              <Text style={[styles.title, { color: theme.colors.text, fontSize: theme.typography.sizes.md }, titleStyle]}>
                {title}
              </Text>
            )}
            {subtitle && (
              <Text style={[styles.subtitle, { color: theme.colors.textSecondary, fontSize: theme.typography.sizes.xs }, subtitleStyle]}>
                {subtitle}
              </Text>
            )}
          </View>
          {headerRight && <View style={[styles.headerRight, { marginLeft: theme.spacing.sm }]}>{headerRight}</View>}
        </View>
      )}

      {children && <View style={[styles.body, { marginTop: theme.spacing.xs }, bodyStyle]}>{children}</View>}

      {footer && (
        <View
          style={[
            styles.footer,
            {
              marginTop: theme.spacing.md,
              paddingTop: theme.spacing.sm,
              borderTopColor: theme.colors.border,
            },
            footerStyle,
          ]}
        >
          {footer}
        </View>
      )}
    </>
  );

  if (onPress) {
    return (
      <AnimatedPressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.container,
          { borderRadius: theme.radii.lg, padding: theme.spacing.md },
          variantStyle,
          style,
          animatedStyle,
        ]}
      >
        {content}
      </AnimatedPressable>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { borderRadius: theme.radii.lg, padding: theme.spacing.md },
        variantStyle,
        style,
      ]}
    >
      {content}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontWeight: '600',
  },
  subtitle: {
    marginTop: 2,
  },
  headerRight: {},
  body: {},
  footer: {
    borderTopWidth: 1,
  },
});
