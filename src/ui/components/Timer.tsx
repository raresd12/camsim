import { useEffect, useRef } from "react";
import type { SessionStore } from "../../core/session/examSession";
import { useRemainingSeconds, useSessionValue } from "../state/session";

export function formatClock(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * Countdown display for the active paper. Drives the store's 1-second tick
 * (which also persists the session every 5 ticks for crash recovery).
 */
export function Timer({ store }: { store: SessionStore }) {
  const remaining = useRemainingSeconds(store);
  const { session } = useSessionValue(store);
  const intervalRef = useRef<number | null>(null);

  const running = session.phase === "in-paper" && !session.paused;

  useEffect(() => {
    if (!running) return;
    intervalRef.current = window.setInterval(() => {
      store.getState().tick();
    }, 1000);
    return () => {
      if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    };
  }, [running, store]);

  const tone =
    remaining <= 60
      ? "bg-red-100 text-red-700 border-red-300 animate-pulse"
      : remaining <= 600
        ? "bg-amber-100 text-amber-800 border-amber-300"
        : "bg-slate-100 text-slate-700 border-slate-300";

  return (
    <div
      className={`rounded-md border px-3 py-1.5 font-mono text-lg font-semibold tabular-nums ${tone}`}
      title={session.paused ? "Timer paused" : "Time remaining"}
    >
      {session.paused ? "⏸ " : ""}
      {formatClock(remaining)}
    </div>
  );
}
