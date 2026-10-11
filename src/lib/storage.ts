import { z } from "zod";
import type { AppState, Player } from "../types";
import { leaguePlayers } from "./eligibility";
import { APP_VERSION, DATA_VERSION } from "./defaults";
import { DEFAULT_SCORING } from "./scoring";
import { orderedTeams, snakePick, totalPicks } from "./draft";
import { assignRoster, eligible, teamPlayers } from "./roster";
export const STORAGE_KEY = "nba-draft-assistant:v1";
const slot = z.enum([
  "PG",
  "SG",
  "SF",
  "PF",
  "C",
  "G",
  "F",
  "UTIL",
  "BN",
  "IR",
]);
const pick = z.object({
  overall: z.number().int().positive(),
  playerId: z.string(),
  teamId: z.string(),
});
const draft = z.object({
  picks: z.array(pick).max(600),
  slotOverrides: z.record(z.string(), z.string()),
});
const scoring = z.object(
  Object.fromEntries(
    Object.keys(DEFAULT_SCORING).map((key) => [
      key,
      z.number().min(-100).max(100),
    ]),
  ) as Record<keyof typeof DEFAULT_SCORING, z.ZodNumber>,
);
const schema = z.object({
  schemaVersion: z.literal(2),
  appVersion: z.string(),
  dataVersion: z.literal(DATA_VERSION),
  leagueSettings: z.object({
    name: z.string().min(1).max(80),
    teamCount: z.number().int().min(2).max(20),
    teams: z.array(
      z.object({ id: z.string().min(1), name: z.string().min(1).max(60) }),
    ),
    myTeamId: z.string(),
    draftSlot: z.number().int().min(1).max(20).nullable(),
    draftDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    roster: z.object({ slots: z.array(slot).min(1).max(25) }),
  }),
  scoringSettings: scoring,
  realDraft: draft,
  mockDraft: draft.extend({
    slot: z.number().int().min(1).max(20),
    style: z.enum(["STANDARD", "GUARD HEAVY", "BIG HEAVY", "CHAOTIC"]),
    seed: z.number().int(),
  }),
  personal: z.record(
    z.string(),
    z.object({
      watch: z.boolean().optional(),
      target: z
        .enum(["PRIORITY", "VALUE", "SLEEPER", "LATE ROUND", "AVOID"])
        .optional(),
      note: z.string().max(10000).optional(),
      rank: z.number().int().min(1).max(600).optional(),
    }),
  ),
  preferences: z.object({
    deepMode: z.boolean(),
    draftDay: z.boolean(),
    pool: z.number().int().min(1).max(600),
  }),
  setupDone: z.boolean(),
  queues: z.object({
    real: z.array(z.string()).max(15),
    mock: z.array(z.string()).max(15),
  }),
  autoRemoveQueued: z.boolean(),
  eligibilityOverrides: z.record(
    z.string(),
    z
      .array(z.enum(["PG", "SG", "SF", "PF", "C"]))
      .min(1)
      .max(5),
  ),
  draftLocked: z.boolean(),
});
export function parseState(input: unknown, players: Player[]): AppState {
  if (
    input &&
    typeof input === "object" &&
    "schemaVersion" in input &&
    input.schemaVersion === 1
  ) {
    input = {
      ...input,
      schemaVersion: 2,
      appVersion: APP_VERSION,
      queues: { real: [], mock: [] },
      autoRemoveQueued: false,
      eligibilityOverrides: {},
      draftLocked: false,
    };
  }
  if (
    input &&
    typeof input === "object" &&
    "dataVersion" in input &&
    typeof input.dataVersion === "string" &&
    /^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/.test(input.dataVersion)
  )
    input = { ...input, dataVersion: DATA_VERSION };
  const state = schema.parse(input) as AppState;
  players = leaguePlayers(players, state.eligibilityOverrides);
  for (const queue of Object.values(state.queues))
    if (new Set(queue).size !== queue.length)
      throw Error("Duplicate queue players");
  for (const positions of Object.values(state.eligibilityOverrides))
    if (new Set(positions).size !== positions.length)
      throw Error("Duplicate eligibility positions");
  const league = state.leagueSettings;
  const ids = new Set(players.map((p) => p.id));
  if (
    league.teams.length !== league.teamCount ||
    new Set(league.teams.map((t) => t.id)).size !== league.teamCount ||
    !league.teams.some((t) => t.id === league.myTeamId)
  )
    throw Error("Invalid fantasy teams");
  if (
    (league.draftSlot ?? 1) > league.teamCount ||
    state.mockDraft.slot > league.teamCount
  )
    throw Error("Draft position outside league");
  if (league.roster.slots.every((s) => s === "IR") || totalPicks(league) > 300)
    throw Error("Use 1–300 regular draft selections");
  // Preserve unmatched personal records and queue IDs for explicit orphan review after a refresh.
  for (const [kind, board] of [
    ["real", state.realDraft],
    ["mock", state.mockDraft],
  ] as const) {
    const settings =
      kind === "mock" ? { ...league, draftSlot: state.mockDraft.slot } : league;
    if (board.picks.length && settings.draftSlot === null)
      throw Error("Draft picks require a known position");
    if (
      board.picks.length > totalPicks(settings) ||
      new Set(board.picks.map((p) => p.playerId)).size !== board.picks.length
    )
      throw Error("Duplicate or excessive picks");
    const teams = orderedTeams(settings);
    board.picks.forEach((p, i) => {
      if (
        p.overall !== i + 1 ||
        !ids.has(p.playerId) ||
        p.teamId !== teams[snakePick(i + 1, settings.teamCount).slot - 1].id
      )
        throw Error("Invalid pick sequence at " + (i + 1));
    });
    for (const [playerId, slotId] of Object.entries(board.slotOverrides)) {
      const p = players.find((p) => p.id === playerId);
      const owner = board.picks.find((p) => p.playerId === playerId);
      const slotIndex = settings.roster.slots.findIndex(
        (s, i) => s + "-" + i === slotId,
      );
      if (
        !p ||
        !owner ||
        slotIndex < 0 ||
        !eligible(p, settings.roster.slots[slotIndex])
      )
        throw Error("Invalid roster override");
    }
    for (const team of teams) {
      const rosterPlayers = teamPlayers(board, team.id, players);
      const pinned = rosterPlayers
        .map((p) => board.slotOverrides[p.id])
        .filter(Boolean);
      if (new Set(pinned).size !== pinned.length)
        throw Error("Duplicate roster slots");
      if (
        assignRoster(
          rosterPlayers,
          settings.roster,
          board.slotOverrides,
        ).filter((s) => s.player).length !== rosterPlayers.length
      )
        throw Error("Roster cannot fit all drafted players");
    }
  }
  return state;
}
export function exportState(state: AppState) {
  return JSON.stringify(
    {
      ...state,
      rosterSettings: state.leagueSettings.roster,
      teams: state.leagueSettings.teams,
      watchlist: Object.entries(state.personal)
        .filter(([, v]) => v.watch)
        .map(([id]) => id),
      targets: Object.fromEntries(
        Object.entries(state.personal)
          .filter(([, v]) => v.target)
          .map(([id, v]) => [id, v.target]),
      ),
      notes: Object.fromEntries(
        Object.entries(state.personal)
          .filter(([, v]) => v.note)
          .map(([id, v]) => [id, v.note]),
      ),
      personalRanks: Object.fromEntries(
        Object.entries(state.personal)
          .filter(([, v]) => v.rank)
          .map(([id, v]) => [id, v.rank]),
      ),
    },
    null,
    2,
  );
}
export function importState(text: string, players: Player[]) {
  if (text.length > 5_000_000) throw Error("Backup too large");
  return parseState(JSON.parse(text), players);
}
