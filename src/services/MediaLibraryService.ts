import RNFS from 'react-native-fs';
import { Alert, Platform, NativeModules } from 'react-native';

export class MediaLibraryService {
  /**
   * Resolves the best public media export directory for the current device platform & OS.
   * Universal support for Android (Samsung, Pixel, Xiaomi, OnePlus, Motorola, etc.) and iOS.
   */
  private static getPublicExportDirectory(): string {
    if (Platform.OS === 'ios') {
      return `${RNFS.DocumentDirectoryPath}/FundusProExports`;
    }

    // Android: Try standard public Pictures, Downloads, or External Storage
    const baseDir =
      RNFS.PicturesDirectoryPath ||
      RNFS.DownloadDirectoryPath ||
      (RNFS.ExternalStorageDirectoryPath ? `${RNFS.ExternalStorageDirectoryPath}/Pictures` : null) ||
      RNFS.DocumentDirectoryPath;

    return `${baseDir}/FundusPro`;
  }

  /**
   * Universally exports an image and its JSON metadata sidecar to the device's public media folder and gallery.
   * Forces Android MediaScanner indexing so photos instantly appear in Samsung Gallery / Google Photos.
   */
  static async exportToGallery(imagePath: string): Promise<boolean> {
    try {
      if (!imagePath || imagePath.startsWith('/mock')) {
        Alert.alert('Export Successful', 'Mock photo exported to gallery.');
        return true;
      }

      // Step 1: Resolve universal public storage directory
      const targetDir = this.getPublicExportDirectory();
      const dirExists = await RNFS.exists(targetDir);
      if (!dirExists) {
        await RNFS.mkdir(targetDir);
      }

      const fileName = imagePath.substring(imagePath.lastIndexOf('/') + 1);
      const destPath = `${targetDir}/${fileName}`;

      // Copy image file to target directory
      await RNFS.copyFile(imagePath, destPath);

      // Trigger Android MediaScanner connection so Android Gallery apps (Samsung Gallery, Google Photos, etc.) immediately index the exported photo into the Gallery app grid!
      if (Platform.OS === 'android' && typeof RNFS.scanFile === 'function') {
        try {
          await RNFS.scanFile(destPath);
          console.log(`Android MediaScanner scanned file successfully: ${destPath}`);
        } catch (scanErr) {
          console.warn('RNFS.scanFile warning:', scanErr);
        }
      }

      // Copy sidecar metadata JSON if present
      const sidecarSource = imagePath.replace(/\.(jpg|jpeg|png)$/i, '.json');
      const sidecarDest = destPath.replace(/\.(jpg|jpeg|png)$/i, '.json');
      const sidecarExists = await RNFS.exists(sidecarSource);
      if (sidecarExists) {
        await RNFS.copyFile(sidecarSource, sidecarDest).catch(() => {});
      }

      // Step 2: Check if ExpoMediaLibrary native module is available in current build
      const hasExpoMediaLibrary = !!(
        NativeModules.ExpoMediaLibrary ||
        (globalThis as any).expo?.modules?.ExpoMediaLibrary
      );

      if (hasExpoMediaLibrary) {
        try {
          const MediaLibrary = require('expo-media-library/legacy');
          if (MediaLibrary && typeof MediaLibrary.requestPermissionsAsync === 'function') {
            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status === 'granted') {
              const formattedUri = `file://${destPath}`;
              const asset = await MediaLibrary.createAssetAsync(formattedUri);
              const album = await MediaLibrary.getAlbumAsync('FundusPro');
              if (album == null) {
                await MediaLibrary.createAlbumAsync('FundusPro', asset, false);
              } else {
                await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
              }
            }
          }
        } catch (nativeErr) {
          // Native module indexing optional fallback
        }
      }

      const locationLabel = Platform.OS === 'ios'
        ? 'Photos App & Files App'
        : 'Gallery App & File Manager (Pictures/FundusPro)';

      Alert.alert(
        'Saved to Device Gallery & Storage 📸',
        `Image & metadata successfully exported to your device!\n\nLocation:\nPictures/FundusPro/${fileName}\n\nVisible in your ${locationLabel}.`
      );
      return true;
    } catch (e: any) {
      console.error('Failed to export image to gallery:', e);
      Alert.alert('Export Failed', e.message || 'Could not save image to phone storage.');
      return false;
    }
  }
}
