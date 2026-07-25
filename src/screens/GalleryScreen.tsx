import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme';
import {
  SectionHeader,
  SearchBar,
  MedicalCard,
  StatusBadge,
  SecondaryButton,
  EmptyState,
  LoadingState,
} from '../components';
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

type FilterCategory = 'all' | 'has_captures' | 'pending_sync';

const GalleryScreen = () => {
  const navigation = useNavigation<AppNavigationProp>();
  const { theme } = useTheme();

  const setCurrentPatient = useAppStore((state) => state.setCurrentPatient);
  const setCurrentSession = useAppStore((state) => state.setCurrentSession);

  const [records, setRecords] = useState<PatientRecordItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('all');
  const [isGridView, setIsGridView] = useState(false);
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
        const pCaptures = allCaptures.filter((c) => c.patientId === p.id);
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

  const filteredRecords = records.filter((r) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      r.patient.name.toLowerCase().includes(q) ||
      (r.patient.patientId && r.patient.patientId.toLowerCase().includes(q));

    if (!matchesSearch) return false;

    if (activeFilter === 'has_captures') return r.captureCount > 0;
    if (activeFilter === 'pending_sync') {
      return r.captures.some((c) => c.uploadStatus === 'pending' || c.uploadStatus === 'failed');
    }

    return true;
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

  const renderItem = ({ item, index }: { item: PatientRecordItem; index: number }) => {
    const pendingCount = item.captures.filter(
      (c) => c.uploadStatus === 'pending' || c.uploadStatus === 'failed'
    ).length;

    return (
      <Animated.View entering={FadeInDown.delay(index * 60).duration(350)}>
        <MedicalCard
          variant="glass"
          title={item.patient.name}
          subtitle={`${item.patient.gender} • DOB: ${item.patient.dob}${
            item.patient.patientId ? ` • ID: ${item.patient.patientId}` : ''
          }`}
          headerRight={
            <StatusBadge
              status={pendingCount > 0 ? 'glare' : 'normal'}
              label={pendingCount > 0 ? `${pendingCount} Sync Pending` : 'All Synced'}
              size="sm"
            />
          }
          footer={
            <View style={styles.cardFooter}>
              <Text style={[styles.statsText, { color: theme.colors.textSecondary }]}>
                📊 {item.sessionCount} Sessions • {item.captureCount} Captures
              </Text>
              <SecondaryButton
                title="Open Chart →"
                variant="outline"
                size="sm"
                fullWidth={false}
                onPress={() => handleOpenPatientRecord(item)}
              />
            </View>
          }
          style={styles.recordCard}
        >
          {/* Thumbnails preview strip */}
          {item.captures.length > 0 ? (
            <View style={styles.thumbnailRow}>
              {item.captures.slice(0, 4).map((cap) => {
                const uri =
                  cap.rawImagePath.startsWith('file://') || cap.rawImagePath.startsWith('http')
                    ? cap.rawImagePath
                    : `file://${cap.rawImagePath}`;
                return (
                  <View key={cap.id} style={styles.thumbWrapper}>
                    <Image source={{ uri }} style={styles.thumbnail} resizeMode="cover" />
                    <View
                      style={[
                        styles.thumbBadge,
                        {
                          backgroundColor:
                            cap.eyeSide === 'left' ? theme.colors.eyeOS : theme.colors.eyeOD,
                        },
                      ]}
                    >
                      <Text style={styles.thumbBadgeText}>{cap.eyeSide.toUpperCase()}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={[styles.noCapturesText, { color: theme.colors.textMuted }]}>
              No fundus images recorded for this patient yet.
            </Text>
          )}
        </MedicalCard>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header Section */}
      <Animated.View
        entering={FadeInDown.duration(400)}
        style={[styles.headerWrapper, { paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.sm }]}
      >
        <SectionHeader
          title="Patient Image Gallery"
          subtitle="Search & inspect clinical patient archives"
          accentColor={theme.colors.primary}
          rightElement={
            <TouchableOpacity
              style={[
                styles.viewToggleBtn,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              ]}
              onPress={() => setIsGridView(!isGridView)}
            >
              <Text style={{ color: theme.colors.text, fontSize: 14 }}>
                {isGridView ? '☰ List View' : '🔲 Grid View'}
              </Text>
            </TouchableOpacity>
          }
        />

        {/* Search Bar */}
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search by Patient Name or MRN ID..."
          style={{ marginBottom: theme.spacing.sm }}
        />

        {/* Filter Chips */}
        <View style={styles.chipRow}>
          <TouchableOpacity
            style={[
              styles.filterChip,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              activeFilter === 'all' && {
                backgroundColor: theme.colors.primary,
                borderColor: theme.colors.primary,
              },
            ]}
            onPress={() => setActiveFilter('all')}
          >
            <Text
              style={[
                styles.chipText,
                { color: activeFilter === 'all' ? theme.colors.text : theme.colors.textSecondary },
              ]}
            >
              All Charts ({records.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterChip,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              activeFilter === 'has_captures' && {
                backgroundColor: theme.colors.secondary,
                borderColor: theme.colors.secondary,
              },
            ]}
            onPress={() => setActiveFilter('has_captures')}
          >
            <Text
              style={[
                styles.chipText,
                {
                  color:
                    activeFilter === 'has_captures' ? theme.colors.text : theme.colors.textSecondary,
                },
              ]}
            >
              With Images
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterChip,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              activeFilter === 'pending_sync' && {
                backgroundColor: theme.colors.warning,
                borderColor: theme.colors.warning,
              },
            ]}
            onPress={() => setActiveFilter('pending_sync')}
          >
            <Text
              style={[
                styles.chipText,
                { color: activeFilter === 'pending_sync' ? '#000' : theme.colors.textSecondary },
              ]}
            >
              Pending Sync
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Main List / Grid */}
      {loading ? (
        <LoadingState message="Loading patient database..." size="medium" />
      ) : (
        <FlatList
          data={filteredRecords}
          keyExtractor={(item) => item.patient.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.listContent, { padding: theme.spacing.md }]}
          ListEmptyComponent={
            <Animated.View entering={FadeInUp.duration(300)}>
              <EmptyState
                title={searchQuery ? 'No Matching Records' : 'Database Archive Empty'}
                description={
                  searchQuery
                    ? `No patient record matched ${searchQuery}. Try refining your search query.`
                    : 'No patient records found in SQLite database. Start a new intake session to populate records.'
                }
                actionLabel={searchQuery ? 'Clear Search' : 'New Intake Session'}
                onActionPress={
                  searchQuery
                    ? () => setSearchQuery('')
                    : () => navigation.navigate('PatientDetails', {})
                }
              />
            </Animated.View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerWrapper: {},
  viewToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  chipRow: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  listContent: { paddingBottom: 40 },
  recordCard: { marginBottom: 16, padding: 16 },
  thumbnailRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 10,
  },
  thumbWrapper: {
    position: 'relative',
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#1E293B',
  },
  thumbBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  thumbBadgeText: {
    color: '#FFF',
    fontSize: 8,
    fontWeight: '800',
  },
  noCapturesText: {
    fontSize: 12,
    fontStyle: 'italic',
    marginVertical: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statsText: {
    fontSize: 12,
    fontWeight: '500',
  },
});

export default GalleryScreen;
