import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { theme } from '../constants/theme';
import { EyeSide } from '../models/types';

interface EyeSelectorProps {
  selectedEye: EyeSide | null;
  onSelectEye: (eye: EyeSide) => void;
}

export const EyeSelector: React.FC<EyeSelectorProps> = ({ selectedEye, onSelectEye }) => {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.button, selectedEye === 'left' && styles.selectedLeft]}
        onPress={() => onSelectEye('left')}
      >
        <Text style={[styles.text, selectedEye === 'left' && styles.selectedText]}>Left Eye (OS)</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.button, selectedEye === 'right' && styles.selectedRight]}
        onPress={() => onSelectEye('right')}
      >
        <Text style={[styles.text, selectedEye === 'right' && styles.selectedText]}>Right Eye (OD)</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceHighlight,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.xs,
  },
  button: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    borderRadius: theme.radii.md,
  },
  selectedLeft: {
    backgroundColor: theme.colors.primary,
  },
  selectedRight: {
    backgroundColor: theme.colors.secondary,
  },
  text: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.sm,
    fontWeight: 'bold',
  },
  selectedText: {
    color: theme.colors.text,
  },
});
