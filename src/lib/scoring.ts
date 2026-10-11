import type { ScoringSettings, ScoringKey } from "../types";
export const DEFAULT_SCORING: ScoringSettings = {
  PTS: 1,
  FGM: 1,
  FGMISS: -1,
  FTM: 1,
  FTMISS: -1,
  "3PM": 1,
  OREB: 2,
  REB: 1,
  AST: 1.5,
  STL: 2,
  BLK: 1.5,
  TO: -2,
  EJ: 10,
};
export const SCORING_LABELS: Record<ScoringKey, string> = {
  PTS: "Points",
  FGM: "Field goals made",
  FGMISS: "Field goals missed",
  FTM: "Free throws made",
  FTMISS: "Free throws missed",
  "3PM": "Three pointers made",
  OREB: "Offensive rebounds",
  REB: "Total rebounds",
  AST: "Assists",
  STL: "Steals",
  BLK: "Blocks",
  TO: "Turnovers",
  EJ: "Ejections",
};
export function scoreStats(
  stats: Partial<Record<ScoringKey, number>>,
  settings = DEFAULT_SCORING,
) {
  return (Object.keys(settings) as ScoringKey[]).reduce(
    (sum, key) => sum + (stats[key] ?? 0) * settings[key],
    0,
  );
}
export function scoringChanged(settings: ScoringSettings) {
  return (Object.keys(DEFAULT_SCORING) as ScoringKey[]).some(
    (k) => settings[k] !== DEFAULT_SCORING[k],
  );
}
