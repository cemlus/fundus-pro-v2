import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AppNavigationProp } from '../navigation/types';
import { theme } from '../constants/theme';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { useAppStore } from '../store/useAppStore';
import { dbService } from '../database/SQLiteService';

const PatientDetailsScreen = () => {
  const navigation = useNavigation<AppNavigationProp>();
  const setCurrentPatient = useAppStore(state => state.setCurrentPatient);
  const setCurrentSession = useAppStore(state => state.setCurrentSession);

  const [name, setName] = useState('');
  const [gender, setGender] = useState('');
  const [dob, setDob] = useState('');
  const [patientIdOpt, setPatientIdOpt] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!name || !dob || !gender) {
      Alert.alert('Validation Error', 'Please fill out all required fields.');
      return;
    }
    
    setLoading(true);
    try {
      const pId = `pat_${Date.now()}`;
      const newPatient = {
        id: pId,
        name,
        gender,
        dob,
        patientId: patientIdOpt,
        notes,
        createdAt: new Date().toISOString(),
      };
      
      await dbService.addPatient(newPatient);
      setCurrentPatient(newPatient);

      // Create a session for this imaging event
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
      Alert.alert('Error', 'Failed to save patient');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Input label="Full Name *" value={name} onChangeText={setName} placeholder="e.g. John Doe" />
      <Input label="Gender *" value={gender} onChangeText={setGender} placeholder="e.g. Male/Female/Other" />
      <Input label="Date of Birth *" value={dob} onChangeText={setDob} placeholder="YYYY-MM-DD" />
      <Input label="Patient ID (Optional)" value={patientIdOpt} onChangeText={setPatientIdOpt} placeholder="e.g. MRN" />
      <Input label="Clinical Notes (Optional)" value={notes} onChangeText={setNotes} placeholder="Observations..." multiline style={{ height: 80 }} />
      
      <View style={styles.footer}>
        <Button title="Save and Start Session" onPress={handleSave} isLoading={loading} />
      </View>
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
  footer: {
    marginTop: theme.spacing.xl,
  },
});

export default PatientDetailsScreen;
