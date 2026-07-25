import React from 'react';
import { View, TextInput, Text, StyleSheet, TextInputProps } from 'react-native';
import { useTheme } from '../theme';

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, style, ...props }) => {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { marginBottom: theme.spacing.md }]}>
      {label ? (
        <Text
          style={[
            styles.label,
            {
              color: theme.colors.text,
              fontSize: theme.typography.sizes.sm,
              marginBottom: theme.spacing.xs,
            },
          ]}
        >
          {label}
        </Text>
      ) : null}
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: theme.colors.surfaceHighlight,
            color: theme.colors.text,
            borderRadius: theme.radii.md,
            paddingHorizontal: theme.spacing.md,
            fontSize: theme.typography.sizes.md,
            borderColor: theme.colors.border,
          },
          error ? { borderColor: theme.colors.danger, borderWidth: 1 } : null,
          style,
        ]}
        placeholderTextColor={theme.colors.textSecondary}
        {...props}
      />
      {error ? (
        <Text
          style={[
            styles.errorText,
            {
              color: theme.colors.danger,
              fontSize: theme.typography.sizes.xs,
              marginTop: theme.spacing.xs,
            },
          ]}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {},
  label: {
    fontWeight: '500',
  },
  input: {
    height: 48,
    borderWidth: 1,
  },
  errorText: {},
});

export default Input;
