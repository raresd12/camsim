import type { KwtPart } from "../../../core/schema/exam";
import { GapText, PartInstructions, QuestionShell, type RendererProps } from "./shared";

export function KeyWordTransformation({ part, answers, onAnswer }: RendererProps<KwtPart>) {
  return (
    <div>
      <PartInstructions title={part.title} instructions={part.instructions} />
      <div className="space-y-3">
        {part.questions.map((q) => (
          <QuestionShell key={q.id} number={q.number}>
            <p className="text-sm text-slate-800">{q.leadIn}</p>
            <p className="my-2">
              <span className="rounded bg-slate-800 px-2 py-0.5 text-xs font-bold tracking-widest text-white">
                {q.keyWord.toUpperCase()}
              </span>
            </p>
            <GapText
              text={q.gapped.replace("{{gap}}", "{{0}}")}
              renderGap={() => (
                <input
                  className="gap-input min-w-[14rem]"
                  type="text"
                  spellCheck={false}
                  autoComplete="off"
                  value={answers[q.id] ?? ""}
                  onChange={(e) => onAnswer(q.id, e.target.value)}
                  aria-label={`Answer for question ${q.number}`}
                />
              )}
            />
            <p className="mt-1 text-xs text-slate-400">
              Use three to six words, including the word given.
            </p>
          </QuestionShell>
        ))}
      </div>
    </div>
  );
}
