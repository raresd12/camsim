import type { McClozePart } from "../../../core/schema/exam";
import { GapText, OptionList, PartInstructions, QuestionShell, type RendererProps } from "./shared";

export function McCloze({ part, answers, onAnswer }: RendererProps<McClozePart>) {
  return (
    <div>
      <PartInstructions title={part.title} instructions={part.instructions} />
      <div className="card mb-5 p-5">
        <GapText
          text={part.text}
          renderGap={(n) => {
            const q = part.questions.find((q) => q.number === n);
            const chosen = q ? answers[q.id] : undefined;
            const optionIdx = chosen ? chosen.charCodeAt(0) - 65 : -1;
            const word = q && optionIdx >= 0 ? q.options[optionIdx] : undefined;
            return (
              <span className="mx-1 inline-block min-w-[6rem] rounded border-b-2 border-cam-500 bg-cam-50 px-2 text-center text-sm font-semibold text-cam-700">
                ({n}) {word ?? "____"}
              </span>
            );
          }}
        />
      </div>
      <div className="space-y-3">
        {part.questions.map((q) => (
          <QuestionShell key={q.id} number={q.number}>
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
