import type { MultipleMatchingPart } from "../../../core/schema/exam";
import {
  LetterSelect,
  PartInstructions,
  QuestionShell,
  TextAndQuestions,
  type RendererProps,
} from "./shared";

export function MultipleMatching({ part, answers, onAnswer }: RendererProps<MultipleMatchingPart>) {
  const letters = part.sections.map((s) => s.label);
  return (
    <div>
      <PartInstructions title={part.title} instructions={part.instructions} />
      <TextAndQuestions
        text={
          <div className="space-y-4">
            {part.sections.map((s) => (
              <div key={s.label}>
                <h4 className="font-semibold text-slate-800">
                  {s.label}
                  {s.title ? ` — ${s.title}` : ""}
                </h4>
                <p className="mt-1 whitespace-pre-wrap leading-7 text-slate-700">{s.text}</p>
              </div>
            ))}
          </div>
        }
      >
        {part.questions.map((q) => (
          <QuestionShell key={q.id} number={q.number} prompt={q.prompt}>
            <LetterSelect
              letters={letters}
              value={answers[q.id] ?? ""}
              onChange={(letter) => onAnswer(q.id, letter)}
            />
          </QuestionShell>
        ))}
      </TextAndQuestions>
    </div>
  );
}
