/**
 * Exam session state machine. Pure transition functions plus a vanilla
 * zustand store (zustand/vanilla has no React dependency). Persistence is
 * injected — the db layer wires it to Dexie.
 */
import { createStore, type StoreApi } from "zustand/vanilla";
import type { ExamPackage } from "../schema/exam";

export type PaperKind = "reading" | "writing" | "listening" | "speaking";
export type SessionMode = "mock" | "single";
export type PaperStatus = "not-started" | "in-progress" | "submitted";
export type SessionPhase = "between-papers" | "in-paper" | "completed";

export const PAPER_LABELS: Record<PaperKind, string> = {
  reading: "Reading & Use of English",
  writing: "Writing",
  listening: "Listening",
  speaking: "Speaking",
};

export const FULL_MOCK_ORDER: PaperKind[] = ["reading", "writing", "listening", "speaking"];

/** Speaking is driven by the part flow; the timer is only a generous backstop. */
const SPEAKING_BACKSTOP_SECONDS = 25 * 60;

export interface WritingDraft {
  part1Text: string;
  part2OptionId: string | null;
  part2Text: string;
}

export interface PaperProgress {
  kind: PaperKind;
  status: PaperStatus;
  totalSeconds: number;
  remainingSeconds: number;
  answers: Record<string, string>;
  writing?: WritingDraft;
  startedAt: number | null;
  submittedAt: number | null;
}

export interface SessionState {
  attemptId: string;
  examId: string;
  mode: SessionMode;
  paperOrder: PaperKind[];
  currentIndex: number;
  phase: SessionPhase;
  /** True when the timer is held (single-paper pause, or crash recovery). */
  paused: boolean;
  papers: Partial<Record<PaperKind, PaperProgress>>;
  startedAt: number;
  completedAt: number | null;
}

export type SessionEvent =
  | { type: "warning"; minutesLeft: 10 | 1; paper: PaperKind }
  | { type: "auto-submit"; paper: PaperKind }
  | { type: "paper-submitted"; paper: PaperKind }
  | { type: "completed" };

export function paperDurationSeconds(exam: ExamPackage, kind: PaperKind): number {
  switch (kind) {
    case "reading":
      return exam.reading.durationMinutes * 60;
    case "writing":
      return exam.writing.durationMinutes * 60;
    case "listening":
      return exam.listening.durationMinutes * 60;
    case "speaking":
      return SPEAKING_BACKSTOP_SECONDS;
  }
}

export interface CreateSessionArgs {
  attemptId: string;
  examId: string;
  mode: SessionMode;
  paperOrder: PaperKind[];
  durations: Record<PaperKind, number>;
  now?: number;
}

export function createSessionState(args: CreateSessionArgs): SessionState {
  if (args.paperOrder.length === 0) {
    throw new Error("A session needs at least one paper");
  }
  const papers: Partial<Record<PaperKind, PaperProgress>> = {};
  for (const kind of args.paperOrder) {
    const total = args.durations[kind];
    papers[kind] = {
      kind,
      status: "not-started",
      totalSeconds: total,
      remainingSeconds: total,
      answers: {},
      writing:
        kind === "writing"
          ? { part1Text: "", part2OptionId: null, part2Text: "" }
          : undefined,
      startedAt: null,
      submittedAt: null,
    };
  }
  return {
    attemptId: args.attemptId,
    examId: args.examId,
    mode: args.mode,
    paperOrder: args.paperOrder,
    currentIndex: 0,
    phase: "between-papers",
    paused: false,
    papers,
    startedAt: args.now ?? Date.now(),
    completedAt: null,
  };
}

export function currentPaperKind(state: SessionState): PaperKind | null {
  if (state.phase === "completed") return null;
  return state.paperOrder[state.currentIndex] ?? null;
}

export function currentPaper(state: SessionState): PaperProgress | null {
  const kind = currentPaperKind(state);
  return kind ? (state.papers[kind] ?? null) : null;
}

function withPaper(
  state: SessionState,
  kind: PaperKind,
  update: (p: PaperProgress) => PaperProgress,
): SessionState {
  const paper = state.papers[kind];
  if (!paper) return state;
  return { ...state, papers: { ...state.papers, [kind]: update(paper) } };
}

export function beginCurrentPaper(state: SessionState, now = Date.now()): SessionState {
  const kind = currentPaperKind(state);
  if (!kind || state.phase !== "between-papers") return state;
  const next = withPaper(state, kind, (p) => ({
    ...p,
    status: "in-progress",
    startedAt: p.startedAt ?? now,
  }));
  return { ...next, phase: "in-paper", paused: false };
}

export function setAnswer(state: SessionState, questionId: string, value: string): SessionState {
  const kind = currentPaperKind(state);
  if (!kind || state.phase !== "in-paper") return state;
  return withPaper(state, kind, (p) => ({
    ...p,
    answers: { ...p.answers, [questionId]: value },
  }));
}

export function updateWriting(state: SessionState, patch: Partial<WritingDraft>): SessionState {
  if (currentPaperKind(state) !== "writing" || state.phase !== "in-paper") return state;
  return withPaper(state, "writing", (p) => ({
    ...p,
    writing: { ...(p.writing ?? { part1Text: "", part2OptionId: null, part2Text: "" }), ...patch },
  }));
}

function advance(state: SessionState, now: number): { state: SessionState; events: SessionEvent[] } {
  const events: SessionEvent[] = [];
  if (state.currentIndex + 1 < state.paperOrder.length) {
    return {
      state: { ...state, currentIndex: state.currentIndex + 1, phase: "between-papers", paused: false },
      events,
    };
  }
  events.push({ type: "completed" });
  return {
    state: { ...state, phase: "completed", completedAt: now, paused: false },
    events,
  };
}

export function submitCurrentPaper(
  state: SessionState,
  now = Date.now(),
): { state: SessionState; events: SessionEvent[] } {
  const kind = currentPaperKind(state);
  if (!kind || state.phase !== "in-paper") return { state, events: [] };
  const submitted = withPaper(state, kind, (p) => ({
    ...p,
    status: "submitted" as const,
    submittedAt: now,
  }));
  const { state: next, events } = advance(submitted, now);
  return { state: next, events: [{ type: "paper-submitted", paper: kind }, ...events] };
}

/**
 * Advance the countdown by `seconds` (normally 1, called by a UI interval).
 * Emits warnings when crossing 10min/1min and auto-submits at zero.
 */
export function tickTimer(
  state: SessionState,
  seconds = 1,
  now = Date.now(),
): { state: SessionState; events: SessionEvent[] } {
  const kind = currentPaperKind(state);
  if (!kind || state.phase !== "in-paper" || state.paused) return { state, events: [] };
  const paper = state.papers[kind];
  if (!paper || paper.status !== "in-progress") return { state, events: [] };

  const before = paper.remainingSeconds;
  const after = Math.max(0, before - seconds);
  const events: SessionEvent[] = [];
  if (before > 600 && after <= 600) events.push({ type: "warning", minutesLeft: 10, paper: kind });
  if (before > 60 && after <= 60) events.push({ type: "warning", minutesLeft: 1, paper: kind });

  let next = withPaper(state, kind, (p) => ({ ...p, remainingSeconds: after }));

  if (after === 0) {
    events.push({ type: "auto-submit", paper: kind });
    const result = submitCurrentPaper(next, now);
    return { state: result.state, events: [...events, ...result.events] };
  }
  return { state: next, events };
}

/** Pausing is a single-paper-mode feature; Full Mock never pauses. */
export function pauseSession(state: SessionState): SessionState {
  if (state.mode !== "single" || state.phase !== "in-paper") return state;
  return { ...state, paused: true };
}

export function resumeSession(state: SessionState): SessionState {
  if (!state.paused) return state;
  return { ...state, paused: false };
}

/** Crash recovery: rehydrate a persisted session, holding the timer. */
export function hydrateSession(persisted: SessionState): SessionState {
  if (persisted.phase === "in-paper") {
    return { ...persisted, paused: true };
  }
  return persisted;
}

// ----------------------------------------------------------------- store

export interface SessionStoreValue {
  session: SessionState;
  /** Incremented every tick; persistence fires every 5 ticks (≈5s). */
  tickCount: number;
  begin: () => void;
  answer: (questionId: string, value: string) => void;
  writing: (patch: Partial<WritingDraft>) => void;
  tick: () => void;
  submit: () => void;
  pause: () => void;
  resume: () => void;
  persistNow: () => void;
}

export interface SessionHooks {
  persist?: (state: SessionState) => void;
  onEvent?: (event: SessionEvent) => void;
  now?: () => number;
}

export type SessionStore = StoreApi<SessionStoreValue>;

const PERSIST_EVERY_TICKS = 5;

export function createSessionStore(
  initial: SessionState,
  hooks: SessionHooks = {},
): SessionStore {
  const now = hooks.now ?? (() => Date.now());
  const emit = (events: SessionEvent[]) => {
    for (const e of events) hooks.onEvent?.(e);
  };

  return createStore<SessionStoreValue>((set, get) => {
    const apply = (next: SessionState, persist = false) => {
      set({ session: next });
      if (persist) hooks.persist?.(next);
    };
    return {
      session: initial,
      tickCount: 0,
      begin: () => apply(beginCurrentPaper(get().session, now()), true),
      answer: (questionId, value) => apply(setAnswer(get().session, questionId, value)),
      writing: (patch) => apply(updateWriting(get().session, patch)),
      tick: () => {
        const { state, events } = tickTimer(get().session, 1, now());
        const tickCount = get().tickCount + 1;
        set({ session: state, tickCount });
        emit(events);
        const submitted = events.some(
          (e) => e.type === "paper-submitted" || e.type === "completed",
        );
        if (submitted || tickCount % PERSIST_EVERY_TICKS === 0) {
          hooks.persist?.(state);
        }
      },
      submit: () => {
        const { state, events } = submitCurrentPaper(get().session, now());
        set({ session: state });
        emit(events);
        hooks.persist?.(state);
      },
      pause: () => apply(pauseSession(get().session), true),
      resume: () => apply(resumeSession(get().session), true),
      persistNow: () => hooks.persist?.(get().session),
    };
  });
}
