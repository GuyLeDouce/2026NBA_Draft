import type {
  Player,
  LeagueSettings,
  DraftState,
  PersonalPlayer,
  Position,
} from "../types";
import { analyzeDraft, fantasyRelevant, tierNumber } from "./recommendations";
import { assignRoster, rosterNeeds, teamPlayers } from "./roster";
import { recordPick, teamOnClock, totalPicks, emptyDraft } from "./draft";
import { PLANNER_WEIGHTS as W } from "./recommendationWeights";
export const SCENARIOS = [
  "BASELINE",
  "POSITION RUN",
  "BEST AVAILABLE",
  "NEEDS HEAVY",
] as const;
export type TwoPickScenario = (typeof SCENARIOS)[number];
export interface TwoPickPath {
  take: Player;
  target: Player;
  fallbacks: Player[];
  first: number;
  next: number;
  combined: number | null;
  coverage: number;
  risk: number;
  survivesIn: string[];
  scenarioPicks: Record<string, string[]>;
  score: number;
  reasons: string[];
}
function noise(id: string, seed: number) {
  let x = seed;
  for (const c of id) x = (x * 31 + c.charCodeAt(0)) >>> 0;
  return (x % 101) / 100;
}
export function scenarioChoice(
  players: Player[],
  league: LeagueSettings,
  draft: DraftState,
  scenario: TwoPickScenario,
  runPosition: Position = "C",
  seed = 0,
) {
  const clock = teamOnClock(draft, league);
  if (!clock) return null;
  const owned = teamPlayers(draft, clock.id, players),
    roster = assignRoster(owned, league.roster, draft.slotOverrides),
    needs = rosterNeeds(roster);
  const taken = new Set(draft.picks.map((p) => p.playerId));
  const pool = players
    .filter((p) => !taken.has(p.id) && fantasyRelevant(p))
    .sort((a, b) => a.researchRank - b.researchRank);
  const ranked = pool
    .map((p) => ({
      p,
      score:
        -p.researchRank +
        (scenario !== "BEST AVAILABLE" &&
        p.eligiblePositions.some((pos) => needs.includes(pos))
          ? W.need * (scenario === "NEEDS HEAVY" ? 2 : 1)
          : 0) +
        (scenario === "POSITION RUN" &&
        p.eligiblePositions.includes(runPosition)
          ? W.run
          : 0) +
        W.tier / tierNumber(p) +
        noise(p.id, seed) * W.variation,
    }))
    .sort((a, b) => b.score - a.score);
  for (const { p } of ranked)
    if (
      assignRoster([...owned, p], league.roster, draft.slotOverrides).filter(
        (s) => s.player,
      ).length ===
      owned.length + 1
    )
      return p;
  return null;
}
export function simulateUntil(
  players: Player[],
  league: LeagueSettings,
  draft: DraftState,
  until: number,
  scenario: TwoPickScenario,
  runPosition: Position = "C",
  seed = 0,
) {
  let result = draft;
  while (
    result.picks.length + 1 < until &&
    result.picks.length < totalPicks(league)
  ) {
    const p = scenarioChoice(
      players,
      league,
      result,
      scenario,
      runPosition,
      seed,
    );
    if (!p) break;
    result = recordPick(result, league, p.id, players);
  }
  return result;
}
export function advancedTwoPickPlan(
  players: Player[],
  league: LeagueSettings,
  draft: DraftState,
  personal: Record<string, PersonalPlayer>,
  initial?: ReturnType<typeof analyzeDraft>,
): TwoPickPath[] {
  const start = initial ?? analyzeDraft(players, league, draft, personal);
  if (
    start.next === null ||
    start.following === null ||
    start.following - start.next > W.horizon
  )
    return [];
  const first = start.next,
    next = start.following;
  const runPosition = [...start.scarcity].sort(
    (a, b) => a.remaining - a.demand - (b.remaining - b.demand),
  )[0].position;
  const pre = simulateUntil(
    players,
    league,
    draft,
    first,
    "BASELINE",
    runPosition,
  );
  if (pre.picks.length + 1 !== first) return [];
  const atTurn =
    pre === draft ? start : analyzeDraft(players, league, pre, personal);
  const options = atTurn.recommendations.slice(0, W.candidates);
  const paths: TwoPickPath[] = [];
  for (const take of options) {
    const after = recordPick(pre, league, take.player.id, players);
    const results = SCENARIOS.map((scenario) => {
      const result = simulateUntil(
        players,
        league,
        after,
        next,
        scenario,
        runPosition,
      );
      const taken = new Set(result.picks.map((p) => p.playerId));
      const owned = teamPlayers(result, league.myTeamId, players);
      const needs = rosterNeeds(
        assignRoster(owned, league.roster, result.slotOverrides),
      );
      const recs = atTurn.recommendations
        .filter((r) => !taken.has(r.player.id))
        .slice(0, 30)
        .filter(
          (r) =>
            assignRoster(
              [...owned, r.player],
              league.roster,
              result.slotOverrides,
            ).filter((s) => s.player).length ===
            owned.length + 1,
        )
        .map((r) => ({
          ...r,
          score:
            r.score +
            (r.player.eligiblePositions.some((p) => needs.includes(p))
              ? W.need
              : 0),
        }))
        .sort((a, b) => b.score - a.score);
      return { scenario, result, recs };
    });
    const targetPool = [
      ...new Set(
        results.flatMap((x) => x.recs.slice(0, 5).map((r) => r.player.id)),
      ),
    ];
    const targets = targetPool
      .map((id) => {
        const available = results.filter((x) =>
          x.recs.some((r) => r.player.id === id),
        );
        const rec = available[0].recs.find((r) => r.player.id === id)!;
        return {
          rec,
          available,
          score:
            available.reduce(
              (sum, x) => sum + x.recs.find((r) => r.player.id === id)!.score,
              0,
            ) / results.length,
        };
      })
      .sort((a, b) => b.score - a.score);
    const target = targets[0];
    if (!target) continue;
    const pair = [take.player, target.rec.player];
    const coverage = new Set(pair.flatMap((p) => p.eligiblePositions)).size;
    const scarcity = start.scarcity
      .filter((x) => take.player.eligiblePositions.includes(x.position))
      .sort((a, b) => a.remaining - b.remaining)[0];
    paths.push({
      take: take.player,
      target: target.rec.player,
      fallbacks: targets.slice(1, 3).map((x) => x.rec.player),
      first,
      next,
      combined: pair.every((p) => p.projectedFpg !== null)
        ? pair.reduce((s, p) => s + p.projectedFpg!, 0)
        : null,
      coverage,
      risk: pair.filter((p) => p.risk === "HIGH").length,
      survivesIn: target.available.map((x) => x.scenario),
      scenarioPicks: Object.fromEntries(
        results.map((x) => [
          x.scenario,
          x.result.picks.slice(after.picks.length).map((p) => p.playerId),
        ]),
      ),
      score: take.score + target.score,
      reasons: [
        take.player.name +
          ": " +
          take.survival.toLowerCase() +
          " to the next turn.",
        scarcity.position +
          ": " +
          scarcity.remaining +
          " draft-relevant options; " +
          scarcity.demand +
          " opponents need the position.",
        target.rec.player.name +
          " remains in " +
          target.available.length +
          " of 4 controlled scenarios. Scenario counts are not probabilities.",
        "Pair covers " +
          coverage +
          " base positions; " +
          pair.filter((p) => p.eligiblePositions.length > 1).length +
          " multi-position players.",
      ],
    });
  }
  return paths.sort((a, b) => b.score - a.score).slice(0, W.paths);
}
export interface SlotScenarioResult {
  slot: number;
  starts: Player[][];
  round1: Player[];
  round2: Player[];
  averageRank: number;
  projection: number | null;
  highRisk: number;
  pressure: string;
  sequences: string[][];
}
export function slotLab(
  players: Player[],
  base: LeagueSettings,
): SlotScenarioResult[] {
  return Array.from({ length: base.teamCount }, (_, index) => {
    const slot = index + 1,
      league = { ...base, draftSlot: slot };
    const sequences: string[][] = [],
      starts: Player[][] = [];
    for (const scenario of [
      "BASELINE",
      "POSITION RUN",
      "NEEDS HEAVY",
    ] as const) {
      let draft = emptyDraft();
      const start: Player[] = [];
      while (
        draft.picks.length < Math.min(totalPicks(league), base.teamCount * 3)
      ) {
        const p = scenarioChoice(
          players,
          league,
          draft,
          scenario,
          scenario === "POSITION RUN" ? "C" : "PG",
          slot,
        );
        if (!p) break;
        if (teamOnClock(draft, league)?.id === league.myTeamId) start.push(p);
        draft = recordPick(draft, league, p.id, players);
      }
      starts.push(start);
      sequences.push(draft.picks.map((p) => p.playerId));
    }
    const all = starts.flat();
    const unique = (round: number) => [
      ...new Map(
        starts.filter((s) => s[round]).map((s) => [s[round].id, s[round]]),
      ).values(),
    ];
    return {
      slot,
      starts,
      round1: unique(0),
      round2: unique(1),
      averageRank:
        all.reduce((s, p) => s + p.researchRank, 0) / Math.max(1, all.length),
      projection: all.every((p) => p.projectedFpg !== null)
        ? starts.reduce(
            (s, ps) => s + ps.reduce((n, p) => n + p.projectedFpg!, 0),
            0,
          ) / starts.length
        : null,
      highRisk: Math.max(
        ...starts.map((ps) => ps.filter((p) => p.risk === "HIGH").length),
      ),
      pressure: starts.some(
        (ps) => !ps.some((p) => p.eligiblePositions.includes("C")),
      )
        ? "Monitor center depth"
        : "Centers covered in each path",
      sequences,
    };
  });
}
