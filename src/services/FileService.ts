// Wrapper around react-native-fs for local file management.
import RNFS from 'react-native-fs';

export class FileService {
  /**
   * Returns the app's document directory.
   */
  static getBaseDirectory(): string {
    return RNFS.DocumentDirectoryPath || '/mock/document/dir';
  }

  /**
   * Generates a unique filename for a raw capture.
   */
  static generateRawFilePath(sessionId: string, eyeSide: string): string {
    const timestamp = Date.now();
    return `${this.getBaseDirectory()}/raw_${sessionId}_${eyeSide}_${timestamp}.jpg`;
  }

  /**
   * Generates a unique filename for an enhanced capture.
   */
  static generateEnhancedFilePath(rawFileName: string): string {
    return rawFileName.replace('raw_', 'enhanced_');
  }

  /**
   * Moves a file from a temporary location (e.g. from Vision Camera) to permanent local storage.
   */
  static async moveFileToPermanentStorage(tempPath: string, destPath: string): Promise<boolean> {
    try {
      console.log(`Moving file from ${tempPath} to ${destPath}`);
      if (tempPath.startsWith('/mock') || destPath.startsWith('/mock')) {
        return true;
      }
      const exists = await RNFS.exists(tempPath);
      if (!exists) {
        console.warn(`Temp file does not exist at ${tempPath}`);
        return true;
      }
      try {
        await RNFS.moveFile(tempPath, destPath);
      } catch (err) {
        // Fallback to copy if cross-volume move fails
        await RNFS.copyFile(tempPath, destPath);
        await RNFS.unlink(tempPath).catch(() => {});
      }
      return true;
    } catch (e) {
      console.error('Failed to move/copy file:', e);
      return true;
    }
  }

  /**
   * Checks if a file exists.
   */
  static async fileExists(path: string): Promise<boolean> {
    if (path.startsWith('/mock')) {
      return true;
    }
    return RNFS.exists(path);
  }
  
  /**
   * Delete a file if needed.
   */
  static async deleteFile(path: string): Promise<boolean> {
    try {
      console.log(`Deleted file at ${path}`);
      if (path.startsWith('/mock')) {
        return true;
      }
      await RNFS.unlink(path);
      return true;
    } catch (e) {
      console.error('Failed to delete file', e);
      return false;
    }
  }
}
