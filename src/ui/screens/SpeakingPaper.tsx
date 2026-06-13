/**
 * Solo speaking simulation: per part, TTS reads the examiner script →
 * prep countdown → recording for responseSeconds (early stop allowed).
 * Each part's recording is stored as a separate Blob in Dexie.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { ExamPackage, SpeakingPart } from "../../core/schema/exam";
import type { SessionStore } from "../../core/session/examSession";
import { useSessionValue } from "../state/session";
import { db, recordingKey } from "../../db/db";
import { cancelSpeech, speak, ttsSupported } from "../lib/tts";
import { useAssetUrl } from "../lib/assets";
import { Recorder, type RecordingResult } from "../components/Recorder";

type Phase = "ready" | "intro" | "prep" | "recording" | "saving" | "finished";

function PartImage({ examId, path }: { examId: string; path: string }) {
  const url = useAssetUrl(examId, path);
  if (!url) return null;
  return <img src={url} alt="Speaking task material" className="max-h-72 rounded-lg border" />;
}

export function SpeakingPaper({ exam, store }: { exam: ExamPackage; store: SessionStore }) {
  const { session } = useSessionValue(store);
  const parts = exam.speaking.parts;
  const attemptId = session.attemptId;

  const [partIndex, setPartIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("ready");
  const [prepLeft, setPrepLeft] = useState(0);
  const [scriptLine, setScriptLine] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  const part: SpeakingPart | undefined = parts[partIndex];

  // Backstop ticking (persists the session every ~5s like the other papers).
  useEffect(() => {
    if (session.phase !== "in-paper") return;
    const interval = window.setInterval(() => store.getState().tick(), 1000);
    return () => window.clearInterval(interval);
  }, [session.phase, store]);

  useEffect(
    () => () => {
      cancelledRef.current = true;
      cancelSpeech();
    },
    [],
  );

  const runIntroAndPrep = useCallback(
    async (p: SpeakingPart) => {
      setPhase("intro");
      setScriptLine(0);
      for (let i = 0; i < p.examinerScript.length; i++) {
        if (cancelledRef.current) return;
        setScriptLine(i);
        await speak(p.examinerScript[i]);
      }
      if (cancelledRef.current) return;
      if (p.prepSeconds > 0) {
        setPhase("prep");
        for (let left = p.prepSeconds; left > 0; left--) {
          if (cancelledRef.current) return;
          setPrepLeft(left);
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
      if (cancelledRef.current) return;
      setPhase("recording");
    },
    [],
  );

  const startPart = useCallback(() => {
    if (!part) return;
    setError(null);
    void runIntroAndPrep(part);
  }, [part, runIntroAndPrep]);

  const handleRecordingComplete = useCallback(
    async (result: RecordingResult) => {
      if (!part) return;
      setPhase("saving");
      await db.recordings.put({
        key: recordingKey(attemptId, part.id),
        attemptId,
        partId: part.id,
        mimeType: result.mimeType,
        durationSeconds: result.durationSeconds,
        blob: result.blob,
      });
      if (partIndex + 1 < parts.length) {
        setPartIndex(partIndex + 1);
        setPhase("ready");
      } else {
        setPhase("finished");
        store.getState().submit();
      }
    },
    [attemptId, part, partIndex, parts.length, store],
  );

  if (!part) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16">
      <header className="sticky top-0 z-40 -mx-4 mb-6 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-800">Speaking</h1>
            <p className="text-xs text-slate-500">
              Solo simulation — your responses are recorded for evaluation
            </p>
          </div>
          <div className="flex gap-1">
            {parts.map((p, i) => (
              <span
                key={p.id}
                className={`h-2 w-8 rounded-full ${
                  i < partIndex ? "bg-green-500" : i === partIndex ? "bg-cam-600" : "bg-slate-200"
                }`}
                title={p.title ?? p.type}
              />
            ))}
          </div>
        </div>
      </header>

      <div className="card p-6">
        <h2 className="text-lg font-semibold text-slate-800">
          {part.title ?? `Part ${partIndex + 1}`}
        </h2>

        <div className="mt-4 space-y-2">
          {part.examinerScript.map((line, i) => (
            <p
              key={i}
              className={`rounded-md px-3 py-2 text-sm leading-6 ${
                phase === "intro" && i === scriptLine
                  ? "bg-cam-50 font-medium text-cam-900"
                  : "text-slate-600"
              }`}
            >
              <span className="mr-2 font-semibold text-cam-600">Examiner:</span>
              {line}
            </p>
          ))}
        </div>

        {part.images && part.images.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-3">
            {part.images.map((img) => (
              <PartImage key={img} examId={exam.meta.id} path={img} />
            ))}
          </div>
        )}

        <div className="mt-6">
          {phase === "ready" && (
            <div className="flex flex-col items-start gap-2">
              {!ttsSupported() && (
                <p className="text-sm text-amber-600">
                  Text-to-speech is unavailable — read the examiner prompt above yourself.
                </p>
              )}
              <button className="btn-primary" onClick={startPart}>
                ▶ Start {part.title ?? `Part ${partIndex + 1}`}
              </button>
              <p className="text-xs text-slate-500">
                {part.prepSeconds > 0 ? `${part.prepSeconds}s preparation, then ` : ""}
                up to {part.responseSeconds}s speaking time.
              </p>
            </div>
          )}

          {phase === "intro" && (
            <p className="text-sm font-medium text-cam-700">🔊 The examiner is speaking…</p>
          )}

          {phase === "prep" && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
              <p className="text-sm font-semibold text-amber-800">
                Preparation time — recording starts in{" "}
                <span className="font-mono text-lg tabular-nums">{prepLeft}s</span>
              </p>
            </div>
          )}

          {phase === "recording" && (
            <Recorder
              maxSeconds={part.responseSeconds}
              onComplete={(r) => void handleRecordingComplete(r)}
              onError={(message) => {
                setError(message);
                setPhase("ready");
              }}
            />
          )}

          {phase === "saving" && <p className="text-sm text-slate-500">Saving recording…</p>}

          {phase === "finished" && (
            <p className="text-sm font-medium text-green-700">
              Speaking test complete — preparing your results…
            </p>
          )}

          {error && (
            <div className="mt-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
              <button
                className="ml-3 underline"
                onClick={() => {
                  // Skip this part without a recording rather than blocking the exam.
                  if (partIndex + 1 < parts.length) {
                    setPartIndex(partIndex + 1);
                    setPhase("ready");
                    setError(null);
                  } else {
                    store.getState().submit();
                  }
                }}
              >
                Skip this part
              </button>
            </div>
          )}
        </div>
      </div>

      <p className="mt-4 text-xs text-slate-400">
        Note: Interactive Communication is estimated in solo mode — there is no examiner or
        partner to interact with.
      </p>
    </div>
  );
}
