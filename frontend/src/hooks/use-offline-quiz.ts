/**
 * Hook for managing offline-first quiz attempts
 * Handles local storage, sync detection, and background sync
 */

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  storeQuizLocally,
  getStoredQuiz,
  saveOfflineAttempt,
  updateOfflineAttempt,
  getPendingAttempts,
  getAttemptsByLesson,
  clearOldOfflineData,
  OfflineAttempt,
  StoredQuiz,
} from '@/lib/offline-quiz';
import { api } from '@/lib/api';

export interface OfflineQuizState {
  isOnline: boolean;
  hasLocalQuiz: boolean;
  pendingAttempts: number;
  syncInProgress: boolean;
  lastSyncTime: number | null;
}

export interface UseOfflineQuizReturn {
  state: OfflineQuizState;
  cacheQuiz: (lesson: any) => Promise<void>;
  createLocalAttempt: (lessonId: string) => Promise<string>;
  updateLocalAttempt: (attemptId: string, answers: any, completed: boolean) => Promise<void>;
  syncAttempts: () => Promise<void>;
  getLocalAttempt: (attemptId: string) => Promise<OfflineAttempt | null>;
}

/**
 * Custom hook for offline quiz management
 */
export function useOfflineQuiz(): UseOfflineQuizReturn {
  const [isOnline, setIsOnline] = useState(true);
  const [hasLocalQuiz, setHasLocalQuiz] = useState(false);
  const [pendingAttempts, setPendingAttempts] = useState(0);
  const [syncInProgress, setSyncInProgress] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const syncTimeoutRef = useRef<NodeJS.Timeout>();

  // Detect online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      console.log('✅ Online - attempting to sync quiz attempts');
      // Auto-sync when comes back online
      setTimeout(() => syncAttemptsInternal(), 500);
    };

    const handleOffline = () => {
      setIsOnline(false);
      console.log('📡 Offline - quiz attempts will be saved locally');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Set initial state
    setIsOnline(navigator.onLine);

    // Cleanup old data on mount
    clearOldOfflineData();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Update pending attempts count periodically
  useEffect(() => {
    const updatePending = async () => {
      const pending = await getPendingAttempts();
      setPendingAttempts(pending.length);
    };

    updatePending();
    const interval = setInterval(updatePending, 5000);

    return () => clearInterval(interval);
  }, []);

  /**
   * Cache quiz locally for offline access
   */
  const cacheQuiz = useCallback(async (lesson: any): Promise<void> => {
    try {
      if (lesson.type !== 'MCQ' || !lesson.questions) return;

      const quiz: StoredQuiz = {
        lessonId: lesson.id,
        title: lesson.title,
        questions: lesson.questions.map((q: any) => ({
          id: q.id,
          question: q.question,
          options: q.options,
        })),
        storedAt: Date.now(),
      };

      await storeQuizLocally(quiz);
      setHasLocalQuiz(true);
      console.log(`📚 Quiz cached: ${lesson.title}`);
    } catch (err) {
      console.error('Failed to cache quiz:', err);
    }
  }, []);

  /**
   * Create a new local attempt
   */
  const createLocalAttempt = useCallback(async (lessonId: string): Promise<string> => {
    const attempt: OfflineAttempt = {
      id: '', // Will be set by saveOfflineAttempt
      lessonId,
      answers: [],
      startedAt: Date.now(),
      completedAt: null,
      syncStatus: isOnline ? 'completed' : 'pending',
    };

    const id = await saveOfflineAttempt(attempt);
    console.log(`📝 Local attempt created: ${id}`);
    return id;
  }, [isOnline]);

  /**
   * Update local attempt with answers
   */
  const updateLocalAttempt = useCallback(
    async (attemptId: string, answers: any, completed: boolean): Promise<void> => {
      const attempts = await getAttemptsByLesson(attemptId); // This is not ideal, but for now
      const attempt = attempts.find((a) => a.id === attemptId);

      if (!attempt) {
        console.warn(`Attempt not found: ${attemptId}`);
        return;
      }

      attempt.answers = answers;
      if (completed) {
        attempt.completedAt = Date.now();
        attempt.syncStatus = isOnline ? 'completed' : 'pending';
      }

      await updateOfflineAttempt(attempt);
      console.log(`✏️  Attempt updated: ${attemptId}`);
    },
    [isOnline]
  );

  /**
   * Sync all pending attempts to backend
   */
  const syncAttemptsInternal = async (): Promise<void> => {
    if (!isOnline || syncInProgress) return;

    setSyncInProgress(true);
    try {
      const pending = await getPendingAttempts();

      if (pending.length === 0) {
        console.log('✅ No pending attempts to sync');
        setSyncInProgress(false);
        return;
      }

      console.log(`🔄 Syncing ${pending.length} attempt(s)...`);

      for (const attempt of pending) {
        try {
          const response = await api.post('/lessons/sync-attempt', {
            lessonId: attempt.lessonId,
            answers: attempt.answers,
            clientId: attempt.id,
          });

          attempt.syncStatus = 'synced';
          attempt.attemptId = response.attemptId;
          await updateOfflineAttempt(attempt);

          console.log(`✅ Attempt synced: ${attempt.id}`);
        } catch (err: any) {
          attempt.syncStatus = 'error';
          attempt.syncError = err.message || 'Sync failed';
          await updateOfflineAttempt(attempt);
          console.error(`❌ Failed to sync attempt ${attempt.id}:`, err);
        }
      }

      setLastSyncTime(Date.now());
      const updated = await getPendingAttempts();
      setPendingAttempts(updated.length);
    } catch (err) {
      console.error('Sync process failed:', err);
    } finally {
      setSyncInProgress(false);
    }
  };

  const syncAttempts = useCallback(async (): Promise<void> => {
    return syncAttemptsInternal();
  }, [isOnline, syncInProgress]);

  /**
   * Get a local attempt (useful for resuming)
   */
  const getLocalAttempt = useCallback(async (attemptId: string): Promise<OfflineAttempt | null> => {
    try {
      const db = await import('@/lib/offline-quiz').then((m) => m.getDB?.());
      if (!db) return null;

      // Simple in-memory cache for now
      const attempts = await getPendingAttempts();
      return attempts.find((a) => a.id === attemptId) || null;
    } catch (err) {
      console.error('Failed to get local attempt:', err);
      return null;
    }
  }, []);

  return {
    state: {
      isOnline,
      hasLocalQuiz,
      pendingAttempts,
      syncInProgress,
      lastSyncTime,
    },
    cacheQuiz,
    createLocalAttempt,
    updateLocalAttempt,
    syncAttempts,
    getLocalAttempt,
  };
}
