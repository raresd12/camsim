/**
 * Drives a live attempt: shows the between-papers interstitial, renders the
 * current paper screen, and redirects to results on completion. Handles
 * crash recovery by rehydrating the attempt from Dexie when needed.
 */
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PAPER_LABELS, currentPaperKind } from "../../core/session/examSession";
import { resumeAttempt, useActiveAttempt, useSessionValue } from "../state/session";
import { ReadingPaper } from "./ReadingPaper";
import { WritingPaper } from "./WritingPaper";
import { ListeningPaper } from "./ListeningPaper";
import { SpeakingPaper } from "./SpeakingPaper";

export function AttemptRunner() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const active = useActiveAttempt();
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!attemptId) return;
    if (active?.attemptId === attemptId) return;
    void resumeAttempt(attemptId).then((ok) => {
      if (!ok) setLoadFailed(true);
    });
  }, [attemptId, active]);

  if (loadFailed) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-600">
          This attempt is not available (it may be completed or its exam was deleted).
        </p>
        <Link to="/" className="btn-secondary mt-4 inline-flex">
          ← Library
        </Link>
      </div>
    );
  }

  if (!active || active.attemptId !== attemptId) {
    return <p className="p-8 text-slate-500">Loading attempt…</p>;
  }

  return <RunnerInner attemptId={active.attemptId} navigateToResults={() => navigate(`/attempt/${attemptId}/results`)} />;
}

function RunnerInner({
  attemptId,
  navigateToResults,
}: {
  attemptId: string;
  navigateToResults: () => void;
}) {
  const active = useActiveAttempt();
  const { session } = useSessionValue(active!.store);

  useEffect(() => {
    if (session.phase === "completed") {
      navigateToResults();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.phase]);

  if (!active) return null;
  const { store, exam } = active;
  const kind = currentPaperKind(session);

  if (session.phase === "completed" || !kind) {
    return <p className="p-8 text-slate-500">Preparing results…</p>;
  }

  if (session.phase === "between-papers") {
    const paper = session.papers[kind];
    const minutes = paper ? Math.round(paper.totalSeconds / 60) : 0;
    const position = session.currentIndex + 1;
    const isResume = paper != null && paper.startedAt !== null;
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <p className="text-sm uppercase tracking-wide text-slate-400">
          Paper {position} of {session.paperOrder.length}
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-800">{PAPER_LABELS[kind]}</h1>
        <p className="mt-3 text-slate-600">
          {kind === "speaking"
            ? "Four parts, guided by a virtual examiner. Your answers are recorded."
            : `You have ${minutes} minutes. The timer starts when you begin.`}
        </p>
        {session.mode === "mock" && (
          <p className="mt-2 text-sm text-amber-600">
            Mock conditions: the paper cannot be paused once started.
          </p>
        )}
        <button className="btn-primary mt-8 px-8 py-3 text-base" onClick={() => store.getState().begin()}>
          {isResume ? "Continue" : "Begin"} {PAPER_LABELS[kind]}
        </button>
      </div>
    );
  }

  // phase === "in-paper" — crash recovery lands here paused.
  if (session.paused && session.mode === "mock") {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-slate-800">Resume {PAPER_LABELS[kind]}</h1>
        <p className="mt-3 text-slate-600">
          Your attempt was interrupted. The timer resumes where it stopped.
        </p>
        <button className="btn-primary mt-8" onClick={() => store.getState().resume()}>
          ▶ Resume paper
        </button>
      </div>
    );
  }

  switch (kind) {
    case "reading":
      return <ReadingPaper key={attemptId} exam={exam} store={store} />;
    case "writing":
      return <WritingPaper key={attemptId} exam={exam} store={store} />;
    case "listening":
      return <ListeningPaper key={attemptId} exam={exam} store={store} />;
    case "speaking":
      return <SpeakingPaper key={attemptId} exam={exam} store={store} />;
  }
}
