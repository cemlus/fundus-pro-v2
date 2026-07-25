import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { AppNavigationProp } from '../navigation/types';
import { useTheme } from '../theme';
import {
  SectionHeader,
  MetricCard,
  MedicalCard,
  StatusBadge,
  PrimaryButton,
  SecondaryButton,
  FloatingActionButton,
  EmptyState,
  LoadingState,
} from '../components';
import { useAppStore } from '../store/useAppStore';
import { dbService } from '../database/SQLiteService';
import { Patient, CaptureImage } from '../models/types';

const HomeScreen = () => {
  const navigation = useNavigation<AppNavigationProp>();
  const { theme } = useTheme();

  const clearSession = useAppStore((state) => state.clearSession);
  const setCurrentPatient = useAppStore((state) => state.setCurrentPatient);
  const setCurrentSession = useAppStore((state) => state.setCurrentSession);

  const [recentPatients, setRecentPatients] = useState<Patient[]>([]);
  const [allCaptures, setAllCaptures] = useState<CaptureImage[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRecentData = useCallback(async () => {
    try {
      setLoading(true);
      await dbService.init();
      const patients = await dbService.getPatients();
      const captures = await dbService.getAllCapturedImages();
      setRecentPatients(patients.slice(0, 5));
      setAllCaptures(captures);
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

  const pendingSyncCount = allCaptures.filter(
    (c) => c.uploadStatus === 'pending' || c.uploadStatus === 'failed'
  ).length;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={[styles.content, { padding: theme.spacing.md }]}>
        {/* Header Banner */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: theme.colors.text }]}>Welcome, Doctor</Text>
            <Text style={[styles.dateText, { color: theme.colors.textSecondary }]}>
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </Text>
          </View>
          <View
            style={[
              styles.clinicBadge,
              {
                backgroundColor: theme.colors.surfaceHighlight,
                borderColor: theme.colors.border,
                borderRadius: theme.radii.pill,
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.xs,
              },
            ]}
          >
            <Text style={[styles.clinicBadgeText, { color: theme.colors.primary }]}>
              🏥 Main Clinic
            </Text>
          </View>
        </Animated.View>

        {/* Dashboard Section Header */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <SectionHeader
            title="Clinical Overview"
            subtitle="Real-time patient statistics & sync status"
            accentColor={theme.colors.primary}
          />
        </Animated.View>

        {/* Statistics Row */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.metricsRow}>
          <MetricCard
            label="Patients"
            value={recentPatients.length}
            subtitle="Registered"
            trend={{ value: 'Active', positive: true }}
            accentColor={theme.colors.primary}
            style={styles.metricCardItem}
            onPress={openGallery}
          />
          <MetricCard
            label="Captures"
            value={allCaptures.length}
            subtitle="Fundus Images"
            accentColor={theme.colors.secondary}
            style={styles.metricCardItem}
            onPress={openGallery}
          />
          <MetricCard
            label="Cloud Sync"
            value={pendingSyncCount === 0 ? 'Synced' : `${pendingSyncCount} Queue`}
            subtitle={pendingSyncCount === 0 ? 'S3 Storage Ready' : 'Upload Pending'}
            accentColor={pendingSyncCount > 0 ? theme.colors.warning : theme.colors.success}
            style={styles.metricCardItem}
            onPress={openSettings}
          />
        </Animated.View>

        {/* Quick Operations Section */}
        <Animated.View entering={FadeInDown.delay(300).duration(400)}>
          <SectionHeader
            title="Quick Operations"
            subtitle="Intake & System Management"
            accentColor={theme.colors.secondary}
          />

          <MedicalCard variant="glass" style={styles.actionCard}>
            <PrimaryButton
              title="Start New Patient Session"
              onPress={startNewPatient}
              size="lg"
              icon={<Text style={{ color: theme.colors.text, fontSize: 18 }}>➕</Text>}
              style={{ marginBottom: theme.spacing.md }}
            />
            <View style={styles.rowActions}>
              <SecondaryButton
                title="View History"
                variant="surface"
                onPress={openGallery}
                icon={<Text style={{ color: theme.colors.text, fontSize: 14 }}>📁</Text>}
                style={styles.flexBtn}
              />
              <View style={{ width: theme.spacing.md }} />
              <SecondaryButton
                title="Settings"
                variant="outline"
                onPress={openSettings}
                icon={<Text style={{ color: theme.colors.primary, fontSize: 14 }}>⚙️</Text>}
                style={styles.flexBtn}
              />
            </View>
          </MedicalCard>
        </Animated.View>

        {/* Recent Patient Records */}
        <Animated.View entering={FadeInDown.delay(400).duration(400)}>
          <SectionHeader
            title="Recent Patient Records"
            subtitle="Top recent active patient charts"
            actionLabel="View All"
            onActionPress={openGallery}
            accentColor={theme.colors.info}
          />
        </Animated.View>

        {loading ? (
          <LoadingState message="Loading recent patient records..." size="medium" />
        ) : recentPatients.length === 0 ? (
          <Animated.View entering={FadeInUp.delay(200).duration(400)}>
            <EmptyState
              title="No Patient Records Found"
              description="Start a new patient session to record fundus images and maintain patient charts."
              actionLabel="Start New Patient Intake"
              onActionPress={startNewPatient}
            />
          </Animated.View>
        ) : (
          recentPatients.map((patient, index) => (
            <Animated.View
              key={patient.id}
              entering={FadeInDown.delay(500 + index * 80).duration(400)}
            >
              <MedicalCard
                variant="default"
                onPress={() => handleSelectPatient(patient)}
                title={patient.name}
                subtitle={`${patient.gender} • DOB: ${patient.dob}${
                  patient.patientId ? ` • ID: ${patient.patientId}` : ''
                }`}
                headerRight={<StatusBadge status="normal" label="Active Chart" size="sm" />}
                footer={
                  <View style={styles.patientCardFooter}>
                    <Text style={[styles.footerDateText, { color: theme.colors.primary }]}>
                      Created: {new Date(patient.createdAt).toLocaleDateString()}
                    </Text>
                    <Text style={[styles.footerActionText, { color: theme.colors.textSecondary }]}>
                      Open Session →
                    </Text>
                  </View>
                }
                style={{ marginBottom: theme.spacing.md }}
              />
            </Animated.View>
          ))
        )}
      </ScrollView>

      {/* Floating Action Button */}
      <FloatingActionButton
        onPress={startNewPatient}
        label="New Patient"
        pulsating={true}
        position="bottom-right"
        icon={<Text style={{ color: theme.colors.text, fontSize: 20 }}>+</Text>}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 90,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 8,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  dateText: {
    fontSize: 13,
    marginTop: 2,
  },
  clinicBadge: {
    borderWidth: 1,
  },
  clinicBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 8,
  },
  metricCardItem: {
    flex: 1,
    padding: 12,
  },
  actionCard: {
    marginBottom: 20,
    padding: 16,
  },
  rowActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  flexBtn: {
    flex: 1,
  },
  patientCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerDateText: {
    fontSize: 12,
    fontWeight: '600',
  },
  footerActionText: {
    fontSize: 12,
    fontWeight: '500',
  },
});

export default HomeScreen;
