"use client";
import type {
  Player,
  PersonalPlayer,
  Recommendation,
  TargetType,
  Position,
} from "../types";
import type { StarterUpgrade } from "../lib/lineupIntelligence";
import { StarterValue } from "./LineupIntelligence";
import { POSITIONS } from "../types";
import { ScoreBreakdown } from "./Planning";
import { Modal } from "./Modal";
import { Star, ArrowRight, GitCompareArrows } from "lucide-react";
const number = (value: number | null | undefined) =>
  value == null ? "—" : value.toFixed(1);
export function PlayerDetail({
  player,
  personal,
  recommendation,
  taken,
  onClose,
  onChange,
  onPick,
  onCompare,
  workbookPlayer,
  onEligibility,
  starterValue,
  queued,
  onQueue,
}: {
  player: Player;
  personal: PersonalPlayer;
  recommendation?: Recommendation;
  taken: string | null;
  onClose: () => void;
  onChange: (patch: Partial<PersonalPlayer>) => void;
  onPick: () => void;
  onCompare: () => void;
  starterValue: StarterUpgrade;
  workbookPlayer: Player;
  onEligibility: (positions: Position[] | null) => void;
  queued: boolean;
  onQueue: () => void;
}) {
  const links = [
    ...new Set(
      [player.contextSource, player.rosterSource, player.historySource]
        .flatMap((s) => (s ?? "").split(" | "))
        .filter((url) => {
          try {
            return ["http:", "https:"].includes(new URL(url).protocol);
          } catch {
            return false;
          }
        }),
    ),
  ];
  return (
    <Modal title="PLAYER DOSSIER" onClose={onClose} wide drawer>
      <div className="detail-hero">
        <span className="eyebrow">
          {player.team ?? "FREE AGENT"} · {player.eligiblePositions.join(" / ")}
        </span>
        <h2>{player.name}</h2>
        <div className="detail-tags">
          <span className="badge">RESEARCH #{player.researchRank}</span>
          {personal.rank && (
            <span className="badge">PERSONAL #{personal.rank}</span>
          )}
          {recommendation && (
            <span className="badge">DYNAMIC #{recommendation.dynamicRank}</span>
          )}
          <span className="badge">{player.risk} RISK</span>
        </div>
      </div>
      <StarterValue value={starterValue} />
      <section className="eligibility-panel">
        <h3>POSITION ELIGIBILITY</h3>
        <p>Workbook: {workbookPlayer.eligiblePositions.join(" / ")}</p>
        <p>League: {player.eligiblePositions.join(" / ")}</p>
        <div className="button-row">
          {POSITIONS.map((pos) => (
            <button
              aria-label={"League eligibility " + pos}
              aria-pressed={player.eligiblePositions.includes(pos)}
              className={
                player.eligiblePositions.includes(pos) ? "selected" : ""
              }
              key={pos}
              onClick={() => {
                const positions = player.eligiblePositions.includes(pos)
                  ? player.eligiblePositions.filter((p) => p !== pos)
                  : [...player.eligiblePositions, pos];
                if (positions.length) onEligibility(positions);
              }}
            >
              {pos}
            </button>
          ))}
          <button onClick={() => onEligibility(null)}>Reset override</button>
        </div>
        <small>
          Base positions only. Existing manual roster assignments must remain
          valid.
        </small>
      </section>
      <div className="stat-grid">
        <div>
          <span>PROJECTION</span>
          <strong>
            {number(player.projectedFpg)} <small>FP/G</small>
          </strong>
        </div>
        <div>
          <span>2025–26</span>
          <strong>
            {number(player.historicalFpg)} <small>FP/G</small>
          </strong>
        </div>
        <div>
          <span>PLANNING GP</span>
          <strong>{player.planningGames ?? "—"}</strong>
        </div>
        <div>
          <span>SEASON FP</span>
          <strong>{player.planningSeasonPoints?.toFixed(0) ?? "—"}</strong>
        </div>
      </div>
      <p className="rationale">
        {player.draftRationale ?? "No research rationale provided."}
      </p>
      <div className="detail-grid">
        <dl>
          {[
            [
              "Projection range",
              number(player.projectedLow) +
                " – " +
                number(player.projectedHigh),
            ],
            ["Historical games", player.historicalGames],
            ["Pool tier", player.poolTier],
            ["Data confidence", player.dataConfidence],
            ["Projection type", player.projectionType],
            ["Roster status", player.rosterStatus],
            ["FantasyPros FP/G", number(player.fantasyProsFpg)],
            ["Hashtag FP/G", number(player.hashtagFpg)],
            ["Raw consensus", number(player.rawConsensus)],
            ["Analyst adjustment", number(player.analystAdjustment)],
            ["VOR", number(recommendation?.vor)],
            [
              "Eligibility flexibility",
              player.eligiblePositions.length + " positions",
            ],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <dt>{label}</dt>
              <dd>{value ?? "—"}</dd>
            </div>
          ))}
        </dl>
        <div className="personal-controls">
          <h3>Your scouting notes</h3>
          <label>
            Personal rank
            <input
              type="number"
              min="1"
              max="600"
              defaultValue={personal.rank ?? ""}
              key={player.id}
              onBlur={(e) => {
                const n = Number(e.target.value);
                if (!e.target.value) onChange({ rank: undefined });
                else if (Number.isInteger(n) && n >= 1 && n <= 600)
                  onChange({ rank: n });
                else e.target.value = String(personal.rank ?? "");
              }}
              placeholder="Use research rank"
            />
          </label>
          <label>
            Target category
            <select
              value={personal.target ?? ""}
              onChange={(e) =>
                onChange({
                  target: (e.target.value || undefined) as
                    TargetType | undefined,
                })
              }
            >
              <option value="">No target label</option>
              {["PRIORITY", "VALUE", "SLEEPER", "LATE ROUND", "AVOID"].map(
                (v) => (
                  <option key={v}>{v}</option>
                ),
              )}
            </select>
          </label>
          <label>
            Player note
            <textarea
              rows={4}
              value={personal.note ?? ""}
              maxLength={10000}
              onChange={(e) => onChange({ note: e.target.value })}
              placeholder="Your read on this player…"
            />
          </label>
          <div className="button-row">
            <button className="secondary" onClick={onQueue}>
              {queued ? "Remove from queue" : "Add to queue"}
            </button>
            <button
              className={personal.watch ? "secondary starred" : "secondary"}
              onClick={() => onChange({ watch: !personal.watch })}
            >
              <Star size={16} />
              {personal.watch ? "UNWATCH" : "WATCH"}
            </button>
            <button className="secondary" onClick={onCompare}>
              <GitCompareArrows size={16} />
              COMPARE
            </button>
          </div>
        </div>
      </div>
      {recommendation && (
        <div className="detail-reasons">
          <h3>{recommendation.action}</h3>
          <ScoreBreakdown rec={recommendation} />
          {recommendation.reasons.map((r) => (
            <p key={r.label}>
              <b>{r.label}.</b> {r.detail}
            </p>
          ))}
        </div>
      )}
      <details>
        <summary>Sources / verification</summary>
        <p>
          Verified / snapshot: {player.verifiedAt ?? "Not provided"}. Static
          workbook research.
        </p>
        {links.map((url, i) => (
          <a key={url} href={url} target="_blank" rel="noreferrer">
            Source {i + 1} · {new URL(url).hostname} ↗
          </a>
        ))}
      </details>
      <div className="modal-actions">
        <span className="muted">{taken ?? "Available in this draft"}</span>
        <button className="primary" disabled={Boolean(taken)} onClick={onPick}>
          DRAFT PLAYER
          <ArrowRight size={18} />
        </button>
      </div>
    </Modal>
  );
}
