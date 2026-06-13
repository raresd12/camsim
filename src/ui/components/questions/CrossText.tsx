import type { CrossTextPart } from "../../../core/schema/exam";
import {
  LetterSelect,
  PartInstructions,
  QuestionShell,
  TextAndQuestions,
  type RendererProps,
} from "./shared";

export function CrossText({ part, answers, onAnswer }: RendererProps<CrossTextPart>) {
  const letters = part.texts.map((t) => t.label);
  return (
    <div>
      <PartInstructions title={part.title} instructions={part.instructions} />
      <TextAndQuestions
        text={
          <div className="space-y-4">
            {part.texts.map((t) => (
              <div key={t.label}>
                <h4 className="font-semibold text-slate-800">
                  {t.label}
                  {t.title ? ` — ${t.title}` : ""}
                </h4>
                <p className="mt-1 whitespace-pre-wrap leading-7 text-slate-700">{t.text}</p>
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
