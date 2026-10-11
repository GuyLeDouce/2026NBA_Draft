import { assignRoster, teamPlayers } from "./roster";
import type { DraftState, LeagueSettings, Player } from "../types";
export const emptyDraft = (): DraftState => ({ picks: [], slotOverrides: {} });
export function snakePick(overall: number, teamCount: number) {
  if (
    !Number.isInteger(overall) ||
    overall < 1 ||
    !Number.isInteger(teamCount) ||
    teamCount < 2
  )
    throw Error("Invalid draft coordinates");
  const round = Math.floor((overall - 1) / teamCount) + 1;
  const pick = ((overall - 1) % teamCount) + 1;
  return {
    overall,
    round,
    pick,
    slot: round % 2 ? pick : teamCount + 1 - pick,
  };
}
export function orderedTeams(league: LeagueSettings) {
  if (league.draftSlot === null) return league.teams;
  const rest = league.teams.filter((t) => t.id !== league.myTeamId);
  rest.splice(
    league.draftSlot - 1,
    0,
    league.teams.find((t) => t.id === league.myTeamId)!,
  );
  return rest;
}
export function rounds(league: LeagueSettings) {
  return league.roster.slots.filter((s) => s !== "IR").length;
}
export function totalPicks(league: LeagueSettings) {
  return league.teamCount * rounds(league);
}
export function nextPick(
  current: number,
  slot: number | null,
  count: number,
  max = Infinity,
) {
  if (slot === null) return null;
  for (let n = current; n <= Math.min(current + count * 2, max); n++)
    if (snakePick(n, count).slot === slot) return n;
  return null;
}
export function teamOnClock(draft: DraftState, league: LeagueSettings) {
  if (draft.picks.length >= totalPicks(league) || league.draftSlot === null)
    return null;
  return orderedTeams(league)[
    snakePick(draft.picks.length + 1, league.teamCount).slot - 1
  ];
}
export function recordPick(
  draft: DraftState,
  league: LeagueSettings,
  playerId: string,
  players: Player[],
): DraftState {
  if (!players.some((p) => p.id === playerId)) throw Error("Unknown player");
  if (draft.picks.some((p) => p.playerId === playerId))
    throw Error("Player already drafted");
  const team = teamOnClock(draft, league);
  if (!team)
    throw Error(
      league.draftSlot === null
        ? "Set your draft position before recording picks."
        : "Draft complete",
    );
  const rosterPlayers = [
    ...teamPlayers(draft, team.id, players),
    players.find((p) => p.id === playerId)!,
  ];
  if (
    assignRoster(rosterPlayers, league.roster, draft.slotOverrides).filter(
      (s) => s.player,
    ).length !== rosterPlayers.length
  )
    throw Error(
      "This team has no eligible roster slot for this player. Rearrange its roster or choose another player.",
    );
  return {
    ...draft,
    picks: [
      ...draft.picks,
      { overall: draft.picks.length + 1, playerId, teamId: team.id },
    ],
  };
}
export function undoPick(draft: DraftState): DraftState {
  const removed = draft.picks.at(-1);
  const overrides = { ...draft.slotOverrides };
  if (removed) delete overrides[removed.playerId];
  return {
    ...draft,
    picks: draft.picks.slice(0, -1),
    slotOverrides: overrides,
  };
}
export function correctPick(
  draft: DraftState,
  overall: number,
  playerId: string,
  players: Player[],
  league?: LeagueSettings,
): DraftState {
  const old = draft.picks.find((p) => p.overall === overall);
  if (!old || !players.some((p) => p.id === playerId))
    throw Error("Invalid correction");
  if (draft.picks.some((p) => p.playerId === playerId && p.overall !== overall))
    throw Error("Replacement is already drafted");
  const overrides = { ...draft.slotOverrides };
  delete overrides[old.playerId];
  const corrected = {
    ...draft,
    picks: draft.picks.map((p) =>
      p.overall === overall ? { ...p, playerId } : p,
    ),
    slotOverrides: overrides,
  };
  if (league) {
    const ps = teamPlayers(corrected, old.teamId, players);
    if (
      assignRoster(ps, league.roster, overrides).filter((s) => s.player)
        .length !== ps.length
    )
      throw Error(
        "Replacement cannot fit this roster. Rearrange manual slots first.",
      );
  }
  return corrected;
}
