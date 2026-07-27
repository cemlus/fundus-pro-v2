import * as SQLite from 'expo-sqlite';
import {
  Patient,
  Session,
  CaptureImage,
  UploadQueueItem,
} from '../models/types';

class DatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.db) return;
    
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        this.db = await SQLite.openDatabaseAsync('fundus_pro.db');

        await this.db.execAsync(`
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS patients (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          gender TEXT NOT NULL,
          dob TEXT NOT NULL,
          patientId TEXT UNIQUE,
          notes TEXT,
          createdAt TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          patientId TEXT NOT NULL,
          notes TEXT,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          FOREIGN KEY (patientId) REFERENCES patients(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS captures (
          id TEXT PRIMARY KEY,
          sessionId TEXT NOT NULL,
          patientId TEXT NOT NULL,
          eyeSide TEXT NOT NULL,
          rawImagePath TEXT NOT NULL,
          enhancedImagePath TEXT,
          captureTime TEXT NOT NULL,
          uploadStatus TEXT NOT NULL,
          enhancementStatus TEXT NOT NULL,
          qualityScore REAL,
          notes TEXT,
          metadata TEXT,
          FOREIGN KEY (sessionId) REFERENCES sessions(id) ON DELETE CASCADE,
          FOREIGN KEY (patientId) REFERENCES patients(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS upload_queue (
          id TEXT PRIMARY KEY,
          imageId TEXT NOT NULL,
          status TEXT NOT NULL,
          retryCount INTEGER NOT NULL,
          lastAttemptAt TEXT,
          errorMessage TEXT,
          FOREIGN KEY (imageId) REFERENCES captures(id) ON DELETE CASCADE
        );
      `);

        console.log('SQLite database initialized successfully.');
      } catch (err) {
        console.error('Failed to initialize SQLite database:', err);
        throw err;
      }
    })();

    return this.initPromise;
  }

  private async getDb(): Promise<SQLite.SQLiteDatabase> {
    if (!this.db) {
      await this.init();
    }

    return this.db!;
  }

  // ------------------------------------------------------------------
  // Patients
  // ------------------------------------------------------------------

  async addPatient(patient: Patient): Promise<void> {
    const db = await this.getDb();

    await db.runAsync(
      `INSERT OR REPLACE INTO patients
      (id, name, gender, dob, patientId, notes, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      patient.id,
      patient.name,
      patient.gender,
      patient.dob,
      patient.patientId ?? null,
      patient.notes ?? null,
      patient.createdAt
    );

    console.log(`Successfully added/replaced patient ${patient.id}.`);
  }

  async getPatients(): Promise<Patient[]> {
    const db = await this.getDb();

    return await db.getAllAsync<Patient>(
      `SELECT * FROM patients ORDER BY createdAt DESC`
    );
  }

  async getPatient(id: string): Promise<Patient | null> {
    const db = await this.getDb();

    const patient = await db.getFirstAsync<Patient>(
      `SELECT * FROM patients WHERE id = ?`,
      id
    );

    return patient ?? null;
  }

  // ------------------------------------------------------------------
  // Sessions
  // ------------------------------------------------------------------

  async addSession(session: Session): Promise<void> {
    const db = await this.getDb();

    await db.runAsync(
      `INSERT OR REPLACE INTO sessions
      (id, patientId, notes, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?)`,
      session.id,
      session.patientId,
      session.notes ?? null,
      session.createdAt,
      session.updatedAt
    );

    console.log(`Successfully added session ${session.id}.`);
  }

  async getSessions(patientId?: string): Promise<Session[]> {
    const db = await this.getDb();

    if (patientId) {
      return await db.getAllAsync<Session>(
        `SELECT * FROM sessions
         WHERE patientId = ?
         ORDER BY createdAt DESC`,
        patientId
      );
    }

    return await db.getAllAsync<Session>(
      `SELECT * FROM sessions ORDER BY createdAt DESC`
    );
  }

  async updateSession(
    id: string,
    updates: Partial<Session>
  ): Promise<void> {
    const db = await this.getDb();

    const keys = Object.keys(updates);

    if (!keys.length) return;

    const setClause = keys.map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(updates).map(v => v === undefined ? null : v), id];

    await db.runAsync(
      `UPDATE sessions SET ${setClause} WHERE id = ?`,
      ...values
    );

    console.log(`Updated session ${id}.`);
  }

  // ------------------------------------------------------------------
  // Captures
  // ------------------------------------------------------------------

  async addCapturedImage(image: CaptureImage): Promise<void> {
    const db = await this.getDb();

    await db.runAsync(
      `INSERT OR REPLACE INTO captures
      (
        id,
        sessionId,
        patientId,
        eyeSide,
        rawImagePath,
        enhancedImagePath,
        captureTime,
        uploadStatus,
        enhancementStatus,
        qualityScore,
        notes,
        metadata
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      image.id,
      image.sessionId,
      image.patientId,
      image.eyeSide,
      image.rawImagePath,
      image.enhancedImagePath ?? null,
      image.captureTime,
      image.uploadStatus,
      image.enhancementStatus,
      image.qualityScore ?? null,
      image.notes ?? null,
      image.metadata ?? null
    );

    console.log(`Successfully added captured image ${image.id}.`);
  }

  async updateCapturedImage(
    id: string,
    updates: Partial<CaptureImage>
  ): Promise<void> {
    const db = await this.getDb();

    const keys = Object.keys(updates);

    if (!keys.length) return;

    const setClause = keys.map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(updates).map(v => v === undefined ? null : v), id];

    await db.runAsync(
      `UPDATE captures SET ${setClause} WHERE id = ?`,
      ...values
    );

    console.log(`Updated captured image ${id}.`);
  }

  async getCapturedImage(id: string): Promise<CaptureImage | null> {
    const db = await this.getDb();

    const image = await db.getFirstAsync<CaptureImage>(
      `SELECT * FROM captures WHERE id = ?`,
      id
    );

    return image ?? null;
  }

  async getCapturedImages(sessionId: string): Promise<CaptureImage[]> {
    const db = await this.getDb();

    return await db.getAllAsync<CaptureImage>(
      `SELECT * FROM captures
       WHERE sessionId = ?
       ORDER BY captureTime ASC`,
      sessionId
    );
  }

  async getAllCapturedImages(): Promise<CaptureImage[]> {
    const db = await this.getDb();

    return await db.getAllAsync<CaptureImage>(
      `SELECT * FROM captures
       ORDER BY captureTime DESC`
    );
  }

  // ------------------------------------------------------------------
  // Upload Queue
  // ------------------------------------------------------------------

  async enqueueUpload(item: UploadQueueItem): Promise<void> {
    const db = await this.getDb();

    await db.runAsync(
      `INSERT OR REPLACE INTO upload_queue
      (id, imageId, status, retryCount, lastAttemptAt, errorMessage)
      VALUES (?, ?, ?, ?, ?, ?)`,
      item.id,
      item.imageId,
      item.status,
      item.retryCount,
      item.lastAttemptAt ?? null,
      item.errorMessage ?? null
    );

    console.log(`Enqueued upload ${item.id}.`);
  }

  async getPendingUploads(): Promise<UploadQueueItem[]> {
    const db = await this.getDb();

    return await db.getAllAsync<UploadQueueItem>(
      `SELECT *
       FROM upload_queue
       WHERE status = ? OR status = ?
       ORDER BY id ASC`,
      'pending',
      'failed'
    );
  }

  async updateUploadQueueItem(
    id: string,
    updates: Partial<UploadQueueItem>
  ): Promise<void> {
    const db = await this.getDb();

    const keys = Object.keys(updates);

    if (!keys.length) return;

    const setClause = keys.map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(updates).map(v => v === undefined ? null : v), id];

    await db.runAsync(
      `UPDATE upload_queue
       SET ${setClause}
       WHERE id = ?`,
      ...values
    );

    console.log(`Updated upload queue item ${id}.`);
  }
}

export const dbService = new DatabaseService();