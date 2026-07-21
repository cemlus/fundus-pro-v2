import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AppNavigationProp } from '../navigation/types';
import { theme } from '../constants/theme';
import { dbService } from '../database/SQLiteService';

const SplashScreen = () => {
  const navigation = useNavigation<AppNavigationProp>();

  useEffect(() => {
    const initializeApp = async () => {
      try {
        await dbService.init();
        // Artificial delay for splash presentation
        setTimeout(() => {
          navigation.replace('Home');
        }, 1500);
      } catch (error) {
        console.error('Failed to initialize app', error);
      }
    };

    initializeApp();
  }, [navigation]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>FundusPro</Text>
      <Text style={styles.subtitle}>Clinical Imaging System</Text>
      <ActivityIndicator size="large" color={theme.colors.primary} style={styles.loader} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: theme.typography.sizes.xxl,
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xxl,
  },
  loader: {
    marginTop: theme.spacing.xl,
  },
});

export default SplashScreen;
