import React from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { theme } from '../constants/theme';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { UploadService } from '../services/UploadService';

const SettingsScreen = () => {

  const handleRetryUploads = async () => {
    await UploadService.retryFailedUploads();
    Alert.alert('Success', 'Retry command sent to background queue.');
  };

  const clearLocalDatabase = () => {
    Alert.alert('Wipe Database', 'This would drop SQLite tables and clear caches.');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Sync Settings</Text>
      <Card style={styles.card}>
        <Text style={styles.description}>
          Manually trigger the background synchronization queue to push pending images to AWS S3 / Backend.
        </Text>
        <Button title="Force Sync Uploads" onPress={handleRetryUploads} />
      </Card>

      <Text style={styles.sectionTitle}>AI Enhancement Pipeline</Text>
      <Card style={styles.card}>
        <Text style={styles.description}>
          The AI Enhancement pipeline runs automatically for queued images. Ensure the device is connected to power for optimal performance if processing locally.
        </Text>
      </Card>

      <Text style={styles.sectionTitle}>Danger Zone</Text>
      <Card style={[styles.card, { borderColor: theme.colors.danger }]}>
        <Text style={styles.description}>
          Clear all local metadata. Raw images will remain on disk until manually deleted.
        </Text>
        <Button title="Wipe Database" variant="danger" onPress={clearLocalDatabase} />
      </Card>
      
      <Text style={styles.version}>App Version 1.0.0</Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg },
  sectionTitle: { fontSize: theme.typography.sizes.md, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: theme.spacing.sm, marginTop: theme.spacing.md },
  card: { marginBottom: theme.spacing.xl },
  description: { color: theme.colors.text, marginBottom: theme.spacing.md, lineHeight: 20 },
  version: { textAlign: 'center', color: theme.colors.textSecondary, marginTop: theme.spacing.xl },
});

export default SettingsScreen;
