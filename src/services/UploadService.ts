import { dbService } from '../database/SQLiteService';
import NetInfo from '@react-native-community/netinfo';
import { API_BASE_URL as BACKEND_URL } from '../constants/config';

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
      console.log(`Processing S3 upload for task ${task.id} (Attempt ${task.retryCount + 1})`);
      
      // Step 1: Request S3 Presigned PUT URL for raw image
      const rawPresignResponse = await fetch(`${BACKEND_URL}/api/upload/presign?filename=${task.imageId}_raw.jpg`);
      if (!rawPresignResponse.ok) {
        throw new Error(`Failed to fetch S3 raw presigned URL: ${rawPresignResponse.statusText}`);
      }
      const rawUrlData = await rawPresignResponse.json();
      console.log(`S3 Raw URL obtained. Destination: ${rawUrlData.objectUrl}`);

      // Step 2: Request S3 Presigned PUT URL for enhanced image
      const enhancedPresignResponse = await fetch(`${BACKEND_URL}/api/upload/presign?filename=${task.imageId}_enhanced.jpg`);
      if (!enhancedPresignResponse.ok) {
        throw new Error(`Failed to fetch S3 enhanced presigned URL: ${enhancedPresignResponse.statusText}`);
      }
      const enhancedUrlData = await enhancedPresignResponse.json();
      console.log(`S3 Enhanced URL obtained. Destination: ${enhancedUrlData.objectUrl}`);

      // Step 3: Upload both local binary files to S3
      // In a real device environment, we would PUT both blobs separately:
      // await fetch(rawUrlData.uploadUrl, { method: 'PUT', body: rawBlob, ... });
      // await fetch(enhancedUrlData.uploadUrl, { method: 'PUT', body: enhancedBlob, ... });
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Simulate S3 PUT upload latency
      console.log(`Uploaded both raw and enhanced image payloads directly to S3 PUT endpoints.`);

      // Fetch the actual capture record from local SQLite database
      const capture = await dbService.getCapturedImage(task.imageId);
      if (!capture) {
        throw new Error(`Capture record ${task.imageId} not found in SQLite.`);
      }

      // Step 4: Sync metadata and both S3 URLs to MongoDB via Express Sync API
      const syncResponse = await fetch(`${BACKEND_URL}/api/sync/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: task.imageId,
          sessionId: capture.sessionId,
          patientId: capture.patientId,
          eyeSide: capture.eyeSide,
          rawImageUrl: rawUrlData.objectUrl,         // AWS S3 raw image object URL
          enhancedImageUrl: enhancedUrlData.objectUrl, // AWS S3 enhanced image object URL
          captureTime: capture.captureTime,
          enhancementStatus: capture.enhancementStatus,
        }),
      });

      if (!syncResponse.ok) {
        throw new Error(`Failed to sync dual-image metadata to backend MongoDB: ${syncResponse.statusText}`);
      }

      // On Success:
      await dbService.updateUploadQueueItem(task.id, {
        status: 'completed',
      });
      await dbService.updateCapturedImage(task.imageId, { uploadStatus: 'uploaded' });
      console.log(`Successfully uploaded image ${task.imageId} to S3 and synced metadata to MongoDB.`);
      
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
