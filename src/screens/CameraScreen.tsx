import React, { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, TouchableWithoutFeedback, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { AppNavigationProp, RootStackParamList } from '../navigation/types';
import type { RouteProp } from '@react-navigation/native';
import { Camera } from 'react-native-vision-camera';
import { theme } from '../constants/theme';
import { Button } from '../components/Button';
import { EyeSelector } from '../components/EyeSelector';
import { EyeSide } from '../models/types';
import { FileService } from '../services/FileService';
import { dbService } from '../database/SQLiteService';
import { useAppStore } from '../store/useAppStore';
import { AIEnhancementService } from '../services/AIEnhancementService';

const CameraScreen = () => {
  const navigation = useNavigation<AppNavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'Camera'>>();
  const { sessionId } = route.params;

  const session = useAppStore(state => state.currentSession);
  const addSessionCapture = useAppStore(state => state.addSessionCapture);

  const camera = useRef<Camera>(null);
  const [device, setDevice] = useState<any>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [selectedEye, setSelectedEye] = useState<EyeSide>('left');
  const [isCapturing, setIsCapturing] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [isTorchOn, setIsTorchOn] = useState(false);
  
  // Track layout dimensions for tap-to-focus normalization
  const [previewLayout, setPreviewLayout] = useState({ width: 1, height: 1 });

  const toggleTorch = () => {
    setIsTorchOn(prev => !prev);
  };

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.5, 5)); // max zoom 5x
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.5, 1)); // min zoom 1x
  
  useEffect(() => {
    (async () => {
      const status = await Camera.requestCameraPermission();
      setHasPermission(status === 'granted');
    })();
  }, []);

  useEffect(() => {
    // Dynamic Device Selector with Fallbacks
    const availableDevices = Camera.getAvailableCameraDevices();
    
    // 1. Look for Telephoto lens first (optimal optical zoom for retinal imaging)
    const telephoto = availableDevices.find(
      d => d.position === 'back' && d.physicalDevices.includes('telephoto-camera')
    );
    if (telephoto) {
      setDevice(telephoto);
      return;
    }

    // 2. Fallback to Wide-Angle lens
    const wideAngle = availableDevices.find(
      d => d.position === 'back' && d.physicalDevices.includes('wide-angle-camera')
    );
    if (wideAngle) {
      setDevice(wideAngle);
      return;
    }

    // 3. Fallback to any back camera
    const anyBack = availableDevices.find(d => d.position === 'back');
    if (anyBack) {
      setDevice(anyBack);
      return;
    }

    // 4. Ultimate fallback to first available device (front camera, simulator, etc.)
    if (availableDevices.length > 0) {
      setDevice(availableDevices[0]);
    }
  }, [hasPermission]);

  const handleFocusTap = async (event: any) => {
    if (!camera.current || !device) return;
    
    const { locationX, locationY } = event.nativeEvent;
    
    // Normalize coordinates between 0.0 (top-left) and 1.0 (bottom-right)
    const x = locationX / previewLayout.width;
    const y = locationY / previewLayout.height;

    try {
      await camera.current.focus({ x, y });
      console.log(`Manual focus triggered at normalized coordinates: (${x.toFixed(2)}, ${y.toFixed(2)})`);
    } catch (e) {
      console.log('Focus action unsupported or failed on this device:', e);
    }
  };

  const handleCapture = async () => {
    if (!session || !device) return;
    setIsCapturing(true);
    
    try {
      const photo = await camera.current?.takePhoto({
        flash: isTorchOn ? 'on' : 'off',
      });
      
      const tempPath = photo?.path || `/mock/temp/photo_${Date.now()}.jpg`;
      const finalPath = FileService.generateRawFilePath(sessionId, selectedEye);
      await FileService.moveFileToPermanentStorage(tempPath, finalPath);

      const newCapture = {
        id: `img_${Date.now()}`,
        sessionId,
        patientId: session.patientId,
        eyeSide: selectedEye,
        rawImagePath: finalPath,
        captureTime: new Date().toISOString(),
        uploadStatus: 'pending' as const,
        enhancementStatus: 'not_started' as const,
      };

      await dbService.addCapturedImage(newCapture);
      addSessionCapture(newCapture);
      
      // Trigger AI glare/contrast correction immediately
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
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Camera permission denied.</Text>
        <Button title="Go Back" onPress={handleClose} />
      </View>
    );
  }

  if (device == null) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.errorText, { marginTop: 10 }]}>Initializing Camera Device...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Tap-to-Focus Wrapper around Camera Viewport */}
      <TouchableWithoutFeedback onPress={handleFocusTap}>
        <View 
          style={styles.cameraPreview}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            setPreviewLayout({ width: width || 1, height: height || 1 });
          }}
        >
          <Camera
            ref={camera}
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={true}
            photo={true}
            zoom={zoom}
            torch={isTorchOn ? 'on' : 'off'}
          />
        </View>
      </TouchableWithoutFeedback>

      <View style={styles.overlayControls}>
        <View style={styles.topRow}>
          <TouchableOpacity style={styles.iconBtn} onPress={handleClose}>
            <Text style={styles.iconText}>✕</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={toggleTorch}>
            <Text style={styles.iconText}>Torch: {isTorchOn ? 'ON' : 'OFF'}</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.eyeSelectorWrapper}>
          <EyeSelector selectedEye={selectedEye} onSelectEye={setSelectedEye} />
        </View>
      </View>

      <View style={styles.bottomBar}>
        <View style={styles.zoomControls}>
          <TouchableOpacity style={styles.iconBtn} onPress={handleZoomOut}>
            <Text style={styles.iconText}>-</Text>
          </TouchableOpacity>
          <Text style={styles.zoomText}>{zoom.toFixed(1)}x</Text>
          <TouchableOpacity style={styles.iconBtn} onPress={handleZoomIn}>
            <Text style={styles.iconText}>+</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity 
          style={[styles.captureBtn, isCapturing && styles.captureBtnDisabled]} 
          onPress={handleCapture}
          disabled={isCapturing}
        >
          <View style={styles.captureBtnInner} />
        </TouchableOpacity>
        <View style={styles.bottomSpacer} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background },
  errorText: { color: theme.colors.text, marginBottom: theme.spacing.lg },
  cameraPreview: { flex: 1, backgroundColor: '#111' },
  overlayControls: { position: 'absolute', top: 50, left: 0, right: 0, paddingHorizontal: theme.spacing.lg },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  iconBtn: { paddingHorizontal: 15, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  iconText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  eyeSelectorWrapper: { marginTop: theme.spacing.lg, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: theme.radii.lg, padding: 4 },
  bottomBar: { height: 140, backgroundColor: '#000', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingBottom: 20 },
  zoomControls: { flexDirection: 'row', alignItems: 'center', width: 100, justifyContent: 'space-between' },
  zoomText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  bottomSpacer: { width: 100 },
  captureBtn: { width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center' },
  captureBtnDisabled: { opacity: 0.5 },
  captureBtnInner: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#fff' },
});

export default CameraScreen;
