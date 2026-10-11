import type { RiskCapacity, StarterUpgrade } from "../lib/lineupIntelligence";
export function RiskPanel({
  risk,
  candidateHigh = false,
}: {
  risk: RiskCapacity;
  candidateHigh?: boolean;
}) {
  return (
    <section className="panel risk-capacity">
      <div className="panel-heading">
        <h3>AVAILABILITY CAPACITY</h3>
        <b>
          IR {risk.occupied} / {risk.capacity}
        </b>
      </div>
      <strong>{risk.exposure}</strong>
      <p>
        {risk.highRisk} high-risk players · {risk.stash} limited-games stashes
      </p>
      {candidateHigh && (
        <p className={risk.highRisk + 1 > risk.capacity ? "notice" : "muted"}>
          This pick would make {risk.highRisk + 1} high-risk players against{" "}
          {risk.capacity} IR slots.
          {risk.highRisk + 1 > risk.capacity
            ? " Availability issues may consume bench capacity."
            : " Your roster has room to absorb some risk."}
        </p>
      )}
      <small>
        High risk does not establish platform IR eligibility. IR occupancy
        reflects your manual lineup placement.
      </small>
    </section>
  );
}
export function StarterValue({ value }: { value: StarterUpgrade }) {
  return (
    <div className="starter-value">
      <span className="eyebrow">{value.classification}</span>
      <p>
        Best planning slot: <b>{value.slot === "BN" ? "BENCH" : value.slot}</b>
        {value.upgrade !== null && (
          <>
            {" "}
            · Starter upgrade <b>+{value.upgrade.toFixed(1)} FP/G</b>
          </>
        )}
      </p>
      {value.replaces && value.upgrade !== null && (
        <small>
          Displaces {value.replaces.name} (
          {value.replaces.projectedFpg?.toFixed(1)} FP/G) through eligible
          lineup reassignment.
        </small>
      )}
      {value.unknown > 0 && (
        <small>
          {value.unknown} current players lack projections; numeric upgrade
          withheld.
        </small>
      )}
      <small>
        Projection-optimized planning lineup; actual slots remain under your
        control.
      </small>
    </div>
  );
}
