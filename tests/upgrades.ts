import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import data from "../src/data/players.generated.json";
import type { Player, Position, SlotType, AppState } from "../src/types";
import { defaultState, defaultLeague } from "../src/lib/defaults";
import {
  emptyDraft,
  recordPick,
  correctPick,
  undoPick,
  teamOnClock,
} from "../src/lib/draft";
import {
  addQueue,
  reorderQueue,
  queueView,
  contingencyLadder,
  queueWaitLabel,
} from "../src/lib/queue";
import { parseState, exportState, importState } from "../src/lib/storage";
import { analyzeDraft, replacementLevels } from "../src/lib/recommendations";
import {
  checkpoint,
  recoveryAction,
  restoreCheckpoint,
  retainedCheckpoints,
} from "../src/lib/recovery";
import { lockedChange, ownsLease } from "../src/lib/draftGuard";
import { leaguePlayers } from "../src/lib/eligibility";
import {
  advancedTwoPickPlan,
  slotLab,
  simulateUntil,
} from "../src/lib/planner";
import { recommendationDeltas } from "../src/lib/recommendationDelta";
import {
  riskCapacity,
  starterUpgrade,
  optimizeActive,
} from "../src/lib/lineupIntelligence";
import { assignRoster } from "../src/lib/roster";
import { workbookDiff } from "../src/lib/workbookDiff";
const players = data.players as Player[];
const league = { ...defaultLeague(), draftSlot: 7 };
const fixture = (
  id: string,
  pos: Position[],
  fpg: number | null,
  rank = 100,
): Player => ({
  ...players[0],
  id,
  name: id,
  eligiblePositions: pos,
  primaryPosition: pos[0],
  researchRank: rank,
  projectedFpg: fpg,
  projectedHigh: fpg,
  risk: "STANDARD",
  planningGames: 72,
});
function configured(): AppState {
  return { ...defaultState(), leagueSettings: league };
}
test("Queue add/remove/reorder limit and duplicate protection", () => {
  let q = addQueue([], players[0].id);
  assert.equal(addQueue(q, players[0].id).length, 1);
  q = addQueue(q, players[1].id);
  assert.deepEqual(reorderQueue(q, q[1], 0), [q[1], q[0]]);
  assert.equal(q.filter((x) => x !== q[0]).length, 1);
  assert.throws(() =>
    addQueue(
      players.slice(0, 15).map((p) => p.id),
      players[16].id,
    ),
  );
});
test("Queue taken retained, promoted, restored on undo and correction", () => {
  const q = players.slice(0, 3).map((p) => p.id);
  const d = recordPick(emptyDraft(), league, q[0], players);
  const recs = analyzeDraft(players, league, d, {}).recommendations;
  assert.equal(queueView(q, d, recs)[0].taken, true);
  assert.equal(contingencyLadder(q, d, recs)[0], q[1]);
  assert.equal(queueView(q, undoPick(d), recs)[0].taken, false);
  const corrected = correctPick(d, 1, q[1], players, league);
  assert.equal(queueView(q, corrected, recs)[0].taken, false);
  assert.equal(queueView(q, corrected, recs)[1].taken, true);
});
test("Queue separate real/mock persistence and wait categories", () => {
  const s = configured();
  s.queues.real = [players[0].id];
  s.queues.mock = [players[1].id];
  assert.deepEqual(importState(exportState(s), players).queues, s.queues);
  const a = analyzeDraft(players, league, s.realDraft, {});
  assert.match(queueWaitLabel(a.recommendations[0], a.distance), /TAKE NOW/);
  assert.equal(queueWaitLabel(a.recommendations[0], null), "WAIT RISK UNKNOWN");
});
test("Schema 1 migrates all legacy state without losing personal data", () => {
  const state = configured();
  state.realDraft = recordPick(state.realDraft, league, players[0].id, players);
  state.personal[players[1].id] = {
    watch: true,
    note: "Keep",
    rank: 1,
    target: "VALUE",
  };
  const legacy: Record<string, unknown> = { ...state, schemaVersion: 1 };
  for (const key of [
    "queues",
    "autoRemoveQueued",
    "eligibilityOverrides",
    "draftLocked",
  ])
    delete legacy[key];
  const result = parseState(legacy, players);
  assert.equal(result.schemaVersion, 2);
  assert.deepEqual(result.personal, state.personal);
  assert.deepEqual(result.realDraft, state.realDraft);
  assert.deepEqual(result.leagueSettings, state.leagueSettings);
  assert.deepEqual(result.scoringSettings, state.scoringSettings);
  assert.deepEqual(result.queues, { real: [], mock: [] });
});
test("Recovery picks, corrections and undo have meaningful actions", () => {
  const s = configured();
  const after = {
    ...s,
    realDraft: recordPick(s.realDraft, league, players[0].id, players),
  };
  assert.match(recoveryAction(s, after)!.action, /Drafted/);
  const corrected = {
    ...after,
    realDraft: correctPick(after.realDraft, 1, players[1].id, players, league),
  };
  assert.match(recoveryAction(after, corrected)!.action, /Corrected/);
  assert.match(recoveryAction(corrected, s)!.action, /Undo/);
  assert.equal(
    recoveryAction(s, { ...s, preferences: { ...s.preferences, pool: 600 } }),
    null,
  );
});
test("Recovery restores draft context while preserving current scouting", () => {
  const s = configured();
  s.queues.real = [players[0].id];
  const c = checkpoint(s, "real", "Start");
  const changed = {
    ...s,
    realDraft: recordPick(s.realDraft, league, players[0].id, players),
    personal: { [players[0].id]: { note: "Keep current note", watch: true } },
  };
  const restored = restoreCheckpoint(changed, c);
  assert.deepEqual(restored.realDraft, s.realDraft);
  assert.deepEqual(restored.queues, s.queues);
  assert.deepEqual(restored.personal, changed.personal);
  assert.deepEqual(
    analyzeDraft(players, league, restored.realDraft, {}),
    analyzeDraft(players, league, s.realDraft, {}),
  );
  const newSnapshot = checkpoint(restored, "real", "Restored checkpoint");
  assert.notEqual(newSnapshot.id, c.id);
});
test("Recovery retention protects real picks over minor and old mock changes", () => {
  const s = configured();
  const list = Array.from({ length: 1000 }, (_, i) =>
    checkpoint(s, "real", "pick", true, i),
  );
  list.push(
    ...Array.from({ length: 150 }, (_, i) =>
      checkpoint(s, "mock", "mock", true, 1000 + i),
    ),
  );
  list.push(
    ...Array.from({ length: 100 }, (_, i) =>
      checkpoint(s, "real", "queue", false, 2000 + i),
    ),
  );
  const retained = retainedCheckpoints(list);
  assert.equal(
    retained.filter((x) => x.kind === "real" && x.major).length,
    800,
  );
  assert.equal(retained.filter((x) => x.kind === "mock").length, 80);
  assert.equal(retained.filter((x) => !x.major).length, 40);
  assert.ok(retained.some((x) => x.timestamp === 999));
});
test("Lease ownership denies stale, expired and competing writers", () => {
  assert.ok(ownsLease({ id: "a", expires: 100 }, "a", 99));
  assert.ok(!ownsLease({ id: "b", expires: 100 }, "a", 99));
  assert.ok(!ownsLease({ id: "a", expires: 100 }, "a", 100));
  assert.ok(!ownsLease(null, "a", 0));
});
test("Two-pick paths deterministic, correct future turns, simulated opponents and fallbacks", () => {
  const a = advancedTwoPickPlan(players, league, emptyDraft(), {});
  assert.deepEqual(a, advancedTwoPickPlan(players, league, emptyDraft(), {}));
  assert.equal(a.length, 3);
  for (const p of a) {
    assert.equal(p.first, 7);
    assert.equal(p.next, 14);
    assert.notEqual(p.take.id, p.target.id);
    assert.ok(p.fallbacks.length);
    for (const ids of Object.values(p.scenarioPicks)) {
      assert.equal(ids.length, 6);
      assert.equal(new Set(ids).size, ids.length);
      assert.ok(!ids.includes(p.take.id));
    }
    for (const scenario of p.survivesIn)
      assert.ok(!p.scenarioPicks[scenario].includes(p.target.id));
  }
});
test("Two-pick planner excludes drafted players and respects unknown/final turns", () => {
  let d = emptyDraft();
  for (let i = 0; i < 6; i++) d = recordPick(d, league, players[i].id, players);
  const ids = new Set(d.picks.map((p) => p.playerId));
  for (const p of advancedTwoPickPlan(players, league, d, {}))
    assert.ok(!ids.has(p.take.id) && !ids.has(p.target.id));
  assert.deepEqual(
    advancedTwoPickPlan(players, defaultLeague(), emptyDraft(), {}),
    [],
  );
});
test("Planner uses needs and center pressure in controlled scenarios", () => {
  const a = simulateUntil(players, league, emptyDraft(), 20, "BEST AVAILABLE");
  const b = simulateUntil(
    players,
    league,
    emptyDraft(),
    20,
    "POSITION RUN",
    "C",
  );
  assert.notDeepEqual(
    a.picks.map((p) => p.playerId),
    b.picks.map((p) => p.playerId),
  );
  assert.equal(a.picks.length, 19);
});
test("Every actual recommendation factor reconciles with its score", () => {
  const personal = {
    [players[2].id]: { rank: 1, target: "PRIORITY" as const },
  };
  for (const rec of analyzeDraft(players, league, emptyDraft(), personal, true)
    .recommendations) {
    assert.ok(
      Math.abs(rec.breakdown.reduce((s, f) => s + f.value, 0) - rec.score) <
        1e-9,
    );
  }
  const rec = analyzeDraft(
    players,
    league,
    emptyDraft(),
    personal,
  ).recommendations.find((r) => r.player.id === players[2].id)!;
  assert.equal(
    rec.breakdown.find((f) => f.label === "Personal rank adjustment")!.value,
    2,
  );
});
test("Recommendation deltas report real factor differences", () => {
  const before = analyzeDraft(
    players,
    league,
    emptyDraft(),
    {},
  ).recommendations;
  const p = before[1];
  const after = [
    {
      ...p,
      dynamicRank: 1,
      breakdown: p.breakdown.map((f) =>
        f.label === "Position scarcity" ? { ...f, value: f.value + 3 } : f,
      ),
    },
  ];
  const delta = recommendationDeltas(before, after, "Test center")[0];
  assert.ok(
    delta.reasons.some((r) => r.includes("Position scarcity increased by 3.0")),
  );
  assert.ok(delta.reasons[0].includes("Test center"));
});
test("Eligibility override affects roster, scarcity and replacement without canonical mutation", () => {
  const canonical = fixture("only-center", ["C"], 30);
  const changed = leaguePlayers([canonical], { [canonical.id]: ["PG", "C"] });
  assert.deepEqual(canonical.eligiblePositions, ["C"]);
  assert.equal(
    assignRoster(changed, { slots: ["PG"] })[0].player?.id,
    canonical.id,
  );
  const s = configured();
  s.eligibilityOverrides[players[0].id] = ["SG", "SF"];
  assert.deepEqual(
    parseState(s, players).eligibilityOverrides,
    s.eligibilityOverrides,
  );
  const effective = leaguePlayers(players, s.eligibilityOverrides);
  assert.notDeepEqual(
    analyzeDraft(effective, league, emptyDraft(), {}).scarcity,
    analyzeDraft(players, league, emptyDraft(), {}).scarcity,
  );
  const allCenters = leaguePlayers(
    players,
    Object.fromEntries(
      players.slice(0, 160).map((p) => [p.id, ["C"] as Position[]]),
    ),
  );
  assert.notDeepEqual(
    replacementLevels(allCenters, league),
    replacementLevels(players, league),
  );
  assert.deepEqual(leaguePlayers(players, {}), players);
});
test("Eligibility rejects empty and special positions", () => {
  const s = configured();
  assert.throws(() =>
    parseState(
      { ...s, eligibilityOverrides: { [players[0].id]: [] } },
      players,
    ),
  );
  assert.throws(() =>
    parseState(
      { ...s, eligibilityOverrides: { [players[0].id]: ["UTIL"] } },
      players,
    ),
  );
});
test("Draft lock prevents dangerous config while allowing pick undo queue and notes", () => {
  const s = { ...configured(), draftLocked: true };
  assert.ok(
    lockedChange(s, {
      ...s,
      scoringSettings: { ...s.scoringSettings, PTS: 2 },
    }),
  );
  assert.ok(
    lockedChange(s, { ...s, leagueSettings: { ...league, teamCount: 12 } }),
  );
  assert.ok(
    lockedChange(s, {
      ...s,
      leagueSettings: { ...league, roster: { slots: ["PG"] } },
    }),
  );
  const picked = {
    ...s,
    realDraft: recordPick(s.realDraft, league, players[0].id, players),
  };
  assert.ok(!lockedChange(s, picked));
  assert.ok(!lockedChange(picked, s));
  assert.ok(
    !lockedChange(s, { ...s, queues: { ...s.queues, real: [players[0].id] } }),
  );
  assert.ok(
    !lockedChange(s, {
      ...s,
      personal: { [players[0].id]: { note: "still works" } },
    }),
  );
});
for (const n of [0, 1, 2, 3])
  test("IR exposure " + n + " / 2", () => {
    const ps = players.slice(0, n).map((p) => ({ ...p, risk: "HIGH" }));
    const r = riskCapacity(ps, assignRoster(ps, league.roster));
    assert.equal(r.capacity, 2);
    assert.equal(r.occupied, 0);
    assert.equal(r.highRisk, n);
    assert.equal(
      r.exposure,
      ["LOW EXPOSURE", "MODERATE EXPOSURE", "HIGH EXPOSURE", "OVERLOADED"][n],
    );
    assert.equal(r.benchBurden, Math.max(0, n - 2));
  });
test("Starter upgrade compares eligible active production and never promotes bench-only candidate", () => {
  const settings = { slots: ["PG", "C", "BN", "IR"] as SlotType[] };
  const owned = [fixture("guard", ["PG"], 30), fixture("center", ["C"], 40)];
  const good = starterUpgrade(
    fixture("better guard", ["PG"], 34),
    owned,
    settings,
  );
  assert.equal(good.classification, "STARTER UPGRADE");
  assert.equal(good.upgrade, 4);
  assert.equal(good.replaces?.id, "guard");
  const bench = starterUpgrade(fixture("wing", ["SF"], 50), owned, settings);
  assert.equal(bench.classification, "BENCH VALUE");
  assert.equal(bench.slot, "BN");
  assert.equal(bench.upgrade, null);
});
test("Starter optimizer preserves flexibility and withholds unknown comparisons", () => {
  const ps = [
    fixture("flex", ["PG", "SG"], 40),
    fixture("pg", ["PG"], 35),
    fixture("sg", ["SG"], 20),
  ];
  const slots = optimizeActive(ps, { slots: ["PG", "SG"] });
  assert.equal(
    slots.reduce((s, x) => s + (x.player?.projectedFpg ?? 0), 0),
    75,
  );
  const value = starterUpgrade(
    fixture("new", ["PG"], 30),
    [fixture("unknown", ["PG"], null)],
    { slots: ["PG", "BN"] },
  );
  assert.equal(value.upgrade, null);
});
test("Workbook preview detects rank team position projection risk roster changes", () => {
  const fresh = structuredClone(players);
  fresh[0] = {
    ...fresh[0],
    researchRank: 2,
    team: "TEST",
    eligiblePositions: ["PG"],
    projectedFpg: null,
    risk: "HIGH",
    rosterStatus: "CHANGED",
  };
  fresh[1].researchRank = 1;
  const diff = workbookDiff(players, fresh);
  assert.equal(diff.matched, 600);
  assert.equal(diff.changed[0].changes.length, 6);
  assert.ok(diff.canApply);
});
test("Workbook preview identifies new removed duplicate and ambiguous identities", () => {
  const fresh = structuredClone(players);
  fresh[0] = {
    ...fresh[0],
    id: "new-jokic",
    searchName: "nikola jokic jr",
    name: "Nikola Jokic Jr.",
  };
  const diff = workbookDiff(players, fresh);
  assert.equal(diff.newPlayers.length, 1);
  assert.equal(diff.removedPlayers.length, 1);
  assert.equal(diff.possibleMatches.length, 1);
  assert.equal(diff.canApply, false);
  assert.equal(
    workbookDiff(players, [...players.slice(1), players[1]]).canApply,
    false,
  );
});
test("Unmatched personal data and queued IDs survive dataset refresh for review", () => {
  const s = configured();
  s.personal["departed-player"] = {
    note: "Preserve me",
    rank: 120,
    watch: true,
  };
  s.queues.real = ["departed-player"];
  s.eligibilityOverrides["departed-player"] = ["C"];
  const restored = parseState(
    { ...s, dataVersion: "2026-10-09-research" },
    players,
  );
  assert.deepEqual(restored.personal, s.personal);
  assert.deepEqual(restored.queues, s.queues);
  assert.deepEqual(restored.eligibilityOverrides, s.eligibilityOverrides);
});
test("Slot lab covers all ten deterministic valid snake starts without duplicates", () => {
  const a = slotLab(players, defaultLeague());
  assert.deepEqual(a, slotLab(players, defaultLeague()));
  assert.equal(a.length, 10);
  for (const result of a) {
    assert.equal(result.starts.length, 3);
    assert.ok(result.starts.every((x) => x.length === 3));
    for (const sequence of result.sequences) {
      assert.equal(sequence.length, 30);
      assert.equal(new Set(sequence).size, 30);
      let d = emptyDraft();
      const l = { ...league, draftSlot: result.slot };
      const mine: string[] = [];
      for (const id of sequence) {
        if (teamOnClock(d, l)?.id === l.myTeamId) mine.push(id);
        d = recordPick(d, l, id, players);
      }
      assert.equal(mine.length, 3);
    }
  }
});

test("Queue wait risk recalculates approaching the turn", () => {
  const duren = players.find((p) => p.id === "jalen-duren")!;
  const initial = analyzeDraft(players, league, emptyDraft(), {});
  let d = emptyDraft();
  for (const p of players.slice(0, 6)) d = recordPick(d, league, p.id, players);
  const later = analyzeDraft(players, league, d, {});
  const earlyLabel = queueWaitLabel(
    initial.recommendations.find((r) => r.player.id === duren.id),
    initial.distance,
  );
  const laterLabel = queueWaitLabel(
    later.recommendations.find((r) => r.player.id === duren.id),
    later.distance,
  );
  assert.notEqual(earlyLabel, laterLabel);
  assert.match(laterLabel, /TAKE NOW/);
});

test("Workbook preview CLI reads its explicit candidate argument without writing data", () => {
  const r = spawnSync(
    process.execPath,
    [
      "scripts/run-ts.cjs",
      "scripts/preview-players.ts",
      data.metadata.sourceWorkbook,
    ],
    { cwd: process.cwd(), encoding: "utf8", windowsHide: true },
  );
  assert.equal(r.status, 0, r.stderr);
  const report = JSON.parse(r.stdout);
  assert.equal(report.matched, 600);
  assert.equal(report.changed.length, 0);
  assert.equal(report.canApply, true);
});

test("Importer blocks ambiguous identity refresh in an isolated fixture workspace", () => {
  const root = process.cwd();
  const dir = fs.mkdtempSync(path.join(root, ".tmp", "identity-preview-"));
  fs.mkdirSync(path.join(dir, "src/data"), { recursive: true });
  const baseline = JSON.stringify(data);
  fs.writeFileSync(path.join(dir, "src/data/players.generated.json"), baseline);
  const wb = XLSX.read(
    fs.readFileSync(path.join(root, data.metadata.sourceWorkbook)),
    { type: "buffer" },
  );
  const sheet = wb.Sheets["Draft Board"];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
  });
  const header = rows.findIndex(
    (r) => r.includes("Overall") && r.includes("Player"),
  );
  const rank = rows[header].indexOf("Overall"),
    name = rows[header].indexOf("Player");
  const row = rows.findIndex((r) => r[rank] === 300);
  const cell = sheet[XLSX.utils.encode_cell({ r: row, c: name })];
  cell.v = String(cell.v) + " Jr.";
  delete cell.w;
  fs.writeFileSync(
    path.join(dir, "candidate.xlsx"),
    XLSX.write(wb, { type: "buffer", bookType: "xlsx" }),
  );
  const r = spawnSync(
    process.execPath,
    [
      path.join(root, "scripts/run-ts.cjs"),
      path.join(root, "scripts/import-players.ts"),
    ],
    {
      cwd: dir,
      env: { ...process.env, PLAYER_WORKBOOK: "candidate.xlsx" },
      encoding: "utf8",
      windowsHide: true,
    },
  );
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /Refresh identity review required/);
  assert.equal(
    fs.readFileSync(path.join(dir, "src/data/players.generated.json"), "utf8"),
    baseline,
  );
});

test("Lockfile has concrete versions for all packages, including optional platforms", () => {
  const lock = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "package-lock.json"), "utf8"),
  ) as {
    packages: Record<
      string,
      {
        version?: string;
        link?: boolean;
        optionalDependencies?: Record<string, string>;
      }
    >;
  };
  for (const [location, entry] of Object.entries(lock.packages)) {
    if (location && !entry.link)
      assert.match(
        entry.version ?? "",
        /^\d+\.\d+\.\d+(?:[-+].*)?$/,
        `Missing or invalid version: ${location}`,
      );
    for (const dependency of Object.keys(entry.optionalDependencies ?? {})) {
      let parent = location;
      let resolved = false;
      while (true) {
        if (
          lock.packages[
            `${parent ? parent + "/" : ""}node_modules/${dependency}`
          ]?.version
        ) {
          resolved = true;
          break;
        }
        if (!parent) break;
        parent = parent.slice(
          0,
          Math.max(0, parent.lastIndexOf("/node_modules/")),
        );
      }
      assert.ok(
        resolved,
        `Missing optional dependency: ${location} -> ${dependency}`,
      );
    }
  }
});
