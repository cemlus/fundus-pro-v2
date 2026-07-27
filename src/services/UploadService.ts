import { dbService } from '../database/SQLiteService';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from './SupabaseClient';

export class UploadService {
  /**
   * Pushes a captured image ID onto the S3 upload queue.
   */
  static async queueUpload(imageId: string): Promise<void> {
    const uploadId = `upload_${Date.now()}_${imageId}`;
    console.log(`Queueing upload task ${uploadId} for image ${imageId}`);
    
    await dbService.enqueueUpload({
      id: uploadId,
      imageId: imageId,
      status: 'pending',
      retryCount: 0,
    });
    
    await dbService.updateCapturedImage(imageId, { uploadStatus: 'pending' });

    // Try uploading immediately
    this.processNextInQueue();
  }

  /**
   * Processes the upload queue. Designed to be resilient to offline states.
   */
  private static async processNextInQueue(): Promise<void> {
    // Check network connectivity first using NetInfo
    const state = await NetInfo.fetch();
    if (!state.isConnected) {
      console.log('Device is offline. Postponing S3 upload.');
      return;
    }

    const pendingUploads = await dbService.getPendingUploads();
    if (pendingUploads.length === 0) return;

    const task = pendingUploads[0];
    
    try {
      // Fetch the actual capture record from local SQLite database
      const capture = await dbService.getCapturedImage(task.imageId);
      if (!capture) {
        throw new Error(`Capture record ${task.imageId} not found in SQLite.`);
      }

      console.log(`Processing Supabase upload for task ${task.id} (Attempt ${task.retryCount + 1})`);
      
      // Helper to convert local file to Blob
      const getBlob = async (uri: string) => {
        const fetchUri = uri.startsWith('file://') ? uri : `file://${uri}`;
        return await new Promise<Blob>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.onload = function() { resolve(xhr.response); };
          xhr.onerror = function() { reject(new TypeError('Network request failed')); };
          xhr.responseType = 'blob';
          xhr.open('GET', fetchUri, true);
          xhr.send(null);
        });
      };

      // Step 1: Upload Raw Image
      const rawBlob = await getBlob(capture.rawImagePath);
      const rawPath = `${task.imageId}_raw.jpg`;
      const { error: rawError } = await supabase.storage
        .from('fundus-images')
        .upload(rawPath, rawBlob, { contentType: 'image/jpeg', upsert: true });
      if (rawError) throw new Error(`Raw upload failed: ${rawError.message}`);
      
      const rawUrl = supabase.storage.from('fundus-images').getPublicUrl(rawPath).data.publicUrl;

      // Step 2: Upload Enhanced Image (if exists)
      let enhancedUrl = null;
      if (capture.enhancedImagePath) {
        const enhancedBlob = await getBlob(capture.enhancedImagePath);
        const enhancedPath = `${task.imageId}_enhanced.jpg`;
        const { error: enhError } = await supabase.storage
          .from('fundus-images')
          .upload(enhancedPath, enhancedBlob, { contentType: 'image/jpeg', upsert: true });
        if (enhError) throw new Error(`Enhanced upload failed: ${enhError.message}`);
        
        enhancedUrl = supabase.storage.from('fundus-images').getPublicUrl(enhancedPath).data.publicUrl;
      }

      // Step 3: Insert metadata to Supabase captures table
      const { error: dbError } = await supabase.from('captures').insert({
        id: task.imageId,
        session_id: capture.sessionId,
        patient_id: capture.patientId,
        eye_side: capture.eyeSide,
        raw_image_url: rawUrl,
        enhanced_image_url: enhancedUrl,
        capture_time: capture.captureTime,
        enhancement_status: capture.enhancementStatus,
      });

      if (dbError) {
        throw new Error(`Failed to sync metadata to Supabase: ${dbError.message}`);
      }

      // On Success:
      await dbService.updateUploadQueueItem(task.id, {
        status: 'completed',
      });
      await dbService.updateCapturedImage(task.imageId, { uploadStatus: 'uploaded' });
      console.log(`Successfully uploaded image ${task.imageId} to Supabase and synced metadata.`);
      
    } catch (error: any) {
      console.error(`Failed to upload/sync task ${task.id}:`, error);
      
      const newRetryCount = task.retryCount + 1;
      await dbService.updateUploadQueueItem(task.id, {
        status: newRetryCount > 3 ? 'failed' : 'pending',
        retryCount: newRetryCount,
        lastAttemptAt: new Date().toISOString(),
        errorMessage: error.message,
      });

      if (newRetryCount > 3) {
        await dbService.updateCapturedImage(task.imageId, { uploadStatus: 'failed' });
      }
    }
  }

  /**
   * Retries all failed uploads (e.g. called when network is restored)
   */
  static async retryFailedUploads(): Promise<void> {
    console.log('Retrying failed uploads...');
    const pending = await dbService.getPendingUploads();
    for (const task of pending) {
      if (task.status === 'failed') {
        await dbService.updateUploadQueueItem(task.id, { status: 'pending', retryCount: 0 });
      }
    }
    this.processNextInQueue();
  }
}
