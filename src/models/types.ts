export interface Patient {
  id: string;
  name: string;
  gender: string;
  dob: string; // ISO string
  createdAt: string; // ISO string
  patientId?: string; // Optional external ID
  notes?: string;
}

export interface Session {
  id: string;
  patientId: string;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  notes?: string;
}

export type EyeSide = 'left' | 'right';
export type UploadStatus = 'not_queued' | 'queued' | 'uploaded' | 'failed';
export type EnhancementStatus = 'not_started' | 'queued' | 'processing' | 'done' | 'failed';

export interface CaptureImage {
  id: string;
  sessionId: string;
  patientId: string;
  eyeSide: EyeSide;
  rawImagePath: string;
  enhancedImagePath?: string | null;
  captureTime: string; // ISO string
  uploadStatus: UploadStatus;
  enhancementStatus: EnhancementStatus;
  qualityScore?: number;
  notes?: string;
  metadata?: string; // JSON string of camera metadata
}

export interface UploadQueueItem {
  id: string;
  imageId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  retryCount: number;
  lastAttemptAt?: string;
  errorMessage?: string;
}
