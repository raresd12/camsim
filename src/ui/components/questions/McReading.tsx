import type { McReadingPart } from "../../../core/schema/exam";
import {
  OptionList,
  PartInstructions,
  QuestionShell,
  TextAndQuestions,
  type RendererProps,
} from "./shared";

export function McReading({ part, answers, onAnswer }: RendererProps<McReadingPart>) {
  return (
    <div>
      <PartInstructions title={part.title} instructions={part.instructions} />
      <TextAndQuestions
        text={<p className="whitespace-pre-wrap leading-7 text-slate-800">{part.text}</p>}
      >
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
      </TextAndQuestions>
    </div>
  );
}
