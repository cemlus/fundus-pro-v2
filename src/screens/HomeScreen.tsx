import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { AppNavigationProp } from '../navigation/types';
import { theme } from '../constants/theme';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { useAppStore } from '../store/useAppStore';
import { dbService } from '../database/SQLiteService';
import { Patient } from '../models/types';

const HomeScreen = () => {
  const navigation = useNavigation<AppNavigationProp>();
  const clearSession = useAppStore(state => state.clearSession);
  const setCurrentPatient = useAppStore(state => state.setCurrentPatient);
  const setCurrentSession = useAppStore(state => state.setCurrentSession);

  const [recentPatients, setRecentPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRecentData = useCallback(async () => {
    try {
      setLoading(true);
      await dbService.init();
      const patients = await dbService.getPatients();
      setRecentPatients(patients.slice(0, 5)); // show top 5 recent
    } catch (e) {
      console.error('Failed to load recent patients:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadRecentData();
    }, [loadRecentData])
  );

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

  const handleSelectPatient = async (patient: Patient) => {
    setCurrentPatient(patient);
    const sessions = await dbService.getSessions(patient.id);
    if (sessions.length > 0) {
      const latestSession = sessions[0];
      setCurrentSession(latestSession);
      const captures = await dbService.getCapturedImages(latestSession.id);
      useAppStore.setState({ sessionCaptures: captures });
      navigation.navigate('Session', { sessionId: latestSession.id });
    } else {
      // Create new session for this patient
      const sId = `ses_${Date.now()}`;
      const newSession = {
        id: sId,
        patientId: patient.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await dbService.addSession(newSession);
      setCurrentSession(newSession);
      useAppStore.setState({ sessionCaptures: [] });
      navigation.navigate('Session', { sessionId: sId });
    }
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
      
      {/* Live Recent Patients List */}
      <Text style={styles.sectionTitle}>Recent Patient Records</Text>
      {recentPatients.length === 0 ? (
        <Card style={styles.recentCard}>
          <Text style={styles.placeholderText}>
            {loading ? 'Loading records...' : 'No past patient records found.'}
          </Text>
        </Card>
      ) : (
        recentPatients.map((patient) => (
          <TouchableOpacity
            key={patient.id}
            activeOpacity={0.7}
            onPress={() => handleSelectPatient(patient)}
          >
            <Card style={styles.patientItemCard}>
              <View style={styles.patientRow}>
                <View>
                  <Text style={styles.patientName}>{patient.name}</Text>
                  <Text style={styles.patientSubtext}>
                    {patient.gender} • DOB: {patient.dob} {patient.patientId ? `• ID: ${patient.patientId}` : ''}
                  </Text>
                </View>
                <Text style={styles.patientDate}>
                  {new Date(patient.createdAt).toLocaleDateString()}
                </Text>
              </View>
            </Card>
          </TouchableOpacity>
        ))
      )}
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
  patientItemCard: {
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
  },
  patientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  patientName: {
    fontSize: theme.typography.sizes.md,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  patientSubtext: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  patientDate: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.primary,
    fontWeight: '600',
  },
});

export default HomeScreen;
