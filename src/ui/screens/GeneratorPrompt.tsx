/**
 * Self-service exam authoring: copy-paste prompts for external AI models
 * (create from scratch, or remix an existing exam.json as a template),
 * plus model recommendations and packaging instructions.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { EXAM_GENERATOR_PROMPT, EXAM_REMIX_PROMPT } from "../lib/generatorPrompt";

const RECOMMENDED_MODELS: Array<{
  name: string;
  where: string;
  verdict: string;
  notes: string;
}> = [
  {
    name: "Claude Opus 4.8",
    where: "claude.ai / Claude API",
    verdict: "Best quality",
    notes:
      "Strongest at holding the strict schema over a very long output and at writing convincing C1-level distractors and cohesive gapped-text paragraphs. Use extended thinking if available.",
  },
  {
    name: "Claude Sonnet 4.6",
    where: "claude.ai / Claude API",
    verdict: "Best value",
    notes:
      "Nearly as reliable on the schema, faster and cheaper. A good default if you generate many exams.",
  },
  {
    name: "Gemini 2.5 Pro",
    where: "AI Studio (aistudio.google.com)",
    verdict: "Good alternative",
    notes:
      "Large output limit helps fit the whole exam in one response. In AI Studio, raise 'Max output tokens' and you can also enforce a JSON response.",
  },
  {
    name: "GPT-5 class (ChatGPT)",
    where: "chatgpt.com",
    verdict: "Works",
    notes:
      "Produces valid files but double-check answer keys (Part 6/7 keys are the usual weak spot). Ask it to re-verify keys before output.",
  },
];

function PromptBlock({ title, prompt }: { title: string; prompt: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard API unavailable (e.g. non-secure context) — user can select manually.
    }
  };
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        <button className="btn-primary" onClick={() => void copy()}>
          {copied ? "✓ Copied" : "📋 Copy prompt"}
        </button>
      </div>
      <pre className="max-h-[24rem] overflow-auto whitespace-pre-wrap bg-slate-900 p-5 font-mono text-xs leading-5 text-slate-100">
        {prompt}
      </pre>
    </div>
  );
}

export function GeneratorPrompt() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Generate an exam with AI</h1>
          <p className="text-sm text-slate-500">
            Paste one of these prompts into an external AI model to get a ready-to-import exam
            package.
          </p>
        </div>
        <Link to="/" className="btn-secondary">← Library</Link>
      </header>

      <section className="card p-6">
        <h2 className="font-semibold text-slate-800">How it works</h2>
        <ol className="mt-3 list-inside list-decimal space-y-2 text-sm text-slate-700">
          <li>Copy a prompt below and paste it into one of the recommended models.</li>
          <li>
            Save the model's output as <code className="rounded bg-slate-100 px-1">exam.json</code>{" "}
            — the file inside the ZIP must always have exactly this name. JSON only, with no{" "}
            <code className="rounded bg-slate-100 px-1">```</code> fences around it.
          </li>
          <li>
            Put the file in a ZIP archive (the ZIP itself can have any name) and import it from{" "}
            <Link to="/import" className="text-cam-600 underline">Import exam</Link>.
          </li>
          <li>
            No audio is needed: listening parts ship a transcript and the app reads it aloud with
            text-to-speech. The "no audio file" warnings at import are expected.
          </li>
        </ol>
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-semibold">Tips</p>
          <ul className="mt-1 list-inside list-disc space-y-1">
            <li>
              <strong>meta.id must be unique per exam.</strong> The file is always named{" "}
              <code className="rounded bg-amber-100 px-1">exam.json</code>, but the{" "}
              <code className="rounded bg-amber-100 px-1">"id"</code> field inside{" "}
              <code className="rounded bg-amber-100 px-1">"meta"</code> identifies the exam in
              your library — importing a second file with the same id replaces the first one.
            </li>
            <li>
              A full exam (56 + 30 questions) is a lot of text — if the response gets cut off,
              reply <em>"continue exactly from where you stopped, mid-string if needed"</em> and
              join the pieces, or ask for reading + writing first and listening + speaking in a
              second message.
            </li>
            <li>
              If the import fails, the error list names the exact JSON path — paste those errors
              back into the model and ask it to fix only those fields.
            </li>
          </ul>
        </div>
      </section>

      <section className="card mt-6 p-6">
        <h2 className="font-semibold text-slate-800">Prompt 1 — create a new exam from scratch</h2>
        <p className="mb-4 mt-1 text-sm text-slate-500">
          Use this the first time, when you don't have a working exam file yet.
        </p>
        <PromptBlock title="From-scratch generator prompt" prompt={EXAM_GENERATOR_PROMPT} />
      </section>

      <section className="card mt-6 p-6">
        <h2 className="font-semibold text-slate-800">
          Prompt 2 — new exam from an existing exam.json (recommended once you have one)
        </h2>
        <p className="mb-4 mt-1 text-sm text-slate-500">
          Giving the model a working file as a structural template makes the schema far more
          reliable. Paste the contents of your existing <code>exam.json</code> where the prompt
          says so (or attach the file in claude.ai / AI Studio). The prompt forces a{" "}
          <strong>new meta.id</strong> and <strong>100% new content</strong> — same skeleton,
          completely different exam, so nothing gets overwritten and you never re-practise
          questions you remember.
        </p>
        <PromptBlock title="Template-based generator prompt" prompt={EXAM_REMIX_PROMPT} />
        <p className="mt-3 text-xs text-slate-500">
          Faster variant: ask it to replace only some papers, e.g.{" "}
          <em>
            "Replace ONLY the reading and writing papers with new content; return the complete
            JSON with listening and speaking unchanged — but still set a new meta.id and title."
          </em>
        </p>
      </section>

      <section className="card mt-6 p-6">
        <h2 className="font-semibold text-slate-800">Recommended models</h2>
        <p className="mt-1 text-sm text-slate-500">
          Use a frontier model with a large output limit. Avoid small/fast tiers (Haiku,
          Flash-Lite, mini) — they drift from the schema and produce wrong answer keys.
        </p>
        <div className="mt-4 space-y-3">
          {RECOMMENDED_MODELS.map((m) => (
            <div key={m.name} className="rounded-lg border border-slate-200 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-800">{m.name}</span>
                <span className="rounded-full bg-cam-100 px-2 py-0.5 text-xs font-semibold text-cam-700">
                  {m.verdict}
                </span>
                <span className="text-xs text-slate-400">{m.where}</span>
              </div>
              <p className="mt-1 text-sm text-slate-600">{m.notes}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
