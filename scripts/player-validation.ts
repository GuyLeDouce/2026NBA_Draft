import type { Player } from "../src/types";
import { normalizeName } from "../src/lib/identity";
export const TOP_20 = [
  "Nikola Jokic",
  "Shai Gilgeous-Alexander",
  "Luka Doncic",
  "Giannis Antetokounmpo",
  "Victor Wembanyama",
  "Karl-Anthony Towns",
  "Jayson Tatum",
  "Cade Cunningham",
  "Anthony Edwards",
  "Jalen Johnson",
  "Donovan Mitchell",
  "Domantas Sabonis",
  "Jalen Duren",
  "Alperen Sengun",
  "Cooper Flagg",
  "Tyrese Maxey",
  "Anthony Davis",
  "Devin Booker",
  "Jalen Brunson",
  "Evan Mobley",
];
export function validatePlayers(players: Player[]) {
  const errors: string[] = [];
  const ranks = players.map((p) => p.researchRank);
  const duplicates = (values: (string | number)[]) =>
    values.length - new Set(values).size;
  if (players.length !== 600) errors.push("Expected exactly 600 players");
  if (duplicates(ranks)) errors.push("Duplicate ranks");
  if (duplicates(players.map((p) => p.id))) errors.push("Duplicate IDs");
  if (duplicates(players.map((p) => normalizeName(p.name))))
    errors.push("Duplicate canonical names");
  const missing = Array.from({ length: 600 }, (_, i) => i + 1).filter(
    (r) => !ranks.includes(r),
  );
  if (
    missing.length ||
    ranks.some((r) => !Number.isInteger(r) || r < 1 || r > 600)
  )
    errors.push("Rank range must be exactly 1–600");
  if (
    TOP_20.some(
      (n, i) => players.find((p) => p.researchRank === i + 1)?.name !== n,
    )
  )
    errors.push("TOP-20 REGRESSION FAILED");
  for (const p of players) {
    if (
      !p.eligiblePositions.length ||
      !p.eligiblePositions.includes(p.primaryPosition)
    )
      errors.push("Invalid positions: " + p.name);
    if (p.projectionType === "NONE" && p.projectedFpg !== null)
      errors.push("Unprojected player has a projection: " + p.name);
  }
  const breakdown = (key: keyof Player) =>
    Object.fromEntries(
      [...new Set(players.map((p) => String(p[key] ?? "UNKNOWN")))]
        .sort()
        .map((v) => [
          v,
          players.filter((p) => String(p[key] ?? "UNKNOWN") === v).length,
        ]),
    );
  const summary = {
    playerCount: players.length,
    uniquePlayers: new Set(players.map((p) => normalizeName(p.name))).size,
    rankRange: [Math.min(...ranks), Math.max(...ranks)],
    missingRanks: missing.length,
    duplicateRanks: duplicates(ranks),
    duplicateIds: duplicates(players.map((p) => p.id)),
    top20: errors.some((e) => e.includes("TOP-20")) ? "FAIL" : "PASS",
    withProjections: players.filter((p) => p.projectedFpg !== null).length,
    withoutProjections: players.filter((p) => p.projectedFpg === null).length,
    risk: breakdown("risk"),
    poolTier: breakdown("poolTier"),
    dataConfidence: breakdown("dataConfidence"),
    projectionType: breakdown("projectionType"),
    position: breakdown("primaryPosition"),
  };
  return { errors, summary };
}
