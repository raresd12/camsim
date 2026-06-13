import { useState } from "react";
import type { ExamPackage } from "../../core/schema/exam";
import type { SessionStore } from "../../core/session/examSession";
import { useSessionValue } from "../state/session";
import { PaperChrome } from "../components/PaperChrome";
import { WordCount } from "../components/WordCount";
import { getStrictness } from "../state/settings";

const TASK_TYPE_LABELS: Record<string, string> = {
  essay: "Essay",
  "email-letter": "Email / Letter",
  proposal: "Proposal",
  report: "Report",
  review: "Review",
};

export function WritingPaper({ exam, store }: { exam: ExamPackage; store: SessionStore }) {
  const { session } = useSessionValue(store);
  const [activeTab, setActiveTab] = useState<"part1" | "part2">("part1");
  const [pasteBlocked, setPasteBlocked] = useState(false);

  const draft = session.papers.writing?.writing ?? {
    part1Text: "",
    part2OptionId: null,
    part2Text: "",
  };
  const blockPaste = session.mode === "mock" && getStrictness().disablePasteInMock;
  const part1 = exam.writing.part1;
  const chosenOption = exam.writing.part2.options.find((o) => o.id === draft.part2OptionId);

  const unanswered =
    (draft.part1Text.trim() === "" ? 1 : 0) + (draft.part2Text.trim() === "" ? 1 : 0);

  const handlePaste = (e: React.ClipboardEvent) => {
    if (blockPaste) {
      e.preventDefault();
      setPasteBlocked(true);
      window.setTimeout(() => setPasteBlocked(false), 2500);
    }
  };

  return (
    <PaperChrome
      title="Writing"
      store={store}
      tabs={[
        { id: "part1", label: "Part 1 — Essay (compulsory)" },
        { id: "part2", label: "Part 2 — Choice of task" },
      ]}
      activeTab={activeTab}
      onSelectTab={(id) => setActiveTab(id as "part1" | "part2")}
      unansweredCount={unanswered}
      banner={
        pasteBlocked ? (
          <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700">
            Pasting is disabled in mock mode.
          </div>
        ) : undefined
      }
    >
      {activeTab === "part1" ? (
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="font-semibold text-slate-800">Part 1 — Essay</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {part1.prompt}
            </p>
            {part1.notes && (
              <ul className="mt-3 list-inside list-disc text-sm text-slate-700">
                {part1.notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            )}
          </div>
          <div className="card p-5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-600">Your essay</span>
              <WordCount text={draft.part1Text} min={part1.wordMin} max={part1.wordMax} />
            </div>
            <textarea
              className="input min-h-[24rem] w-full font-serif text-base leading-7"
              spellCheck={false}
              autoComplete="off"
              value={draft.part1Text}
              onPaste={handlePaste}
              onChange={(e) => store.getState().writing({ part1Text: e.target.value })}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {!chosenOption ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">
                Choose <strong>one</strong> of the following tasks. You will write 220–260 words.
              </p>
              {exam.writing.part2.options.map((option, i) => (
                <button
                  key={option.id}
                  className="card block w-full p-5 text-left hover:border-cam-500"
                  onClick={() => store.getState().writing({ part2OptionId: option.id })}
                >
                  <span className="font-semibold text-cam-700">
                    Question {i + 2} — {TASK_TYPE_LABELS[option.taskType] ?? option.taskType}
                  </span>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{option.prompt}</p>
                </button>
              ))}
            </div>
          ) : (
            <>
              <div className="card p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-slate-800">
                      {TASK_TYPE_LABELS[chosenOption.taskType] ?? chosenOption.taskType}
                    </h3>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {chosenOption.prompt}
                    </p>
                  </div>
                  <button
                    className="btn-secondary shrink-0"
                    onClick={() =>
                      store.getState().writing({ part2OptionId: null, part2Text: "" })
                    }
                  >
                    Change task
                  </button>
                </div>
              </div>
              <div className="card p-5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-600">Your answer</span>
                  <WordCount
                    text={draft.part2Text}
                    min={chosenOption.wordMin}
                    max={chosenOption.wordMax}
                  />
                </div>
                <textarea
                  className="input min-h-[24rem] w-full font-serif text-base leading-7"
                  spellCheck={false}
                  autoComplete="off"
                  value={draft.part2Text}
                  onPaste={handlePaste}
                  onChange={(e) => store.getState().writing({ part2Text: e.target.value })}
                />
              </div>
            </>
          )}
        </div>
      )}
    </PaperChrome>
  );
}
