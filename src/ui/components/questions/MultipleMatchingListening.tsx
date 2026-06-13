import type { MmListeningPart } from "../../../core/schema/exam";
import { LetterSelect, PartInstructions, QuestionShell, type RendererProps } from "./shared";

export function MultipleMatchingListening({
  part,
  answers,
  onAnswer,
}: RendererProps<MmListeningPart>) {
  return (
    <div>
      <PartInstructions title={part.title} instructions={part.instructions} />
      <div className="space-y-6">
        {part.tasks.map((task, ti) => {
          const letters = task.options.map((o) => o.label);
          const used = new Set(task.questions.map((q) => answers[q.id]).filter(Boolean));
          return (
            <div key={ti} className="grid gap-6 lg:grid-cols-2">
              <div className="card p-5">
                <p className="mb-3 text-sm italic text-slate-600">{task.instructions}</p>
                <ul className="space-y-2">
                  {task.options.map((o) => (
                    <li key={o.label} className="text-sm text-slate-700">
                      <span className="font-bold text-cam-700">{o.label}</span> {o.text}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-3">
                {task.questions.map((q) => (
                  <QuestionShell key={q.id} number={q.number} prompt={q.prompt}>
                    <LetterSelect
                      letters={letters}
                      usedLetters={used}
                      value={answers[q.id] ?? ""}
                      onChange={(letter) => onAnswer(q.id, letter)}
                    />
                  </QuestionShell>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
