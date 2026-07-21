import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AppNavigationProp } from '../navigation/types';
import { theme } from '../constants/theme';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { useAppStore } from '../store/useAppStore';

const HomeScreen = () => {
  const navigation = useNavigation<AppNavigationProp>();
  const clearSession = useAppStore(state => state.clearSession);

  const startNewPatient = () => {
    clearSession();
    navigation.navigate('PatientDetails', {});
  };

  const openSettings = () => {
    navigation.navigate('Settings');
  };

  const openGallery = () => {
    navigation.navigate('Gallery');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Welcome, Doctor</Text>
        <Text style={styles.date}>{new Date().toLocaleDateString()}</Text>
      </View>

      <Card style={styles.actionCard}>
        <Text style={styles.cardTitle}>Quick Actions</Text>
        <Button 
          title="Start New Patient Session" 
          onPress={startNewPatient} 
          style={styles.mainAction} 
        />
        <View style={styles.rowActions}>
          <Button 
            title="View History" 
            variant="secondary" 
            style={styles.flexBtn} 
            onPress={openGallery} 
          />
          <View style={{ width: theme.spacing.md }} />
          <Button 
            title="Settings" 
            variant="outline" 
            style={styles.flexBtn} 
            onPress={openSettings} 
          />
        </View>
      </Card>
      
      {/* Mock Recent Patients List */}
      <Text style={styles.sectionTitle}>Recent Activity</Text>
      <Card style={styles.recentCard}>
        <Text style={styles.placeholderText}>No recent sessions today.</Text>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.lg,
  },
  header: {
    marginBottom: theme.spacing.xl,
  },
  greeting: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  date: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  actionCard: {
    marginBottom: theme.spacing.xl,
  },
  cardTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
  },
  mainAction: {
    marginBottom: theme.spacing.md,
  },
  rowActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  flexBtn: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  recentCard: {
    padding: theme.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: theme.colors.textSecondary,
  },
});

export default HomeScreen;
