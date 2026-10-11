import type { Player, Position } from "../types";
export function leaguePlayers(
  players: Player[],
  overrides: Record<string, Position[]>,
) {
  return players.map((p) =>
    overrides[p.id] ? { ...p, eligiblePositions: [...overrides[p.id]] } : p,
  );
}
