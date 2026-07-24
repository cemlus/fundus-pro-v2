import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { useIsFocused, useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  usePhotoOutput,
} from "react-native-vision-camera";

import { AppNavigationProp, RootStackParamList } from "../navigation/types";
import { theme } from "../constants/theme";
import { Button } from "../components/Button";
import { EyeSelector } from "../components/EyeSelector";
import { EyeSide } from "../models/types";
import { FileService } from "../services/FileService";
import { dbService } from "../database/SQLiteService";
import { useAppStore } from "../store/useAppStore";
import { AIEnhancementService } from "../services/AIEnhancementService";

const CameraScreen = () => {
  const isFocused = useIsFocused();
  const navigation = useNavigation<AppNavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, "Camera">>();
  const { sessionId } = route.params;

  const session = useAppStore((state) => state.currentSession);
  const addSessionCapture = useAppStore((state) => state.addSessionCapture);

  const camera = useRef<any>(null);
  const photoOutput = usePhotoOutput();

  const device = useCameraDevice("back");
  const { hasPermission, requestPermission } = useCameraPermission();

  const minZoom = device?.minZoom ?? 1;
  const maxZoom = device ? Math.min(device.maxZoom ?? 5, 5) : 5;

  const [selectedEye, setSelectedEye] = useState<EyeSide>("left");
  const [isCapturing, setIsCapturing] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [flashMode, setFlashMode] = useState<"off" | "on" | "auto">("on");

  useEffect(() => {
    if (!hasPermission) {
      requestPermission().catch((err) => {
        console.warn("Camera permission request failed:", err);
      });
    }
  }, [hasPermission, requestPermission]);

  const toggleTorch = () => {
    if (!isCameraReady) return;
    setIsTorchOn((prev) => !prev);
  };

  const toggleFlash = () => {
    setFlashMode((prev) => {
      if (prev === "off") return "on";
      if (prev === "on") return "auto";
      return "off";
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
      let tempPath = `/mock/document/dir/mock_raw_${Date.now()}.jpg`;

      if (photoOutput && typeof photoOutput.capturePhotoToFile === 'function') {
        const photoFile = await photoOutput.capturePhotoToFile(
          { flashMode: isTorchOn ? "off" : flashMode },
          {}
        );
        if (photoFile?.filePath) {
          tempPath = photoFile.filePath;
        }
      }

      const finalPath = FileService.generateRawFilePath(sessionId, selectedEye);

      const moved = await FileService.moveFileToPermanentStorage(
        tempPath,
        finalPath,
      );
      if (!moved) {
        throw new Error("Failed to move captured image to permanent storage.");
      }

      const newCapture = {
        id: `img_${Date.now()}`,
        sessionId,
        patientId: session.patientId,
        eyeSide: selectedEye,
        rawImagePath: finalPath,
        captureTime: new Date().toISOString(),
        uploadStatus: "pending" as const,
        enhancementStatus: "not_started" as const,
      };

      await dbService.addCapturedImage(newCapture);
      addSessionCapture(newCapture);

      AIEnhancementService.queueEnhancement(newCapture.id, finalPath);

      navigation.replace("ImageReview", { imageId: newCapture.id });
    } catch (error) {
      console.error("Failed to capture image", error);
      Alert.alert("Error", "Capture failed. Please try again.");
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
        <Text style={styles.errorText}>Camera permission is required.</Text>
        <Button title="Grant Permission" onPress={() => requestPermission()} />
        <Button title="Go Back" onPress={handleClose} />
      </View>
    );
  }

  if (device == null) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.errorText, { marginTop: 10 }]}>
          Initializing Camera Device...
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
        torchMode={isFocused && isCameraReady ? (isTorchOn ? "on" : "off") : undefined}
      />

      {/* Ophthalmic Alignment Target Overlay */}
      <View style={styles.reticleContainer} pointerEvents="none">
        <View style={styles.reticleOuterRing}>
          <View style={styles.reticleInnerDot} />
          <View style={[styles.reticleLine, styles.reticleTopLine]} />
          <View style={[styles.reticleLine, styles.reticleBottomLine]} />
          <View style={[styles.reticleLine, styles.reticleLeftLine]} />
          <View style={[styles.reticleLine, styles.reticleRightLine]} />
        </View>
      </View>

      {/* Top Glass Header Bar */}
      <View style={styles.topHeaderBar}>
        <TouchableOpacity style={styles.circularHeaderBtn} onPress={handleClose}>
          <Text style={styles.headerBtnText}>✕</Text>
        </TouchableOpacity>

        <View style={styles.titleContainer}>
          <Text style={styles.headerTitle}>Fundus Capture</Text>
          <Text style={styles.headerSubtitle}>
            {selectedEye === 'left' ? 'Left Eye (OS)' : 'Right Eye (OD)'}
          </Text>
        </View>

        <View style={styles.headerRightGroup}>
          {/* Constant Torch Button */}
          <TouchableOpacity
            style={[
              styles.headerControlPill,
              isTorchOn && styles.constantTorchActivePill,
            ]}
            onPress={toggleTorch}
          >
            <Text style={[styles.controlPillText, isTorchOn && styles.constantTorchActiveText]}>
              ⚡ {isTorchOn ? "TORCH ON" : "TORCH"}
            </Text>
          </TouchableOpacity>

          {/* Photo Strobe Flash Button */}
          <TouchableOpacity
            style={[
              styles.headerControlPill,
              flashMode !== "off" && styles.strobeFlashActivePill,
              { marginLeft: 6 },
            ]}
            onPress={toggleFlash}
          >
            <Text style={styles.controlPillText}>
              📸 {flashMode.toUpperCase()}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Active Constant Illumination Banner */}
      {isTorchOn && (
        <View style={styles.activeTorchBanner}>
          <Text style={styles.activeTorchBannerText}>⚡ CONSTANT ILLUMINATION ACTIVE</Text>
        </View>
      )}

      {/* Eye Selector Floating Bar */}
      <View style={styles.eyeSelectorFloatingWrapper}>
        <EyeSelector selectedEye={selectedEye} onSelectEye={setSelectedEye} />
      </View>

      {/* Bottom Medical Control Dock */}
      <View style={styles.bottomDock}>
        {/* Zoom Controls & Quick Presets */}
        <View style={styles.zoomPresetRow}>
          <TouchableOpacity style={styles.zoomStepBtn} onPress={handleZoomOut}>
            <Text style={styles.zoomStepText}>-</Text>
          </TouchableOpacity>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.zoomPresetsScroll}>
            {[1, 1.5, 2, 3, 5].map((zVal) => (
              <TouchableOpacity
                key={zVal}
                style={[styles.zoomChip, Math.abs(zoom - zVal) < 0.2 && styles.zoomChipActive]}
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

        {/* Shutter Button Row */}
        <View style={styles.shutterRow}>
          <View style={{ width: 60 }} />

          <TouchableOpacity
            style={[styles.outerShutterRing, isCapturing && styles.shutterDisabled]}
            onPress={handleCapture}
            disabled={isCapturing}
          >
            <View style={styles.innerShutterButton} />
          </TouchableOpacity>

          <View style={styles.sessionCounterContainer}>
            <Text style={styles.sessionCounterNum}>
              {useAppStore.getState().sessionCaptures.length}
            </Text>
            <Text style={styles.sessionCounterLabel}>Captured</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.lg,
  },
  errorText: {
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
    textAlign: "center",
  },

  /* Ophthalmic Reticle Target */
  reticleContainer: {
    ...StyleSheet.absoluteFill,
    justifyContent: "center",
    alignItems: "center",
  },
  reticleOuterRing: {
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1.5,
    borderColor: "rgba(56, 189, 248, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.05)",
  },
  reticleInnerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(56, 189, 248, 0.6)",
  },
  reticleLine: {
    position: "absolute",
    backgroundColor: "rgba(56, 189, 248, 0.4)",
  },
  reticleTopLine: { top: 10, width: 1.5, height: 20 },
  reticleBottomLine: { bottom: 10, width: 1.5, height: 20 },
  reticleLeftLine: { left: 10, width: 20, height: 1.5 },
  reticleRightLine: { right: 10, width: 20, height: 1.5 },

  /* Top Header Bar */
  topHeaderBar: {
    position: "absolute",
    top: 44,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  circularHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerBtnText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  titleContainer: { alignItems: "center" },
  headerTitle: { color: "#fff", fontSize: 14, fontWeight: "700", letterSpacing: 0.5 },
  headerSubtitle: { color: theme.colors.primary, fontSize: 11, fontWeight: "600" },
  headerRightGroup: { flexDirection: "row", alignItems: "center" },
  headerControlPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  controlPillText: { color: "#fff", fontSize: 11, fontWeight: "bold" },
  constantTorchActivePill: { backgroundColor: "#f59e0b" },
  constantTorchActiveText: { color: "#000" },
  strobeFlashActivePill: { backgroundColor: "rgba(56, 189, 248, 0.3)" },

  /* Torch Banner */
  activeTorchBanner: {
    position: "absolute",
    top: 104,
    alignSelf: "center",
    backgroundColor: "rgba(245, 158, 11, 0.95)",
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 12,
  },
  activeTorchBannerText: { color: "#000", fontSize: 11, fontWeight: "800", letterSpacing: 1 },

  /* Eye Selector Pill */
  eyeSelectorFloatingWrapper: {
    position: "absolute",
    top: 142,
    left: 24,
    right: 24,
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    borderRadius: 20,
    padding: 4,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },

  /* Bottom Control Dock */
  bottomDock: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(15, 23, 42, 0.9)",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 16,
    paddingBottom: 32,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  zoomPresetRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  zoomStepBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  zoomStepText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  zoomPresetsScroll: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  zoomChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    marginHorizontal: 4,
  },
  zoomChipActive: {
    backgroundColor: theme.colors.primary,
  },
  zoomChipText: { color: "#94a3b8", fontSize: 12, fontWeight: "700" },
  zoomChipTextActive: { color: "#fff" },

  shutterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  outerShutterRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  shutterDisabled: { opacity: 0.5 },
  innerShutterButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#fff",
  },
  sessionCounterContainer: { width: 60, alignItems: "center" },
  sessionCounterNum: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  sessionCounterLabel: { color: "#94a3b8", fontSize: 10 },
});

export default CameraScreen;
