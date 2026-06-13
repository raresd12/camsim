/**
 * Listening playback. Two modes:
 * - Strict conductor (mock): per part, 45s announcement pause → recording
 *   plays → 15s pause → recording plays again → next part. No scrubbing or
 *   replay; "Recording 1 of 2" indicator. TTS reads the transcript when the
 *   part has no audio asset.
 * - Practice player (single paper, strictness off): normal controls.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { ListeningPart } from "../../core/schema/exam";
import { cancelSpeech, speak, ttsSupported } from "../lib/tts";

export type ConductorPhase =
  | "idle"
  | "announce"
  | "playing"
  | "between"
  | "finished";

export interface ConductorState {
  partIndex: number;
  phase: ConductorPhase;
  /** 1 or 2 while playing/between. */
  recordingNumber: 1 | 2;
  /** Seconds left in announce/between countdowns. */
  countdown: number;
  usingTts: boolean;
}

export function useListeningConductor({
  parts,
  urls,
  shortPauses,
  onAllFinished,
}: {
  parts: ListeningPart[];
  /** Object URL per part, or null → TTS fallback. */
  urls: Array<string | null>;
  shortPauses: boolean;
  onAllFinished?: () => void;
}) {
  const announceSeconds = shortPauses ? 5 : 45;
  const gapSeconds = shortPauses ? 3 : 15;

  const [state, setState] = useState<ConductorState>({
    partIndex: 0,
    phase: "idle",
    recordingNumber: 1,
    countdown: 0,
    usingTts: false,
  });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const stopEverything = useCallback(() => {
    cancelledRef.current = true;
    clearTimer();
    cancelSpeech();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  }, []);

  useEffect(() => () => stopEverything(), [stopEverything]);

  const runCountdown = useCallback(
    (seconds: number, phase: ConductorPhase, partIndex: number, rec: 1 | 2) =>
      new Promise<void>((resolve) => {
        let left = seconds;
        setState((s) => ({ ...s, phase, partIndex, recordingNumber: rec, countdown: left }));
        clearTimer();
        timerRef.current = window.setInterval(() => {
          left -= 1;
          if (cancelledRef.current) {
            clearTimer();
            resolve();
            return;
          }
          setState((s) => ({ ...s, countdown: Math.max(0, left) }));
          if (left <= 0) {
            clearTimer();
            resolve();
          }
        }, 1000);
      }),
    [],
  );

  const playOnce = useCallback(
    (partIndex: number, rec: 1 | 2) =>
      new Promise<void>((resolve) => {
        const url = urls[partIndex];
        const part = parts[partIndex];
        setState((s) => ({
          ...s,
          phase: "playing",
          partIndex,
          recordingNumber: rec,
          usingTts: !url,
          countdown: 0,
        }));
        if (url) {
          const audio = new Audio(url);
          audioRef.current = audio;
          audio.onended = () => resolve();
          audio.onerror = () => resolve();
          void audio.play().catch(() => resolve());
        } else if (ttsSupported()) {
          void speak(part.transcript).then(resolve);
        } else {
          resolve();
        }
      }),
    [parts, urls],
  );

  /** Run the full sequence from the given part to the end. */
  const start = useCallback(
    async (fromPart = 0) => {
      cancelledRef.current = false;
      for (let i = fromPart; i < parts.length; i++) {
        if (cancelledRef.current) return;
        await runCountdown(announceSeconds, "announce", i, 1);
        if (cancelledRef.current) return;
        await playOnce(i, 1);
        if (cancelledRef.current) return;
        await runCountdown(gapSeconds, "between", i, 2);
        if (cancelledRef.current) return;
        await playOnce(i, 2);
      }
      if (!cancelledRef.current) {
        setState((s) => ({ ...s, phase: "finished" }));
        onAllFinished?.();
      }
    },
    [announceSeconds, gapSeconds, onAllFinished, parts.length, playOnce, runCountdown],
  );

  return { state, start, stop: stopEverything };
}

export function ConductorBanner({ state, partCount }: { state: ConductorState; partCount: number }) {
  if (state.phase === "idle") return null;
  if (state.phase === "finished") {
    return (
      <div className="rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
        All recordings have been played. Review your answers, then submit the paper.
      </div>
    );
  }
  const label =
    state.phase === "announce"
      ? `Part ${state.partIndex + 1} of ${partCount} — read the questions. Audio starts in ${state.countdown}s`
      : state.phase === "between"
        ? `Part ${state.partIndex + 1} — second playback starts in ${state.countdown}s`
        : `Part ${state.partIndex + 1} — playing${state.usingTts ? " (TTS fallback)" : ""}`;
  return (
    <div className="flex items-center justify-between rounded-lg border border-cam-500 bg-cam-50 px-4 py-3">
      <div className="flex items-center gap-3 text-sm font-medium text-cam-700">
        {state.phase === "playing" && (
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute h-full w-full animate-ping rounded-full bg-cam-500 opacity-60" />
            <span className="relative h-2.5 w-2.5 rounded-full bg-cam-600" />
          </span>
        )}
        {label}
      </div>
      <span className="rounded-full bg-cam-600 px-3 py-1 text-xs font-semibold text-white">
        Recording {state.recordingNumber} of 2
      </span>
    </div>
  );
}

/** Free playback for practice mode (replay + scrubbing allowed). */
export function PracticePlayer({ url, transcript }: { url: string | null; transcript: string }) {
  const [speaking, setSpeaking] = useState(false);
  if (url) {
    return <audio controls src={url} className="w-full" preload="metadata" />;
  }
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      No audio file in this package — using text-to-speech.
      <button
        className="btn-secondary ml-3"
        disabled={speaking || !ttsSupported()}
        onClick={() => {
          setSpeaking(true);
          void speak(transcript).then(() => setSpeaking(false));
        }}
      >
        {speaking ? "Speaking…" : "▶ Read transcript aloud"}
      </button>
      <button className="btn-secondary ml-2" disabled={!speaking} onClick={() => { cancelSpeech(); setSpeaking(false); }}>
        Stop
      </button>
    </div>
  );
}
