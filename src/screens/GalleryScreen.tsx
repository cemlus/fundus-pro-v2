import React from 'react';
import { View, Text, StyleSheet, FlatList, Alert } from 'react-native';
import { theme } from '../constants/theme';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { useNavigation } from '@react-navigation/native';
import { AppNavigationProp } from '../navigation/types';

// Mock data for the gallery since we are abstracting the SQLite reads
const MOCK_HISTORY = [
  { id: '1', patientName: 'John Doe', date: '2023-10-01', images: 4, uploadStatus: 'uploaded' },
  { id: '2', patientName: 'Jane Smith', date: '2023-10-02', images: 2, uploadStatus: 'pending' },
];

const GalleryScreen = () => {
  const navigation = useNavigation<AppNavigationProp>();

  const renderItem = ({ item }: { item: typeof MOCK_HISTORY[0] }) => (
    <Card style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.patientName}>{item.patientName}</Text>
        <Text style={styles.date}>{item.date}</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.details}>{item.images} Captures</Text>
        <Text style={[styles.status, item.uploadStatus === 'uploaded' ? styles.statusSuccess : styles.statusWarning]}>
          Sync: {item.uploadStatus}
        </Text>
      </View>
      <Button 
        title="View Details" 
        variant="outline" 
        size="small" 
        onPress={() => Alert.alert('Info', 'View historical session not implemented in mock.')} 
      />
    </Card>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={MOCK_HISTORY}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No historical sessions found.</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  listContent: { padding: theme.spacing.lg },
  card: { marginBottom: theme.spacing.md },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: theme.spacing.xs },
  patientName: { fontSize: theme.typography.sizes.md, fontWeight: 'bold', color: theme.colors.text },
  date: { fontSize: theme.typography.sizes.sm, color: theme.colors.textSecondary },
  cardBody: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: theme.spacing.md },
  details: { color: theme.colors.textSecondary },
  status: { fontWeight: 'bold' },
  statusSuccess: { color: theme.colors.success },
  statusWarning: { color: theme.colors.warning },
  emptyContainer: { alignItems: 'center', marginTop: theme.spacing.xxl },
  emptyText: { color: theme.colors.textSecondary },
});

export default GalleryScreen;
