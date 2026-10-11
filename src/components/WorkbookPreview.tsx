"use client";
import { useState } from "react";
import type { Player } from "../types";
import { workbookDiff, type WorkbookDiff } from "../lib/workbookDiff";
export function WorkbookPreview({
  players,
  locked,
}: {
  players: Player[];
  locked: boolean;
}) {
  const [diff, setDiff] = useState<WorkbookDiff | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function preview(file: File) {
    if (locked) return;
    setBusy(true);
    setError("");
    setDiff(null);
    try {
      if (file.size > 10_000_000)
        throw Error("Workbook exceeds 10 MB preview limit");
      const { parseWorkbook } = await import("../lib/workbookParser");
      setDiff(
        workbookDiff(
          players,
          parseWorkbook(new Uint8Array(await file.arrayBuffer())),
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Workbook could not be parsed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel settings-section">
      <span className="eyebrow">READ-ONLY RESEARCH REVIEW</span>
      <h2>Preview data update</h2>
      <p>
        Choose a trusted research XLSX to compare its Draft Board with this
        dataset. Preview never changes the canonical workbook, generated data or
        your draft.
      </p>
      <label>
        Candidate workbook
        <input
          aria-label="Preview workbook"
          type="file"
          accept=".xlsx"
          disabled={locked || busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void preview(file);
            e.target.value = "";
          }}
        />
      </label>
      {busy && <p>Reading workbook…</p>}
      {error && <p role="alert">{error}</p>}
      {diff && (
        <>
          <h3>
            {diff.matched} matched · {diff.newPlayers.length} new ·{" "}
            {diff.removedPlayers.length} removed
          </h3>
          <p>
            {diff.canApply
              ? "Identity checks passed. Review all changes before running the importer."
              : "UPDATE BLOCKED · Resolve identity / validation issues first."}
          </p>
          {diff.issues.map((x) => (
            <p className="error" key={x}>
              {x}
            </p>
          ))}
          {diff.possibleMatches.map((x) => (
            <p key={x.oldName + x.newName}>
              Possible identity match: {x.oldName} → {x.newName}
            </p>
          ))}
          <div className="workbook-changes">
            {diff.changed.map((p) => (
              <details key={p.id}>
                <summary>
                  {p.name} · {p.changes.length} changes
                </summary>
                {p.changes.map((c) => (
                  <p key={c.field}>
                    <b>{c.field}</b>: {c.before} → {c.after}
                  </p>
                ))}
              </details>
            ))}
          </div>
          <p>New: {diff.newPlayers.map((p) => p.name).join(", ") || "None"}</p>
          <p>
            Removed / orphan review:{" "}
            {diff.removedPlayers.map((p) => p.name).join(", ") || "None"}
          </p>
          <p>
            Use the documented preview → import → validate → build workflow
            after reviewing the report. Existing IDs carry personal data
            forward; unmatched personal records remain available for review and
            export. No in-draft dataset replacement.
          </p>
        </>
      )}
    </section>
  );
}
