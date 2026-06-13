import { useEffect, useRef, useState } from "react";
import type { ExamPackage, ListeningPart } from "../../core/schema/exam";
import type { SessionStore } from "../../core/session/examSession";
import { useSessionValue } from "../state/session";
import { useAssetUrl } from "../lib/assets";
import { getStrictness } from "../state/settings";
import { PaperChrome } from "../components/PaperChrome";
import {
  ConductorBanner,
  PracticePlayer,
  useListeningConductor,
} from "../components/AudioPlayer";
import { McExtracts } from "../components/questions/McExtracts";
import { SentenceCompletion } from "../components/questions/SentenceCompletion";
import { McInterview } from "../components/questions/McInterview";
import { MultipleMatchingListening } from "../components/questions/MultipleMatchingListening";

function renderPart(
  part: ListeningPart,
  answers: Record<string, string>,
  onAnswer: (id: string, value: string) => void,
) {
  switch (part.type) {
    case "mc-extracts":
      return <McExtracts part={part} answers={answers} onAnswer={onAnswer} />;
    case "sentence-completion":
      return <SentenceCompletion part={part} answers={answers} onAnswer={onAnswer} />;
    case "mc-interview":
      return <McInterview part={part} answers={answers} onAnswer={onAnswer} />;
    case "multiple-matching-listening":
      return <MultipleMatchingListening part={part} answers={answers} onAnswer={onAnswer} />;
  }
}

function questionIds(part: ListeningPart): string[] {
  if (part.type === "multiple-matching-listening") {
    return part.tasks.flatMap((t) => t.questions.map((q) => q.id));
  }
  return part.questions.map((q) => q.id);
}

export function ListeningPaper({ exam, store }: { exam: ExamPackage; store: SessionStore }) {
  const { session } = useSessionValue(store);
  const parts = exam.listening.parts;
  const examId = exam.meta.id;

  // Schema guarantees exactly 4 listening parts, so hook order is stable.
  const url0 = useAssetUrl(examId, parts[0].audioFile);
  const url1 = useAssetUrl(examId, parts[1].audioFile);
  const url2 = useAssetUrl(examId, parts[2].audioFile);
  const url3 = useAssetUrl(examId, parts[3].audioFile);
  const urls = [url0, url1, url2, url3];

  const strictness = getStrictness();
  const strict = session.mode === "mock" || strictness.strictListeningInPractice;

  const [activePartId, setActivePartId] = useState(parts[0].id);
  const activeIndex = Math.max(0, parts.findIndex((p) => p.id === activePartId));
  const activePart = parts[activeIndex];
  const answers = session.papers.listening?.answers ?? {};

  const { state: conductor, start, stop } = useListeningConductor({
    parts,
    urls,
    shortPauses: strictness.shortListeningPauses,
  });

  // In strict mode the playback sequence starts once, when assets are ready
  // (object URLs resolve asynchronously; missing audio stays null forever, so
  // wait one render for the lookups to settle before starting).
  const startedRef = useRef(false);
  const [assetsSettled, setAssetsSettled] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setAssetsSettled(true), 400);
    return () => window.clearTimeout(t);
  }, []);
  useEffect(() => {
    if (strict && assetsSettled && !startedRef.current && !session.paused) {
      startedRef.current = true;
      void start(0);
    }
  }, [strict, assetsSettled, session.paused, start]);

  // Follow the conductor: switch the visible part to the one being played.
  useEffect(() => {
    if (strict && conductor.phase !== "idle" && conductor.phase !== "finished") {
      setActivePartId(parts[conductor.partIndex].id);
    }
  }, [strict, conductor.partIndex, conductor.phase, parts]);

  // Stop all audio if the paper gets submitted/auto-submitted.
  const submitted = session.papers.listening?.status === "submitted";
  useEffect(() => {
    if (submitted) stop();
  }, [submitted, stop]);

  const allIds = parts.flatMap(questionIds);
  const unanswered = allIds.filter((id) => !(answers[id] ?? "").trim()).length;

  return (
    <PaperChrome
      title="Listening"
      store={store}
      tabs={parts.map((p, i) => ({ id: p.id, label: `Part ${i + 1}` }))}
      activeTab={activePart.id}
      onSelectTab={setActivePartId}
      unansweredCount={unanswered}
      banner={
        strict ? (
          <div className="mb-4">
            <ConductorBanner state={conductor} partCount={parts.length} />
          </div>
        ) : (
          <div className="mb-4">
            <PracticePlayer url={urls[activeIndex]} transcript={activePart.transcript} />
          </div>
        )
      }
    >
      {renderPart(activePart, answers, (id, value) => store.getState().answer(id, value))}
    </PaperChrome>
  );
}
