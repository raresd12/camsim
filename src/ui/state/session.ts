/**
 * Wires the core session store (zustand/vanilla) to React and Dexie:
 * attempt creation, crash recovery, periodic persistence.
 */
import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { useStore } from "zustand";
import {
  createSessionState,
  createSessionStore,
  hydrateSession,
  paperDurationSeconds,
  type PaperKind,
  type SessionEvent,
  type SessionMode,
  type SessionStore,
  type SessionStoreValue,
} from "../../core/session/examSession";
import type { ExamPackage } from "../../core/schema/exam";
import { db, saveSessionSnapshot, type AttemptRecord } from "../../db/db";

interface ActiveAttempt {
  store: SessionStore;
  exam: ExamPackage;
  attemptId: string;
}

interface ActiveAttemptHolder {
  active: ActiveAttempt | null;
  setActive: (a: ActiveAttempt | null) => void;
}

const useHolder = create<ActiveAttemptHolder>((set) => ({
  active: null,
  setActive: (active) => set({ active }),
}));

export type SessionEventListener = (event: SessionEvent) => void;
const eventListeners = new Set<SessionEventListener>();

export function onSessionEvent(listener: SessionEventListener): () => void {
  eventListeners.add(listener);
  return () => eventListeners.delete(listener);
}

function makeStore(initial: Parameters<typeof createSessionStore>[0]): SessionStore {
  return createSessionStore(initial, {
    persist: (state) => {
      void saveSessionSnapshot(state);
    },
    onEvent: (event) => {
      for (const l of eventListeners) l(event);
    },
  });
}

export async function startAttempt(
  exam: ExamPackage,
  mode: SessionMode,
  paperOrder: PaperKind[],
): Promise<string> {
  const attemptId = crypto.randomUUID();
  const durations = {
    reading: paperDurationSeconds(exam, "reading"),
    writing: paperDurationSeconds(exam, "writing"),
    listening: paperDurationSeconds(exam, "listening"),
    speaking: paperDurationSeconds(exam, "speaking"),
  };
  const session = createSessionState({
    attemptId,
    examId: exam.meta.id,
    mode,
    paperOrder,
    durations,
  });
  const record: AttemptRecord = {
    id: attemptId,
    examId: exam.meta.id,
    mode,
    startedAt: session.startedAt,
    status: "in-progress",
    session,
  };
  await db.attempts.add(record);
  useHolder.getState().setActive({ store: makeStore(session), exam, attemptId });
  return attemptId;
}

/** Load an in-progress attempt from Dexie (crash recovery / resume). */
export async function resumeAttempt(attemptId: string): Promise<boolean> {
  const existing = useHolder.getState().active;
  if (existing?.attemptId === attemptId) return true;

  const attempt = await db.attempts.get(attemptId);
  if (!attempt || attempt.status !== "in-progress") return false;
  const exam = await db.exams.get(attempt.examId);
  if (!exam) return false;

  const session = hydrateSession(attempt.session);
  useHolder.getState().setActive({ store: makeStore(session), exam: exam.pkg, attemptId });
  return true;
}

export function clearActiveAttempt(): void {
  useHolder.getState().setActive(null);
}

export function useActiveAttempt(): ActiveAttempt | null {
  return useHolder((s) => s.active);
}

/** Subscribe to the live session value of the active attempt's store. */
export function useSessionValue(store: SessionStore): SessionStoreValue {
  return useStore(store);
}

/** Re-render every second while a paper timer is running (cheap selector). */
export function useRemainingSeconds(store: SessionStore): number {
  return useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => {
      const s = store.getState().session;
      const kind = s.paperOrder[s.currentIndex];
      return kind ? (s.papers[kind]?.remainingSeconds ?? 0) : 0;
    },
  );
}
