import {
  POSITIONS,
  type Player,
  type SlotType,
  type RosterSettings,
  type RosterSlot,
  type DraftState,
  type Position,
} from "../types";
export const DEFAULT_SLOTS: SlotType[] = [
  "PG",
  "SG",
  "SF",
  "PF",
  "C",
  "G",
  "F",
  "UTIL",
  "UTIL",
  "UTIL",
  "UTIL",
  "BN",
  "BN",
  "BN",
  "BN",
  "IR",
  "IR",
];
export function eligible(player: Player, slot: SlotType) {
  return (
    slot === "BN" ||
    slot === "IR" ||
    slot === "UTIL" ||
    (slot === "G"
      ? player.eligiblePositions.some((p) => p === "PG" || p === "SG")
      : slot === "F"
        ? player.eligiblePositions.some((p) => p === "SF" || p === "PF")
        : player.eligiblePositions.includes(slot))
  );
}
export function assignRoster(
  players: Player[],
  settings: RosterSettings,
  overrides: Record<string, string> = {},
): RosterSlot[] {
  const slots: RosterSlot[] = settings.slots.map((type, i) => ({
    id: type + "-" + i,
    type,
    player: null,
  }));
  const pinned = new Set<string>();
  for (const player of players) {
    const slot = slots.find((s) => s.id === overrides[player.id]);
    if (slot && !slot.player && eligible(player, slot.type)) {
      slot.player = player;
      pinned.add(player.id);
    }
  }
  const priority = (s: RosterSlot) =>
    POSITIONS.includes(s.type as Position)
      ? 0
      : s.type === "G" || s.type === "F"
        ? 1
        : s.type === "UTIL"
          ? 2
          : 3;
  const order = [...slots]
    .filter((s) => s.type !== "IR")
    .sort((a, b) => priority(a) - priority(b));
  const assigned = new Map<string, RosterSlot>();
  for (const slot of slots) if (slot.player) assigned.set(slot.player.id, slot);
  const candidates = [...players].sort(
    (a, b) =>
      a.researchRank - b.researchRank ||
      a.eligiblePositions.length - b.eligiblePositions.length,
  );
  function fill(slot: RosterSlot, visited: Set<string>): boolean {
    const free = candidates.find(
      (p) =>
        !pinned.has(p.id) &&
        !visited.has(p.id) &&
        !assigned.has(p.id) &&
        eligible(p, slot.type),
    );
    if (free) {
      slot.player = free;
      assigned.set(free.id, slot);
      return true;
    }
    for (const player of candidates) {
      if (
        pinned.has(player.id) ||
        visited.has(player.id) ||
        !eligible(player, slot.type)
      )
        continue;
      visited.add(player.id);
      const prior = assigned.get(player.id);
      if (!prior || fill(prior, visited)) {
        slot.player = player;
        assigned.set(player.id, slot);
        return true;
      }
    }
    return false;
  }
  for (const slot of order) if (!slot.player) fill(slot, new Set());
  return slots;
}
export function teamPlayers(
  draft: DraftState,
  teamId: string,
  players: Player[],
) {
  const map = new Map(players.map((p) => [p.id, p]));
  return draft.picks
    .filter((p) => p.teamId === teamId)
    .map((p) => map.get(p.playerId)!)
    .filter(Boolean);
}
export function rosterNeeds(slots: RosterSlot[]): Position[] {
  return POSITIONS.filter((pos) =>
    slots.some(
      (s) =>
        !s.player &&
        (s.type === pos ||
          (s.type === "G" && (pos === "PG" || pos === "SG")) ||
          (s.type === "F" && (pos === "SF" || pos === "PF"))),
    ),
  );
}
export function movePlayer(
  draft: DraftState,
  players: Player[],
  settings: RosterSettings,
  playerId: string,
  slotId: string,
) {
  const roster = assignRoster(players, settings, draft.slotOverrides);
  const target = roster.find((s) => s.id === slotId);
  const origin = roster.find((s) => s.player?.id === playerId);
  const player = players.find((p) => p.id === playerId);
  if (!target || !origin || !player || !eligible(player, target.type))
    throw Error("Player is not eligible for that slot");
  const overrides = { ...draft.slotOverrides, [playerId]: slotId };
  if (target.player) {
    if (!eligible(target.player, origin.type))
      throw Error("These players cannot swap slots");
    overrides[target.player.id] = origin.id;
  }
  return { ...draft, slotOverrides: overrides };
}
export function rosterQuality(players: Player[], slots: RosterSlot[]) {
  const projected = players.filter((p) => p.projectedFpg !== null);
  const average = projected.length
    ? projected.reduce((s, p) => s + p.projectedFpg!, 0) / projected.length
    : null;
  const highRisk = players.filter((p) => p.risk === "HIGH").length;
  const covered = POSITIONS.filter((pos) =>
    slots.some((s) => s.type === pos && s.player),
  ).length;
  const flexible = players.filter((p) => p.eligiblePositions.length > 1).length;
  return {
    average,
    seasonPoints: projected.reduce(
      (s, p) => s + (p.planningSeasonPoints ?? 0),
      0,
    ),
    known: projected.length,
    total: players.length,
    highRisk,
    covered,
    flexible,
    stash: players.filter(
      (p) => p.planningGames !== null && p.planningGames < 45,
    ).length,
    upside: players.filter(
      (p) =>
        p.projectedHigh !== null &&
        p.projectedFpg !== null &&
        p.projectedHigh - p.projectedFpg >= 5,
    ).length,
    production:
      average === null
        ? "No picks"
        : average >= 40
          ? "Excellent"
          : average >= 30
            ? "Strong"
            : average >= 22
              ? "Developing"
              : "Depth roster",
    coverage: covered === 5 ? "Complete" : covered >= 3 ? "Good" : "Building",
    availability:
      highRisk >= 3 ? "Elevated" : highRisk >= 1 ? "Moderate" : "Low",
  };
}
