import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  Easing,
  FadeInDown,
  FadeInUp,
} from 'react-native-reanimated';
import { useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  usePhotoOutput,
} from 'react-native-vision-camera';

import { AppNavigationProp, RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme';
import { EyeSelector, PrimaryButton } from '../components';
import { EyeSide } from '../models/types';
import { FileService } from '../services/FileService';
import { dbService } from '../database/SQLiteService';
import { useAppStore } from '../store/useAppStore';
import { AIEnhancementService } from '../services/AIEnhancementService';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const CameraScreen = () => {
  const isFocused = useIsFocused();
  const navigation = useNavigation<AppNavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'Camera'>>();
  const { sessionId } = route.params;
  const { theme } = useTheme();

  const session = useAppStore((state) => state.currentSession);
  const addSessionCapture = useAppStore((state) => state.addSessionCapture);

  const camera = useRef<any>(null);
  const photoOutput = usePhotoOutput();

  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();

  const minZoom = device?.minZoom ?? 1;
  const maxZoom = device ? Math.min(device.maxZoom ?? 5, 5) : 5;

  const [selectedEye, setSelectedEye] = useState<EyeSide>('left');
  const [isCapturing, setIsCapturing] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [flashMode, setFlashMode] = useState<'off' | 'on' | 'auto'>('on');

  // Reanimated Shared Values
  const reticleScale = useSharedValue(1);
  const reticleOpacity = useSharedValue(0.7);
  const shutterScale = useSharedValue(1);

  useEffect(() => {
    if (!hasPermission) {
      requestPermission().catch((err) => {
        console.warn('Camera permission request failed:', err);
      });
    }
  }, [hasPermission, requestPermission]);

  // Reticle Pulse Animation
  useEffect(() => {
    reticleScale.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(1.0, { duration: 1200, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    reticleOpacity.value = withRepeat(
      withSequence(
        withTiming(1.0, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.6, { duration: 1200, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, [reticleScale, reticleOpacity]);

  const animatedReticleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: reticleScale.value }],
    opacity: reticleOpacity.value,
  }));

  const animatedShutterStyle = useAnimatedStyle(() => ({
    transform: [{ scale: shutterScale.value }],
  }));

  const handleShutterPressIn = () => {
    if (!isCapturing) {
      shutterScale.value = withSpring(0.88, { damping: 15, stiffness: 300 });
    }
  };

  const handleShutterPressOut = () => {
    if (!isCapturing) {
      shutterScale.value = withSpring(1, { damping: 15, stiffness: 300 });
    }
  };

  const toggleTorch = () => {
    if (!isCameraReady) return;
    setIsTorchOn((prev) => !prev);
  };

  const toggleFlash = () => {
    setFlashMode((prev) => {
      if (prev === 'off') return 'on';
      if (prev === 'on') return 'auto';
      return 'off';
    });
  };

  const handleZoomIn = () => {
    if (!isCameraReady) return;
    setZoom((prev) => {
      if (prev >= maxZoom) return prev;
      return Number(Math.min(prev + 0.5, maxZoom).toFixed(1));
    });
  };

  const handleZoomOut = () => {
    if (!isCameraReady) return;
    setZoom((prev) => {
      if (prev <= minZoom) return prev;
      return Number(Math.max(prev - 0.5, minZoom).toFixed(1));
    });
  };

  const handleCapture = async () => {
    if (!session || !device) return;

    setIsCapturing(true);
    try {

      const photoFile =
        photoOutput && typeof photoOutput.capturePhotoToFile === 'function'
          ? await photoOutput.capturePhotoToFile(
              { flashMode: isTorchOn ? 'off' : flashMode },
              {}
            )
          : null;

      const tempPath = photoFile?.filePath || (photoFile as any)?.path;
      if (!tempPath) throw new Error('Camera capture failed: Invalid photo output path');
      const finalPath = FileService.generateRawFilePath(sessionId, selectedEye);

      const moved = await FileService.moveFileToPermanentStorage(tempPath, finalPath);
      if (!moved) {
        throw new Error('Failed to move captured image to permanent storage.');
      }

      const currentPatient = useAppStore.getState().currentPatient;
      const metadataPayload = {
        patientId: session.patientId,
        patientName: currentPatient?.name || 'Unknown',
        patientDob: currentPatient?.dob || '',
        patientGender: currentPatient?.gender || '',
        sessionId,
        eyeSide: selectedEye,
        captureTime: new Date().toISOString(),
        zoomLevel: zoom,
        torchMode: isTorchOn ? 'on' : 'off',
        flashMode,
        deviceModel: device.name || 'Camera Device',
      };


      const newCapture = {
        id: `img_${Date.now()}`,
        sessionId,
        patientId: session.patientId,
        eyeSide: selectedEye,
        rawImagePath: finalPath,
        captureTime: metadataPayload.captureTime,
        uploadStatus: 'pending' as const,
        enhancementStatus: 'not_started' as const,
        metadata: JSON.stringify(metadataPayload),
      };

      await dbService.addCapturedImage(newCapture);
      addSessionCapture(newCapture);

      AIEnhancementService.queueEnhancement(newCapture.id, finalPath);

      navigation.replace('ImageReview', { imageId: newCapture.id });
    } catch (error) {
      console.error('Failed to capture image', error);
      Alert.alert('Error', 'Capture failed. Please try again.');
    } finally {
      setIsCapturing(false);
    }
  };

  const handleClose = () => {
    navigation.goBack();
  };

  if (!hasPermission) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.errorText, { color: theme.colors.text }]}>Camera permission is required.</Text>
        <PrimaryButton title="Grant Permission" onPress={() => requestPermission()} style={{ marginBottom: 12 }} />
        <PrimaryButton title="Go Back" onPress={handleClose} />
      </View>
    );
  }

  if (device == null) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.errorText, { color: theme.colors.textSecondary, marginTop: 12 }]}>
          Initializing Medical Viewfinder...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Viewfinder */}
      <Camera
        ref={camera}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isFocused}
        outputs={[photoOutput]}
        onPreviewStarted={() => setIsCameraReady(true)}
        onPreviewStopped={() => setIsCameraReady(false)}
        zoom={isFocused && isCameraReady ? zoom : undefined}
        torchMode={isFocused && isCameraReady ? (isTorchOn ? 'on' : 'off') : undefined}
      />

      {/* Ophthalmic Alignment Target Overlay with Reanimated Pulse */}
      <View style={styles.reticleContainer} pointerEvents="none">
        <Animated.View
          style={[
            styles.reticleOuterRing,
            { borderColor: 'rgba(14, 165, 233, 0.6)', backgroundColor: 'rgba(14, 165, 233, 0.05)' },
            animatedReticleStyle,
          ]}
        >
          <View style={[styles.reticleInnerDot, { backgroundColor: theme.colors.primary }]} />
          <View style={[styles.reticleLine, styles.reticleTopLine, { backgroundColor: theme.colors.primary }]} />
          <View style={[styles.reticleLine, styles.reticleBottomLine, { backgroundColor: theme.colors.primary }]} />
          <View style={[styles.reticleLine, styles.reticleLeftLine, { backgroundColor: theme.colors.primary }]} />
          <View style={[styles.reticleLine, styles.reticleRightLine, { backgroundColor: theme.colors.primary }]} />
        </Animated.View>
      </View>

      {/* Glassmorphism Top HUD Bar */}
      <Animated.View
        entering={FadeInDown.duration(400)}
        style={[styles.topHeaderBar, theme.glassmorphism.glassHeader]}
      >
        <TouchableOpacity style={styles.circularHeaderBtn} onPress={handleClose}>
          <Text style={styles.headerBtnText}>✕</Text>
        </TouchableOpacity>

        <View style={styles.titleContainer}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Fundus Medical HUD</Text>
          <Text style={[styles.headerSubtitle, { color: theme.colors.primary }]}>
            {selectedEye === 'left' ? 'OS — Left Eye' : 'OD — Right Eye'}
          </Text>
        </View>

        <View style={styles.headerRightGroup}>
          <TouchableOpacity
            style={[
              styles.headerControlPill,
              isTorchOn && { backgroundColor: theme.colors.warning },
            ]}
            onPress={toggleTorch}
          >
            <Text style={[styles.controlPillText, isTorchOn && { color: '#000' }]}>
              ⚡ {isTorchOn ? 'TORCH ON' : 'TORCH'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.headerControlPill,
              flashMode !== 'off' && { backgroundColor: 'rgba(14, 165, 233, 0.3)' },
              { marginLeft: 6 },
            ]}
            onPress={toggleFlash}
          >
            <Text style={styles.controlPillText}>📸 {flashMode.toUpperCase()}</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Active Torch Illumination Banner */}
      {isTorchOn && (
        <Animated.View entering={FadeInDown.duration(300)} style={styles.activeTorchBanner}>
          <Text style={styles.activeTorchBannerText}>⚡ CONSTANT ILLUMINATION ACTIVE</Text>
        </Animated.View>
      )}

      {/* Bottom Medical Control Dock */}
      <Animated.View
        entering={FadeInUp.duration(400)}
        style={[styles.bottomDock, theme.glassmorphism.glassHeader]}
      >
        {/* Segmented Eye Selector Toggle */}
        <View style={styles.eyeSelectorDockWrapper}>
          <EyeSelector selectedEye={selectedEye} onSelectEye={setSelectedEye} />
        </View>

        {/* Zoom Controls & Chips */}
        <View style={styles.zoomPresetRow}>
          <TouchableOpacity style={styles.zoomStepBtn} onPress={handleZoomOut}>
            <Text style={styles.zoomStepText}>-</Text>
          </TouchableOpacity>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.zoomPresetsScroll}>
            {[1, 1.5, 2, 3, 5].map((zVal) => (
              <TouchableOpacity
                key={zVal}
                style={[
                  styles.zoomChip,
                  Math.abs(zoom - zVal) < 0.2 && { backgroundColor: theme.colors.primary },
                ]}
                onPress={() => isCameraReady && setZoom(Math.min(Math.max(zVal, minZoom), maxZoom))}
              >
                <Text style={[styles.zoomChipText, Math.abs(zoom - zVal) < 0.2 && styles.zoomChipTextActive]}>
                  {zVal.toFixed(1)}x
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity style={styles.zoomStepBtn} onPress={handleZoomIn}>
            <Text style={styles.zoomStepText}>+</Text>
          </TouchableOpacity>
        </View>

        {/* Reanimated Shutter Button Row */}
        <View style={styles.shutterRow}>
          <View style={{ width: 60 }} />

          <AnimatedPressable
            onPress={isCapturing ? undefined : handleCapture}
            onPressIn={handleShutterPressIn}
            onPressOut={handleShutterPressOut}
            disabled={isCapturing}
            style={[
              styles.outerShutterRing,
              { borderColor: theme.colors.primary },
              isCapturing && styles.shutterDisabled,
              animatedShutterStyle,
            ]}
          >
            <View style={[styles.innerShutterButton, { backgroundColor: theme.colors.text }]} />
          </AnimatedPressable>

          <View style={styles.sessionCounterContainer}>
            <Text style={[styles.sessionCounterNum, { color: theme.colors.text }]}>
              {useAppStore.getState().sessionCaptures.length}
            </Text>
            <Text style={[styles.sessionCounterLabel, { color: theme.colors.textSecondary }]}>Captured</Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  errorText: {
    marginBottom: 20,
    textAlign: 'center',
    fontSize: 16,
  },
  reticleContainer: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reticleOuterRing: {
    width: 230,
    height: 230,
    borderRadius: 115,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reticleInnerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  reticleLine: {
    position: 'absolute',
  },
  reticleTopLine: { top: 12, width: 2, height: 22 },
  reticleBottomLine: { bottom: 12, width: 2, height: 22 },
  reticleLeftLine: { left: 12, width: 22, height: 2 },
  reticleRightLine: { right: 12, width: 22, height: 2 },
  topHeaderBar: {
    position: 'absolute',
    top: 44,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 24,
  },
  circularHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  titleContainer: { alignItems: 'center' },
  headerTitle: { fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  headerSubtitle: { fontSize: 11, fontWeight: '600' },
  headerRightGroup: { flexDirection: 'row', alignItems: 'center' },
  headerControlPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  controlPillText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  activeTorchBanner: {
    position: 'absolute',
    top: 106,
    alignSelf: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.95)',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 12,
  },
  activeTorchBannerText: { color: '#000', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  bottomDock: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 16,
    paddingBottom: 32,
    paddingHorizontal: 20,
  },
  eyeSelectorDockWrapper: {
    marginBottom: 14,
  },
  zoomPresetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  zoomStepBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomStepText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  zoomPresetsScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  zoomChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginHorizontal: 4,
  },
  zoomChipText: { color: '#94A3B8', fontSize: 12, fontWeight: '700' },
  zoomChipTextActive: { color: '#fff' },
  shutterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  outerShutterRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  shutterDisabled: { opacity: 0.5 },
  innerShutterButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  sessionCounterContainer: { width: 60, alignItems: 'center' },
  sessionCounterNum: { fontSize: 16, fontWeight: 'bold' },
  sessionCounterLabel: { fontSize: 10 },
});

export default CameraScreen;
