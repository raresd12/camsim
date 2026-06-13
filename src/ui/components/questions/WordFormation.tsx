import type { WordFormationPart } from "../../../core/schema/exam";
import { GapText, PartInstructions, type RendererProps } from "./shared";

export function WordFormation({ part, answers, onAnswer }: RendererProps<WordFormationPart>) {
  return (
    <div>
      <PartInstructions title={part.title} instructions={part.instructions} />
      <div className="card p-5">
        <GapText
          text={part.text}
          renderGap={(n) => {
            const q = part.questions.find((q) => q.number === n);
            if (!q) return <span>____</span>;
            return (
              <span className="whitespace-nowrap">
                <span className="text-xs font-bold text-cam-600">({n})</span>
                <input
                  className="gap-input"
                  type="text"
                  spellCheck={false}
                  autoComplete="off"
                  value={answers[q.id] ?? ""}
                  onChange={(e) => onAnswer(q.id, e.target.value)}
                  aria-label={`Gap ${n}, formed from ${q.stem}`}
                />
                <span className="ml-1 rounded bg-slate-800 px-1.5 py-0.5 text-xs font-bold tracking-wide text-white">
                  {q.stem.toUpperCase()}
                </span>
              </span>
            );
          }}
        />
      </div>
    </div>
  );
}
