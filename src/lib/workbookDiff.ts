import type { Player } from "../types";
export const DIFF_FIELDS = [
  "researchRank",
  "team",
  "eligiblePositions",
  "projectedFpg",
  "risk",
  "rosterStatus",
] as const;
export interface WorkbookDiffPlayer {
  id: string;
  name: string;
  changes: {
    field: (typeof DIFF_FIELDS)[number];
    before: string;
    after: string;
  }[];
}
export interface WorkbookDiff {
  matched: number;
  newPlayers: Player[];
  removedPlayers: Player[];
  changed: WorkbookDiffPlayer[];
  issues: string[];
  possibleMatches: { oldName: string; newName: string }[];
  canApply: boolean;
}
export function workbookDiff(before: Player[], after: Player[]): WorkbookDiff {
  const old = new Map(before.map((p) => [p.id, p])),
    fresh = new Map(after.map((p) => [p.id, p]));
  const newPlayers = after.filter((p) => !old.has(p.id)),
    removedPlayers = before.filter((p) => !fresh.has(p.id));
  const issues: string[] = [];
  if (fresh.size !== after.length)
    issues.push("Duplicate stable IDs in candidate workbook");
  if (new Set(after.map((p) => p.searchName)).size !== after.length)
    issues.push("Duplicate normalized player identities");
  if (after.length !== 600)
    issues.push("Expected 600 canonical players; found " + after.length);
  const ranks = new Set(after.map((p) => p.researchRank));
  if (
    ranks.size !== 600 ||
    after.some(
      (p) =>
        !Number.isInteger(p.researchRank) ||
        p.researchRank < 1 ||
        p.researchRank > 600,
    )
  )
    issues.push("Ranks must cover 1–600 exactly once");
  const possibleMatches = removedPlayers.flatMap((a) =>
    newPlayers
      .filter(
        (b) =>
          a.searchName.split(" ").at(-1) === b.searchName.split(" ").at(-1) ||
          a.searchName.replace(/\b(jr|sr|ii|iii|iv)\b/g, "").trim() ===
            b.searchName.replace(/\b(jr|sr|ii|iii|iv)\b/g, "").trim(),
      )
      .map((b) => ({ oldName: a.name, newName: b.name })),
  );
  if (possibleMatches.length)
    issues.push(
      "Possible identity changes require manual review; no automatic merge",
    );
  const display = (v: unknown) =>
    v === null
      ? "No projection / blank"
      : Array.isArray(v)
        ? [...v].sort().join(" / ")
        : String(v);
  const changed = after
    .filter((p) => old.has(p.id))
    .map((p) => ({
      id: p.id,
      name: p.name,
      changes: DIFF_FIELDS.flatMap((field) =>
        display(old.get(p.id)![field]) !== display(p[field])
          ? [
              {
                field,
                before: display(old.get(p.id)![field]),
                after: display(p[field]),
              },
            ]
          : [],
      ),
    }))
    .filter((p) => p.changes.length);
  return {
    matched: after.length - newPlayers.length,
    newPlayers,
    removedPlayers,
    changed,
    issues,
    possibleMatches,
    canApply: issues.length === 0,
  };
}
