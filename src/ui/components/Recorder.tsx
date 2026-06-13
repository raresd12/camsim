import { useEffect, useRef, useState } from "react";

/** Preferred first: formats Gemini accepts most reliably. */
const MIME_PREFERENCES = [
  "audio/ogg;codecs=opus",
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
];

export function pickRecorderMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const mime of MIME_PREFERENCES) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return "";
}

export interface RecordingResult {
  blob: Blob;
  mimeType: string;
  durationSeconds: number;
}

/**
 * MediaRecorder wrapper: starts immediately on mount, auto-stops at
 * maxSeconds, allows stopping early. Calls onComplete exactly once.
 */
export function Recorder({
  maxSeconds,
  onComplete,
  onError,
}: {
  maxSeconds: number;
  onComplete: (result: RecordingResult) => void;
  onError: (message: string) => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const [active, setActive] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const startedAtRef = useRef(0);
  const finishedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let interval: number | null = null;
    const chunks: BlobPart[] = [];

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        onError("Microphone access was denied. Check browser permissions and reload.");
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const mimeType = pickRecorderMime();
      let recorder: MediaRecorder;
      try {
        recorder = mimeType
          ? new MediaRecorder(stream, { mimeType })
          : new MediaRecorder(stream);
      } catch {
        onError("Recording is not supported in this browser.");
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        stream?.getTracks().forEach((t) => t.stop());
        if (finishedRef.current) return;
        finishedRef.current = true;
        const type = recorder.mimeType || mimeType || "audio/webm";
        onComplete({
          blob: new Blob(chunks, { type }),
          mimeType: type,
          durationSeconds: Math.round((Date.now() - startedAtRef.current) / 1000),
        });
      };
      recorder.start(1000);
      setActive(true);
      interval = window.setInterval(() => {
        const seconds = Math.floor((Date.now() - startedAtRef.current) / 1000);
        setElapsed(seconds);
        if (seconds >= maxSeconds && recorder.state === "recording") {
          recorder.stop();
        }
      }, 250);
    }

    void start();
    return () => {
      cancelled = true;
      if (interval !== null) window.clearInterval(interval);
      const recorder = recorderRef.current;
      if (recorder && recorder.state === "recording") {
        // Unmounting mid-recording: stop tracks without reporting a result.
        finishedRef.current = true;
        recorder.stop();
      }
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const remaining = Math.max(0, maxSeconds - elapsed);

  return (
    <div className="flex items-center gap-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
      <span className="relative flex h-3 w-3">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
      </span>
      <div className="flex-1">
        <div className="text-sm font-semibold text-red-700">
          {active ? "Recording…" : "Starting microphone…"}
        </div>
        <div className="font-mono text-sm tabular-nums text-red-600">
          {elapsed}s elapsed · {remaining}s left
        </div>
      </div>
      <button
        className="btn-secondary"
        disabled={!active}
        onClick={() => {
          const r = recorderRef.current;
          if (r && r.state === "recording") r.stop();
        }}
      >
        Stop early
      </button>
    </div>
  );
}
