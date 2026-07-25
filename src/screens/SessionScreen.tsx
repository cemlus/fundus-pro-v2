import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Animated, { FadeInDown, FadeInUp, SlideInRight } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { AppNavigationProp } from '../navigation/types';
import { useTheme } from '../theme';
import { useAppStore } from '../store/useAppStore';
import {
  SectionHeader,
  MedicalCard,
  MetricCard,
  PrimaryButton,
  SecondaryButton,
  EyeSelector,
  StatusBadge,
  EmptyState,
} from '../components';
import { EyeSide } from '../models/types';

const SessionScreen = () => {
  const navigation = useNavigation<AppNavigationProp>();
  const { theme } = useTheme();

  const patient = useAppStore((state) => state.currentPatient);
  const session = useAppStore((state) => state.currentSession);
  const captures = useAppStore((state) => state.sessionCaptures);

  const [selectedEye, setSelectedEye] = useState<EyeSide>('left');

  if (!patient || !session) return null;

  const leftCaptures = captures.filter((c) => c.eyeSide === 'left');
  const rightCaptures = captures.filter((c) => c.eyeSide === 'right');

  const startCamera = () => {
    navigation.navigate('Camera', { sessionId: session.id });
  };

  const endSession = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Home' }],
    });
  };

  const selectedEyeLabel = selectedEye === 'left' ? 'OS (Left Eye)' : 'OD (Right Eye)';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={[styles.content, { padding: theme.spacing.md }]}
    >
      {/* Active Session Header Card */}
      <Animated.View entering={FadeInDown.duration(400)}>
        <SectionHeader
          title="Active Examination Session"
          subtitle={`Session ID: ${session.id}`}
          accentColor={theme.colors.primary}
          rightElement={<StatusBadge status="processing" label="In Progress" size="sm" />}
        />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(100).duration(400)}>
        <MedicalCard
          variant="glass"
          title={patient.name}
          subtitle={`${patient.gender} • DOB: ${patient.dob}${
            patient.patientId ? ` • ID: ${patient.patientId}` : ''
          }`}
          style={styles.patientCard}
        >
          {patient.notes ? (
            <Text style={[styles.notesText, { color: theme.colors.textSecondary }]}>
              Notes: {patient.notes}
            </Text>
          ) : null}
        </MedicalCard>
      </Animated.View>

      {/* Target Eye Selector & Camera Launcher */}
      <Animated.View entering={FadeInDown.delay(200).duration(400)}>
        <SectionHeader
          title="Capture Configuration"
          subtitle="Select target eye for next fundus capture"
          accentColor={theme.colors.secondary}
        />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(250).duration(400)}>
        <MedicalCard variant="default" style={styles.captureConfigCard}>
          <EyeSelector selectedEye={selectedEye} onSelectEye={setSelectedEye} />

          <View style={{ height: theme.spacing.lg }} />

          <PrimaryButton
            title={`Launch Camera — ${selectedEyeLabel}`}
            onPress={startCamera}
            size="lg"
            icon={<Text style={{ color: theme.colors.text, fontSize: 20 }}>📷</Text>}
          />
        </MedicalCard>
      </Animated.View>

      {/* Capture Metrics Row */}
      <Animated.View entering={FadeInDown.delay(300).duration(400)}>
        <SectionHeader
          title="Session Metrics"
          subtitle="Distribution of fundus captures by eye"
          accentColor={theme.colors.info}
        />
      </Animated.View>

      <Animated.View entering={SlideInRight.delay(350).duration(400)} style={styles.metricsRow}>
        <MetricCard
          label="Left Eye (OS)"
          value={`${leftCaptures.length} Images`}
          subtitle={selectedEye === 'left' ? 'Target Eye Active' : 'OS Captured'}
          accentColor={theme.colors.eyeOS}
          style={styles.flexMetric}
        />
        <View style={{ width: theme.spacing.md }} />
        <MetricCard
          label="Right Eye (OD)"
          value={`${rightCaptures.length} Images`}
          subtitle={selectedEye === 'right' ? 'Target Eye Active' : 'OD Captured'}
          accentColor={theme.colors.eyeOD}
          style={styles.flexMetric}
        />
      </Animated.View>

      {/* Capture History Gallery */}
      <Animated.View entering={FadeInDown.delay(400).duration(400)}>
        <SectionHeader
          title="Session Captures"
          subtitle={`Total captures recorded: ${captures.length}`}
          accentColor={theme.colors.primary}
        />
      </Animated.View>

      {captures.length === 0 ? (
        <Animated.View entering={FadeInUp.delay(200).duration(400)}>
          <EmptyState
            title="No Captures Recorded Yet"
            description="Select your target eye above and launch the camera to begin taking high-resolution fundus images."
            actionLabel={`Launch Camera (${selectedEye.toUpperCase()})`}
            onActionPress={startCamera}
          />
        </Animated.View>
      ) : (
        <View style={styles.captureList}>
          {captures.map((capture, index) => {
            const isLeft = capture.eyeSide === 'left';
            return (
              <Animated.View
                key={capture.id}
                entering={FadeInDown.delay(450 + index * 60).duration(400)}
              >
                <MedicalCard
                  variant="default"
                  title={`Capture #${index + 1} — ${isLeft ? 'Left Eye (OS)' : 'Right Eye (OD)'}`}
                  subtitle={`Recorded at ${new Date(capture.captureTime).toLocaleTimeString()}`}
                  headerRight={
                    <StatusBadge
                      status={capture.enhancementStatus === 'done' ? 'enhanced' : capture.enhancementStatus}
                      size="sm"
                    />
                  }
                  footer={
                    <View style={styles.captureFooter}>
                      <StatusBadge
                        status={capture.uploadStatus === 'uploaded' ? 'normal' : capture.uploadStatus}
                        label={capture.uploadStatus === 'uploaded' ? 'Cloud Synced' : 'Sync Pending'}
                        size="sm"
                      />
                      <SecondaryButton
                        title="Review Image"
                        variant="outline"
                        size="sm"
                        fullWidth={false}
                        onPress={() => navigation.navigate('ImageReview', { imageId: capture.id })}
                      />
                    </View>
                  }
                  style={{ marginBottom: theme.spacing.md }}
                />
              </Animated.View>
            );
          })}
        </View>
      )}

      {/* Complete Session Button */}
      <Animated.View entering={FadeInUp.delay(500).duration(400)} style={styles.footer}>
        <SecondaryButton
          title="Complete Session & Return Home"
          variant="surface"
          size="lg"
          onPress={endSession}
        />
      </Animated.View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: 40 },
  patientCard: { marginBottom: 16, padding: 16 },
  notesText: { fontSize: 13, marginTop: 8, fontStyle: 'italic' },
  captureConfigCard: { marginBottom: 20, padding: 16 },
  metricsRow: { flexDirection: 'row', marginBottom: 20 },
  flexMetric: { flex: 1 },
  captureList: { marginTop: 4 },
  captureFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footer: { marginTop: 24, marginBottom: 24 },
});

export default SessionScreen;
