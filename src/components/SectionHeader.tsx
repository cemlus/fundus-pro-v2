import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useTheme } from '../theme';

export interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onActionPress?: () => void;
  rightElement?: React.ReactNode;
  accentColor?: string;
  style?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  subtitleStyle?: StyleProp<TextStyle>;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  actionLabel,
  onActionPress,
  rightElement,
  accentColor,
  style,
  titleStyle,
  subtitleStyle,
}) => {
  const { theme } = useTheme();

  const activeAccentColor = accentColor || theme.colors.primary;

  return (
    <View style={[styles.container, { marginVertical: theme.spacing.sm }, style]}>
      <View style={styles.leftContainer}>
        <View
          style={[
            styles.accentBar,
            {
              backgroundColor: activeAccentColor,
              borderRadius: theme.radii.sm,
              marginRight: theme.spacing.sm,
            },
          ]}
        />
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: theme.colors.text, fontSize: theme.typography.sizes.lg }, titleStyle]}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary, fontSize: theme.typography.sizes.xs }, subtitleStyle]}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      {rightElement ? (
        <View style={[styles.rightContainer, { marginLeft: theme.spacing.md }]}>{rightElement}</View>
      ) : actionLabel && onActionPress ? (
        <TouchableOpacity
          onPress={onActionPress}
          activeOpacity={0.7}
          style={[styles.actionButton, { paddingVertical: theme.spacing.xs, paddingHorizontal: theme.spacing.sm }]}
        >
          <Text style={[styles.actionText, { color: theme.colors.primary, fontSize: theme.typography.sizes.sm }]}>
            {actionLabel}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  accentBar: {
    width: 4,
    height: 20,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 2,
  },
  rightContainer: {},
  actionButton: {},
  actionText: {
    fontWeight: '600',
  },
});
