import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button, Card } from "@/components/ui-kit";
import { runDigitizationPipeline, type PipelineResult } from "@/lib/land";

export const Route = createFileRoute("/_authenticated/upload")({
  head: () => ({
    meta: [
      { title: "Upload & Digitize Documents — Bhoomi Setu" },
      {
        name: "description",
        content:
          "Upload scanned legacy land documents and run image enhancement, OCR and AI field extraction.",
      },
      { property: "og:title", content: "Upload & Digitize Documents — Bhoomi Setu" },
      {
        property: "og:description",
        content: "Officer interface for scanning, enhancing and extracting fields from land documents.",
      },
    ],
  }),
  component: UploadPage,
});

const LANGS = [
  { v: "hi", l: "Hindi (Devanagari)" },
  { v: "mr", l: "Marathi" },
  { v: "ta", l: "Tamil" },
  { v: "te", l: "Telugu" },
  { v: "bn", l: "Bengali" },
  { v: "en", l: "English" },
];

function UploadPage() {
  const navigate = useNavigate();
  const [fileName, setFileName] = useState("");
  const [language, setLanguage] = useState("hi");
  const [district, setDistrict] = useState("Nagpur");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function process() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await runDigitizationPipeline({
        fileName: fileName || "untitled_scan.tif",
        language,
        district,
      });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Processing failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl">Upload &amp; digitize</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Scanned document → image enhancement → OCR &amp; handwriting recognition → AI field
          extraction → validation → verification queue.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <Card title="New document">
          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium">Scanned file</span>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
                className="mt-1.5 block w-full rounded-md border border-input bg-card px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm"
              />
              <span className="mt-1 block text-xs text-muted-foreground">
                Demo mode: the file stays on your device; the pipeline produces simulated OCR and
                extraction output with realistic confidence scores.
              </span>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium">Document language</span>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="mt-1.5 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                >
                  {LANGS.map((l) => (
                    <option key={l.v} value={l.v}>
                      {l.l}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-medium">District</span>
                <input
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="mt-1.5 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                />
              </label>
            </div>

            <Button onClick={process} disabled={busy}>
              {busy ? "Processing…" : "Run digitization pipeline"}
            </Button>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </Card>

        <Card title="Pipeline output">
          {!result && !busy && (
            <p className="text-sm text-muted-foreground">
              Run the pipeline to see preprocessing, recognition, extraction and validation steps.
            </p>
          )}
          {busy && <p className="text-sm text-muted-foreground">Working through the pipeline…</p>}
          {result && (
            <div className="space-y-4">
              <ol className="space-y-2 text-sm">
                {result.steps.map((s, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-0.5 text-success">✓</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
              {result.flags.length > 0 && (
                <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
                  <p className="font-medium">Flagged for officer review</p>
                  <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                    {result.flags.map((f) => (
                      <li key={f}>{f.replaceAll("_", " ")}</li>
                    ))}
                  </ul>
                </div>
              )}
              <Button
                variant="outline"
                onClick={() => navigate({ to: "/records/$id", params: { id: result.recordId } })}
              >
                Open extracted record
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
