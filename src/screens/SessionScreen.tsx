import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AppNavigationProp } from '../navigation/types';
import { theme } from '../constants/theme';
import { useAppStore } from '../store/useAppStore';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { EyeSelector } from '../components/EyeSelector';
import { EyeSide } from '../models/types';

const SessionScreen = () => {
  const navigation = useNavigation<AppNavigationProp>();
  const patient = useAppStore(state => state.currentPatient);
  const session = useAppStore(state => state.currentSession);
  const captures = useAppStore(state => state.sessionCaptures);
  
  const [selectedEye, setSelectedEye] = React.useState<EyeSide>('left');

  if (!patient || !session) return null;

  const leftCaptures = captures.filter(c => c.eyeSide === 'left');
  const rightCaptures = captures.filter(c => c.eyeSide === 'right');

  const startCamera = () => {
    navigation.navigate('Camera', { sessionId: session.id });
  };

  const endSession = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Home' }],
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card style={styles.patientCard}>
        <Text style={styles.patientName}>{patient.name}</Text>
        <Text style={styles.patientInfo}>{patient.gender} • DOB: {patient.dob}</Text>
        {patient.patientId ? <Text style={styles.patientInfo}>ID: {patient.patientId}</Text> : null}
      </Card>

      <Text style={styles.sectionTitle}>Select Eye for Next Capture</Text>
      <EyeSelector selectedEye={selectedEye} onSelectEye={setSelectedEye} />

      <View style={styles.actionContainer}>
        <Button title={`Launch Camera (${selectedEye.toUpperCase()})`} onPress={startCamera} size="large" />
      </View>

      <Text style={styles.sectionTitle}>Session Captures</Text>
      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Left Eye (OS)</Text>
          <Text style={styles.statValue}>{leftCaptures.length} Captured</Text>
        </View>
        <View style={{ width: theme.spacing.md }} />
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Right Eye (OD)</Text>
          <Text style={styles.statValue}>{rightCaptures.length} Captured</Text>
        </View>
      </View>
      
      {captures.length > 0 && (
        <View style={styles.captureList}>
          {captures.map((capture, index) => (
            <Card key={capture.id} style={styles.captureItem}>
              <View>
                <Text style={styles.captureEyeText}>{capture.eyeSide === 'left' ? 'Left Eye' : 'Right Eye'}</Text>
                <Text style={styles.captureTimeText}>{new Date(capture.captureTime).toLocaleTimeString()}</Text>
              </View>
              <Button 
                title="Review" 
                variant="secondary" 
                size="small" 
                onPress={() => navigation.navigate('ImageReview', { imageId: capture.id })} 
              />
            </Card>
          ))}
        </View>
      )}

      <View style={styles.footer}>
        <Button title="Complete Session" variant="outline" onPress={endSession} />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg },
  patientCard: { marginBottom: theme.spacing.xl, backgroundColor: theme.colors.surfaceHighlight },
  patientName: { fontSize: theme.typography.sizes.lg, fontWeight: 'bold', color: theme.colors.text },
  patientInfo: { fontSize: theme.typography.sizes.sm, color: theme.colors.textSecondary, marginTop: theme.spacing.xs },
  sectionTitle: { fontSize: theme.typography.sizes.md, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: theme.spacing.md, marginTop: theme.spacing.md },
  actionContainer: { marginTop: theme.spacing.xl, marginBottom: theme.spacing.xl },
  statsContainer: { flexDirection: 'row', marginBottom: theme.spacing.lg },
  statBox: { flex: 1, backgroundColor: theme.colors.surface, padding: theme.spacing.md, borderRadius: theme.radii.md, alignItems: 'center', borderColor: theme.colors.border, borderWidth: 1 },
  statLabel: { color: theme.colors.textSecondary, fontSize: theme.typography.sizes.xs, marginBottom: theme.spacing.xs },
  statValue: { color: theme.colors.text, fontSize: theme.typography.sizes.md, fontWeight: 'bold' },
  captureList: { marginTop: theme.spacing.sm },
  captureItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.sm },
  captureEyeText: { color: theme.colors.text, fontWeight: '600' },
  captureTimeText: { color: theme.colors.textSecondary, fontSize: theme.typography.sizes.xs, marginTop: 4 },
  footer: { marginTop: theme.spacing.xxl, paddingBottom: theme.spacing.xl },
});

export default SessionScreen;
