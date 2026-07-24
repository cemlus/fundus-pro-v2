import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { AppNavigationProp, RootStackParamList } from '../navigation/types';
import type { RouteProp } from '@react-navigation/native';
import { theme } from '../constants/theme';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { useAppStore } from '../store/useAppStore';
import { AIEnhancementService } from '../services/AIEnhancementService';
import { UploadService } from '../services/UploadService';

const ImageReviewScreen = () => {
  const navigation = useNavigation<AppNavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'ImageReview'>>();
  const { imageId } = route.params;

  const captures = useAppStore(state => state.sessionCaptures);
  const capture = captures.find(c => c.id === imageId);
  const updateSessionCapture = useAppStore(state => state.updateSessionCapture);

  const [refreshing, setRefreshing] = useState(false);

  // Poll for enhancement status updates if processing
  useEffect(() => {
    let interval: any;
    if (capture?.enhancementStatus === 'processing' || capture?.enhancementStatus === 'queued') {
      interval = setInterval(() => {
        // In a real app we'd fetch the latest status from the DB/Store
        // For now, we simulate UI state updates through Zustand
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [capture?.enhancementStatus]);

  if (!capture) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Image not found</Text>
        <Button title="Go Back" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  const handleEnhance = async () => {
    updateSessionCapture(capture.id, { enhancementStatus: 'queued' });
    await AIEnhancementService.queueEnhancement(capture.id, capture.rawImagePath);
    // Note: The service simulated completion directly and updated the DB.
    // The Zustand store should technically be updated by a DB subscription in a real app.
    // For demo, we manually set to processing in UI immediately.
  };

  const handleUpload = async () => {
    updateSessionCapture(capture.id, { uploadStatus: 'pending' });
    await UploadService.queueUpload(capture.id);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{capture.eyeSide === 'left' ? 'Left Eye (OS)' : 'Right Eye (OD)'}</Text>
      <Text style={styles.timestamp}>{new Date(capture.captureTime).toLocaleString()}</Text>

      <Card style={styles.imageCard}>
        {capture.rawImagePath ? (
          <Image
            source={{
              uri: capture.rawImagePath.startsWith('file://') || capture.rawImagePath.startsWith('http')
                ? capture.rawImagePath
                : `file://${capture.rawImagePath}`,
            }}
            style={styles.capturedImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.mockImagePlaceholder}>
            <Text style={styles.mockImageText}>RAW IMAGE</Text>
          </View>
        )}
        <Text style={styles.pathText} numberOfLines={1} ellipsizeMode="middle">
          Path: {capture.rawImagePath}
        </Text>
      </Card>

      {capture.enhancedImagePath && (
        <Card style={styles.imageCard}>
          <Image
            source={{
              uri: capture.enhancedImagePath.startsWith('file://') || capture.enhancedImagePath.startsWith('http')
                ? capture.enhancedImagePath
                : `file://${capture.enhancedImagePath}`,
            }}
            style={styles.capturedImage}
            resizeMode="cover"
          />
          <Text style={styles.pathText} numberOfLines={1} ellipsizeMode="middle">
            Path: {capture.enhancedImagePath}
          </Text>
        </Card>
      )}

      <Text style={styles.sectionTitle}>Actions</Text>
      <View style={styles.actionGrid}>
        <Card style={styles.actionItem}>
          <Text style={styles.statusLabel}>Enhancement</Text>
          <Text style={styles.statusValue}>{capture.enhancementStatus.toUpperCase()}</Text>
          {(capture.enhancementStatus === 'not_started' || capture.enhancementStatus === 'failed') && (
            <Button title="Run AI Enhance" onPress={handleEnhance} size="small" style={styles.actionBtn} />
          )}
        </Card>

        <Card style={styles.actionItem}>
          <Text style={styles.statusLabel}>Upload to S3</Text>
          <Text style={styles.statusValue}>{capture.uploadStatus.toUpperCase()}</Text>
          {(capture.uploadStatus === 'pending' || capture.uploadStatus === 'failed') && (
            <Button title="Queue Upload" onPress={handleUpload} size="small" style={styles.actionBtn} />
          )}
        </Card>
      </View>

      <Button title="Back to Session" variant="outline" onPress={() => navigation.goBack()} style={{ marginTop: theme.spacing.xl }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background },
  errorText: { color: theme.colors.text, marginBottom: theme.spacing.md },
  content: { padding: theme.spacing.lg },
  title: { fontSize: theme.typography.sizes.xl, fontWeight: 'bold', color: theme.colors.text },
  timestamp: { fontSize: theme.typography.sizes.sm, color: theme.colors.textSecondary, marginBottom: theme.spacing.lg },
  imageCard: { padding: 0, overflow: 'hidden', marginBottom: theme.spacing.lg },
  capturedImage: { width: '100%', height: 250, backgroundColor: '#1e293b' },
  mockImagePlaceholder: { width: '100%', height: 250, backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center' },
  mockImageText: { color: '#64748b', fontWeight: 'bold', letterSpacing: 2 },
  pathText: { padding: theme.spacing.sm, fontSize: 10, color: theme.colors.textSecondary },
  sectionTitle: { fontSize: theme.typography.sizes.md, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: theme.spacing.sm },
  actionGrid: { flexDirection: 'row', gap: theme.spacing.md },
  actionItem: { flex: 1, alignItems: 'center' },
  statusLabel: { color: theme.colors.textSecondary, fontSize: theme.typography.sizes.xs },
  statusValue: { color: theme.colors.text, fontSize: theme.typography.sizes.sm, fontWeight: 'bold', marginVertical: theme.spacing.sm },
  actionBtn: { width: '100%' },
});

export default ImageReviewScreen;
