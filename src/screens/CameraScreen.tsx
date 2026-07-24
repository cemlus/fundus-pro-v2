import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
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
  const navigation = useNavigation<AppNavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, "Camera">>();
  const { sessionId } = route.params;

  const session = useAppStore((state) => state.currentSession);
  const addSessionCapture = useAppStore((state) => state.addSessionCapture);

  const camera = useRef<any>(null);
  const photoOutput = usePhotoOutput();

  const device = useCameraDevice("back");
  const { hasPermission, requestPermission } = useCameraPermission();

  const [selectedEye, setSelectedEye] = useState<EyeSide>("left");
  const [isCapturing, setIsCapturing] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [isTorchOn, setIsTorchOn] = useState(false);

  useEffect(() => {
    if (!hasPermission) {
      requestPermission().catch((err) => {
        console.warn("Camera permission request failed:", err);
      });
    }
  }, [hasPermission, requestPermission]);

  const toggleTorch = () => {
    setIsTorchOn((prev) => !prev);
  };

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.5, 5));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.5, 1));

  const handleCapture = async () => {
    if (!session || !device) return;

    setIsCapturing(true);
    try {
      let tempPath = `/mock/document/dir/mock_raw_${Date.now()}.jpg`;

      if (photoOutput && typeof photoOutput.capturePhotoToFile === 'function') {
        const photoFile = await photoOutput.capturePhotoToFile(
          { flashMode: isTorchOn ? "on" : "off" },
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
      <Camera
        ref={camera}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        outputs={[photoOutput]}
        zoom={zoom}
        torchMode={isTorchOn ? "on" : "off"}
      />

      <View style={styles.overlayControls}>
        <View style={styles.topRow}>
          <TouchableOpacity style={styles.iconBtn} onPress={handleClose}>
            <Text style={styles.iconText}>✕</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.iconBtn} onPress={toggleTorch}>
            <Text style={styles.iconText}>
              Torch: {isTorchOn ? "ON" : "OFF"}
            </Text>
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
  overlayControls: {
    position: "absolute",
    top: 50,
    left: 0,
    right: 0,
    paddingHorizontal: theme.spacing.lg,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  iconBtn: {
    paddingHorizontal: 15,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  iconText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  eyeSelectorWrapper: {
    marginTop: theme.spacing.lg,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: theme.radii.lg,
    padding: 4,
  },
  bottomBar: {
    height: 140,
    backgroundColor: "#000",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingBottom: 20,
  },
  zoomControls: {
    flexDirection: "row",
    alignItems: "center",
    width: 100,
    justifyContent: "space-between",
  },
  zoomText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  bottomSpacer: { width: 100 },
  captureBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "rgba(255,255,255,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  captureBtnDisabled: { opacity: 0.5 },
  captureBtnInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#fff",
  },
});

export default CameraScreen;
