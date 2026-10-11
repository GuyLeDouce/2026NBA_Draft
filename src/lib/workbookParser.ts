import * as XLSX from "xlsx";
import { POSITIONS, type Player, type Position } from "../types";
import { normalizeName, playerId, normalizePositions } from "./identity";
export function parseWorkbook(bytes: Uint8Array): Player[] {
  const workbook = XLSX.read(bytes, { type: "array", cellDates: true });
  const sheet = workbook.Sheets["Draft Board"];
  if (!sheet) throw Error("Missing canonical Draft Board sheet");
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
  });
  const headerIndex = rows.findIndex(
    (r) => r.includes("Overall") && r.includes("Player"),
  );
  if (headerIndex < 0) throw Error("Draft Board headers missing");
  const headers = rows[headerIndex].map(String);
  const fields = {
    researchRank: "Overall",
    name: "Player",
    team: "Team",
    primaryPosition: "Main group",
    historicalGames: "2025-26 GP",
    historicalFpg: "2025-26 FP/G",
    projectedLow: "2026-27 low",
    projectedHigh: "2026-27 high",
    planningGames: "Planning GP",
    risk: "Risk",
    projectedFpg: "2026-27 center",
    planningSeasonPoints: "Planning season FP",
    status: "Status",
    draftRationale: "Draft rationale",
    fantasyProsFpg: "FP custom FP/G",
    hashtagFpg: "HT custom FP/G",
    rawConsensus: "Raw consensus",
    analystAdjustment: "Analyst adjustment",
    contextSource: "Context source",
    poolTier: "Pool tier",
    dataConfidence: "Data confidence",
    projectionType: "Projection type",
    rosterStatus: "Roster status",
    verifiedAt: "Verified / snapshot",
    rosterSource: "Roster source",
    historySource: "History source",
  };
  for (const field of [...Object.values(fields), "Source position tags"])
    if (!headers.includes(field))
      throw Error("Missing expected column: " + field);
  const numeric = new Set([
    "researchRank",
    "historicalGames",
    "historicalFpg",
    "projectedLow",
    "projectedHigh",
    "planningGames",
    "projectedFpg",
    "planningSeasonPoints",
    "fantasyProsFpg",
    "hashtagFpg",
    "rawConsensus",
    "analystAdjustment",
  ]);
  const players: Player[] = rows
    .slice(headerIndex + 1)
    .filter((r) => r[headers.indexOf("Overall")] !== null)
    .map((row) => {
      const record: Record<string, unknown> = {};
      for (const [field, column] of Object.entries(fields)) {
        const raw = row[headers.indexOf(column)];
        let value: unknown =
          raw === null || raw === undefined || raw === "" ? null : raw;
        if (value !== null && numeric.has(field)) {
          value = Number(value);
          if (!Number.isFinite(value)) throw Error("Invalid numeric " + column);
        } else if (value !== null)
          value =
            raw instanceof Date
              ? raw.toISOString().slice(0, 10)
              : String(raw).trim();
        record[field] = value;
      }
      if (typeof record.name !== "string" || !record.name)
        throw Error("Missing player name");
      if (!POSITIONS.includes(record.primaryPosition as Position))
        throw Error("Invalid primary position " + record.name);
      record.id = playerId(record.name);
      record.searchName = normalizeName(record.name);
      record.eligiblePositions = normalizePositions(
        String(row[headers.indexOf("Source position tags")] ?? ""),
        record.primaryPosition as Position,
      );
      // NONE explicitly denotes no reliable projection. Its source zeros/range are placeholders, not forecasts.
      if (record.projectionType === "NONE")
        for (const key of [
          "projectedLow",
          "projectedHigh",
          "projectedFpg",
          "planningGames",
          "planningSeasonPoints",
        ])
          record[key] = null;
      return record as unknown as Player;
    });

  return players;
}
