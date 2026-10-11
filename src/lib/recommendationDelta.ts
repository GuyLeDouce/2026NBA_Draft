import type { Recommendation } from "../types";
export interface RecommendationDelta {
  id: string;
  movement: number;
  reasons: string[];
}
export function recommendationDeltas(
  before: Recommendation[],
  after: Recommendation[],
  lastPick?: string,
): RecommendationDelta[] {
  return after.slice(0, 5).flatMap((rec) => {
    const prior = before.find((r) => r.player.id === rec.player.id);
    if (!prior) return [];
    const movement = prior.dynamicRank - rec.dynamicRank;
    const changes = rec.breakdown
      .map((f) => ({
        label: f.label,
        difference:
          f.value -
          (prior.breakdown.find((x) => x.label === f.label)?.value ?? 0),
      }))
      .filter((f) => Math.abs(f.difference) >= 0.1)
      .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));
    if (Math.abs(movement) < 2 && changes.length === 0) return [];
    return [
      {
        id: rec.player.id,
        movement,
        reasons: [
          ...(lastPick ? [lastPick + " was drafted."] : []),
          ...changes
            .slice(0, 3)
            .map(
              (f) =>
                f.label +
                " " +
                (f.difference > 0 ? "increased" : "decreased") +
                " by " +
                Math.abs(f.difference).toFixed(1) +
                " score points.",
            ),
          ...(changes.length
            ? []
            : ["Higher-ranked options left the available pool."]),
        ],
      },
    ];
  });
}
