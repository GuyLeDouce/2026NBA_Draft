"use client";
import { useState } from "react";
import type {
  AppState,
  DraftState,
  LeagueSettings,
  Player,
  RosterSlot,
} from "../types";
import {
  assignRoster,
  eligible,
  rosterNeeds,
  rosterQuality,
  teamPlayers,
} from "../lib/roster";
import { orderedTeams, rounds, snakePick } from "../lib/draft";
export function Roster({
  slots,
  onInspect,
  onMove,
  compact = false,
}: {
  slots: RosterSlot[];
  onInspect: (id: string) => void;
  onMove?: (id: string, slot: string) => void;
  compact?: boolean;
}) {
  const groups = [
    ["STARTERS", ["PG", "SG", "SF", "PF", "C"]],
    ["FLEX", ["G", "F", "UTIL"]],
    ["BENCH", ["BN"]],
    ["INJURED RESERVE", ["IR"]],
  ] as const;
  return (
    <div className={"roster " + (compact ? "small" : "")}>
      {groups.map(([name, types]) => (
        <div className="roster-group" key={name}>
          <h3>{name}</h3>
          {slots
            .filter((s) => (types as readonly string[]).includes(s.type))
            .map((s) => (
              <div
                className={"roster-slot " + (!s.player ? "open" : "")}
                key={s.id}
              >
                <span className={"slot-label pos-" + s.type}>{s.type}</span>
                {s.player ? (
                  <>
                    <button
                      className="roster-player"
                      onClick={() => onInspect(s.player!.id)}
                    >
                      <b>{s.player.name}</b>
                      <small>
                        {s.player.team} ·{" "}
                        {s.player.projectedFpg?.toFixed(1) ?? "—"} FP/G
                      </small>
                    </button>
                    {onMove && (
                      <select
                        aria-label={"Move " + s.player.name}
                        value={s.id}
                        onChange={(e) => onMove(s.player!.id, e.target.value)}
                      >
                        {slots
                          .filter((target) => eligible(s.player!, target.type))
                          .map((target) => (
                            <option key={target.id} value={target.id}>
                              {target.type}{" "}
                              {slots
                                .filter((t) => t.type === target.type)
                                .indexOf(target) + 1}
                            </option>
                          ))}
                      </select>
                    )}
                  </>
                ) : (
                  <span className="muted">Open slot</span>
                )}
              </div>
            ))}
        </div>
      ))}
    </div>
  );
}
export function TeamView({
  state,
  draft,
  league,
  players,
  onInspect,
  onMove,
}: {
  state: AppState;
  draft: DraftState;
  league: LeagueSettings;
  players: Player[];
  onInspect: (id: string) => void;
  onMove: (id: string, slot: string) => void;
}) {
  const [teamId, setTeamId] = useState(league.myTeamId);
  const team = league.teams.find((t) => t.id === teamId) ?? league.teams[0];
  const selected = teamPlayers(draft, team.id, players);
  const slots = assignRoster(selected, league.roster, draft.slotOverrides);
  const quality = rosterQuality(selected, slots);
  return (
    <div className="team-layout">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">ROSTER ROOM</span>
            <h2>{team.name}</h2>
          </div>
          <select
            aria-label="View fantasy team"
            value={team.id}
            onChange={(e) => setTeamId(e.target.value)}
          >
            {league.teams.map((t) => (
              <option value={t.id} key={t.id}>
                {t.name}
                {t.id === league.myTeamId ? " · YOU" : ""}
              </option>
            ))}
          </select>
        </div>
        <Roster
          slots={slots}
          onInspect={onInspect}
          onMove={team.id === league.myTeamId ? onMove : undefined}
        />
      </section>
      <div>
        <section className="panel quality">
          <span className="eyebrow">ROSTER PROFILE</span>
          <h2>Built to compete</h2>
          <div className="quality-grid">
            {[
              ["Production", quality.production],
              ["Position coverage", quality.coverage],
              ["Availability risk", quality.availability],
              ["Flexibility", quality.flexible + " multi-position"],
              ["Upside", quality.upside + " wide-range picks"],
              ["Stash count", quality.stash],
            ].map(([name, value]) => (
              <div key={name}>
                <span>{name}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <p className="muted">
            {quality.average?.toFixed(1) ?? "—"} average FP/G ·{" "}
            {quality.seasonPoints.toLocaleString(undefined, {
              maximumFractionDigits: 0,
            })}{" "}
            planning season points. Projection coverage: {quality.known}/
            {quality.total} players.
          </p>
          <p className="muted">
            Needs:{" "}
            {rosterNeeds(slots).join(", ") || "Primary positions covered"}
          </p>
          <details>
            <summary>How this profile is measured</summary>
            <p>
              Production averages known player forecasts: Excellent ≥40, Strong
              ≥30, Developing ≥22 FP/G. Coverage counts the five standard slots
              (Good ≥3, Complete 5). Availability risk is Moderate with 1–2
              HIGH-risk picks and Elevated with 3+. Upside means a high
              projection ≥5 FP/G above center. Stashes have fewer than 45
              planning games. Season points are a sum of known projections, not
              a lineup schedule forecast.
            </p>
          </details>
        </section>
        <section className="panel opponents">
          <div className="panel-heading">
            <h2>All team needs</h2>
          </div>
          {league.teams.map((t) => {
            const ps = teamPlayers(draft, t.id, players);
            const needs = rosterNeeds(
              assignRoster(ps, league.roster, draft.slotOverrides),
            );
            return (
              <button
                className="opponent-row"
                key={t.id}
                onClick={() => setTeamId(t.id)}
              >
                <b>{t.name}</b>
                <span>{ps.length} picks</span>
                <small>{needs.join(" · ") || "Depth / bench"}</small>
              </button>
            );
          })}
        </section>
        {state.personal && (
          <section className="panel quality">
            <h3>Watchlist status</h3>
            {players
              .filter((p) => state.personal[p.id]?.watch)
              .map((p) => (
                <button
                  key={p.id}
                  className="watchlist-row"
                  onClick={() => onInspect(p.id)}
                >
                  {p.name}
                  <span>
                    {draft.picks.some((pick) => pick.playerId === p.id)
                      ? "TAKEN"
                      : "AVAILABLE"}
                  </span>
                </button>
              ))}
          </section>
        )}
      </div>
    </div>
  );
}
export function DraftBoard({
  draft,
  league,
  players,
  onCorrect,
  onInspect,
}: {
  draft: DraftState;
  league: LeagueSettings;
  players: Player[];
  onCorrect: (overall: number) => void;
  onInspect: (id: string) => void;
}) {
  const teams = orderedTeams(league);
  const map = new Map(players.map((p) => [p.id, p]));
  return (
    <section className="panel draft-board">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">EVERY PICK. EVERY TEAM.</span>
          <h2>The draft board</h2>
        </div>
        <span className="count">{draft.picks.length} selections</span>
      </div>
      {league.draftSlot === null && (
        <p className="notice">
          Draft order is provisional until you enter your position in Settings.
        </p>
      )}
      <div className="draft-grid-scroll">
        <div
          className="draft-grid"
          style={{
            gridTemplateColumns:
              "46px repeat(" + league.teamCount + ", minmax(130px, 1fr))",
          }}
        >
          <div className="draft-grid-header">RD</div>
          {teams.map((team, i) => (
            <div
              className={
                "draft-grid-header " +
                (team.id === league.myTeamId ? "mine" : "")
              }
              key={team.id}
            >
              {i + 1}. {team.name}
              {team.id === league.myTeamId && <small>YOUR TEAM</small>}
            </div>
          ))}
          {Array.from({ length: rounds(league) }, (_, r) => (
            <DraftRound
              key={r}
              round={r + 1}
              count={league.teamCount}
              draft={draft}
              teams={teams}
              map={map}
              onCorrect={onCorrect}
            />
          ))}
        </div>
      </div>
      <div className="history-list">
        <h3>Pick history · click a pick to correct</h3>
        {[...draft.picks].reverse().map((pick) => {
          const player = map.get(pick.playerId)!;
          return (
            <div key={pick.overall}>
              <span className="rank">{pick.overall}</span>
              <button onClick={() => onInspect(player.id)}>
                {player.name}
              </button>
              <span>{teams.find((t) => t.id === pick.teamId)?.name}</span>
              <button
                className="text-button"
                onClick={() => onCorrect(pick.overall)}
              >
                Correct
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
function DraftRound({
  round,
  count,
  draft,
  teams,
  map,
  onCorrect,
}: {
  round: number;
  count: number;
  draft: DraftState;
  teams: LeagueSettings["teams"];
  map: Map<string, Player>;
  onCorrect: (overall: number) => void;
}) {
  return (
    <>
      <div className="round-cell">{round.toString().padStart(2, "0")}</div>
      {teams.map((team, i) => {
        const overall = (round - 1) * count + (round % 2 ? i + 1 : count - i);
        const pick = draft.picks.find((p) => p.overall === overall);
        const p = pick ? map.get(pick.playerId) : null;
        const current = overall === draft.picks.length + 1;
        return (
          <button
            disabled={!pick}
            className={
              "pick-tile " +
              (current ? "on-deck" : "") +
              " " +
              (overall === draft.picks.length ? "latest" : "") +
              " pos-border-" +
              (p?.primaryPosition ?? "")
            }
            key={team.id}
            onClick={() => onCorrect(overall)}
          >
            <small>
              {round}.
              {snakePick(overall, count).pick.toString().padStart(2, "0")} · #
              {overall}
            </small>
            {p ? (
              <>
                <b>{p.name}</b>
                <span>
                  {p.team} · {p.eligiblePositions.join("/")}
                </span>
              </>
            ) : (
              <span>{current ? "ON THE CLOCK" : "—"}</span>
            )}
          </button>
        );
      })}
    </>
  );
}
