/**
 * Offline-First Quiz Storage Service
 * Uses IndexedDB for reliable local storage of quiz attempts
 * Syncs to backend when connection is restored
 */

export interface StoredQuiz {
  lessonId: string;
  title: string;
  questions: Array<{
    id: string;
    question: string;
    options: string[];
  }>;
  storedAt: number;
}

export interface OfflineAttempt {
  id: string; // Local ID for tracking
  lessonId: string;
  answers: Array<{ questionId: string; answer: number }>;
  startedAt: number;
  completedAt: number | null;
  syncStatus: 'completed' | 'pending' | 'synced' | 'error';
  syncError?: string;
  attemptId?: string; // Server ID after sync
}

const DB_NAME = 'airman-quiz-db';
const QUIZ_STORE = 'quizzes';
const ATTEMPT_STORE = 'attempts';
const DB_VERSION = 1;

/**
 * Initialize IndexedDB
 */
function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(QUIZ_STORE)) {
        db.createObjectStore(QUIZ_STORE, { keyPath: 'lessonId' });
      }

      if (!db.objectStoreNames.contains(ATTEMPT_STORE)) {
        const store = db.createObjectStore(ATTEMPT_STORE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('lessonId', 'lessonId', { unique: false });
        store.createIndex('syncStatus', 'syncStatus', { unique: false });
      }
    };
  });
}

/**
 * Store quiz metadata locally (questions, options, etc)
 */
export async function storeQuizLocally(quiz: StoredQuiz): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction([QUIZ_STORE], 'readwrite');
    const store = tx.objectStore(QUIZ_STORE);
    await new Promise((resolve, reject) => {
      const req = store.put(quiz);
      req.onsuccess = () => resolve(undefined);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to store quiz locally:', err);
  }
}

/**
 * Get stored quiz from IndexedDB
 */
export async function getStoredQuiz(lessonId: string): Promise<StoredQuiz | null> {
  try {
    const db = await getDB();
    const tx = db.transaction([QUIZ_STORE], 'readonly');
    const store = tx.objectStore(QUIZ_STORE);
    return new Promise((resolve, reject) => {
      const req = store.get(lessonId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to retrieve stored quiz:', err);
    return null;
  }
}

/**
 * Save quiz attempt locally
 */
export async function saveOfflineAttempt(attempt: OfflineAttempt): Promise<string> {
  try {
    const db = await getDB();
    const tx = db.transaction([ATTEMPT_STORE], 'readwrite');
    const store = tx.objectStore(ATTEMPT_STORE);
    const id = `attempt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fullAttempt = { ...attempt, id };

    await new Promise((resolve, reject) => {
      const req = store.put(fullAttempt);
      req.onsuccess = () => resolve(undefined);
      req.onerror = () => reject(req.error);
    });
    return id;
  } catch (err) {
    console.error('Failed to save offline attempt:', err);
    throw err;
  }
}

/**
 * Update offline attempt (answers, status, etc)
 */
export async function updateOfflineAttempt(attempt: OfflineAttempt): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction([ATTEMPT_STORE], 'readwrite');
    const store = tx.objectStore(ATTEMPT_STORE);
    await new Promise((resolve, reject) => {
      const req = store.put(attempt);
      req.onsuccess = () => resolve(undefined);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to update offline attempt:', err);
    throw err;
  }
}

/**
 * Get all pending attempts ready for sync
 */
export async function getPendingAttempts(): Promise<OfflineAttempt[]> {
  try {
    const db = await getDB();
    const tx = db.transaction([ATTEMPT_STORE], 'readonly');
    const store = tx.objectStore(ATTEMPT_STORE);
    const index = store.index('syncStatus');

    return new Promise((resolve, reject) => {
      const req = index.getAll('pending');
      req.onsuccess = () => resolve(req.result as OfflineAttempt[]);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to get pending attempts:', err);
    return [];
  }
}

/**
 * Get all attempts for a lesson
 */
export async function getAttemptsByLesson(lessonId: string): Promise<OfflineAttempt[]> {
  try {
    const db = await getDB();
    const tx = db.transaction([ATTEMPT_STORE], 'readonly');
    const store = tx.objectStore(ATTEMPT_STORE);
    const index = store.index('lessonId');

    return new Promise((resolve, reject) => {
      const req = index.getAll(lessonId);
      req.onsuccess = () => resolve(req.result as OfflineAttempt[]);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to get lesson attempts:', err);
    return [];
  }
}

/**
 * Get a single offline attempt by its local ID
 */
export async function getAttemptById(id: string): Promise<OfflineAttempt | null> {
  try {
    const db = await getDB();
    const tx = db.transaction([ATTEMPT_STORE], 'readonly');
    const store = tx.objectStore(ATTEMPT_STORE);
    return new Promise((resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => resolve((req.result as OfflineAttempt) || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to get attempt by id:', err);
    return null;
  }
}

/**
 * Clear old offline data (older than 30 days)
 */
export async function clearOldOfflineData(): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction([ATTEMPT_STORE], 'readwrite');
    const store = tx.objectStore(ATTEMPT_STORE);
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    // This is simplified - in production would use cursor with range
    const allAttempts = await new Promise<OfflineAttempt[]>((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result as OfflineAttempt[]);
      req.onerror = () => reject(req.error);
    });

    const toDelete = allAttempts
      .filter((a) => a.syncStatus === 'synced' && a.completedAt && a.completedAt < thirtyDaysAgo)
      .map((a) => a.id);

    for (const id of toDelete) {
      await new Promise((resolve, reject) => {
        const req = store.delete(id);
        req.onsuccess = () => resolve(undefined);
        req.onerror = () => reject(req.error);
      });
    }
  } catch (err) {
    console.warn('Failed to clear old offline data:', err);
  }
}
