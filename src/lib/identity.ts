import { POSITIONS, type Position } from "../types";
export function normalizeName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
export function playerId(name: string) {
  return normalizeName(name).replace(/\s+/g, "-");
}
export function normalizePositions(
  tags: string | null,
  primary: Position,
): Position[] {
  const explicit = (tags ?? "")
    .toUpperCase()
    .split(/[^A-Z]+/)
    .filter((p): p is Position => POSITIONS.includes(p as Position));
  return POSITIONS.filter((p) => p === primary || explicit.includes(p));
}
