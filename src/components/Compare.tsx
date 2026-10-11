import type {
  Player,
  Recommendation,
  PersonalPlayer,
  PositionScarcity,
} from "../types";
import { Modal } from "./Modal";
export function Compare({
  players,
  recommendations,
  personal,
  scarcity,
  onClose,
  onRemove,
}: {
  players: Player[];
  recommendations: Recommendation[];
  personal: Record<string, PersonalPlayer>;
  scarcity: PositionScarcity[];
  onClose: () => void;
  onRemove: (id: string) => void;
}) {
  const recs = players.map((p) =>
    recommendations.find((r) => r.player.id === p.id),
  );
  const favored = recs
    .filter((r): r is Recommendation => Boolean(r))
    .sort((a, b) => b.score - a.score)[0];
  return (
    <Modal title="SIDE BY SIDE" wide onClose={onClose}>
      <p>
        Compare production, availability, and fit.{" "}
        {favored
          ? "Current draft conditions favor " + favored.player.name + "."
          : "Add available players to see the engine’s preference."}
      </p>
      <div className="comparison-scroll">
        <table>
          <thead>
            <tr>
              <th>Scouting lens</th>
              {players.map((p) => (
                <th key={p.id}>
                  {p.name}
                  <button
                    className="text-button"
                    onClick={() => onRemove(p.id)}
                  >
                    Remove
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              "Research rank",
              "Personal rank",
              "Dynamic rank",
              "Projection FP/G",
              "Range",
              "Planning GP",
              "VOR",
              "Tier",
              "Risk",
              "Flexibility",
              "Scarcity",
              "Roster fit",
              "Confidence",
              "Rationale",
            ].map((label, i) => (
              <tr key={label}>
                <th>{label}</th>
                {players.map((p, j) => {
                  const r = recs[j];
                  const values = [
                    p.researchRank,
                    personal[p.id]?.rank ?? "—",
                    r?.dynamicRank ?? "—",
                    p.projectedFpg?.toFixed(1) ?? "—",
                    (p.projectedLow?.toFixed(1) ?? "—") +
                      " – " +
                      (p.projectedHigh?.toFixed(1) ?? "—"),
                    p.planningGames ?? "—",
                    r?.vor?.toFixed(1) ?? "—",
                    r?.tier ?? p.poolTier,
                    p.risk,
                    p.eligiblePositions.join(" / "),
                    scarcity
                      .filter((s) => p.eligiblePositions.includes(s.position))
                      .map((s) => s.position + ": " + s.remaining)
                      .join(", "),
                    r?.fit ?? "Drafted / outside active pool",
                    p.dataConfidence,
                    p.draftRationale,
                  ];
                  return <td key={p.id}>{values[i]}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted">
        Production upside trades off against availability and roster coverage.
        Dynamic rank describes this draft context; it does not replace your
        research order.
      </p>
    </Modal>
  );
}
