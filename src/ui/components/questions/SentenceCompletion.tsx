import type { SentenceCompletionPart } from "../../../core/schema/exam";
import { GapText, PartInstructions, QuestionShell, type RendererProps } from "./shared";

export function SentenceCompletion({
  part,
  answers,
  onAnswer,
}: RendererProps<SentenceCompletionPart>) {
  return (
    <div>
      <PartInstructions title={part.title} instructions={part.instructions} />
      <div className="space-y-3">
        {part.questions.map((q) => (
          <QuestionShell key={q.id} number={q.number}>
            <GapText
              text={q.sentence}
              renderGap={() => (
                <input
                  className="gap-input min-w-[10rem]"
                  type="text"
                  spellCheck={false}
                  autoComplete="off"
                  value={answers[q.id] ?? ""}
                  onChange={(e) => onAnswer(q.id, e.target.value)}
                  aria-label={`Answer for question ${q.number}`}
                />
              )}
            />
          </QuestionShell>
        ))}
      </div>
    </div>
  );
}
