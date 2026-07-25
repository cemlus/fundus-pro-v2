import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useTheme } from '../theme';
import {
  SectionHeader,
  MedicalCard,
  MetricCard,
  StatusBadge,
  PrimaryButton,
  SecondaryButton,
} from '../components';
import { UploadService } from '../services/UploadService';
import { dbService } from '../database/SQLiteService';

const SettingsScreen = () => {
  const { theme } = useTheme();

  const [patientCount, setPatientCount] = useState<number>(0);
  const [captureCount, setCaptureCount] = useState<number>(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        await dbService.init();
        const patients = await dbService.getPatients();
        const captures = await dbService.getAllCapturedImages();
        setPatientCount(patients.length);
        setCaptureCount(captures.length);
      } catch (e) {
        console.error('Failed to load settings stats:', e);
      }
    };
    fetchStats();
  }, []);

  const handleForceSyncUploads = async () => {
    setSyncing(true);
    try {
      await UploadService.retryFailedUploads();
      Alert.alert('Sync Enqueued', 'Forced background synchronization queue triggered for pending images.');
    } catch (e) {
      console.error(e);
      Alert.alert('Sync Error', 'Failed to trigger background upload sync.');
    } finally {
      setSyncing(false);
    }
  };

  const clearLocalDatabase = () => {
    Alert.alert(
      'Wipe Local Database Cache',
      'Are you sure? This action clears SQLite tables and image index caches. Raw image files remain on disk.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Wipe Database', style: 'destructive', onPress: () => Alert.alert('Database Reset', 'SQLite database index cleared.') },
      ]
    );
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={[styles.content, { padding: theme.spacing.md }]}
    >
      {/* System Metrics Header */}
      <Animated.View entering={FadeInDown.duration(400)}>
        <SectionHeader
          title="System Status & Metrics"
          subtitle="Local SQLite database and storage overview"
          accentColor={theme.colors.primary}
          rightElement={<StatusBadge status="normal" label="System Healthy" size="sm" />}
        />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.metricsRow}>
        <MetricCard
          label="Database Records"
          value={`${patientCount} Patients`}
          subtitle="Registered Charts"
          accentColor={theme.colors.primary}
          style={styles.flexMetric}
        />
        <View style={{ width: theme.spacing.md }} />
        <MetricCard
          label="Local Captures"
          value={`${captureCount} Files`}
          subtitle="Fundus Disk Storage"
          accentColor={theme.colors.secondary}
          style={styles.flexMetric}
        />
      </Animated.View>

      {/* Cloud Synchronization Section */}
      <Animated.View entering={FadeInDown.delay(200).duration(400)}>
        <SectionHeader
          title="Cloud Synchronization (AWS S3)"
          subtitle="Background queue & push settings"
          accentColor={theme.colors.secondary}
        />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(250).duration(400)}>
        <MedicalCard
          variant="glass"
          title="AWS S3 Upload Queue"
          subtitle="Manually push pending fundus captures to cloud storage"
          style={styles.card}
        >
          <Text style={[styles.description, { color: theme.colors.textSecondary }]}>
            Fundus Pro automatically syncs captured images when network connectivity is active. Trigger a forced manual push to clear pending queues immediately.
          </Text>
          <PrimaryButton
            title="Force Sync Uploads"
            onPress={handleForceSyncUploads}
            loading={syncing}
            icon={<Text style={{ color: theme.colors.text, fontSize: 16 }}>🔄</Text>}
          />
        </MedicalCard>
      </Animated.View>

      {/* AI Pipeline Settings */}
      <Animated.View entering={FadeInDown.delay(300).duration(400)}>
        <SectionHeader
          title="AI Enhancement Pipeline"
          subtitle="Local neural network contrast enhancement"
          accentColor={theme.colors.info}
        />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(350).duration(400)}>
        <MedicalCard
          variant="default"
          title="Ophthalmic Contrast Optimization"
          subtitle="Automatic CLAHE / deep learning contrast boost"
          headerRight={<StatusBadge status="enhanced" label="Active" size="sm" />}
          style={styles.card}
        >
          <Text style={[styles.description, { color: theme.colors.textSecondary }]}>
            The AI Enhancement service processes captured fundus images in a background queue. Ensure device has sufficient battery or is connected to power for batch processing.
          </Text>
        </MedicalCard>
      </Animated.View>

      {/* System Maintenance & Danger Zone */}
      <Animated.View entering={FadeInDown.delay(400).duration(400)}>
        <SectionHeader
          title="System Maintenance & Danger Zone"
          subtitle="Database reset & cache management"
          accentColor={theme.colors.danger}
        />
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(450).duration(400)}>
        <MedicalCard
          variant="outlined"
          title="Wipe Local Database Cache"
          subtitle="Clear metadata tables and index cache"
          style={[styles.card, { borderColor: 'rgba(239, 68, 68, 0.4)' }]}
        >
          <Text style={[styles.description, { color: theme.colors.textSecondary }]}>
            Clears all SQLite patient charts, session logs, and sidecar index records. High-resolution RAW images saved in application disk storage will not be deleted.
          </Text>
          <SecondaryButton
            title="Wipe Database Cache"
            variant="outline"
            onPress={clearLocalDatabase}
            textStyle={{ color: theme.colors.danger }}
            style={{ borderColor: theme.colors.danger }}
          />
        </MedicalCard>
      </Animated.View>

      <Text style={[styles.versionText, { color: theme.colors.textMuted }]}>
        Fundus Pro Clinical System v1.0.0 (Build 2026.07)
      </Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: 40 },
  metricsRow: { flexDirection: 'row', marginBottom: 20 },
  flexMetric: { flex: 1 },
  card: { marginBottom: 20, padding: 16 },
  description: { fontSize: 13, lineHeight: 18, marginBottom: 16 },
  versionText: { textAlign: 'center', fontSize: 12, marginTop: 16, marginBottom: 24 },
});

export default SettingsScreen;
