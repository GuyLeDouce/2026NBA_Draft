import type { Player, LeagueSettings, MockDraftState } from "../types";
import { recordPick, teamOnClock, totalPicks } from "./draft";
import { analyzeDraft } from "./recommendations";
export function mockLeague(
  league: LeagueSettings,
  mock: MockDraftState,
): LeagueSettings {
  return { ...league, draftSlot: mock.slot };
}
function noise(id: string, seed: number, pick: number) {
  let h = (seed + pick * 101) >>> 0;
  for (const c of id) h = (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0;
  return (h % 1000) / 1000;
}
export function simulateToMyPick(
  players: Player[],
  league: LeagueSettings,
  mock: MockDraftState,
): MockDraftState {
  const settings = mockLeague(league, mock);
  let current = { ...mock, picks: [...mock.picks] };
  while (current.picks.length < totalPicks(settings)) {
    const team = teamOnClock(current, settings);
    if (!team || team.id === settings.myTeamId) break;
    let analysis = analyzeDraft(
      players,
      { ...settings, myTeamId: team.id, draftSlot: null },
      current,
      {},
      false,
    );
    if (!analysis.recommendations.length)
      analysis = analyzeDraft(
        players,
        { ...settings, myTeamId: team.id, draftSlot: null },
        current,
        {},
        true,
      );
    const candidates = analysis.recommendations.slice(
      0,
      mock.style === "CHAOTIC" ? 15 : 8,
    );
    const chosen = candidates
      .map((r) => {
        const guard = r.player.eligiblePositions.some(
          (p) => p === "PG" || p === "SG",
        );
        const big = r.player.eligiblePositions.some(
          (p) => p === "PF" || p === "C",
        );
        return {
          r,
          score:
            r.score +
            (mock.style === "GUARD HEAVY" && guard
              ? 5
              : mock.style === "BIG HEAVY" && big
                ? 5
                : 0) +
            noise(r.player.id, mock.seed, current.picks.length) *
              (mock.style === "CHAOTIC" ? 18 : 3),
        };
      })
      .sort((a, b) => b.score - a.score)[0];
    if (!chosen) throw Error("No eligible mock candidates remain");
    current = {
      ...current,
      ...recordPick(current, settings, chosen.r.player.id, players),
    };
  }
  return current;
}
