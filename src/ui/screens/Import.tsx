import { useCallback, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { importExamZip, ImportError, type ImportedPackage } from "../../core/import/packageImport";
import { countQuestions } from "../../core/grading/objective";
import { assetKey, db } from "../../db/db";

type ImportState =
  | { status: "idle" }
  | { status: "reading" }
  | { status: "error"; message: string; details: string[] }
  | { status: "preview"; pkg: ImportedPackage }
  | { status: "saving" };

export function Import() {
  const navigate = useNavigate();
  const [state, setState] = useState<ImportState>({ status: "idle" });
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    setState({ status: "reading" });
    try {
      const pkg = await importExamZip(await file.arrayBuffer());
      setState({ status: "preview", pkg });
    } catch (err) {
      if (err instanceof ImportError) {
        setState({ status: "error", message: err.message, details: err.details });
      } else {
        setState({
          status: "error",
          message: err instanceof Error ? err.message : String(err),
          details: [],
        });
      }
    }
  }, []);

  const save = useCallback(async (pkg: ImportedPackage) => {
    setState({ status: "saving" });
    const examId = pkg.exam.meta.id;
    await db.transaction("rw", [db.exams, db.assets], async () => {
      await db.assets.where("examId").equals(examId).delete();
      await db.exams.put({
        id: examId,
        title: pkg.exam.meta.title,
        source: pkg.exam.meta.source,
        importedAt: Date.now(),
        warnings: pkg.warnings,
        pkg: pkg.exam,
      });
      await db.assets.bulkPut(
        pkg.assets.map((a) => ({
          key: assetKey(examId, a.path),
          examId,
          path: a.path,
          mimeType: a.mimeType,
          kind: a.kind,
          blob: a.blob,
        })),
      );
    });
    navigate("/");
  }, [navigate]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Import exam package</h1>
        <Link to="/" className="btn-secondary">
          ← Library
        </Link>
      </header>

      {(state.status === "idle" || state.status === "reading" || state.status === "error") && (
        <>
          <label
            className={`card flex cursor-pointer flex-col items-center gap-3 border-2 border-dashed p-12 text-center transition-colors ${
              dragOver ? "border-cam-500 bg-cam-50" : "border-slate-300"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files[0];
              if (file) void handleFile(file);
            }}
          >
            <span className="text-4xl">📦</span>
            <span className="font-medium text-slate-700">
              {state.status === "reading"
                ? "Reading package…"
                : "Drop a .zip here, or click to choose"}
            </span>
            <span className="text-sm text-slate-500">
              The ZIP must contain an <code>exam.json</code> plus any referenced audio/images.
              Don't have one?{" "}
              <Link to="/generator" className="text-cam-600 underline" onClick={(e) => e.stopPropagation()}>
                Generate an exam with AI
              </Link>
              .
            </span>
            <input
              type="file"
              accept=".zip,application/zip"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
                e.target.value = "";
              }}
            />
          </label>

          {state.status === "error" && (
            <div className="card mt-6 border-red-300 bg-red-50 p-5">
              <h2 className="font-semibold text-red-700">Import failed</h2>
              <p className="mt-1 text-sm text-red-700">{state.message}</p>
              {state.details.length > 0 && (
                <ul className="mt-3 max-h-64 list-inside list-disc overflow-y-auto text-xs text-red-600">
                  {state.details.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}

      {state.status === "preview" && <Preview pkg={state.pkg} onSave={() => void save(state.pkg)} onCancel={() => setState({ status: "idle" })} />}
      {state.status === "saving" && <p className="text-slate-500">Saving to your library…</p>}
    </div>
  );
}

function Preview({
  pkg,
  onSave,
  onCancel,
}: {
  pkg: ImportedPackage;
  onSave: () => void;
  onCancel: () => void;
}) {
  const counts = countQuestions(pkg.exam);
  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold text-slate-800">{pkg.exam.meta.title}</h2>
      {pkg.exam.meta.source && (
        <p className="mt-1 text-sm text-slate-500">Source: {pkg.exam.meta.source}</p>
      )}
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div className="rounded-md bg-slate-50 p-3">
          <dt className="text-xs text-slate-500">Reading & UoE</dt>
          <dd className="font-semibold text-slate-800">
            {counts.reading} questions · {pkg.exam.reading.durationMinutes} min
          </dd>
        </div>
        <div className="rounded-md bg-slate-50 p-3">
          <dt className="text-xs text-slate-500">Writing</dt>
          <dd className="font-semibold text-slate-800">
            2 tasks · {pkg.exam.writing.durationMinutes} min
          </dd>
        </div>
        <div className="rounded-md bg-slate-50 p-3">
          <dt className="text-xs text-slate-500">Listening</dt>
          <dd className="font-semibold text-slate-800">
            {counts.listening} questions · {pkg.exam.listening.durationMinutes} min
          </dd>
        </div>
        <div className="rounded-md bg-slate-50 p-3">
          <dt className="text-xs text-slate-500">Speaking</dt>
          <dd className="font-semibold text-slate-800">4 parts</dd>
        </div>
      </dl>
      <p className="mt-3 text-sm text-slate-600">
        {pkg.assets.length} asset file{pkg.assets.length === 1 ? "" : "s"} found in the package.
      </p>
      {pkg.warnings.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <h3 className="text-sm font-semibold text-amber-800">Warnings</h3>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-amber-700">
            {pkg.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-6 flex justify-end gap-3">
        <button className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn-primary" onClick={onSave}>
          Save to library
        </button>
      </div>
    </div>
  );
}
