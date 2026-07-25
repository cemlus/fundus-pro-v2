import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, Text } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { AppNavigationProp } from '../navigation/types';
import { useTheme } from '../theme';
import {
  SectionHeader,
  MedicalCard,
  PrimaryButton,
  Input,
  EyeSelector,
  StatusBadge,
} from '../components';
import { EyeSide } from '../models/types';
import { useAppStore } from '../store/useAppStore';
import { dbService } from '../database/SQLiteService';

const PatientDetailsScreen = () => {
  const navigation = useNavigation<AppNavigationProp>();
  const { theme } = useTheme();

  const setCurrentPatient = useAppStore((state) => state.setCurrentPatient);
  const setCurrentSession = useAppStore((state) => state.setCurrentSession);

  const [name, setName] = useState('');
  const [gender, setGender] = useState('');
  const [dob, setDob] = useState('');
  const [patientIdOpt, setPatientIdOpt] = useState('');
  const [notes, setNotes] = useState('');
  const [targetEye, setTargetEye] = useState<EyeSide>('left');

  const [errors, setErrors] = useState<{ name?: string; gender?: string; dob?: string }>({});
  const [loading, setLoading] = useState(false);

  const validate = (): boolean => {
    const newErrors: { name?: string; gender?: string; dob?: string } = {};
    if (!name.trim()) newErrors.name = 'Full name is required';
    if (!gender.trim()) newErrors.gender = 'Gender is required';
    if (!dob.trim()) {
      newErrors.dob = 'Date of birth is required';
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(dob.trim())) {
      newErrors.dob = 'Use format YYYY-MM-DD (e.g. 1985-06-15)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      Alert.alert('Validation Error', 'Please complete all required fields correctly before saving.');
      return;
    }

    setLoading(true);
    try {
      const pId = `pat_${Date.now()}`;
      const newPatient = {
        id: pId,
        name: name.trim(),
        gender: gender.trim(),
        dob: dob.trim(),
        patientId: patientIdOpt.trim(),
        notes: notes.trim(),
        createdAt: new Date().toISOString(),
      };

      await dbService.addPatient(newPatient);
      setCurrentPatient(newPatient);

      const sId = `ses_${Date.now()}`;
      const newSession = {
        id: sId,
        patientId: pId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await dbService.addSession(newSession);
      setCurrentSession(newSession);

      navigation.replace('Session', { sessionId: sId });
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to save patient record. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={[styles.content, { padding: theme.spacing.md }]}
    >
      <Animated.View entering={FadeInDown.duration(400)}>
        <SectionHeader
          title="Patient Intake Form"
          subtitle="Create chart & initialize imaging session"
          accentColor={theme.colors.primary}
          rightElement={<StatusBadge status="processing" label="New Record" size="sm" />}
        />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(100).duration(400)}>
        <MedicalCard variant="glass" style={styles.formCard}>
          <Text style={[styles.cardSectionHeader, { color: theme.colors.text }]}>
            Demographic Information
          </Text>

          <Input
            label="Full Name *"
            value={name}
            onChangeText={(text) => {
              setName(text);
              if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
            }}
            placeholder="e.g. Jane Doe"
            error={errors.name}
          />

          <View style={styles.twoColumnRow}>
            <View style={styles.flexColumn}>
              <Input
                label="Gender *"
                value={gender}
                onChangeText={(text) => {
                  setGender(text);
                  if (errors.gender) setErrors((prev) => ({ ...prev, gender: undefined }));
                }}
                placeholder="e.g. Female"
                error={errors.gender}
              />
            </View>
            <View style={{ width: theme.spacing.md }} />
            <View style={styles.flexColumn}>
              <Input
                label="Date of Birth *"
                value={dob}
                onChangeText={(text) => {
                  setDob(text);
                  if (errors.dob) setErrors((prev) => ({ ...prev, dob: undefined }));
                }}
                placeholder="YYYY-MM-DD"
                error={errors.dob}
              />
            </View>
          </View>

          <Input
            label="Medical Record Number / ID (Optional)"
            value={patientIdOpt}
            onChangeText={setPatientIdOpt}
            placeholder="e.g. MRN-948201"
          />
        </MedicalCard>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(200).duration(400)}>
        <SectionHeader
          title="Clinical Pre-Assessment"
          subtitle="Target eye selection & examination notes"
          accentColor={theme.colors.secondary}
        />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(300).duration(400)}>
        <MedicalCard variant="default" style={styles.formCard}>
          <Text style={[styles.cardSectionHeader, { color: theme.colors.text }]}>
            Initial Target Eye
          </Text>
          <EyeSelector selectedEye={targetEye} onSelectEye={setTargetEye} />

          <View style={{ height: theme.spacing.md }} />

          <Input
            label="Clinical Notes / Pre-existing Conditions (Optional)"
            value={notes}
            onChangeText={setNotes}
            placeholder="Enter baseline notes, symptoms, or dilation status..."
            multiline
            numberOfLines={3}
            style={{ height: 84 }}
          />
        </MedicalCard>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(400).duration(400)} style={styles.footer}>
        <PrimaryButton
          title="Save & Start Imaging Session"
          onPress={handleSave}
          loading={loading}
          size="lg"
          icon={<Text style={{ color: theme.colors.text, fontSize: 18 }}>📸</Text>}
        />
      </Animated.View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 40,
  },
  formCard: {
    marginBottom: 20,
    padding: 16,
  },
  cardSectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  twoColumnRow: {
    flexDirection: 'row',
  },
  flexColumn: {
    flex: 1,
  },
  footer: {
    marginTop: 8,
    marginBottom: 24,
  },
});

export default PatientDetailsScreen;
