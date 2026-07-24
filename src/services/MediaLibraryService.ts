import RNFS from 'react-native-fs';
import { Alert, NativeModules } from 'react-native';

export class MediaLibraryService {
  /**
   * Exports an image and its sidecar metadata JSON file to the device's public Pictures/FundusPro folder using RNFS,
   * making them immediately visible in Samsung My Files and Samsung Gallery without requiring native module rebuilds.
   */
  static async exportToGallery(imagePath: string): Promise<boolean> {
    try {
      if (!imagePath || imagePath.startsWith('/mock')) {
        Alert.alert('Export Successful', 'Mock photo exported to gallery.');
        return true;
      }

      // Step 1: Export using RNFS to public Pictures/FundusPro directory
      const picturesDir = RNFS.PicturesDirectoryPath || `${RNFS.ExternalStorageDirectoryPath}/Pictures`;
      const targetDir = `${picturesDir}/FundusPro`;
      
      const dirExists = await RNFS.exists(targetDir);
      if (!dirExists) {
        await RNFS.mkdir(targetDir);
      }

      const fileName = imagePath.substring(imagePath.lastIndexOf('/') + 1);
      const destPath = `${targetDir}/${fileName}`;

      // Copy image file to public Pictures/FundusPro
      await RNFS.copyFile(imagePath, destPath);

      // Copy sidecar metadata JSON if present
      const sidecarSource = imagePath.replace(/\.(jpg|jpeg|png)$/i, '.json');
      const sidecarDest = destPath.replace(/\.(jpg|jpeg|png)$/i, '.json');
      const sidecarExists = await RNFS.exists(sidecarSource);
      if (sidecarExists) {
        await RNFS.copyFile(sidecarSource, sidecarDest).catch(() => {});
      }

      // Step 2: Check if ExpoMediaLibrary native module is present before requiring it
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
        } catch (e) {
          // Fail gracefully if native registration fails
        }
      }

      Alert.alert(
        'Saved to Device! 📸',
        `Image & metadata saved to your Samsung device at:\n\nPictures/FundusPro/${fileName}\n\nYou can now view them in Samsung "My Files" and Samsung Gallery!`
      );
      return true;
    } catch (e: any) {
      console.error('Failed to export image to gallery:', e);
      Alert.alert('Export Failed', e.message || 'Could not save image to phone storage.');
      return false;
    }
  }
}
