import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  Easing,
  FadeInUp,
  FadeInDown,
} from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { AppNavigationProp } from '../navigation/types';
import { useTheme } from '../theme';
import { LoadingState } from '../components';
import { dbService } from '../database/SQLiteService';

const SplashScreen = () => {
  const navigation = useNavigation<AppNavigationProp>();
  const { theme } = useTheme();

  const logoScale = useSharedValue(0.7);
  const logoOpacity = useSharedValue(0);
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    // Reveal logo with smooth spring and fade-in
    logoOpacity.value = withTiming(1, { duration: 800 });
    logoScale.value = withSpring(1, { damping: 12, stiffness: 100 });

    // Subtle continuous pulse after reveal
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(1.0, { duration: 1200, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    const initializeApp = async () => {
      try {
        await dbService.init();
        setTimeout(() => {
          navigation.replace('Home');
        }, 1600);
      } catch (error) {
        console.error('Failed to initialize app', error);
      }
    };

    initializeApp();
  }, [navigation, logoOpacity, logoScale, pulseScale]);

  const animatedLogoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value * pulseScale.value }],
  }));

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Background Clinical Grid Glow */}
      <View style={styles.backgroundGlow} pointerEvents="none" />

      {/* Animated Ophthalmic Logo Reveal */}
      <Animated.View style={[styles.logoContainer, animatedLogoStyle]}>
        <View style={[styles.outerLogoRing, { borderColor: theme.colors.primary }]}>
          <View style={[styles.innerLogoRing, { borderColor: theme.colors.secondary, backgroundColor: theme.colors.background }]}>
            <Text style={styles.logoIrisIcon}>👁️</Text>
          </View>
        </View>

        <Animated.View entering={FadeInDown.delay(200).duration(600)} style={styles.textGroup}>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            Fundus<Text style={{ color: theme.colors.primary }}>Pro</Text>
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            CLINICAL OPHTHALMIC IMAGING
          </Text>
        </Animated.View>
      </Animated.View>

      {/* Reanimated Loading Spinner */}
      <Animated.View entering={FadeInUp.delay(400).duration(600)} style={styles.loaderContainer}>
        <LoadingState
          message="Initializing Clinical Database..."
          size="small"
          pulseColor={theme.colors.primary}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backgroundGlow: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(14, 165, 233, 0.06)',
    top: '30%',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerLogoRing: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(19, 28, 46, 0.6)',
    marginBottom: 24,
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  innerLogoRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoIrisIcon: {
    fontSize: 34,
  },
  textGroup: {
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 40,
  },
  loaderContainer: {
    position: 'absolute',
    bottom: 60,
  },
});

export default SplashScreen;
