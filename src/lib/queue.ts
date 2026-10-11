import type { DraftState, Recommendation } from "../types";
export const QUEUE_LIMIT = 15;
export function addQueue(queue: string[], id: string) {
  if (queue.includes(id)) return queue;
  if (queue.length >= QUEUE_LIMIT)
    throw Error("Queue holds up to 15 players. Remove one first.");
  return [...queue, id];
}
export function reorderQueue(queue: string[], id: string, index: number) {
  if (!queue.includes(id)) return queue;
  const result = queue.filter((x) => x !== id);
  result.splice(Math.max(0, Math.min(result.length, index)), 0, id);
  return result;
}
export function queueView(
  queue: string[],
  draft: DraftState,
  recs: Recommendation[],
) {
  return queue.map((id) => ({
    id,
    taken: draft.picks.some((p) => p.playerId === id),
    recommendation: recs.find((r) => r.player.id === id),
  }));
}
export function contingencyLadder(
  queue: string[],
  draft: DraftState,
  recs: Recommendation[],
) {
  const taken = new Set(draft.picks.map((p) => p.playerId));
  return [
    ...new Set([
      ...queue.filter((id) => !taken.has(id)),
      ...recs.map((r) => r.player.id),
    ]),
  ].slice(0, 5);
}
export function queueWaitLabel(rec?: Recommendation, distance?: number | null) {
  if (distance == null || !rec) return "WAIT RISK UNKNOWN";
  return rec.survival === "UNLIKELY TO SURVIVE"
    ? "TAKE NOW · RISKY TO WAIT"
    : rec.survival === "TOSS-UP"
      ? "COULD GO EITHER WAY"
      : "LIKELY TO SURVIVE";
}
