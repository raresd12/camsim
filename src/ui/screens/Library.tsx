import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db, deleteExamCascade, type AttemptRecord } from "../../db/db";
import { countQuestions } from "../../core/grading/objective";
import { PAPER_LABELS } from "../../core/session/examSession";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { clearActiveAttempt } from "../state/session";

function AttemptRow({ attempt }: { attempt: AttemptRecord }) {
  const navigate = useNavigate();
  const date = new Date(attempt.startedAt).toLocaleString();
  const papers = attempt.session.paperOrder.map((k) => PAPER_LABELS[k]).join(", ");
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm text-slate-700">
          <span className="font-medium">{attempt.mode === "mock" ? "Full Mock" : "Single Paper"}</span>{" "}
          · {date}
        </p>
        <p className="truncate text-xs text-slate-500">{papers}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {attempt.results?.overall && (
          <span className="rounded-full bg-cam-600 px-2.5 py-0.5 text-xs font-bold text-white">
            {attempt.results.overall.score} ({attempt.results.overall.grade})
          </span>
        )}
        {attempt.status === "in-progress" ? (
          <button
            className="btn-primary"
            onClick={() => navigate(`/attempt/${attempt.id}/run`)}
          >
            Resume
          </button>
        ) : (
          <button
            className="btn-secondary"
            onClick={() => navigate(`/attempt/${attempt.id}/results`)}
          >
            Results
          </button>
        )}
      </div>
    </div>
  );
}

export function Library() {
  const navigate = useNavigate();
  const exams = useLiveQuery(() => db.exams.orderBy("importedAt").reverse().toArray(), []);
  const attempts = useLiveQuery(() => db.attempts.orderBy("startedAt").reverse().toArray(), []);
  const [deleting, setDeleting] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">CamSim</h1>
          <p className="text-sm text-slate-500">Cambridge C1 Advanced exam simulator</p>
        </div>
        <div className="flex gap-3">
          <Link to="/import" className="btn-primary">
            + Import exam
          </Link>
          <Link to="/generator" className="btn-secondary">
            ✨ Generate with AI
          </Link>
          <Link to="/settings" className="btn-secondary">
            ⚙ Settings
          </Link>
        </div>
      </header>

      {!exams || exams.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-lg font-medium text-slate-700">No exams in your library yet</p>
          <p className="mt-2 text-sm text-slate-500">
            Import a ZIP package containing <code>exam.json</code> and audio files to get started.
            A sample package ships with the project at <code>fixtures/sample-exam.zip</code> — or
            generate a new exam with an external AI model.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link to="/import" className="btn-primary">
              Import an exam
            </Link>
            <Link to="/generator" className="btn-secondary">
              ✨ Generate with AI
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {exams.map((exam) => {
            const counts = countQuestions(exam.pkg);
            const examAttempts = (attempts ?? []).filter((a) => a.examId === exam.id);
            return (
              <div key={exam.id} className="card p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-800">{exam.title}</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      C1 Advanced · {counts.reading} reading/UoE questions · {counts.listening}{" "}
                      listening questions · imported {new Date(exam.importedAt).toLocaleDateString()}
                    </p>
                    {exam.warnings.length > 0 && (
                      <p className="mt-1 text-xs text-amber-600">
                        ⚠ {exam.warnings.length} import warning{exam.warnings.length > 1 ? "s" : ""}{" "}
                        (e.g. {exam.warnings[0]})
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      className="btn-primary"
                      onClick={() => {
                        clearActiveAttempt();
                        navigate(`/exam/${exam.id}/lobby`);
                      }}
                    >
                      Start
                    </button>
                    <button className="btn-secondary" onClick={() => setDeleting(exam.id)}>
                      Delete
                    </button>
                  </div>
                </div>
                {examAttempts.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Attempts
                    </h3>
                    {examAttempts.map((a) => (
                      <AttemptRow key={a.id} attempt={a} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={deleting !== null}
        title="Delete this exam?"
        confirmLabel="Delete exam and attempts"
        danger
        onConfirm={() => {
          if (deleting) void deleteExamCascade(deleting);
          setDeleting(null);
        }}
        onCancel={() => setDeleting(null)}
      >
        <p>This removes the exam, its audio files, and all attempts including recordings.</p>
      </ConfirmDialog>
    </div>
  );
}
