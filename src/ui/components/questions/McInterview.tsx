import type { McInterviewPart } from "../../../core/schema/exam";
import { OptionList, PartInstructions, QuestionShell, type RendererProps } from "./shared";

export function McInterview({ part, answers, onAnswer }: RendererProps<McInterviewPart>) {
  return (
    <div>
      <PartInstructions title={part.title} instructions={part.instructions} />
      <div className="space-y-3">
        {part.questions.map((q) => (
          <QuestionShell key={q.id} number={q.number} prompt={q.prompt}>
            <OptionList
              questionId={q.id}
              options={q.options}
              value={answers[q.id] ?? ""}
              onChange={(letter) => onAnswer(q.id, letter)}
            />
          </QuestionShell>
        ))}
      </div>
    </div>
  );
}
