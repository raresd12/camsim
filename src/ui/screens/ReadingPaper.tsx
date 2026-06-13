import { useState } from "react";
import type { ExamPackage, ReadingPart } from "../../core/schema/exam";
import type { SessionStore } from "../../core/session/examSession";
import { useSessionValue } from "../state/session";
import { PaperChrome } from "../components/PaperChrome";
import { McCloze } from "../components/questions/McCloze";
import { OpenCloze } from "../components/questions/OpenCloze";
import { WordFormation } from "../components/questions/WordFormation";
import { KeyWordTransformation } from "../components/questions/KeyWordTransformation";
import { McReading } from "../components/questions/McReading";
import { CrossText } from "../components/questions/CrossText";
import { GappedText } from "../components/questions/GappedText";
import { MultipleMatching } from "../components/questions/MultipleMatching";

function renderPart(
  part: ReadingPart,
  answers: Record<string, string>,
  onAnswer: (id: string, value: string) => void,
) {
  switch (part.type) {
    case "mc-cloze":
      return <McCloze part={part} answers={answers} onAnswer={onAnswer} />;
    case "open-cloze":
      return <OpenCloze part={part} answers={answers} onAnswer={onAnswer} />;
    case "word-formation":
      return <WordFormation part={part} answers={answers} onAnswer={onAnswer} />;
    case "key-word-transformation":
      return <KeyWordTransformation part={part} answers={answers} onAnswer={onAnswer} />;
    case "mc-reading":
      return <McReading part={part} answers={answers} onAnswer={onAnswer} />;
    case "cross-text":
      return <CrossText part={part} answers={answers} onAnswer={onAnswer} />;
    case "gapped-text":
      return <GappedText part={part} answers={answers} onAnswer={onAnswer} />;
    case "multiple-matching":
      return <MultipleMatching part={part} answers={answers} onAnswer={onAnswer} />;
  }
}

export function ReadingPaper({ exam, store }: { exam: ExamPackage; store: SessionStore }) {
  const { session } = useSessionValue(store);
  const parts = exam.reading.parts;
  const [activePartId, setActivePartId] = useState(parts[0].id);
  const activePart = parts.find((p) => p.id === activePartId) ?? parts[0];
  const answers = session.papers.reading?.answers ?? {};

  const allQuestionIds = parts.flatMap((p) => p.questions.map((q) => q.id));
  const unanswered = allQuestionIds.filter((id) => !(answers[id] ?? "").trim()).length;

  return (
    <PaperChrome
      title="Reading & Use of English"
      store={store}
      tabs={parts.map((p, i) => ({ id: p.id, label: `Part ${i + 1}` }))}
      activeTab={activePart.id}
      onSelectTab={setActivePartId}
      unansweredCount={unanswered}
    >
      {renderPart(activePart, answers, (id, value) => store.getState().answer(id, value))}
    </PaperChrome>
  );
}
