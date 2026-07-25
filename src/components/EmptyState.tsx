import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { PrimaryButton } from './PrimaryButton';
import { useTheme } from '../theme';

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onActionPress?: () => void;
  style?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  descriptionStyle?: StyleProp<TextStyle>;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  actionLabel,
  onActionPress,
  style,
  titleStyle,
  descriptionStyle,
}) => {
  const { theme } = useTheme();

  const defaultIcon = icon || (
    <View
      style={[
        styles.defaultIconBg,
        {
          backgroundColor: 'rgba(14, 165, 233, 0.1)',
          borderColor: 'rgba(14, 165, 233, 0.2)',
        },
      ]}
    >
      <Text style={styles.defaultIconText}>👁️</Text>
    </View>
  );

  return (
    <View
      style={[
        styles.container,
        {
          padding: theme.spacing.xl,
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radii.lg,
          borderColor: theme.colors.border,
        },
        style,
      ]}
    >
      <View style={[styles.iconContainer, { marginBottom: theme.spacing.md }]}>{defaultIcon}</View>
      <Text style={[styles.title, { color: theme.colors.text, fontSize: theme.typography.sizes.lg, marginBottom: theme.spacing.xs }, titleStyle]}>
        {title}
      </Text>
      {description ? (
        <Text style={[styles.description, { color: theme.colors.textSecondary, fontSize: theme.typography.sizes.sm }, descriptionStyle]}>
          {description}
        </Text>
      ) : null}
      {actionLabel && onActionPress ? (
        <View style={[styles.actionContainer, { marginTop: theme.spacing.lg }]}>
          <PrimaryButton
            title={actionLabel}
            onPress={onActionPress}
            size="md"
            fullWidth={false}
          />
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    minHeight: 220,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  defaultIconBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  defaultIconText: {
    fontSize: 28,
  },
  title: {
    fontWeight: '700',
    textAlign: 'center',
  },
  description: {
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  actionContainer: {},
});
