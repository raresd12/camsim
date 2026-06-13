import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db";
import {
  FULL_MOCK_ORDER,
  PAPER_LABELS,
  type PaperKind,
} from "../../core/session/examSession";
import { startAttempt } from "../state/session";
import { playTestBeep } from "../lib/audio";
import { hasAiConfigured } from "../state/settings";

type MicStatus = "unknown" | "checking" | "granted" | "denied";

export function MockLobby() {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const exam = useLiveQuery(() => (examId ? db.exams.get(examId) : undefined), [examId]);

  const [mode, setMode] = useState<"mock" | "single">("mock");
  const [singlePaper, setSinglePaper] = useState<PaperKind>("reading");
  const [objectiveOnly, setObjectiveOnly] = useState(false);
  const [micStatus, setMicStatus] = useState<MicStatus>("unknown");
  const [beepPlayed, setBeepPlayed] = useState(false);
  const [starting, setStarting] = useState(false);
  const [aiConfigured, setAiConfigured] = useState(false);

  useEffect(() => {
    setAiConfigured(hasAiConfigured());
  }, []);

  if (!examId) return null;
  if (exam === undefined) {
    return <p className="p-8 text-slate-500">Loading…</p>;
  }
  if (exam === null || !exam) {
    return (
      <div className="p-8">
        <p className="text-slate-600">Exam not found.</p>
        <Link to="/" className="btn-secondary mt-4 inline-flex">
          ← Library
        </Link>
      </div>
    );
  }

  const paperOrder: PaperKind[] =
    mode === "mock"
      ? objectiveOnly
        ? ["reading", "listening"]
        : FULL_MOCK_ORDER
      : [singlePaper];

  const needsMic = paperOrder.includes("speaking");
  const needsAudio = paperOrder.includes("listening") || paperOrder.includes("speaking");
  const needsAi = paperOrder.includes("writing") || paperOrder.includes("speaking");
  const micBlocked = needsMic && micStatus !== "granted";

  const checkMic = async () => {
    setMicStatus("checking");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setMicStatus("granted");
    } catch {
      setMicStatus("denied");
    }
  };

  const begin = async () => {
    setStarting(true);
    const attemptId = await startAttempt(exam.pkg, mode, paperOrder);
    navigate(`/attempt/${attemptId}/run`);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{exam.title}</h1>
          <p className="text-sm text-slate-500">Choose how you want to take this exam.</p>
        </div>
        <Link to="/" className="btn-secondary">
          ← Library
        </Link>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <button
          className={`card p-5 text-left ${mode === "mock" ? "ring-2 ring-cam-600" : ""}`}
          onClick={() => setMode("mock")}
        >
          <h2 className="font-semibold text-slate-800">Full Mock</h2>
          <p className="mt-1 text-sm text-slate-600">
            All four papers in exam order with strict timing. No pausing. Results at the end.
          </p>
        </button>
        <button
          className={`card p-5 text-left ${mode === "single" ? "ring-2 ring-cam-600" : ""}`}
          onClick={() => setMode("single")}
        >
          <h2 className="font-semibold text-slate-800">Single Paper</h2>
          <p className="mt-1 text-sm text-slate-600">
            Practise one paper. Pausing allowed; results immediately afterwards.
          </p>
        </button>
      </div>

      {mode === "single" && (
        <div className="card mt-4 p-5">
          <h3 className="text-sm font-semibold text-slate-700">Which paper?</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {(Object.keys(PAPER_LABELS) as PaperKind[]).map((kind) => (
              <button
                key={kind}
                className={`btn ${singlePaper === kind ? "bg-cam-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                onClick={() => setSinglePaper(kind)}
              >
                {PAPER_LABELS[kind]}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="card mt-6 p-5">
        <h3 className="font-semibold text-slate-800">Pre-flight checks</h3>
        <ul className="mt-4 space-y-3">
          {needsMic && (
            <li className="flex items-center justify-between gap-3">
              <span className="text-sm text-slate-700">
                Microphone access (required for Speaking)
              </span>
              {micStatus === "granted" ? (
                <span className="text-sm font-semibold text-green-600">✓ Granted</span>
              ) : (
                <button
                  className="btn-secondary"
                  disabled={micStatus === "checking"}
                  onClick={() => void checkMic()}
                >
                  {micStatus === "denied" ? "Denied — retry" : micStatus === "checking" ? "Checking…" : "Request access"}
                </button>
              )}
            </li>
          )}
          {needsAudio && (
            <li className="flex items-center justify-between gap-3">
              <span className="text-sm text-slate-700">Audio output test</span>
              <div className="flex items-center gap-2">
                {beepPlayed && <span className="text-sm font-semibold text-green-600">✓ Played</span>}
                <button
                  className="btn-secondary"
                  onClick={() => {
                    void playTestBeep().then(() => setBeepPlayed(true));
                  }}
                >
                  🔊 Play test sound
                </button>
              </div>
            </li>
          )}
          {needsAi && (
            <li className="flex items-center justify-between gap-3">
              <span className="text-sm text-slate-700">
                Gemini API key (for Writing & Speaking evaluation)
              </span>
              {aiConfigured ? (
                <span className="text-sm font-semibold text-green-600">✓ Configured</span>
              ) : (
                <Link to="/settings" className="btn-secondary">
                  Configure in Settings
                </Link>
              )}
            </li>
          )}
        </ul>

        {needsAi && !aiConfigured && (
          <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
            <p>
              Without an API key, Writing and Speaking cannot be evaluated. You can still take
              them (your text and recordings are kept and can be evaluated later once a key is
              added), or switch to objective papers only.
            </p>
            {mode === "mock" && (
              <label className="mt-3 flex items-center gap-2 font-medium">
                <input
                  type="checkbox"
                  checked={objectiveOnly}
                  onChange={(e) => setObjectiveOnly(e.target.checked)}
                />
                Objective papers only (Reading & Use of English + Listening)
              </label>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Papers: {paperOrder.map((k) => PAPER_LABELS[k]).join(" → ")}
        </p>
        <button
          className="btn-primary px-6 py-3 text-base"
          disabled={starting || micBlocked}
          title={micBlocked ? "Grant microphone access first" : undefined}
          onClick={() => void begin()}
        >
          {starting ? "Starting…" : "Start exam"}
        </button>
      </div>
    </div>
  );
}
