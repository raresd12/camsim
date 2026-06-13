import { describe, expect, it, vi } from "vitest";
import {
  beginCurrentPaper,
  createSessionState,
  createSessionStore,
  currentPaperKind,
  FULL_MOCK_ORDER,
  hydrateSession,
  pauseSession,
  resumeSession,
  setAnswer,
  submitCurrentPaper,
  tickTimer,
  type SessionEvent,
  type SessionState,
} from "./examSession";

const DURATIONS = { reading: 5400, writing: 5400, listening: 2400, speaking: 1500 };

function mockSession(): SessionState {
  return createSessionState({
    attemptId: "att-1",
    examId: "exam-1",
    mode: "mock",
    paperOrder: FULL_MOCK_ORDER,
    durations: DURATIONS,
    now: 1000,
  });
}

function singleSession(): SessionState {
  return createSessionState({
    attemptId: "att-2",
    examId: "exam-1",
    mode: "single",
    paperOrder: ["reading"],
    durations: DURATIONS,
    now: 1000,
  });
}

describe("session lifecycle", () => {
  it("starts between papers with everything not-started", () => {
    const s = mockSession();
    expect(s.phase).toBe("between-papers");
    expect(currentPaperKind(s)).toBe("reading");
    expect(s.papers.reading?.status).toBe("not-started");
    expect(s.papers.reading?.remainingSeconds).toBe(5400);
  });

  it("begins a paper and records answers only while in it", () => {
    let s = mockSession();
    // answers are ignored before the paper starts
    s = setAnswer(s, "r1q1", "A");
    expect(s.papers.reading?.answers).toEqual({});
    s = beginCurrentPaper(s, 2000);
    expect(s.phase).toBe("in-paper");
    s = setAnswer(s, "r1q1", "A");
    expect(s.papers.reading?.answers).toEqual({ r1q1: "A" });
  });

  it("advances through the full mock order on submit", () => {
    let s = mockSession();
    for (const expected of FULL_MOCK_ORDER) {
      expect(currentPaperKind(s)).toBe(expected);
      s = beginCurrentPaper(s);
      s = submitCurrentPaper(s).state;
    }
    expect(s.phase).toBe("completed");
    expect(s.completedAt).not.toBeNull();
  });

  it("completes immediately after the only paper in single mode", () => {
    let s = singleSession();
    s = beginCurrentPaper(s);
    const { state, events } = submitCurrentPaper(s);
    expect(state.phase).toBe("completed");
    expect(events.map((e) => e.type)).toEqual(["paper-submitted", "completed"]);
  });
});

describe("timer", () => {
  it("counts down and emits warnings crossing 10min and 1min", () => {
    let s = beginCurrentPaper(mockSession());
    s.papers.reading!.remainingSeconds = 601;
    let result = tickTimer(s);
    expect(result.events).toEqual([{ type: "warning", minutesLeft: 10, paper: "reading" }]);
    result.state.papers.reading!.remainingSeconds = 61;
    result = tickTimer(result.state);
    expect(result.events).toEqual([{ type: "warning", minutesLeft: 1, paper: "reading" }]);
  });

  it("auto-submits at zero and advances to the next paper", () => {
    let s = beginCurrentPaper(mockSession());
    s.papers.reading!.remainingSeconds = 1;
    const { state, events } = tickTimer(s);
    expect(events.map((e) => e.type)).toEqual(["auto-submit", "paper-submitted"]);
    expect(state.papers.reading?.status).toBe("submitted");
    expect(state.phase).toBe("between-papers");
    expect(currentPaperKind(state)).toBe("writing");
  });

  it("does not tick while paused or between papers", () => {
    const betweenPapers = mockSession();
    expect(tickTimer(betweenPapers).state).toBe(betweenPapers);

    let single = beginCurrentPaper(singleSession());
    single = pauseSession(single);
    expect(tickTimer(single).state).toBe(single);
    const resumed = resumeSession(single);
    expect(tickTimer(resumed).state.papers.reading?.remainingSeconds).toBe(5399);
  });

  it("ignores pause in mock mode", () => {
    const s = beginCurrentPaper(mockSession());
    expect(pauseSession(s).paused).toBe(false);
  });
});

describe("crash recovery", () => {
  it("rehydrates an in-paper session with the timer held", () => {
    let s = beginCurrentPaper(mockSession());
    s.papers.reading!.remainingSeconds = 1234;
    const restored = hydrateSession(s);
    expect(restored.paused).toBe(true);
    expect(restored.papers.reading?.remainingSeconds).toBe(1234);
    const resumed = resumeSession(restored);
    expect(tickTimer(resumed).state.papers.reading?.remainingSeconds).toBe(1233);
  });
});

describe("createSessionStore", () => {
  it("persists every 5 ticks and on submit, and forwards events", () => {
    const persist = vi.fn();
    const events: SessionEvent[] = [];
    const store = createSessionStore(mockSession(), {
      persist,
      onEvent: (e) => events.push(e),
      now: () => 99,
    });

    store.getState().begin();
    expect(persist).toHaveBeenCalledTimes(1); // begin persists

    for (let i = 0; i < 5; i++) store.getState().tick();
    expect(persist).toHaveBeenCalledTimes(2); // 5th tick persists
    expect(store.getState().session.papers.reading?.remainingSeconds).toBe(5395);

    store.getState().answer("r1q1", "C");
    expect(store.getState().session.papers.reading?.answers.r1q1).toBe("C");

    store.getState().submit();
    expect(persist).toHaveBeenCalledTimes(3);
    expect(events.some((e) => e.type === "paper-submitted")).toBe(true);
  });

  it("emits auto-submit through the store tick", () => {
    const events: SessionEvent[] = [];
    const store = createSessionStore(
      createSessionState({
        attemptId: "a",
        examId: "e",
        mode: "single",
        paperOrder: ["listening"],
        durations: { ...DURATIONS, listening: 1 },
      }),
      { onEvent: (e) => events.push(e) },
    );
    store.getState().begin();
    store.getState().tick();
    expect(events.map((e) => e.type)).toEqual(["auto-submit", "paper-submitted", "completed"]);
    expect(store.getState().session.phase).toBe("completed");
  });
});
