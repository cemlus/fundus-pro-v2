import { dbService } from '../database/SQLiteService';
import { FileService } from './FileService';
import { useAppStore } from '../store/useAppStore';
import { API_BASE_URL } from '../constants/config';

export class AIEnhancementService {
  /**
   * Enqueues an image for AI enhancement processing.
   */
  static async queueEnhancement(imageId: string, rawImagePath: string): Promise<void> {
    console.log(`Enqueuing image ${imageId} for AI enhancement`);
    
    // Set status to queued in DB
    await dbService.updateCapturedImage(imageId, {
      enhancementStatus: 'queued',
    });

    // Update Zustand state
    useAppStore.getState().updateSessionCapture(imageId, {
      enhancementStatus: 'queued',
    });

    // In a real app, this might trigger a background worker. 
    // Here we simulate the processing immediately for demonstration.
    this.processQueueStep(imageId, rawImagePath);
  }

  /**
   * Mock processing of AI Enhancement.
   * This is where a TFLite or PyTorch Mobile model would be invoked, 
   * taking the rawImagePath and generating an enhanced image array.
   */
  private static async processQueueStep(imageId: string, rawImagePath: string): Promise<void> {
    try {
      await dbService.updateCapturedImage(imageId, { enhancementStatus: 'processing' });
      useAppStore.getState().updateSessionCapture(imageId, { enhancementStatus: 'processing' });
      
      const RNFS = require('react-native-fs');

      // Step 1: Read raw image from disk
      const fileUri = rawImagePath.startsWith('file://') ? rawImagePath : `file://${rawImagePath}`;
      const base64 = await RNFS.readFile(rawImagePath.replace('file://', ''), 'base64');

      // Hardcoded Windows IPv4 address since dynamic resolution failed
      let backendUrl = 'http://172.17.14.168:8000/api/enhance/glare'; 
      if (__DEV__) {
        const { NativeModules } = require('react-native');
        const scriptURL = NativeModules.SourceCode.scriptURL;
        if (scriptURL) {
          const packagerIP = scriptURL.split('://')[1].split(':')[0];
          backendUrl = `http://${packagerIP}:8000/api/enhance/glare`;
        }
      } 
      
      const response = await fetch(backendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64 }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Cloud Glare Correction failed: ${response.statusText}`);
      }

      const { enhancedBase64, report } = await response.json();
      console.log('Successfully received corrected frame from cloud model. Report:', report);

      // Step 2: Save the corrected frame locally
      const enhancedPath = FileService.generateEnhancedFilePath(rawImagePath);
      await RNFS.writeFile(enhancedPath.replace('file://', ''), enhancedBase64, 'base64');

      console.log(`AI Enhancement complete for ${imageId}. Saved to ${enhancedPath}`);

      await dbService.updateCapturedImage(imageId, {
        enhancementStatus: 'done',
        enhancedImagePath: enhancedPath,
      });

      // Synchronize changes to Zustand store immediately
      useAppStore.getState().updateSessionCapture(imageId, {
        enhancementStatus: 'done',
        enhancedImagePath: enhancedPath,
      });

    } catch (error) {
      console.error(`AI Enhancement failed for ${imageId}`, error);
      await dbService.updateCapturedImage(imageId, { enhancementStatus: 'failed' });
      useAppStore.getState().updateSessionCapture(imageId, { enhancementStatus: 'failed' });
    }
  }

  /**
   * Retrieves the current enhancement status for an image.
   */
  static async getEnhancementStatus(imageId: string) {
    console.log(`Checking enhancement status for ${imageId}`);
  }
}
