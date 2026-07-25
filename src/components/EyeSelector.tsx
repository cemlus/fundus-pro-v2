import React from 'react';
import { View, Text, Pressable, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '../theme';
import { EyeSide } from '../models/types';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface EyeSelectorProps {
  selectedEye: EyeSide | null;
  onSelectEye: (eye: EyeSide) => void;
  style?: StyleProp<ViewStyle>;
}

export const EyeSelector: React.FC<EyeSelectorProps> = ({
  selectedEye,
  onSelectEye,
  style,
}) => {
  const { theme } = useTheme();

  const leftScale = useSharedValue(1);
  const rightScale = useSharedValue(1);

  const leftAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: leftScale.value }],
  }));

  const rightAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: rightScale.value }],
  }));

  const handlePressIn = (eye: EyeSide) => {
    if (eye === 'left') {
      leftScale.value = withSpring(0.95, { damping: 15, stiffness: 300 });
    } else {
      rightScale.value = withSpring(0.95, { damping: 15, stiffness: 300 });
    }
  };

  const handlePressOut = (eye: EyeSide) => {
    if (eye === 'left') {
      leftScale.value = withSpring(1, { damping: 15, stiffness: 300 });
    } else {
      rightScale.value = withSpring(1, { damping: 15, stiffness: 300 });
    }
  };

  const isLeftSelected = selectedEye === 'left';
  const isRightSelected = selectedEye === 'right';

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surfaceHighlight,
          borderRadius: theme.radii.lg,
          padding: theme.spacing.xs,
        },
        style,
      ]}
    >
      <AnimatedPressable
        onPress={() => onSelectEye('left')}
        onPressIn={() => handlePressIn('left')}
        onPressOut={() => handlePressOut('left')}
        style={[
          styles.button,
          { borderRadius: theme.radii.md, paddingVertical: theme.spacing.md },
          isLeftSelected && { backgroundColor: theme.colors.eyeOS },
          leftAnimatedStyle,
        ]}
      >
        <Text
          style={[
            styles.text,
            {
              color: isLeftSelected ? theme.colors.text : theme.colors.textSecondary,
              fontSize: theme.typography.sizes.sm,
            },
          ]}
        >
          Left Eye (OS)
        </Text>
      </AnimatedPressable>

      <AnimatedPressable
        onPress={() => onSelectEye('right')}
        onPressIn={() => handlePressIn('right')}
        onPressOut={() => handlePressOut('right')}
        style={[
          styles.button,
          { borderRadius: theme.radii.md, paddingVertical: theme.spacing.md },
          isRightSelected && { backgroundColor: theme.colors.eyeOD },
          rightAnimatedStyle,
        ]}
      >
        <Text
          style={[
            styles.text,
            {
              color: isRightSelected ? theme.colors.text : theme.colors.textSecondary,
              fontSize: theme.typography.sizes.sm,
            },
          ]}
        >
          Right Eye (OD)
        </Text>
      </AnimatedPressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
  },
  button: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '700',
  },
});

export default EyeSelector;
