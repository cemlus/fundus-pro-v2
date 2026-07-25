import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useTheme } from '../theme';

export type StatusType =
  | 'normal'
  | 'glare'
  | 'low_quality'
  | 'processing'
  | 'enhanced'
  | 'pending'
  | string;

export interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  size?: 'sm' | 'md';
  showDot?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

interface StatusConfig {
  bg: string;
  border: string;
  text: string;
  defaultLabel: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  size = 'md',
  showDot = true,
  style,
  textStyle,
}) => {
  const { theme } = useTheme();

  const getStatusConfig = (st: StatusType): StatusConfig => {
    const normalized = st.toLowerCase().replace(/[\s-]/g, '_');

    switch (normalized) {
      case 'normal':
        return {
          bg: 'rgba(16, 185, 129, 0.15)',
          border: 'rgba(16, 185, 129, 0.4)',
          text: theme.colors.success,
          defaultLabel: 'Normal',
        };
      case 'glare':
        return {
          bg: 'rgba(245, 158, 11, 0.15)',
          border: 'rgba(245, 158, 11, 0.4)',
          text: theme.colors.warning,
          defaultLabel: 'Glare Detected',
        };
      case 'low_quality':
      case 'lowquality':
        return {
          bg: 'rgba(239, 68, 68, 0.15)',
          border: 'rgba(239, 68, 68, 0.4)',
          text: theme.colors.danger,
          defaultLabel: 'Low Quality',
        };
      case 'processing':
        return {
          bg: 'rgba(14, 165, 233, 0.15)',
          border: 'rgba(14, 165, 233, 0.4)',
          text: theme.colors.primary,
          defaultLabel: 'Processing',
        };
      case 'enhanced':
        return {
          bg: 'rgba(20, 184, 166, 0.15)',
          border: 'rgba(20, 184, 166, 0.4)',
          text: theme.colors.secondary,
          defaultLabel: 'Enhanced',
        };
      case 'pending':
        return {
          bg: 'rgba(148, 163, 184, 0.15)',
          border: 'rgba(148, 163, 184, 0.4)',
          text: theme.colors.textSecondary,
          defaultLabel: 'Pending',
        };
      default:
        return {
          bg: 'rgba(14, 165, 233, 0.15)',
          border: 'rgba(14, 165, 233, 0.4)',
          text: theme.colors.primary,
          defaultLabel: st,
        };
    }
  };

  const config = getStatusConfig(status);
  const displayText = label || config.defaultLabel;
  const isSmall = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: config.bg,
          borderColor: config.border,
          borderRadius: theme.radii.pill,
        },
        isSmall
          ? { paddingVertical: 2, paddingHorizontal: theme.spacing.sm }
          : { paddingVertical: theme.spacing.xs, paddingHorizontal: theme.spacing.md },
        style,
      ]}
    >
      {showDot && (
        <View
          style={[
            styles.dot,
            { backgroundColor: config.text, borderRadius: theme.radii.pill },
            isSmall
              ? { width: 6, height: 6, marginRight: 4 }
              : { width: 8, height: 8, marginRight: theme.spacing.xs },
          ]}
        />
      )}
      <Text
        style={[
          styles.text,
          { color: config.text },
          isSmall ? styles.textSm : styles.textMd,
          textStyle,
        ]}
      >
        {displayText}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
  },
  dot: {},
  text: {
    fontWeight: '600',
  },
  textSm: {
    fontSize: 10,
    lineHeight: 12,
  },
  textMd: {
    fontSize: 12,
    lineHeight: 16,
  },
});
