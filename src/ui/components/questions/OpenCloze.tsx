import type { OpenClozePart } from "../../../core/schema/exam";
import { GapText, PartInstructions, type RendererProps } from "./shared";

export function OpenCloze({ part, answers, onAnswer }: RendererProps<OpenClozePart>) {
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
                  aria-label={`Gap ${n}`}
                />
              </span>
            );
          }}
        />
      </div>
    </div>
  );
}
