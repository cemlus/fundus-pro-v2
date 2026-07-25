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

export interface TrendInfo {
  value: string;
  positive?: boolean;
}

export interface MetricCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: TrendInfo;
  trendDirection?: 'up' | 'down' | 'neutral';
  accentColor?: string;
  style?: StyleProp<ViewStyle>;
  valueStyle?: StyleProp<TextStyle>;
  labelStyle?: StyleProp<TextStyle>;
  onPress?: () => void;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  subtitle,
  icon,
  trend,
  trendDirection,
  accentColor,
  style,
  valueStyle,
  labelStyle,
  onPress,
}) => {
  const { theme } = useTheme();

  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (onPress) {
      scale.value = withSpring(0.96, { damping: 15, stiffness: 300 });
    }
  };

  const handlePressOut = () => {
    if (onPress) {
      scale.value = withSpring(1, { damping: 15, stiffness: 300 });
    }
  };

  const isPositive =
    trend?.positive !== undefined
      ? trend.positive
      : trendDirection === 'up';
  
  const isNegative =
    trend?.positive === false || trendDirection === 'down';

  const trendColor = isPositive
    ? theme.colors.success
    : isNegative
    ? theme.colors.danger
    : theme.colors.textSecondary;

  const trendArrow = isPositive ? '↑' : isNegative ? '↓' : '→';

  const cardContent = (
    <>
      <View style={styles.headerRow}>
        <Text style={[styles.label, { color: theme.colors.textSecondary }, labelStyle]} numberOfLines={1}>
          {label}
        </Text>
        {icon && <View style={styles.iconContainer}>{icon}</View>}
      </View>

      <View style={styles.valueRow}>
        <Text
          style={[
            styles.value,
            { color: theme.colors.text },
            accentColor ? { color: accentColor } : null,
            valueStyle,
          ]}
          numberOfLines={1}
        >
          {value}
        </Text>
      </View>

      {(subtitle || trend) && (
        <View style={styles.footerRow}>
          {trend && (
            <View style={[styles.trendBadge, { backgroundColor: `${trendColor}20` }]}>
              <Text style={[styles.trendText, { color: trendColor }]}>
                {trendArrow} {trend.value}
              </Text>
            </View>
          )}

          {subtitle && (
            <Text style={[styles.subtitle, { color: theme.colors.textMuted }]} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
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
          {
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radii.lg,
            borderColor: theme.colors.border,
            padding: theme.spacing.md,
          },
          theme.shadows.sm,
          style,
          animatedStyle,
        ]}
      >
        {cardContent}
      </AnimatedPressable>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radii.lg,
          borderColor: theme.colors.border,
          padding: theme.spacing.md,
        },
        theme.shadows.sm,
        style,
      ]}
    >
      {cardContent}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  iconContainer: {
    marginLeft: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  valueRow: {
    marginVertical: 4,
  },
  value: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  trendBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 6,
  },
  trendText: {
    fontSize: 11,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 11,
    flex: 1,
  },
});
