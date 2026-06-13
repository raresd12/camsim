import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db, recordingKey, type AttemptRecord, type SpeakingEvalRecord, type WritingEvalRecord } from "../../db/db";
import type { ExamPackage, ListeningPart } from "../../core/schema/exam";
import type { GradedQuestion } from "../../core/grading/objective";
import { SCALE_MAX, SCALE_MIN, gradeForScore } from "../../core/grading/scale";
import { PAPER_LABELS } from "../../core/session/examSession";
import {
  computeObjectiveResults,
  providerFromSettings,
  runAiEvaluations,
  type EvalProgress,
} from "../lib/evaluate";
import { useBlobUrl } from "../lib/assets";

const SKILL_LABELS: Record<string, string> = {
  reading: "Reading",
  useOfEnglish: "Use of English",
  writing: "Writing",
  listening: "Listening",
  speaking: "Speaking",
};

const SKILL_ORDER = ["reading", "useOfEnglish", "writing", "listening", "speaking"] as const;

export function Results() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const attempt = useLiveQuery(
    () => (attemptId ? db.attempts.get(attemptId) : undefined),
    [attemptId],
  );
  const exam = useLiveQuery(
    () => (attempt ? db.exams.get(attempt.examId) : undefined),
    [attempt?.examId],
  );

  // Grade objective papers once both records have loaded (idempotent).
  useEffect(() => {
    if (attempt && exam) {
      void computeObjectiveResults(attempt, exam.pkg);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt?.id, exam?.id, attempt?.session.phase]);

  if (!attemptId) return null;
  if (attempt === undefined || exam === undefined) {
    return <p className="p-8 text-slate-500">Loading results…</p>;
  }
  if (!attempt || !exam) {
    return (
      <div className="p-8">
        <p className="text-slate-600">Attempt or exam not found.</p>
        <Link to="/" className="btn-secondary mt-4 inline-flex">← Library</Link>
      </div>
    );
  }

  return <ResultsBody attempt={attempt} exam={exam.pkg} />;
}

function ResultsBody({ attempt, exam }: { attempt: AttemptRecord; exam: ExamPackage }) {
  const results = attempt.results;
  const [progress, setProgress] = useState<EvalProgress | null>(null);
  const [evalErrors, setEvalErrors] = useState<string[]>([]);
  const [running, setRunning] = useState(false);

  const provider = providerFromSettings();
  const writingTaken =
    attempt.session.papers.writing?.status === "submitted" &&
    ((attempt.session.papers.writing.writing?.part1Text.trim() ?? "") !== "" ||
      (attempt.session.papers.writing.writing?.part2Text.trim() ?? "") !== "");
  const speakingTaken = attempt.session.papers.speaking?.status === "submitted";
  const pendingAi =
    (writingTaken && (!results?.writing?.part1 || (!results?.writing?.part2 && (attempt.session.papers.writing?.writing?.part2Text.trim() ?? "") !== ""))) ||
    (speakingTaken && (results?.speaking?.parts.length ?? 0) < exam.speaking.parts.length);

  const runAi = async () => {
    if (!provider) return;
    setRunning(true);
    setEvalErrors([]);
    const fresh = await db.attempts.get(attempt.id);
    if (fresh) {
      const { errors } = await runAiEvaluations(fresh, exam, provider, setProgress);
      setEvalErrors(errors);
    }
    setRunning(false);
    setProgress(null);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Statement of Results</h1>
          <p className="text-sm text-slate-500">
            {exam.meta.title} · {attempt.mode === "mock" ? "Full Mock" : "Single Paper"} ·{" "}
            {new Date(attempt.startedAt).toLocaleString()}
          </p>
        </div>
        <Link to="/" className="btn-secondary">← Library</Link>
      </header>

      {/* ---- Scale scores ---- */}
      <section className="card p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-semibold text-slate-800">
            Cambridge English Scale scores{" "}
            <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
              estimated
            </span>
          </h2>
          {results?.overall && (
            <div className="text-right">
              <div className="text-3xl font-bold text-cam-700">{results.overall.score}</div>
              <span
                className={`mt-1 inline-block rounded-full px-3 py-1 text-xs font-bold text-white ${
                  gradeForScore(results.overall.score).pass ? "bg-green-600" : "bg-slate-500"
                }`}
              >
                {results.overall.label}
              </span>
              {results.overall.skillsCounted < 5 && (
                <p className="mt-1 text-xs text-slate-400">
                  based on {results.overall.skillsCounted} of 5 skills
                </p>
              )}
            </div>
          )}
        </div>
        <div className="mt-5 space-y-3">
          {SKILL_ORDER.map((skill) => (
            <ScaleBar
              key={skill}
              label={SKILL_LABELS[skill]}
              score={results?.scaleScores[skill]}
            />
          ))}
        </div>
        <p className="mt-4 text-xs text-slate-400">
          Conversions use a piecewise-linear approximation of the Cambridge English Scale and are
          not official scores. Grade boundaries: A 200+, B 193+, C 180+ (pass), 160–179 B2
          certificate.
        </p>
      </section>

      {/* ---- AI evaluation control ---- */}
      {(writingTaken || speakingTaken) && (
        <section className="card mt-6 p-6">
          <h2 className="font-semibold text-slate-800">AI examiner (Gemini)</h2>
          {!provider && (
            <p className="mt-2 text-sm text-amber-700">
              No API key/model configured — add one in{" "}
              <Link className="underline" to="/settings">Settings</Link> and come back; your
              writing and recordings are saved.
            </p>
          )}
          {provider && pendingAi && !running && (
            <button className="btn-primary mt-3" onClick={() => void runAi()}>
              Evaluate Writing & Speaking
            </button>
          )}
          {running && (
            <p className="mt-3 text-sm text-cam-700">
              {progress
                ? `Evaluating (${Math.min(progress.done + 1, progress.total)}/${progress.total}): ${progress.step}…`
                : "Starting evaluation…"}
            </p>
          )}
          {!pendingAi && provider && (
            <p className="mt-2 text-sm text-green-700">All available evaluations are complete.</p>
          )}
          {evalErrors.length > 0 && (
            <ul className="mt-3 list-inside list-disc text-sm text-red-600">
              {evalErrors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
          {speakingTaken && (
            <p className="mt-3 text-xs text-slate-400">
              Disclaimer: Interactive Communication is estimated in solo mode.
            </p>
          )}
        </section>
      )}

      {/* ---- Per-paper drill-down ---- */}
      <div className="mt-6 space-y-4">
        {results?.gradedReading && (
          <Drilldown
            title={`${PAPER_LABELS.reading} — ${results.gradedReading.reading.raw + results.gradedReading.useOfEnglish.raw}/${results.gradedReading.reading.max + results.gradedReading.useOfEnglish.max} marks`}
          >
            <ObjectiveReview perQuestion={results.gradedReading.perQuestion} />
          </Drilldown>
        )}
        {results?.gradedListening && (
          <Drilldown
            title={`${PAPER_LABELS.listening} — ${results.gradedListening.raw}/${results.gradedListening.max} marks`}
          >
            <ObjectiveReview perQuestion={results.gradedListening.perQuestion} />
            <h4 className="mb-2 mt-6 text-sm font-semibold text-slate-700">Transcripts</h4>
            <div className="space-y-3">
              {exam.listening.parts.map((part: ListeningPart, i: number) => (
                <details key={part.id} className="rounded-md border border-slate-200 p-3">
                  <summary className="cursor-pointer text-sm font-medium text-slate-700">
                    Part {i + 1} transcript
                  </summary>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                    {part.transcript}
                  </p>
                </details>
              ))}
            </div>
          </Drilldown>
        )}
        {(results?.writing?.part1 || results?.writing?.part2) && (
          <Drilldown title="Writing — examiner feedback">
            <div className="grid gap-4 lg:grid-cols-2">
              {results.writing?.part1 && (
                <WritingCard title="Part 1 — Essay" record={results.writing.part1} />
              )}
              {results.writing?.part2 && (
                <WritingCard
                  title={`Part 2 — ${results.writing.part2.taskType}`}
                  record={results.writing.part2}
                />
              )}
            </div>
          </Drilldown>
        )}
        {speakingTaken && (
          <Drilldown title="Speaking — recordings & feedback">
            <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Interactive Communication is estimated in solo mode.
            </p>
            <div className="space-y-4">
              {exam.speaking.parts.map((part) => (
                <SpeakingPartCard
                  key={part.id}
                  attemptId={attempt.id}
                  partId={part.id}
                  title={part.title ?? part.type}
                  record={results?.speaking?.parts.find((p) => p.partId === part.id)}
                />
              ))}
            </div>
          </Drilldown>
        )}
      </div>
    </div>
  );
}

function ScaleBar({ label, score }: { label: string; score: number | undefined }) {
  const pct =
    score === undefined ? 0 : ((score - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100;
  const grade = score !== undefined ? gradeForScore(score) : null;
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 shrink-0 text-sm font-medium text-slate-700">{label}</span>
      <div className="relative h-5 flex-1 overflow-hidden rounded-full bg-slate-100">
        {score !== undefined && (
          <div
            className={`h-full rounded-full ${grade?.pass ? "bg-cam-600" : "bg-amber-500"}`}
            style={{ width: `${Math.max(3, pct)}%` }}
          />
        )}
        {/* C1 pass mark (180) */}
        <div
          className="absolute top-0 h-full w-0.5 bg-green-600/60"
          style={{ left: `${((180 - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100}%` }}
          title="Pass mark (180)"
        />
      </div>
      <span className="w-14 shrink-0 text-right font-mono text-sm font-semibold tabular-nums text-slate-800">
        {score ?? "—"}
      </span>
    </div>
  );
}

function Drilldown({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="card overflow-hidden">
      <summary className="cursor-pointer px-6 py-4 font-semibold text-slate-800 hover:bg-slate-50">
        {title}
      </summary>
      <div className="border-t border-slate-100 px-6 py-4">{children}</div>
    </details>
  );
}

function ObjectiveReview({ perQuestion }: { perQuestion: GradedQuestion[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
            <th className="py-2 pr-3">#</th>
            <th className="py-2 pr-3">Your answer</th>
            <th className="py-2 pr-3">Key</th>
            <th className="py-2">Marks</th>
          </tr>
        </thead>
        <tbody>
          {perQuestion.map((q) => {
            const full = q.marksAwarded === q.marksAvailable;
            const none = q.marksAwarded === 0;
            return (
              <tr key={q.questionId} className="border-b border-slate-100">
                <td className="py-2 pr-3 font-mono text-slate-500">{q.number}</td>
                <td className={`py-2 pr-3 ${none ? "text-red-600" : "text-slate-800"}`}>
                  {q.userAnswer || <span className="italic text-slate-300">blank</span>}
                </td>
                <td className="py-2 pr-3 text-slate-600">{q.correctAnswer}</td>
                <td className={`py-2 font-semibold ${full ? "text-green-600" : none ? "text-red-600" : "text-amber-600"}`}>
                  {q.marksAwarded}/{q.marksAvailable}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SubscaleRow({ name, value }: { name: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-44 shrink-0 text-xs text-slate-600">{name}</span>
      <div className="h-2 flex-1 rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-cam-500" style={{ width: `${(value / 5) * 100}%` }} />
      </div>
      <span className="w-8 text-right font-mono text-xs font-semibold">{value}</span>
    </div>
  );
}

function WritingCard({ title, record }: { title: string; record: WritingEvalRecord }) {
  const s = record.evaluation.subscales;
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <h4 className="font-semibold capitalize text-slate-800">{title}</h4>
      <p className="text-xs text-slate-400">{record.wordCount} words</p>
      <div className="mt-3 space-y-1.5">
        <SubscaleRow name="Content" value={s.content} />
        <SubscaleRow name="Communicative Achievement" value={s.communicativeAchievement} />
        <SubscaleRow name="Organisation" value={s.organisation} />
        <SubscaleRow name="Language" value={s.language} />
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-700">{record.evaluation.examinerComments}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <h5 className="text-xs font-semibold uppercase text-green-600">Strengths</h5>
          <ul className="mt-1 list-inside list-disc text-xs text-slate-600">
            {record.evaluation.strengths.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </div>
        <div>
          <h5 className="text-xs font-semibold uppercase text-amber-600">Improve</h5>
          <ul className="mt-1 list-inside list-disc text-xs text-slate-600">
            {record.evaluation.improvements.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </div>
      </div>
      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-slate-400">Your text</summary>
        <p className="mt-2 whitespace-pre-wrap rounded bg-slate-50 p-3 font-serif text-sm leading-6 text-slate-700">
          {record.text}
        </p>
      </details>
    </div>
  );
}

function SpeakingPartCard({
  attemptId,
  partId,
  title,
  record,
}: {
  attemptId: string;
  partId: string;
  title: string;
  record: SpeakingEvalRecord | undefined;
}) {
  const recording = useLiveQuery(
    () => db.recordings.get(recordingKey(attemptId, partId)),
    [attemptId, partId],
  );
  const url = useBlobUrl(recording?.blob ?? null);
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="font-semibold capitalize text-slate-800">{title}</h4>
        {recording && <span className="text-xs text-slate-400">{recording.durationSeconds}s</span>}
      </div>
      {url ? (
        <audio controls src={url} className="mt-2 w-full" preload="metadata" />
      ) : (
        <p className="mt-2 text-sm italic text-slate-400">No recording for this part.</p>
      )}
      {record ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="space-y-1.5">
            <SubscaleRow name="Grammatical Resource" value={record.evaluation.subscales.grammaticalResource} />
            <SubscaleRow name="Lexical Resource" value={record.evaluation.subscales.lexicalResource} />
            <SubscaleRow name="Discourse Management" value={record.evaluation.subscales.discourseManagement} />
            <SubscaleRow name="Pronunciation" value={record.evaluation.subscales.pronunciation} />
            <SubscaleRow name="Interactive Communication *" value={record.evaluation.subscales.interactiveCommunication} />
            <p className="mt-2 text-xs text-slate-400">
              Fluency: {record.fluency.speechSeconds.toFixed(0)}s speech /{" "}
              {record.fluency.totalSeconds.toFixed(0)}s total · {record.fluency.pauseCount} pauses
              &gt;1.5s · longest {record.fluency.longestPauseSeconds.toFixed(1)}s
            </p>
            <p className="text-sm leading-6 text-slate-700">{record.evaluation.examinerComments}</p>
          </div>
          <div>
            <h5 className="text-xs font-semibold uppercase text-slate-400">Transcript</h5>
            <p className="mt-1 max-h-48 overflow-y-auto whitespace-pre-wrap rounded bg-slate-50 p-3 text-sm leading-6 text-slate-700">
              {record.evaluation.transcript}
            </p>
          </div>
        </div>
      ) : (
        recording && <p className="mt-2 text-sm text-slate-400">Not yet evaluated.</p>
      )}
    </div>
  );
}
