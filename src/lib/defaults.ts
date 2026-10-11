import dataset from "../data/players.generated.json";
import type { AppState, LeagueSettings } from "../types";
import { DEFAULT_SCORING } from "./scoring";
import { DEFAULT_SLOTS } from "./roster";
import { emptyDraft } from "./draft";
export const DATA_VERSION = dataset.metadata.dataVersion;
export const APP_VERSION = "1.1.0";
export function defaultLeague(): LeagueSettings {
  return {
    name: "2026–27 Draft Room",
    teamCount: 10,
    teams: Array.from({ length: 10 }, (_, i) => ({
      id: "team-" + (i + 1),
      name: i === 0 ? "My Team" : "Team " + (i + 1),
    })),
    myTeamId: "team-1",
    draftSlot: null,
    draftDate: "2026-10-13",
    roster: { slots: [...DEFAULT_SLOTS] },
  };
}
export function defaultState(): AppState {
  return {
    schemaVersion: 2,
    appVersion: APP_VERSION,
    dataVersion: DATA_VERSION,
    leagueSettings: defaultLeague(),
    scoringSettings: { ...DEFAULT_SCORING },
    realDraft: emptyDraft(),
    mockDraft: { ...emptyDraft(), slot: 1, style: "STANDARD", seed: 2026 },
    personal: {},
    preferences: { deepMode: false, draftDay: false, pool: 250 },
    setupDone: false,
    queues: { real: [], mock: [] },
    autoRemoveQueued: false,
    eligibilityOverrides: {},
    draftLocked: false,
  };
}
