import SQLite from 'react-native-sqlite-storage';
import { Patient, Session, CaptureImage, UploadQueueItem } from '../models/types';

SQLite.enablePromise(true);

class DatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;

  async init(): Promise<void> {
    if (this.db) return;
    try {
      this.db = await SQLite.openDatabase({
        name: 'fundus_pro.db',
        location: 'default',
      });
      
      // Create tables if they do not exist
      await this.db.executeSql(`
        CREATE TABLE IF NOT EXISTS patients (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          gender TEXT NOT NULL,
          dob TEXT NOT NULL,
          patientId TEXT UNIQUE,
          notes TEXT,
          createdAt TEXT NOT NULL
        )
      `);

      await this.db.executeSql(`
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          patientId TEXT NOT NULL,
          notes TEXT,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          FOREIGN KEY (patientId) REFERENCES patients (id) ON DELETE CASCADE
        )
      `);

      await this.db.executeSql(`
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
          FOREIGN KEY (sessionId) REFERENCES sessions (id) ON DELETE CASCADE,
          FOREIGN KEY (patientId) REFERENCES patients (id) ON DELETE CASCADE
        )
      `);

      await this.db.executeSql(`
        CREATE TABLE IF NOT EXISTS upload_queue (
          id TEXT PRIMARY KEY,
          imageId TEXT NOT NULL,
          status TEXT NOT NULL,
          retryCount INTEGER NOT NULL,
          lastAttemptAt TEXT,
          errorMessage TEXT,
          FOREIGN KEY (imageId) REFERENCES captures (id) ON DELETE CASCADE
        )
      `);
      
      console.log('SQLite database initialized successfully.');
    } catch (error) {
      console.error('Failed to initialize SQLite database:', error);
      throw error;
    }
  }

  private async getDb(): Promise<SQLite.SQLiteDatabase> {
    if (!this.db) {
      await this.init();
    }
    return this.db!;
  }

  // --- Patients ---
  async addPatient(patient: Patient): Promise<void> {
    const database = await this.getDb();
    await database.executeSql(
      'INSERT OR REPLACE INTO patients (id, name, gender, dob, patientId, notes, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [patient.id, patient.name, patient.gender, patient.dob, patient.patientId || null, patient.notes || null, patient.createdAt]
    );
    console.log(`Successfully added/replaced patient ${patient.id} in SQLite.`);
  }

  async getPatients(): Promise<Patient[]> {
    const database = await this.getDb();
    const [results] = await database.executeSql('SELECT * FROM patients ORDER BY createdAt DESC');
    const patients: Patient[] = [];
    for (let i = 0; i < results.rows.length; i++) {
      patients.push(results.rows.item(i));
    }
    return patients;
  }

  async getPatient(id: string): Promise<Patient | null> {
    const database = await this.getDb();
    const [results] = await database.executeSql('SELECT * FROM patients WHERE id = ?', [id]);
    if (results.rows.length > 0) {
      return results.rows.item(0) as Patient;
    }
    return null;
  }

  // --- Sessions ---
  async addSession(session: Session): Promise<void> {
    const database = await this.getDb();
    await database.executeSql(
      'INSERT OR REPLACE INTO sessions (id, patientId, notes, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)',
      [session.id, session.patientId, session.notes || null, session.createdAt, session.updatedAt]
    );
    console.log(`Successfully added session ${session.id} in SQLite.`);
  }

  async getSessions(patientId?: string): Promise<Session[]> {
    const database = await this.getDb();
    const query = patientId 
      ? 'SELECT * FROM sessions WHERE patientId = ? ORDER BY createdAt DESC' 
      : 'SELECT * FROM sessions ORDER BY createdAt DESC';
    const params = patientId ? [patientId] : [];
    
    const [results] = await database.executeSql(query, params);
    const sessions: Session[] = [];
    for (let i = 0; i < results.rows.length; i++) {
      sessions.push(results.rows.item(i));
    }
    return sessions;
  }

  async updateSession(id: string, updates: Partial<Session>): Promise<void> {
    const database = await this.getDb();
    const keys = Object.keys(updates);
    if (keys.length === 0) return;

    const setString = keys.map(k => `${k} = ?`).join(', ');
    const params = [...Object.values(updates), id];
    
    await database.executeSql(`UPDATE sessions SET ${setString} WHERE id = ?`, params);
    console.log(`Updated session ${id} in SQLite.`);
  }

  // --- Captured Images ---
  async addCapturedImage(image: CaptureImage): Promise<void> {
    const database = await this.getDb();
    await database.executeSql(
      'INSERT OR REPLACE INTO captures (id, sessionId, patientId, eyeSide, rawImagePath, enhancedImagePath, captureTime, uploadStatus, enhancementStatus, qualityScore, notes, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        image.id, 
        image.sessionId, 
        image.patientId, 
        image.eyeSide, 
        image.rawImagePath, 
        image.enhancedImagePath || null, 
        image.captureTime, 
        image.uploadStatus, 
        image.enhancementStatus, 
        image.qualityScore || null, 
        image.notes || null, 
        image.metadata || null
      ]
    );
    console.log(`Successfully added captured image ${image.id} in SQLite.`);
  }

  async updateCapturedImage(id: string, updates: Partial<CaptureImage>): Promise<void> {
    const database = await this.getDb();
    const keys = Object.keys(updates);
    if (keys.length === 0) return;

    const setString = keys.map(k => `${k} = ?`).join(', ');
    const params = [...Object.values(updates), id];
    
    await database.executeSql(`UPDATE captures SET ${setString} WHERE id = ?`, params);
    console.log(`Updated captured image ${id} in SQLite.`);
  }

  async getCapturedImage(id: string): Promise<CaptureImage | null> {
    const database = await this.getDb();
    const [results] = await database.executeSql('SELECT * FROM captures WHERE id = ?', [id]);
    if (results.rows.length > 0) {
      return results.rows.item(0) as CaptureImage;
    }
    return null;
  }

  async getCapturedImages(sessionId: string): Promise<CaptureImage[]> {
    const database = await this.getDb();
    const [results] = await database.executeSql('SELECT * FROM captures WHERE sessionId = ? ORDER BY captureTime ASC', [sessionId]);
    const captures: CaptureImage[] = [];
    for (let i = 0; i < results.rows.length; i++) {
      captures.push(results.rows.item(i));
    }
    return captures;
  }

  async getAllCapturedImages(): Promise<CaptureImage[]> {
    const database = await this.getDb();
    const [results] = await database.executeSql('SELECT * FROM captures ORDER BY captureTime DESC');
    const captures: CaptureImage[] = [];
    for (let i = 0; i < results.rows.length; i++) {
      captures.push(results.rows.item(i));
    }
    return captures;
  }

  // --- Upload Queue ---
  async enqueueUpload(item: UploadQueueItem): Promise<void> {
    const database = await this.getDb();
    await database.executeSql(
      'INSERT OR REPLACE INTO upload_queue (id, imageId, status, retryCount, lastAttemptAt, errorMessage) VALUES (?, ?, ?, ?, ?, ?)',
      [item.id, item.imageId, item.status, item.retryCount, item.lastAttemptAt || null, item.errorMessage || null]
    );
    console.log(`Enqueued upload ${item.id} in SQLite.`);
  }

  async getPendingUploads(): Promise<UploadQueueItem[]> {
    const database = await this.getDb();
    const [results] = await database.executeSql(
      'SELECT * FROM upload_queue WHERE status = ? OR status = ? ORDER BY id ASC',
      ['pending', 'failed']
    );
    const uploads: UploadQueueItem[] = [];
    for (let i = 0; i < results.rows.length; i++) {
      uploads.push(results.rows.item(i));
    }
    return uploads;
  }

  async updateUploadQueueItem(id: string, updates: Partial<UploadQueueItem>): Promise<void> {
    const database = await this.getDb();
    const keys = Object.keys(updates);
    if (keys.length === 0) return;

    const setString = keys.map(k => `${k} = ?`).join(', ');
    const params = [...Object.values(updates), id];
    
    await database.executeSql(`UPDATE upload_queue SET ${setString} WHERE id = ?`, params);
    console.log(`Updated upload item ${id} in SQLite.`);
  }
}

export const dbService = new DatabaseService();
