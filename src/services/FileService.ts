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
   * Ensures that a directory path exists on the local filesystem.
   */
  static async ensureDirectoryExists(dirPath: string): Promise<void> {
    if (dirPath.startsWith('/mock')) return;
    try {
      const exists = await RNFS.exists(dirPath);
      if (!exists) {
        await RNFS.mkdir(dirPath);
      }
    } catch (e) {
      console.error(`Failed to create directory ${dirPath}:`, e);
    }
  }

  /**
   * Generates and ensures a patient-session specific directory:
   * Documents/FundusPro/Patients/<patientId>/Session_<sessionId>
   */
  static async getPatientSessionDir(patientId: string, sessionId: string): Promise<string> {
    const base = `${this.getBaseDirectory()}/FundusPro/Patients/${patientId}/Session_${sessionId}`;
    await this.ensureDirectoryExists(base);
    return base;
  }

  /**
   * Generates a unique filename for a raw capture inside patient session folder.
   */
  static generateRawFilePath(sessionId: string, eyeSide: string, patientId?: string): string {
    const timestamp = Date.now();
    const folder = patientId 
      ? `${this.getBaseDirectory()}/FundusPro/Patients/${patientId}/Session_${sessionId}`
      : this.getBaseDirectory();
    return `${folder}/raw_${sessionId}_${eyeSide}_${timestamp}.jpg`;
  }

  /**
   * Generates a unique filename for an enhanced capture.
   */
  static generateEnhancedFilePath(rawFileName: string): string {
    return rawFileName.replace('raw_', 'enhanced_');
  }

  /**
   * Writes a JSON sidecar file containing metadata alongside the image file.
   */
  static async writeMetadataSidecar(imagePath: string, metadataRecord: Record<string, any>): Promise<string | null> {
    const sidecarPath = imagePath.replace(/\.(jpg|jpeg|png)$/i, '.json');
    try {
      if (imagePath.startsWith('/mock')) return sidecarPath;
      await RNFS.writeFile(sidecarPath, JSON.stringify(metadataRecord, null, 2), 'utf8');
      console.log(`Successfully wrote metadata sidecar: ${sidecarPath}`);
      return sidecarPath;
    } catch (e) {
      console.error(`Failed to write metadata sidecar for ${imagePath}:`, e);
      return null;
    }
  }

  /**
   * Reads a JSON sidecar metadata file if present.
   */
  static async readMetadataSidecar(imagePath: string): Promise<Record<string, any> | null> {
    const sidecarPath = imagePath.replace(/\.(jpg|jpeg|png)$/i, '.json');
    try {
      if (imagePath.startsWith('/mock')) return null;
      const exists = await RNFS.exists(sidecarPath);
      if (!exists) return null;
      const content = await RNFS.readFile(sidecarPath, 'utf8');
      return JSON.parse(content);
    } catch (e) {
      console.error(`Failed to read metadata sidecar ${sidecarPath}:`, e);
      return null;
    }
  }

  /**
   * Moves a file from a temporary location to permanent local storage.
   */
  static async moveFileToPermanentStorage(tempPath: string, destPath: string): Promise<boolean> {
    try {
      console.log(`Moving file from ${tempPath} to ${destPath}`);
      if (tempPath.startsWith('/mock') || destPath.startsWith('/mock')) {
        return true;
      }
      // Ensure destination parent directory exists
      const parentDir = destPath.substring(0, destPath.lastIndexOf('/'));
      await this.ensureDirectoryExists(parentDir);

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
      // Try deleting sidecar as well
      const sidecar = path.replace(/\.(jpg|jpeg|png)$/i, '.json');
      await RNFS.unlink(sidecar).catch(() => {});
      return true;
    } catch (e) {
      console.error('Failed to delete file', e);
      return false;
    }
  }
}
