"use client";
import { useState } from "react";
import type { AppState, SlotType, ScoringKey } from "../types";
import {
  SCORING_LABELS,
  DEFAULT_SCORING,
  scoreStats,
  scoringChanged,
} from "../lib/scoring";
import { orderedTeams } from "../lib/draft";
export function Settings({
  state,
  onSave,
  onExport,
  onImport,
  onReset,
  wizard = false,
  onClose,
}: {
  state: AppState;
  onSave: (state: AppState) => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onReset: (kind: string) => void;
  wizard?: boolean;
  onClose?: () => void;
}) {
  const [draft, setDraft] = useState(() => structuredClone(state));
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [sample, setSample] = useState<Partial<Record<ScoringKey, number>>>({
    PTS: 3,
    FGM: 1,
    "3PM": 1,
  });
  const locked =
    state.draftLocked ||
    state.realDraft.picks.length > 0 ||
    state.mockDraft.picks.length > 0;
  const league = draft.leagueSettings;
  const updateLeague = (patch: Partial<AppState["leagueSettings"]>) =>
    setDraft({ ...draft, leagueSettings: { ...league, ...patch } });
  function save() {
    try {
      onSave({ ...draft, setupDone: true });
      setError("");
      onClose?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid settings");
    }
  }
  const section = (n: number) => !wizard || step === n;
  return (
    <fieldset className="settings-content" disabled={state.draftLocked}>
      {wizard && (
        <div className="setup-steps">
          {["League", "Draft order", "Roster", "Scoring"].map((s, i) => (
            <button
              className={step === i ? "selected" : ""}
              key={s}
              onClick={() => setStep(i)}
            >
              {i + 1}. {s}
            </button>
          ))}
        </div>
      )}
      {locked && (
        <p className="notice">
          Draft format is locked while real or mock picks exist. Reset the
          relevant drafts to change team count, order, or roster slots.
        </p>
      )}
      {section(0) && (
        <section className="panel settings-section">
          <span className="eyebrow">YOUR LEAGUE</span>
          <h2>Set the room</h2>
          <div className="form-grid">
            <label>
              League name
              <input
                value={league.name}
                maxLength={80}
                onChange={(e) => updateLeague({ name: e.target.value })}
              />
            </label>
            <label>
              Number of teams
              <input
                type="number"
                min={2}
                max={20}
                disabled={locked}
                value={league.teamCount}
                onChange={(e) => {
                  const count = Number(e.target.value);
                  if (count < 2 || count > 20) return;
                  const teams = Array.from(
                    { length: count },
                    (_, i) =>
                      league.teams[i] ?? {
                        id: "team-" + (i + 1),
                        name: "Team " + (i + 1),
                      },
                  );
                  updateLeague({
                    teamCount: count,
                    teams,
                    myTeamId: teams.some((t) => t.id === league.myTeamId)
                      ? league.myTeamId
                      : teams[0].id,
                    draftSlot:
                      league.draftSlot && league.draftSlot <= count
                        ? league.draftSlot
                        : null,
                  });
                  setDraft((prev) => ({
                    ...prev,
                    mockDraft: {
                      ...prev.mockDraft,
                      slot: Math.min(count, prev.mockDraft.slot),
                    },
                  }));
                }}
              />
            </label>
            <label>
              Draft date
              <input
                type="date"
                value={league.draftDate}
                onChange={(e) => updateLeague({ draftDate: e.target.value })}
              />
            </label>
            <label>
              Format
              <input readOnly value="Head-to-head points · Snake" />
            </label>
          </div>
          <h3>Fantasy team names</h3>
          <div className="form-grid">
            {league.teams.map((team, i) => (
              <label key={team.id}>
                Team {i + 1}
                <input
                  aria-label={"Fantasy team " + (i + 1)}
                  value={team.name}
                  maxLength={60}
                  onChange={(e) =>
                    updateLeague({
                      teams: league.teams.map((t) =>
                        t.id === team.id ? { ...t, name: e.target.value } : t,
                      ),
                    })
                  }
                />
              </label>
            ))}
          </div>
        </section>
      )}
      {section(1) && (
        <section className="panel settings-section">
          <span className="eyebrow">SNAKE DRAFT</span>
          <h2>Find your seat</h2>
          <p>
            Your actual draft position can remain unknown. Research is available
            immediately.
          </p>
          <div className="form-grid">
            <label>
              My fantasy team
              <select
                disabled={locked}
                value={league.myTeamId}
                onChange={(e) => updateLeague({ myTeamId: e.target.value })}
              >
                {league.teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              My draft position
              <select
                disabled={locked}
                value={league.draftSlot ?? ""}
                onChange={(e) =>
                  updateLeague({
                    draftSlot: e.target.value ? Number(e.target.value) : null,
                  })
                }
              >
                <option value="">Unknown — choose later</option>
                {league.teams.map((_, i) => (
                  <option key={i} value={i + 1}>
                    Position {i + 1}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="muted">
            Other teams follow the team list order. Your team is inserted at
            your selected position. Rename teams in order to match the real
            draft.
          </p>
          <div className="order-preview">
            {orderedTeams(league).map((t, i) => (
              <span
                key={t.id}
                className={t.id === league.myTeamId ? "mine" : ""}
              >
                {league.draftSlot ? i + 1 : "?"} · {t.name}
              </span>
            ))}
          </div>
        </section>
      )}
      {section(2) && (
        <section className="panel settings-section">
          <span className="eyebrow">ROSTER CONSTRUCTION</span>
          <h2>A place for every pick</h2>
          <p>
            IR slots are reserved for manual placement and do not add draft
            rounds.
          </p>
          <div className="slot-editor">
            {league.roster.slots.map((slot, i) => (
              <div key={i}>
                <select
                  aria-label={"Roster slot " + (i + 1)}
                  disabled={locked}
                  value={slot}
                  onChange={(e) =>
                    updateLeague({
                      roster: {
                        slots: league.roster.slots.map((s, j) =>
                          j === i ? (e.target.value as SlotType) : s,
                        ),
                      },
                    })
                  }
                >
                  {[
                    "PG",
                    "SG",
                    "SF",
                    "PF",
                    "C",
                    "G",
                    "F",
                    "UTIL",
                    "BN",
                    "IR",
                  ].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <button
                  aria-label={"Remove roster slot " + (i + 1)}
                  disabled={locked || league.roster.slots.length === 1}
                  onClick={() =>
                    updateLeague({
                      roster: {
                        slots: league.roster.slots.filter((_, j) => j !== i),
                      },
                    })
                  }
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button
            className="secondary"
            disabled={locked || league.roster.slots.length >= 25}
            onClick={() =>
              updateLeague({
                roster: { slots: [...league.roster.slots, "BN"] },
              })
            }
          >
            Add bench slot
          </button>
        </section>
      )}
      {section(3) && (
        <section className="panel settings-section">
          <span className="eyebrow">CUSTOM POINTS</span>
          <h2>Your scoring advantage</h2>
          <p>
            OREB stacks with total rebounds. Made shots stack with points.
            Workbook projections use the original league scoring.
          </p>
          {scoringChanged(draft.scoringSettings) && (
            <p className="notice">
              Scoring was changed. The calculator uses your settings; research
              projections and rankings remain the workbook’s original scoring.
              Import a rescored workbook to update forecasts.
            </p>
          )}
          <div className="scoring-grid">
            {(Object.keys(DEFAULT_SCORING) as ScoringKey[]).map((key) => (
              <label key={key}>
                {SCORING_LABELS[key]}
                <input
                  type="number"
                  step="0.5"
                  min="-100"
                  max="100"
                  value={draft.scoringSettings[key]}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      scoringSettings: {
                        ...draft.scoringSettings,
                        [key]: Number(e.target.value),
                      },
                    })
                  }
                />
              </label>
            ))}
          </div>
          <details>
            <summary>
              Scoring sandbox ·{" "}
              {scoreStats(sample, draft.scoringSettings).toFixed(1)} fantasy
              points
            </summary>
            <div className="scoring-grid">
              {(Object.keys(DEFAULT_SCORING) as ScoringKey[]).map((key) => (
                <label key={key}>
                  {key}
                  <input
                    aria-label={"Sample " + key}
                    type="number"
                    min={0}
                    value={sample[key] ?? 0}
                    onChange={(e) =>
                      setSample({ ...sample, [key]: Number(e.target.value) })
                    }
                  />
                </label>
              ))}
            </div>
          </details>
        </section>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="settings-actions">
        {wizard && step > 0 && (
          <button onClick={() => setStep(step - 1)}>Back</button>
        )}
        {wizard && step < 3 ? (
          <button className="primary" onClick={() => setStep(step + 1)}>
            Continue →
          </button>
        ) : (
          <button className="primary" onClick={save}>
            {wizard ? "Enter war room" : "Save settings"}
          </button>
        )}
        {wizard && <button onClick={onClose}>Research first</button>}
      </div>
      {!wizard && (
        <section className="panel settings-section">
          <span className="eyebrow">LOCAL CONTROL</span>
          <h2>Backups & resets</h2>
          <p>
            Everything stays in this browser. Export a backup before changing
            devices or clearing browser data.
          </p>
          <div className="button-row">
            <button className="secondary" onClick={onExport}>
              Export state JSON
            </button>
            <label className="button secondary">
              Import state JSON
              <input
                className="sr-only"
                type="file"
                accept=".json,application/json"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onImport(file);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          <div className="reset-grid">
            {[
              "REAL DRAFT",
              "MOCK DRAFT",
              "PERSONAL RANKINGS",
              "ALL APP DATA",
            ].map((kind) => (
              <button
                className="danger"
                key={kind}
                onClick={() => onReset(kind)}
              >
                Reset {kind.toLowerCase()}
              </button>
            ))}
          </div>
        </section>
      )}
    </fieldset>
  );
}
