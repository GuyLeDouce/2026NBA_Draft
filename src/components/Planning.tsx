"use client";
import type { Recommendation, Player } from "../types";
import type { TwoPickPath, SlotScenarioResult } from "../lib/planner";
import type { RecommendationDelta } from "../lib/recommendationDelta";
export function ScoreBreakdown({ rec }: { rec: Recommendation }) {
  return (
    <details className="score-breakdown">
      <summary>Recommendation breakdown · {rec.score.toFixed(1)}</summary>
      <p className="muted">
        Actual engine contributions. Context is capped to protect research
        value. Scores are ordering units, not grades.
      </p>
      <dl>
        {rec.breakdown
          .filter((f) => f.value !== 0)
          .map((f) => (
            <div key={f.label}>
              <dt>{f.label}</dt>
              <dd>
                {f.value > 0 ? "+" : ""}
                {f.value.toFixed(3).replace(/\.?0+$/, "")}
              </dd>
            </div>
          ))}
        <div className="score-total">
          <dt>TOTAL</dt>
          <dd>{rec.score.toFixed(3).replace(/\.?0+$/, "")}</dd>
        </div>
      </dl>
    </details>
  );
}
export function TwoPickPlans({
  paths,
  onInspect,
}: {
  paths: TwoPickPath[];
  onInspect: (id: string) => void;
}) {
  if (!paths.length)
    return (
      <section className="panel two-pick">
        <h3>TWO-PICK PLANNER</h3>
        <p>
          Set your draft position to model your next two turns. Plans stop when
          fewer than two selections remain.
        </p>
      </section>
    );
  return (
    <section className="panel advanced-plans">
      <span className="eyebrow">
        BEST TWO-PICK PLAN · #{paths[0].first} → #{paths[0].next}
      </span>
      <h3>Prepare the next move</h3>
      <p className="muted">
        Four controlled scenarios. Off-clock paths assume baseline selections
        before your first turn; availability is conditional.
      </p>
      <div className="path-grid">
        {paths.map((plan, i) => (
          <article
            className={i === 0 ? "path-card preferred" : "path-card"}
            key={plan.take.id}
          >
            <span className="eyebrow">
              PATH {String.fromCharCode(65 + i)}
              {i === 0 ? " · ENGINE FAVORED" : ""}
            </span>
            <small>TAKE NOW · #{plan.first}</small>
            <button onClick={() => onInspect(plan.take.id)}>
              {plan.take.name}
            </button>
            <small>TARGET NEXT · #{plan.next}</small>
            <button onClick={() => onInspect(plan.target.id)}>
              {plan.target.name}
            </button>
            <dl>
              <div>
                <dt>Combined FP/G</dt>
                <dd>~{plan.combined?.toFixed(0) ?? "—"}</dd>
              </div>
              <div>
                <dt>Position coverage</dt>
                <dd>{plan.coverage} base positions</dd>
              </div>
              <div>
                <dt>High-risk picks</dt>
                <dd>{plan.risk}</dd>
              </div>
              <div>
                <dt>Target survives</dt>
                <dd>{plan.survivesIn.length}/4 scenarios</dd>
              </div>
              <div>
                <dt>Wait risk</dt>
                <dd>
                  {plan.survivesIn.length === 4
                    ? "Lower"
                    : plan.survivesIn.length >= 2
                      ? "Moderate"
                      : "High"}
                </dd>
              </div>
            </dl>
            <p>
              Fallbacks:{" "}
              {plan.fallbacks.map((p) => p.name).join(" / ") ||
                "Reassess at next turn"}
            </p>
            <details>
              <summary>Why this path</summary>
              {plan.reasons.map((r) => (
                <p key={r}>{r}</p>
              ))}
              <p>Target remains in: {plan.survivesIn.join(", ")}</p>
            </details>
          </article>
        ))}
      </div>
    </section>
  );
}
export function WhyChanged({
  deltas,
  players,
}: {
  deltas: RecommendationDelta[];
  players: Player[];
}) {
  if (!deltas.length) return null;
  return (
    <details className="panel why-changed">
      <summary>WHY THIS CHANGED · since the last recorded pick</summary>
      {deltas.map((d) => (
        <div key={d.id}>
          <b>
            {players.find((p) => p.id === d.id)?.name}{" "}
            {Math.abs(d.movement) >= 2
              ? (d.movement > 0 ? "↑" : "↓") + Math.abs(d.movement)
              : ""}
          </b>
          {d.reasons.map((r) => (
            <p key={r}>{r}</p>
          ))}
        </div>
      ))}
    </details>
  );
}
export function SlotLabResults({
  results,
  known,
}: {
  results: SlotScenarioResult[];
  known: number | null;
}) {
  return (
    <div className="slot-lab">
      <p>
        Three deterministic scenarios per seat; research-driven selections with
        modest needs / center-run variation. These are possible starts, not
        guaranteed availability. Lower average research rank means stronger
        ranked players.
      </p>
      {known && (
        <p className="notice">
          Your seat is #{known}. Use exact-seat Mock Draft for rehearsal;
          all-seat comparisons remain secondary.
        </p>
      )}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {[
                "Slot",
                "Avg research rank",
                "Top-3 FP/G",
                "High-risk picks",
                "Position pressure",
              ].map((x) => (
                <th key={x}>{x}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.slot}>
                <td>
                  #{r.slot}
                  {r.slot === known ? " · YOUR SEAT" : ""}
                </td>
                <td>{r.averageRank.toFixed(0)}</td>
                <td>~{r.projection?.toFixed(0) ?? "—"}</td>
                <td>{r.highRisk}</td>
                <td>{r.pressure}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {results.map((r) => (
        <details key={r.slot}>
          <summary>SLOT {r.slot} · possible two / three-player starts</summary>
          <p>Round 1: {r.round1.map((p) => p.name).join(" / ")}</p>
          <p>Round 2: {r.round2.map((p) => p.name).join(" / ")}</p>
          {r.starts.map((ps, i) => (
            <p key={i}>
              <b>{["Baseline", "Center run", "Needs heavy"][i]}</b>:{" "}
              {ps.map((p) => p.name).join(" → ")}
            </p>
          ))}
        </details>
      ))}
    </div>
  );
}
