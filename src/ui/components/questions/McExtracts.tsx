import type { McExtractsPart } from "../../../core/schema/exam";
import { OptionList, PartInstructions, QuestionShell, type RendererProps } from "./shared";

export function McExtracts({ part, answers, onAnswer }: RendererProps<McExtractsPart>) {
  let lastExtract: string | undefined;
  return (
    <div>
      <PartInstructions title={part.title} instructions={part.instructions} />
      <div className="space-y-3">
        {part.questions.map((q) => {
          const showLabel = q.extractLabel && q.extractLabel !== lastExtract;
          lastExtract = q.extractLabel ?? lastExtract;
          return (
            <div key={q.id}>
              {showLabel && (
                <h4 className="mb-2 mt-4 font-semibold text-slate-700">{q.extractLabel}</h4>
              )}
              <QuestionShell number={q.number} prompt={q.prompt}>
                <OptionList
                  questionId={q.id}
                  options={q.options}
                  value={answers[q.id] ?? ""}
                  onChange={(letter) => onAnswer(q.id, letter)}
                />
              </QuestionShell>
            </div>
          );
        })}
      </div>
    </div>
  );
}
