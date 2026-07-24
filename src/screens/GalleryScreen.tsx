import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { theme } from '../constants/theme';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { AppNavigationProp } from '../navigation/types';
import { dbService } from '../database/SQLiteService';
import { Patient, CaptureImage } from '../models/types';
import { useAppStore } from '../store/useAppStore';

interface PatientRecordItem {
  patient: Patient;
  sessionCount: number;
  captureCount: number;
  captures: CaptureImage[];
}

const GalleryScreen = () => {
  const navigation = useNavigation<AppNavigationProp>();
  const setCurrentPatient = useAppStore(state => state.setCurrentPatient);
  const setCurrentSession = useAppStore(state => state.setCurrentSession);

  const [records, setRecords] = useState<PatientRecordItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const loadGalleryData = useCallback(async () => {
    try {
      setLoading(true);
      await dbService.init();
      const patients = await dbService.getPatients();
      const allCaptures = await dbService.getAllCapturedImages();

      const items: PatientRecordItem[] = [];
      for (const p of patients) {
        const sessions = await dbService.getSessions(p.id);
        const pCaptures = allCaptures.filter(c => c.patientId === p.id);
        items.push({
          patient: p,
          sessionCount: sessions.length,
          captureCount: pCaptures.length,
          captures: pCaptures,
        });
      }
      setRecords(items);
    } catch (e) {
      console.error('Failed to load gallery data:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadGalleryData();
    }, [loadGalleryData])
  );

  const filteredRecords = records.filter(r => {
    const q = searchQuery.toLowerCase();
    return (
      r.patient.name.toLowerCase().includes(q) ||
      (r.patient.patientId && r.patient.patientId.toLowerCase().includes(q))
    );
  });

  const handleOpenPatientRecord = async (item: PatientRecordItem) => {
    setCurrentPatient(item.patient);
    const sessions = await dbService.getSessions(item.patient.id);
    if (sessions.length > 0) {
      const latestSession = sessions[0];
      setCurrentSession(latestSession);
      const captures = await dbService.getCapturedImages(latestSession.id);
      useAppStore.setState({ sessionCaptures: captures });
      navigation.navigate('Session', { sessionId: latestSession.id });
    }
  };

  const renderItem = ({ item }: { item: PatientRecordItem }) => {
    const latestImage = item.captures.length > 0 ? item.captures[0].rawImagePath : null;

    return (
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.patientName}>{item.patient.name}</Text>
            <Text style={styles.subtext}>
              {item.patient.gender} • DOB: {item.patient.dob} {item.patient.patientId ? `• ID: ${item.patient.patientId}` : ''}
            </Text>
          </View>
          <Text style={styles.date}>
            {new Date(item.patient.createdAt).toLocaleDateString()}
          </Text>
        </View>

        {/* Thumbnail Preview strip if images exist */}
        {item.captures.length > 0 && (
          <View style={styles.thumbnailRow}>
            {item.captures.slice(0, 4).map(cap => (
              <Image
                key={cap.id}
                source={{
                  uri: cap.rawImagePath.startsWith('file://') || cap.rawImagePath.startsWith('http')
                    ? cap.rawImagePath
                    : `file://${cap.rawImagePath}`,
                }}
                style={styles.thumbnail}
              />
            ))}
          </View>
        )}

        <View style={styles.cardBody}>
          <Text style={styles.details}>
            {item.sessionCount} Sessions • {item.captureCount} Captures
          </Text>
        </View>

        <Button 
          title="Open Patient Record" 
          variant="outline" 
          size="small" 
          onPress={() => handleOpenPatientRecord(item)} 
        />
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchWrapper}>
        <Input
          placeholder="Search by Patient Name or MRN..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <FlatList
        data={filteredRecords}
        keyExtractor={item => item.patient.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {loading ? 'Loading history...' : 'No patient records found.'}
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  searchWrapper: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md },
  listContent: { padding: theme.spacing.lg },
  card: { marginBottom: theme.spacing.md },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: theme.spacing.xs },
  patientName: { fontSize: theme.typography.sizes.md, fontWeight: 'bold', color: theme.colors.text },
  subtext: { fontSize: theme.typography.sizes.xs, color: theme.colors.textSecondary, marginTop: 2 },
  date: { fontSize: theme.typography.sizes.xs, color: theme.colors.primary, fontWeight: '600' },
  thumbnailRow: { flexDirection: 'row', gap: 6, marginVertical: theme.spacing.sm },
  thumbnail: { width: 50, height: 50, borderRadius: 8, backgroundColor: '#1e293b' },
  cardBody: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: theme.spacing.md },
  details: { color: theme.colors.textSecondary, fontSize: theme.typography.sizes.xs },
  emptyContainer: { alignItems: 'center', marginTop: theme.spacing.xxl },
  emptyText: { color: theme.colors.textSecondary },
});

export default GalleryScreen;
