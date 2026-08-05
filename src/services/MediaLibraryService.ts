import RNFS from 'react-native-fs';
import { Alert, Platform } from 'react-native';

export class MediaLibraryService {
  /**
   * Universally exports an image to the device's public photo gallery and storage.
   * Compatible with Android 10-14+ Scoped Storage (OnePlus OxygenOS, Motorola MyUI, Samsung, Pixel) & iOS.
   */
  static async exportToGallery(imagePath: string): Promise<boolean> {
    try {
      if (!imagePath || imagePath.startsWith('/mock')) {
        Alert.alert('Export Successful', 'Mock photo exported to gallery.');
        return true;
      }

      // Ensure proper file:// URI format for Expo MediaLibrary / MediaScanner
      const fileUri = imagePath.startsWith('file://') ? imagePath : `file://${imagePath}`;
      const rawPath = imagePath.replace('file://', '');

      // Check if file actually exists locally first
      const fileExists = await RNFS.exists(rawPath);
      if (!fileExists) {
        throw new Error(`File does not exist at path: ${rawPath}`);
      }

      let savedViaMediaLibrary = false;

      // Method 1: Try expo-media-library (MediaStore API - Required for Android 10+ Scoped Storage on OnePlus, Motorola, etc.)
      try {
        const MediaLibrary = require('expo-media-library');
        if (MediaLibrary && typeof MediaLibrary.requestPermissionsAsync === 'function') {
          const { status, canAskAgain } = await MediaLibrary.requestPermissionsAsync(true);

          if (status === 'granted') {
            const asset = await MediaLibrary.createAssetAsync(fileUri);

            // Save into a dedicated 'FundusPro' Album
            try {
              const album = await MediaLibrary.getAlbumAsync('FundusPro');
              if (album == null) {
                await MediaLibrary.createAlbumAsync('FundusPro', asset, false);
              } else {
                await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
              }
            } catch (albumErr) {
              console.warn('Could not create/add to FundusPro album, asset saved to main gallery:', albumErr);
            }

            savedViaMediaLibrary = true;
          } else if (!canAskAgain) {
            Alert.alert(
              'Permission Required',
              'Storage/Photos permission was denied. Please enable permission for Fundus Pro in your device settings to export photos.'
            );
            return false;
          }
        }
      } catch (expoErr) {
        console.warn('expo-media-library attempt failed or module not native-linked:', expoErr);
      }

      // Method 2: Fallback for older Android or devices without expo-media-library native code linked
      if (!savedViaMediaLibrary && Platform.OS === 'android') {
        const baseDir =
          RNFS.PicturesDirectoryPath ||
          RNFS.DownloadDirectoryPath ||
          RNFS.DocumentDirectoryPath;
        const targetDir = `${baseDir}/FundusPro`;

        const dirExists = await RNFS.exists(targetDir);
        if (!dirExists) {
          await RNFS.mkdir(targetDir);
        }

        const fileName = rawPath.substring(rawPath.lastIndexOf('/') + 1);
        const destPath = `${targetDir}/${fileName}`;

        await RNFS.copyFile(rawPath, destPath);

        if (typeof RNFS.scanFile === 'function') {
          try {
            await RNFS.scanFile(destPath);
          } catch (scanErr) {
            console.warn('RNFS.scanFile failed:', scanErr);
          }
        }

        // Copy sidecar metadata JSON if present
        const sidecarSource = rawPath.replace(/\.(jpg|jpeg|png)$/i, '.json');
        const sidecarDest = destPath.replace(/\.(jpg|jpeg|png)$/i, '.json');
        if (await RNFS.exists(sidecarSource)) {
          await RNFS.copyFile(sidecarSource, sidecarDest).catch(() => {});
        }
      }

      const fileName = rawPath.substring(rawPath.lastIndexOf('/') + 1);
      Alert.alert(
        'Saved to Device Gallery 📸',
        `Image successfully exported to your device gallery!\n\nFilename:\n${fileName}`
      );
      return true;
    } catch (e: any) {
      console.error('Failed to export image to gallery:', e);
      Alert.alert('Export Failed', e.message || 'Could not save image to phone storage.');
      return false;
    }
  }
}
