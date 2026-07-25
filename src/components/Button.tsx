import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { useTheme } from '../theme';

export interface LegacyButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'outline';
  size?: 'small' | 'medium' | 'large';
  isLoading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Button: React.FC<LegacyButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  isLoading = false,
  disabled = false,
  style,
  textStyle,
}) => {
  const { theme } = useTheme();

  const getBackgroundColor = () => {
    if (disabled) return theme.colors.surfaceHighlight;
    switch (variant) {
      case 'primary': return theme.colors.primary;
      case 'secondary': return theme.colors.secondary;
      case 'danger': return theme.colors.danger;
      case 'outline': return 'transparent';
      default: return theme.colors.primary;
    }
  };

  const getTextColor = () => {
    if (disabled) return theme.colors.textSecondary;
    if (variant === 'outline') return theme.colors.primary;
    return theme.colors.text;
  };

  const getHeight = () => {
    switch (size) {
      case 'small': return 36;
      case 'medium': return 48;
      case 'large': return 56;
      default: return 48;
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          backgroundColor: getBackgroundColor(),
          height: getHeight(),
          borderColor: variant === 'outline' ? theme.colors.border : 'transparent',
          borderWidth: variant === 'outline' ? 1 : 0,
          borderRadius: theme.radii.md,
          paddingHorizontal: theme.spacing.lg,
        },
        style,
      ]}
      onPress={onPress}
      disabled={disabled || isLoading}
      activeOpacity={0.8}
    >
      {isLoading ? (
        <ActivityIndicator color={getTextColor()} />
      ) : (
        <Text style={[styles.text, { color: getTextColor(), fontSize: theme.typography.sizes.md }, textStyle]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  text: {
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
