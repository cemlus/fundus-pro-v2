import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useTheme } from '../theme';

export interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onClear?: () => void;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  editable?: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChangeText,
  placeholder = 'Search...',
  onClear,
  icon,
  style,
  inputStyle,
  autoCapitalize = 'none',
  autoCorrect = false,
  editable = true,
}) => {
  const { theme } = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  const handleClear = () => {
    onChangeText('');
    if (onClear) {
      onClear();
    }
  };

  const defaultSearchIcon = icon || (
    <Text style={[styles.searchIconText, { color: theme.colors.textSecondary }]}>🔍</Text>
  );

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radii.md,
          borderColor: theme.colors.border,
          paddingHorizontal: theme.spacing.md,
        },
        isFocused && {
          borderColor: theme.colors.primary,
          backgroundColor: theme.colors.surfaceHighlight,
        },
        style,
      ]}
    >
      <View style={[styles.iconContainer, { marginRight: theme.spacing.sm }]}>{defaultSearchIcon}</View>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        editable={editable}
        style={[
          styles.input,
          { color: theme.colors.text, fontSize: theme.typography.sizes.md },
          inputStyle,
        ]}
      />

      {value.length > 0 && (
        <TouchableOpacity
          onPress={handleClear}
          activeOpacity={0.7}
          style={[styles.clearButton, { marginLeft: theme.spacing.sm }]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <View style={[styles.clearIconBg, { backgroundColor: theme.colors.textMuted }]}>
            <Text style={[styles.clearIconText, { color: theme.colors.background }]}>✕</Text>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    height: 48,
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchIconText: {
    fontSize: 16,
  },
  input: {
    flex: 1,
    paddingVertical: 0,
  },
  clearButton: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearIconBg: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearIconText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
});
