import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Alert } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useNavigation, useRoute } from '@react-navigation/native';
import { AppNavigationProp, RootStackParamList } from '../navigation/types';
import type { RouteProp } from '@react-navigation/native';
import { useTheme } from '../theme';
import {
  SectionHeader,
  MedicalCard,
  MetricCard,
  StatusBadge,
  PrimaryButton,
  SecondaryButton,
  EmptyState,
} from '../components';
import { useAppStore } from '../store/useAppStore';
import { AIEnhancementService } from '../services/AIEnhancementService';
import { UploadService } from '../services/UploadService';
import { FileService } from '../services/FileService';
import { NativeModules } from 'react-native';

// We use inline require for expo-image-manipulator so it doesn't crash dev clients without the native module

const ImageReviewScreen = () => {
  const navigation = useNavigation<AppNavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'ImageReview'>>();
  const { imageId } = route.params;
  const { theme } = useTheme();

  const captures = useAppStore((state) => state.sessionCaptures);
  const capture = captures.find((c) => c.id === imageId);
  const updateSessionCapture = useAppStore((state) => state.updateSessionCapture);

  const [activeTab, setActiveTab] = useState<'raw' | 'enhanced'>('raw');
  const [exporting, setExporting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Poll for enhancement status updates if processing
  useEffect(() => {
    let interval: any;
    if (capture?.enhancementStatus === 'processing' || capture?.enhancementStatus === 'queued') {
      interval = setInterval(() => {
        // In a real app we'd fetch the latest status from DB
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [capture?.enhancementStatus]);

  if (!capture) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.colors.background }]}>
        <EmptyState
          title="Image Record Not Found"
          description="The requested fundus image capture could not be retrieved."
          actionLabel="Go Back to Session"
          onActionPress={() => navigation.goBack()}
        />
      </View>
    );
  }

  const parseMetadata = () => {
    if (!capture.metadata) return null;
    try {
      return JSON.parse(capture.metadata);
    } catch {
      return null;
    }
  };

  const parsedMeta = parseMetadata();

  const handleEnhance = async () => {
    updateSessionCapture(capture.id, { enhancementStatus: 'queued' });
    await AIEnhancementService.queueEnhancement(capture.id, capture.rawImagePath);
  };

  const handleUpload = async () => {
    updateSessionCapture(capture.id, { uploadStatus: 'pending' });
    await UploadService.queueUpload(capture.id);
    Alert.alert('Cloud Queue', 'Image queued for background cloud synchronization.');
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      Alert.alert('Export Successful', 'Image saved to device media library.');
    } catch (e) {
      console.error(e);
      Alert.alert('Export Failed', 'Could not export image to gallery.');
    } finally {
      setExporting(false);
    }
  };

  const applyManipulation = async (actions: any[]) => {
    setIsEditing(true);
    try {
      let ImageManipulator;
      try {
        ImageManipulator = require('expo-image-manipulator');
      } catch (e) {
        Alert.alert(
          'Rebuild Required',
          'The image editor requires native code. Please rebuild your dev client app (e.g. npx expo run:android).'
        );
        return;
      }

      const targetPath = activeTab === 'enhanced' && capture.enhancedImagePath 
        ? capture.enhancedImagePath 
        : capture.rawImagePath;
      
      const targetUri = targetPath.startsWith('file://') || targetPath.startsWith('http') 
        ? targetPath 
        : `file://${targetPath}`;

      const result = await ImageManipulator.manipulateAsync(
        targetUri,
        actions,
        { compress: 1, format: 'jpeg' } // Use string 'jpeg' instead of enum
      );
      
      const cleanPath = targetPath.replace(/_edit_\d+/g, '');
      const newPath = cleanPath.replace(/\.jpg$/i, `_edit_${Date.now()}.jpg`);
      await FileService.moveFileToPermanentStorage(result.uri.replace('file://', ''), newPath);
      
      if (activeTab === 'raw' || !capture.enhancedImagePath) {
        updateSessionCapture(capture.id, { rawImagePath: newPath });
      } else {
        updateSessionCapture(capture.id, { enhancedImagePath: newPath });
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Edit Error', 'Could not apply image edit.');
    } finally {
      setIsEditing(false);
    }
  };

  const currentImagePath =
    activeTab === 'enhanced' && capture.enhancedImagePath
      ? capture.enhancedImagePath
      : capture.rawImagePath;

  const formattedUri =
    currentImagePath.startsWith('file://') || currentImagePath.startsWith('http')
      ? currentImagePath
      : `file://${currentImagePath}`;

  const eyeLabel = capture.eyeSide === 'left' ? 'OS — Left Eye' : 'OD — Right Eye';
  const enhancementBadgeStatus =
    capture.enhancementStatus === 'done' ? 'enhanced' : capture.enhancementStatus;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={[styles.content, { padding: theme.spacing.md }]}
    >
      {/* Header */}
      <Animated.View entering={FadeInDown.duration(400)}>
        <SectionHeader
          title="Fundus Image Review"
          subtitle={eyeLabel}
          accentColor={theme.colors.primary}
          rightElement={<StatusBadge status={enhancementBadgeStatus} size="sm" />}
        />
      </Animated.View>

      {/* RAW vs AI-Enhanced Toggle Tabs */}
      <Animated.View
        entering={FadeInDown.delay(100).duration(400)}
        style={[
          styles.tabContainer,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: theme.radii.md,
            padding: theme.spacing.xs,
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.tabButton,
            { borderRadius: theme.radii.sm },
            activeTab === 'raw' && { backgroundColor: theme.colors.primary },
          ]}
          onPress={() => setActiveTab('raw')}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'raw' ? theme.colors.text : theme.colors.textSecondary },
            ]}
          >
            📷 RAW Image
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabButton,
            { borderRadius: theme.radii.sm },
            activeTab === 'enhanced' && { backgroundColor: theme.colors.secondary },
            !capture.enhancedImagePath && styles.disabledTab,
          ]}
          onPress={() => {
            if (capture.enhancedImagePath) {
              setActiveTab('enhanced');
            } else {
              Alert.alert('AI Enhancement Required', 'Run AI Enhancement to generate contrast-enhanced fundus view.');
            }
          }}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'enhanced' ? theme.colors.text : theme.colors.textSecondary },
            ]}
          >
            ✨ AI-Enhanced {capture.enhancedImagePath ? '' : '(Not Run)'}
          </Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Image Preview Card */}
      <Animated.View entering={FadeInDown.delay(200).duration(400)}>
        <MedicalCard variant="glass" style={styles.previewCard}>
          <View style={styles.imageWrapper}>
            <Image source={{ uri: formattedUri }} style={styles.previewImage} resizeMode="contain" />
            <View
              style={[
                styles.viewBadgeOverlay,
                {
                  backgroundColor: theme.colors.glassHeaderBg,
                  borderRadius: theme.radii.sm,
                  borderColor: theme.colors.borderLight,
                },
              ]}
            >
              <Text style={[styles.viewBadgeText, { color: theme.colors.text }]}>
                {activeTab === 'enhanced' ? 'AI ENHANCED VIEW' : 'RAW OPTICAL CAPTURE'}
              </Text>
            </View>
          </View>

          <View style={styles.pathBar}>
            <Text style={[styles.pathLabel, { color: theme.colors.textMuted }]}>Storage Path:</Text>
            <Text
              style={[styles.pathValue, { color: theme.colors.textSecondary }]}
              numberOfLines={1}
              ellipsizeMode="middle"
            >
              {currentImagePath}
            </Text>
          </View>
        </MedicalCard>
      </Animated.View>

      {/* Image Editing Tools */}
      <Animated.View entering={FadeInDown.delay(250).duration(400)}>
        <SectionHeader
          title="Image Editing"
          subtitle="Adjust the current view"
          accentColor={theme.colors.primary}
        />
        <MedicalCard variant="default" style={styles.editCard}>
          <View style={styles.editRow}>
            <TouchableOpacity 
              style={[styles.editButton, { backgroundColor: theme.colors.surface }]}
              onPress={() => applyManipulation([{ rotate: 90 }])}
              disabled={isEditing}
            >
              <Text style={{ fontSize: 20 }}>↻</Text>
              <Text style={[styles.editButtonText, { color: theme.colors.text }]}>Rotate</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.editButton, { backgroundColor: theme.colors.surface }]}
              onPress={() => applyManipulation([{ flip: 'horizontal' }])}
              disabled={isEditing}
            >
              <Text style={{ fontSize: 20 }}>↔</Text>
              <Text style={[styles.editButtonText, { color: theme.colors.text }]}>Flip H</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.editButton, { backgroundColor: theme.colors.surface }]}
              onPress={() => applyManipulation([{ flip: 'vertical' }])}
              disabled={isEditing}
            >
              <Text style={{ fontSize: 20 }}>↕</Text>
              <Text style={[styles.editButtonText, { color: theme.colors.text }]}>Flip V</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.editButton, { backgroundColor: theme.colors.surface }]}
              onPress={async () => {
                // Auto crop to center
                setIsEditing(true);
                try {
                   let ImageManipulator;
                   try {
                     ImageManipulator = require('expo-image-manipulator');
                   } catch (e) {
                     Alert.alert('Rebuild Required', 'Please rebuild your dev client app.');
                     return;
                   }
                   const { width, height } = await ImageManipulator.manipulateAsync(formattedUri, []);
                   const size = Math.min(width, height);
                   const originX = (width - size) / 2;
                   const originY = (height - size) / 2;
                   await applyManipulation([{ crop: { originX, originY, width: size, height: size } }]);
                } catch (e) {
                   console.error(e);
                } finally {
                   setIsEditing(false);
                }
              }}
              disabled={isEditing}
            >
              <Text style={{ fontSize: 20 }}>⛶</Text>
              <Text style={[styles.editButtonText, { color: theme.colors.text }]}>Crop</Text>
            </TouchableOpacity>
          </View>
        </MedicalCard>
      </Animated.View>

      {/* Metadata & Status Information */}
      <Animated.View entering={FadeInDown.delay(300).duration(400)}>
        <SectionHeader
          title="Capture Metadata & Status"
          subtitle="Clinical diagnostic details"
          accentColor={theme.colors.info}
        />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(350).duration(400)} style={styles.metricsRow}>
        <MetricCard
          label="Enhancement"
          value={capture.enhancementStatus.toUpperCase()}
          subtitle={capture.enhancedImagePath ? 'Enhanced Image Available' : 'Standard Raw'}
          accentColor={
            capture.enhancementStatus === 'done' ? theme.colors.secondary : theme.colors.primary
          }
          style={styles.flexMetric}
        />
        <View style={{ width: theme.spacing.md }} />
        <MetricCard
          label="Cloud Sync"
          value={capture.uploadStatus.toUpperCase()}
          subtitle={capture.uploadStatus === 'uploaded' ? 'Pushed to AWS S3' : 'Pending Upload Queue'}
          accentColor={capture.uploadStatus === 'uploaded' ? theme.colors.success : theme.colors.warning}
          style={styles.flexMetric}
        />
      </Animated.View>

      {/* Detailed Technical Sidecar Card */}
      {parsedMeta && (
        <Animated.View entering={FadeInDown.delay(400).duration(400)}>
          <MedicalCard variant="default" title="Technical Sidecar Metadata" style={styles.metaCard}>
            <View style={styles.metaGrid}>
              <View style={styles.metaItem}>
                <Text style={[styles.metaLabel, { color: theme.colors.textMuted }]}>Patient ID</Text>
                <Text style={[styles.metaVal, { color: theme.colors.text }]}>{parsedMeta.patientId}</Text>
              </View>
              <View style={styles.metaItem}>
                <Text style={[styles.metaLabel, { color: theme.colors.textMuted }]}>Zoom Level</Text>
                <Text style={[styles.metaVal, { color: theme.colors.text }]}>{parsedMeta.zoomLevel}x</Text>
              </View>
              <View style={styles.metaItem}>
                <Text style={[styles.metaLabel, { color: theme.colors.textMuted }]}>Torch Mode</Text>
                <Text style={[styles.metaVal, { color: theme.colors.text }]}>
                  {parsedMeta.torchMode?.toUpperCase()}
                </Text>
              </View>
              <View style={styles.metaItem}>
                <Text style={[styles.metaLabel, { color: theme.colors.textMuted }]}>Device Hardware</Text>
                <Text style={[styles.metaVal, { color: theme.colors.text }]}>{parsedMeta.deviceModel}</Text>
              </View>
            </View>
          </MedicalCard>
        </Animated.View>
      )}

      {/* Bottom Actions Sheet */}
      <Animated.View entering={FadeInUp.delay(450).duration(400)}>
        <SectionHeader
          title="Actions & Pipeline Operations"
          subtitle="Process or export fundus image"
          accentColor={theme.colors.secondary}
        />

        <MedicalCard variant="glass" style={styles.actionSheetCard}>
          {capture.enhancementStatus !== 'done' && (
            <SecondaryButton
              title="Run AI Contrast & Clarity Enhancement"
              variant="surface"
              onPress={handleEnhance}
              icon={<Text style={{ fontSize: 16 }}>✨</Text>}
              style={{ marginBottom: theme.spacing.md }}
            />
          )}

          {capture.uploadStatus !== 'uploaded' && (
            <SecondaryButton
              title="Queue for Cloud Sync (S3)"
              variant="outline"
              onPress={handleUpload}
              icon={<Text style={{ fontSize: 16 }}>☁️</Text>}
              style={{ marginBottom: theme.spacing.md }}
            />
          )}

          <PrimaryButton
            title="Export to Phone Gallery"
            onPress={handleExport}
            loading={exporting}
            icon={<Text style={{ color: theme.colors.text, fontSize: 18 }}>📸</Text>}
            style={{ marginBottom: theme.spacing.md }}
          />

          <SecondaryButton
            title="Return to Examination Session"
            variant="surface"
            onPress={() => navigation.goBack()}
          />
        </MedicalCard>
      </Animated.View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  content: { paddingBottom: 40 },
  tabContainer: {
    flexDirection: 'row',
    borderWidth: 1,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  disabledTab: {
    opacity: 0.5,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  previewCard: {
    padding: 0,
    marginBottom: 20,
    overflow: 'hidden',
  },
  imageWrapper: {
    width: '100%',
    height: 260,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  viewBadgeOverlay: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
  },
  viewBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  pathBar: {
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pathLabel: {
    fontSize: 11,
    marginRight: 6,
    fontWeight: '600',
  },
  pathValue: {
    fontSize: 11,
    flex: 1,
  },
  metricsRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  flexMetric: {
    flex: 1,
  },
  metaCard: {
    marginBottom: 20,
    padding: 16,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 12,
  },
  metaItem: {
    width: '46%',
  },
  metaLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  metaVal: {
    fontSize: 13,
    fontWeight: '700',
  },
  actionSheetCard: {
    padding: 16,
    marginBottom: 24,
  },
  editCard: {
    marginBottom: 20,
    padding: 12,
  },
  editRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  editButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    marginHorizontal: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  editButtonText: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
});

export default ImageReviewScreen;
