import type { GappedTextPart } from "../../../core/schema/exam";
import { GapText, LetterSelect, PartInstructions, type RendererProps } from "./shared";

export function GappedText({ part, answers, onAnswer }: RendererProps<GappedTextPart>) {
  const letters = part.options.map((o) => o.label);
  const used = new Set(part.questions.map((q) => answers[q.id]).filter(Boolean));
  return (
    <div>
      <PartInstructions title={part.title} instructions={part.instructions} />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <GapText
            text={part.text}
            renderGap={(n) => {
              const q = part.questions.find((q) => q.number === n);
              if (!q) return <span>____</span>;
              return (
                <span className="mx-1 inline-flex items-center gap-1 rounded border border-cam-300 bg-cam-50 px-2 py-1 align-middle">
                  <span className="text-xs font-bold text-cam-600">{n}</span>
                  <LetterSelect
                    letters={letters}
                    usedLetters={used}
                    value={answers[q.id] ?? ""}
                    onChange={(letter) => onAnswer(q.id, letter)}
                  />
                </span>
              );
            }}
          />
        </div>
        <div className="space-y-3">
          {part.options.map((o) => (
            <div
              key={o.label}
              className={`rounded-lg border p-4 ${used.has(o.label) ? "border-cam-300 bg-cam-50/60" : "border-slate-200 bg-white"}`}
            >
              <span className="font-bold text-cam-700">{o.label}</span>
              <p className="mt-1 text-sm leading-6 text-slate-700">{o.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
