import test from "node:test";
import assert from "node:assert/strict";
import data from "../src/data/players.generated.json";
import type { Player, MockStyle, Position, SlotType } from "../src/types";
import { validatePlayers, TOP_20 } from "../scripts/player-validation";
import {
  normalizeName,
  playerId,
  normalizePositions,
} from "../src/lib/identity";
import { DEFAULT_SCORING, scoreStats } from "../src/lib/scoring";
import { defaultState, defaultLeague } from "../src/lib/defaults";
import {
  emptyDraft,
  snakePick,
  nextPick,
  recordPick,
  undoPick,
  correctPick,
  teamOnClock,
  totalPicks,
} from "../src/lib/draft";
import {
  assignRoster,
  eligible,
  movePlayer,
  rosterNeeds,
  teamPlayers,
} from "../src/lib/roster";
import {
  analyzeDraft,
  fantasyRelevant,
  replacementLevels,
  tierNumber,
  twoPickPlan,
  valueLabel,
} from "../src/lib/recommendations";
import { simulateToMyPick, mockLeague } from "../src/lib/mock";
import { exportState, importState, parseState } from "../src/lib/storage";
const players = data.players as Player[];
const league = { ...defaultLeague(), draftSlot: 7 };
const fixture = (name: string, pos: Position[], rank = 100): Player => ({
  ...players[0],
  id: playerId(name),
  name,
  researchRank: rank,
  primaryPosition: pos[0],
  eligiblePositions: pos,
  risk: "STANDARD",
});
const events: [string, Parameters<typeof scoreStats>[0], number][] = [
  ["OREB stacks with total REB", { OREB: 1, REB: 1 }, 3],
  ["made two", { PTS: 2, FGM: 1 }, 3],
  ["made three stacks", { PTS: 3, FGM: 1, "3PM": 1 }, 5],
  ["made FT", { PTS: 1, FTM: 1 }, 2],
  ["missed FG", { FGMISS: 1 }, -1],
  ["missed FT", { FTMISS: 1 }, -1],
  ["assists", { AST: 2 }, 3],
  ["steals", { STL: 1 }, 2],
  ["blocks", { BLK: 2 }, 3],
  ["turnovers", { TO: 1 }, -2],
  ["ejections", { EJ: 1 }, 10],
];
for (const [name, stats, expected] of events)
  test("Scoring: " + name, () => assert.equal(scoreStats(stats), expected));
test("Scoring edits stay centralized", () =>
  assert.equal(scoreStats({ AST: 2 }, { ...DEFAULT_SCORING, AST: 3 }), 6));
test("600 unique records, complete rank range, exact Top 20", () => {
  assert.deepEqual(validatePlayers(players).errors, []);
  assert.deepEqual(
    players.slice(0, 20).map((p) => p.name),
    TOP_20,
  );
});
test("Regression gate rejects changed rankings", () =>
  assert.ok(
    validatePlayers([
      { ...players[0], name: "Wrong" },
      ...players.slice(1),
    ]).errors.some((e) => e.includes("TOP-20")),
  ));
test("Validation rejects duplicate IDs/ranks and missing players", () =>
  assert.ok(
    validatePlayers([players[0], players[0], ...players.slice(2, -1)]).errors
      .length >= 3,
  ));
test("No reliable projections are null, never zero placeholders", () => {
  assert.equal(players.filter((p) => p.projectedFpg === null).length, 171);
  assert.ok(
    players
      .filter((p) => p.projectionType === "NONE")
      .every(
        (p) =>
          p.projectedLow === null &&
          p.projectedHigh === null &&
          p.planningSeasonPoints === null,
      ),
  );
});
test("Names retain suffix identity and normalize accents/apostrophes", () => {
  assert.equal(playerId("Nicolás O’Neal Jr."), "nicolas-oneal-jr");
  assert.notEqual(playerId("Gary Payton"), playerId("Gary Payton II"));
  assert.equal(normalizeName("Karl-Anthony Towns"), "karl anthony towns");
  assert.equal(
    playerId(players[0].name),
    playerId({ ...players[0], researchRank: 40 }.name),
  );
});
test("Explicit position normalization; broad tags use primary", () => {
  assert.deepEqual(normalizePositions("PG/SF/SG", "SG"), ["PG", "SG", "SF"]);
  assert.deepEqual(normalizePositions("GF", "SF"), ["SF"]);
});
for (let slot = 1; slot <= 10; slot++)
  test("Snake all rounds and future picks, slot " + slot, () => {
    for (let round = 1; round <= 15; round++) {
      const overall = (round - 1) * 10 + (round % 2 ? slot : 11 - slot);
      assert.equal(snakePick(overall, 10).slot, slot);
      assert.equal(snakePick(overall, 10).round, round);
      assert.equal(nextPick((round - 1) * 10 + 1, slot, 10, 150), overall);
    }
  });
test("Snake slot seven exact turn picks", () => {
  assert.deepEqual(
    [7, 14, 27, 34].map((n) => snakePick(n, 10).pick),
    [7, 4, 7, 4],
  );
  assert.equal(nextPick(151, 7, 10, 150), null);
  assert.equal(nextPick(1, null, 10), null);
});
test("Snake rejects invalid coordinates", () => {
  assert.throws(() => snakePick(0, 10));
  assert.throws(() => snakePick(1, 1));
});
for (const position of ["PG", "SG", "SF", "PF", "C"] as Position[])
  test("Roster primary " + position, () => {
    const p = fixture("Test " + position, [position]);
    const roster = assignRoster([p], league.roster);
    assert.equal(roster.find((s) => s.player)?.type, position);
    assert.ok(eligible(p, "UTIL"));
    assert.ok(eligible(p, "BN"));
  });
test("Roster G/F and restrictive multi-position assignment", () => {
  assert.ok(eligible(fixture("Guard", ["SG"]), "G"));
  assert.ok(!eligible(fixture("Guard", ["SG"]), "F"));
  assert.ok(eligible(fixture("Forward", ["PF"]), "F"));
  const sg = fixture("Wing", ["SG", "SF"]);
  assert.equal(
    assignRoster([sg], league.roster).find((s) => s.player)?.type,
    "SG",
  );
});
test("Roster augmenting assignment avoids unnecessary bench and IR", () => {
  const pool = [
    fixture("A", ["PG"]),
    fixture("B", ["PG", "SG"]),
    fixture("C", ["SG", "SF"]),
  ];
  const roster = assignRoster(pool, {
    slots: ["PG", "SG", "SF", "UTIL", "BN", "IR"],
  });
  assert.equal(roster.filter((s) => s.player).length, 3);
  assert.ok(roster.slice(0, 3).every((s) => s.player));
  assert.ok(roster.slice(3).every((s) => !s.player));
});
test("Roster bench overflow and manual slot swap", () => {
  const ps = [fixture("A", ["PG"]), fixture("B", ["SG"])];
  const settings = { slots: ["PG", "SG", "UTIL", "BN"] as SlotType[] };
  const board = { picks: [], slotOverrides: {} };
  const moved = movePlayer(board, ps, settings, ps[0].id, "UTIL-2");
  assert.equal(
    assignRoster(ps, settings, moved.slotOverrides)[2].player?.id,
    ps[0].id,
  );
  assert.throws(() => movePlayer(board, ps, settings, ps[0].id, "SG-1"));
  assert.equal(
    assignRoster([fixture("A", ["C"]), fixture("B", ["C"])], {
      slots: ["C", "BN", "IR"],
    }).filter((s) => s.player).length,
    2,
  );
});
test("Record, exclude, advance, sequential undo restores derived state", () => {
  let draft = emptyDraft();
  const baseline = analyzeDraft(players, league, draft, {});
  for (let i = 0; i < 25; i++)
    draft = recordPick(draft, league, players[i].id, players);
  assert.equal(draft.picks.length, 25);
  assert.equal(teamPlayers(draft, league.myTeamId, players).length, 2);
  assert.ok(
    !analyzeDraft(players, league, draft, {}).recommendations.some(
      (r) => r.player.id === players[0].id,
    ),
  );
  for (let i = 0; i < 25; i++) draft = undoPick(draft);
  assert.deepEqual(draft, emptyDraft());
  assert.deepEqual(analyzeDraft(players, league, draft, {}), baseline);
});
test("Duplicate draft, unknown player, unknown slot and completion guards", () => {
  const draft = recordPick(emptyDraft(), league, players[0].id, players);
  assert.throws(() => recordPick(draft, league, players[0].id, players));
  assert.throws(() => recordPick(draft, league, "bad", players));
  assert.throws(() =>
    recordPick(emptyDraft(), defaultLeague(), players[0].id, players),
  );
});
test("Correction replaces one pick without disturbing snake assignment", () => {
  let d = emptyDraft();
  for (let i = 0; i < 20; i++)
    d = recordPick(d, league, players[i].id, players);
  const result = correctPick(d, 4, players[30].id, players);
  assert.equal(result.picks[3].playerId, players[30].id);
  assert.equal(result.picks[3].teamId, d.picks[3].teamId);
  assert.equal(teamOnClock(result, league)?.id, teamOnClock(d, league)?.id);
  assert.throws(() => correctPick(d, 4, players[0].id, players));
  assert.ok(
    analyzeDraft(players, league, result, {}).recommendations.some(
      (r) => r.player.id === players[3].id,
    ),
  );
});
test("Research dominates initial recommendation and WATCH is excluded", () => {
  const a = analyzeDraft(players, league, emptyDraft(), {});
  assert.ok(a.recommendations[0].player.researchRank <= 3);
  assert.ok(a.recommendations.every((r) => fantasyRelevant(r.player)));
  assert.ok(!a.recommendations.some((r) => r.player.researchRank >= 430));
});
test("Personal rank changes value without changing research", () => {
  const p = players[39];
  const a = analyzeDraft(players, league, emptyDraft(), {
    [p.id]: { rank: 1 },
  });
  assert.ok(
    a.recommendations.find((r) => r.player.id === p.id)!.dynamicRank <= 5,
  );
  assert.equal(p.researchRank, 40);
});
test("Scarcity adjustment cannot push rank 80 over elite early talent", () => {
  const a = analyzeDraft(players, league, emptyDraft(), {});
  assert.ok(
    a.recommendations.slice(0, 5).every((r) => r.player.researchRank < 20),
  );
});
test("Cumulative high risk applies a modest penalty", () => {
  const candidate = players.find((p) => p.risk === "HIGH")!;
  const high = players
    .filter((p) => p.risk === "HIGH" && p.id !== candidate.id)
    .slice(0, 2);
  const low = high.map((p) => ({ ...p, risk: "STANDARD" }));
  const d = {
    picks: high.map((p, i) => ({
      overall: i + 1,
      playerId: p.id,
      teamId: league.myTeamId,
    })),
    slotOverrides: {},
  };
  const a = analyzeDraft(players, league, d, {}).recommendations.find(
    (r) => r.player.id === candidate.id,
  )!;
  const b = analyzeDraft(
    players.map((p) => low.find((x) => x.id === p.id) ?? p),
    league,
    d,
    {},
  ).recommendations.find((r) => r.player.id === candidate.id)!;
  assert.ok(a.score < b.score);
  assert.ok(b.score - a.score <= 4);
  assert.ok(
    a.reasons.some((r) => r.detail.includes("major availability risk")),
  );
});
test("Replacement unaffected by watch projections and respects roster format", () => {
  const before = replacementLevels(players, league);
  const after = replacementLevels(
    players.map((p) =>
      p.poolTier === "WATCH" ? { ...p, projectedFpg: 500 } : p,
    ),
    league,
  );
  assert.deepEqual(before, after);
  assert.ok(Object.values(before).every((v) => v !== null && v > 0));
  assert.notDeepEqual(
    before,
    replacementLevels(players, {
      ...league,
      roster: { slots: ["PG", "SG", "SF", "PF", "C"] },
    }),
  );
});
test("Tier, value and wait categories have documented boundaries", () => {
  assert.equal(tierNumber(players[0]), 1);
  assert.equal(valueLabel(2), "FAIR");
  assert.equal(valueLabel(9), "VALUE +9");
  assert.equal(valueLabel(18), "STEAL +18");
  assert.equal(valueLabel(-12), "REACH -12");
  const a = analyzeDraft(players, league, emptyDraft(), {});
  assert.ok(
    a.recommendations.every((r) =>
      ["LIKELY TO SURVIVE", "TOSS-UP", "UNLIKELY TO SURVIVE"].includes(
        r.survival,
      ),
    ),
  );
  assert.ok(a.alerts.length <= 3);
});
test("Unknown slot has no fictitious future pick or two-pick plan", () => {
  const a = analyzeDraft(players, defaultLeague(), emptyDraft(), {});
  assert.equal(a.next, null);
  assert.equal(a.distance, null);
  assert.equal(twoPickPlan(a), null);
});
test("Opponent demand and runs recalculate from picks", () => {
  const centers = players.filter((p) => p.primaryPosition === "C").slice(0, 5);
  let draft = emptyDraft();
  for (const p of centers) draft = recordPick(draft, league, p.id, players);
  const a = analyzeDraft(players, league, draft, {});
  assert.ok(a.runs.some((r) => r.position === "C" && r.count === 5));
  assert.ok(a.alerts.some((a) => a.title.includes("RUN")));
  assert.ok(a.scarcity.every((s) => s.demand <= a.intervening.length));
});
for (const style of [
  "STANDARD",
  "GUARD HEAVY",
  "BIG HEAVY",
  "CHAOTIC",
] as MockStyle[])
  test("Mock complete draft: " + style, () => {
    const state = defaultState();
    const realBefore = JSON.stringify(state.realDraft);
    let mock = { ...state.mockDraft, slot: 7, style };
    const settings = mockLeague(state.leagueSettings, mock);
    for (let round = 0; round < 15; round++) {
      mock = simulateToMyPick(players, state.leagueSettings, mock);
      assert.equal(teamOnClock(mock, settings)?.id, settings.myTeamId);
      const best = analyzeDraft(players, settings, mock, {}).recommendations[0];
      mock = {
        ...mock,
        ...recordPick(mock, settings, best.player.id, players),
      };
    }
    mock = simulateToMyPick(players, state.leagueSettings, mock);
    assert.equal(mock.picks.length, totalPicks(settings));
    assert.equal(
      new Set(mock.picks.map((p) => p.playerId)).size,
      mock.picks.length,
    );
    assert.ok(
      mock.picks
        .slice(0, 20)
        .every(
          (p) => players.find((x) => x.id === p.playerId)!.researchRank < 50,
        ),
    );
    assert.ok(
      mock.picks.every(
        (p) => players.find((x) => x.id === p.playerId)!.poolTier !== "WATCH",
      ),
    );
    assert.equal(JSON.stringify(state.realDraft), realBefore);
  });
test("Mock determinism and consecutive turn boundary", () => {
  const state = defaultState();
  const mock = { ...state.mockDraft, slot: 10 };
  assert.deepEqual(
    simulateToMyPick(players, state.leagueSettings, mock),
    simulateToMyPick(players, state.leagueSettings, mock),
  );
  let d = simulateToMyPick(players, state.leagueSettings, mock);
  const settings = mockLeague(state.leagueSettings, d);
  d = {
    ...d,
    ...recordPick(
      d,
      settings,
      players.find((p) => !d.picks.some((x) => x.playerId === p.id))!.id,
      players,
    ),
  };
  assert.equal(
    simulateToMyPick(players, state.leagueSettings, d).picks.length,
    10,
  );
});
test("Storage export and import preserve every state namespace", () => {
  const s = defaultState();
  s.leagueSettings = league;
  s.realDraft = recordPick(s.realDraft, league, players[0].id, players);
  s.personal[players[4].id] = {
    watch: true,
    note: "Test note",
    rank: 3,
    target: "PRIORITY",
  };
  assert.deepEqual(importState(exportState(s), players), s);
});
test("Storage rejects corrupted, incompatible, duplicate and unknown data", () => {
  assert.throws(() => importState("{broken", players));
  for (const patch of [
    { schemaVersion: 99 },
    { dataVersion: "old" },
    {
      realDraft: {
        picks: [{ overall: 1, playerId: "bad", teamId: "team-1" }],
        slotOverrides: {},
      },
    },
    { scoringSettings: { PTS: 1 } },
  ])
    assert.throws(() => parseState({ ...defaultState(), ...patch }, players));
});
test("Storage rejects impossible slot positions and duplicate teams", () => {
  const s = defaultState();
  s.leagueSettings.draftSlot = 11;
  assert.throws(() => parseState(s, players));
  s.leagueSettings.draftSlot = 1;
  s.leagueSettings.teams[1].id = s.leagueSettings.teams[0].id;
  assert.throws(() => parseState(s, players));
});
test("Default league does not invent actual position", () =>
  assert.equal(defaultState().leagueSettings.draftSlot, null));
test("All core needs disappear when primary slots filled", () => {
  const ps = (["PG", "SG", "SF", "PF", "C"] as Position[]).map((p) =>
    fixture(p, [p]),
  );
  assert.equal(
    rosterNeeds(assignRoster(ps, { slots: ["PG", "SG", "SF", "PF", "C"] }))
      .length,
    0,
  );
});

test("Higher-value starters stay ahead of bench options", () => {
  const ps = [
    fixture("Elite center", ["C"], 1),
    fixture("Reserve center", ["C"], 100),
  ];
  const roster = assignRoster(ps, { slots: ["C", "BN"] });
  assert.equal(roster[0].player?.id, ps[0].id);
  assert.equal(roster[1].player?.id, ps[1].id);
});

test("Draft capacity guard prevents losing an unplaceable player", () => {
  const settings = {
    ...league,
    teamCount: 2,
    teams: league.teams.slice(0, 2),
    draftSlot: 1,
    roster: { slots: ["PG"] as SlotType[] },
  };
  assert.throws(() =>
    recordPick(
      emptyDraft(),
      settings,
      players.find(
        (p) => p.eligiblePositions.length === 1 && p.primaryPosition === "C",
      )!.id,
      players,
    ),
  );
});
test("Deep mode never recommends unprojected watch entries", () => {
  const p = players.find((p) => p.projectionType === "NONE")!;
  const a = analyzeDraft(
    players,
    league,
    emptyDraft(),
    { [p.id]: { rank: 1 } },
    true,
  );
  assert.ok(!a.recommendations.some((r) => r.player.id === p.id));
});

import "./upgrades";
