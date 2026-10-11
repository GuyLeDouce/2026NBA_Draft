"use client";
import { useMemo, useState } from "react";
import { Search, Star, Plus, SlidersHorizontal } from "lucide-react";
import type {
  Player,
  AppState,
  DraftState,
  Recommendation,
  Position,
} from "../types";
import { POSITIONS } from "../types";
import { normalizeName } from "../lib/identity";
import {
  fantasyRelevant,
  tierNumber,
  valueLabel,
} from "../lib/recommendations";
export function Board({
  players,
  state,
  draft,
  recommendations,
  onInspect,
  onPick,
  onWatch,
  onPreference,
  compact = false,
  quickPick = false,
}: {
  players: Player[];
  state: AppState;
  draft: DraftState;
  recommendations: Recommendation[];
  onInspect: (id: string) => void;
  onPick: (id: string) => void;
  onWatch: (id: string) => void;
  onPreference: (patch: Partial<AppState["preferences"]>) => void;
  compact?: boolean;
  quickPick?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState<Position | "ALL">("ALL");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    team: "",
    poolTier: "",
    risk: "",
    dataConfidence: "",
    projectionType: "",
    rosterStatus: "",
    personal: "",
    availability: "AVAILABLE",
    sort: "RESEARCH",
  });
  const taken = useMemo(
    () => new Map(draft.picks.map((p) => [p.playerId, p])),
    [draft.picks],
  );
  const dynamic = useMemo(
    () => new Map(recommendations.map((r) => [r.player.id, r])),
    [recommendations],
  );
  const result = useMemo(() => {
    const term = normalizeName(search);
    return players
      .filter((p) => {
        const personal = state.personal[p.id];
        return (
          (!term
            ? (state.preferences.deepMode || fantasyRelevant(p)) &&
              p.researchRank <= state.preferences.pool
            : normalizeName(
                p.name + " " + p.team + " " + p.eligiblePositions.join(" "),
              ).includes(term)) &&
          (position === "ALL" || p.eligiblePositions.includes(position)) &&
          (
            [
              "team",
              "poolTier",
              "risk",
              "dataConfidence",
              "projectionType",
              "rosterStatus",
            ] as const
          ).every((key) => !filters[key] || p[key] === filters[key]) &&
          (!filters.personal ||
            (filters.personal === "WATCH"
              ? personal?.watch
              : filters.personal === "TARGETS"
                ? personal?.target && personal.target !== "AVOID"
                : personal?.target === filters.personal)) &&
          (filters.availability === "ALL" ||
            (filters.availability === "DRAFTED"
              ? taken.has(p.id)
              : !taken.has(p.id)))
        );
      })
      .sort((a, b) =>
        filters.sort === "PERSONAL"
          ? (state.personal[a.id]?.rank ?? a.researchRank) -
            (state.personal[b.id]?.rank ?? b.researchRank)
          : filters.sort === "DYNAMIC"
            ? (dynamic.get(a.id)?.dynamicRank ?? 999) -
              (dynamic.get(b.id)?.dynamicRank ?? 999)
            : a.researchRank - b.researchRank,
      );
  }, [players, search, position, filters, state, taken, dynamic]);
  return (
    <section
      className={"panel board " + (compact ? "compact" : "")}
      aria-label="Player big board"
    >
      <div className="panel-heading">
        <div>
          <span className="eyebrow">THE SCOUTING REPORT</span>
          <h2>{compact ? "Available players" : "The big board"}</h2>
        </div>
        <span className="count">{result.length} players</span>
      </div>
      <div className="searchbar">
        <Search size={17} />
        <input
          id="player-search"
          aria-label="Search all 600 players"
          placeholder="Search all 600 players…  /"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.repeat && result[0]) {
              e.preventDefault();
              if (quickPick && !taken.has(result[0].id)) onPick(result[0].id);
              else onInspect(result[0].id);
            }
            if (e.key === "Escape") {
              setSearch("");
              e.currentTarget.blur();
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              document
                .querySelector<HTMLButtonElement>(".player-name")
                ?.focus();
            }
          }}
        />
        <button
          className={"icon " + (showFilters ? "active" : "")}
          aria-label="Toggle filters"
          onClick={() => setShowFilters(!showFilters)}
        >
          <SlidersHorizontal size={18} />
        </button>
      </div>
      <div className="board-tools">
        <div className="position-tabs">
          {(["ALL", ...POSITIONS] as const).map((p) => (
            <button
              key={p}
              className={position === p ? "selected" : ""}
              onClick={() => setPosition(p)}
            >
              {p}
            </button>
          ))}
        </div>
        <select
          aria-label="Visible player pool"
          value={state.preferences.pool}
          onChange={(e) => onPreference({ pool: Number(e.target.value) })}
        >
          {[100, 200, 250, 300, 400, 500, 600].map((n) => (
            <option value={n} key={n}>
              {n === 600 ? "All 600" : "Top " + n}
            </option>
          ))}
        </select>
      </div>
      {showFilters && (
        <div className="filter-grid">
          {(
            [
              "team",
              "poolTier",
              "risk",
              "dataConfidence",
              "projectionType",
              "rosterStatus",
            ] as const
          ).map((key) => (
            <label key={key}>
              {
                {
                  team: "NBA team",
                  poolTier: "Pool tier",
                  risk: "Risk",
                  dataConfidence: "Confidence",
                  projectionType: "Projection",
                  rosterStatus: "Roster status",
                }[key]
              }
              <select
                value={filters[key]}
                onChange={(e) =>
                  setFilters({ ...filters, [key]: e.target.value })
                }
              >
                <option value="">All</option>
                {[
                  ...new Set(
                    players
                      .map((p) => p[key])
                      .filter((v): v is string => Boolean(v)),
                  ),
                ]
                  .sort()
                  .map((v) => (
                    <option key={v}>{v}</option>
                  ))}
              </select>
            </label>
          ))}
          <label>
            Personal
            <select
              value={filters.personal}
              onChange={(e) =>
                setFilters({ ...filters, personal: e.target.value })
              }
            >
              <option value="">All players</option>
              {[
                "WATCH",
                "TARGETS",
                "PRIORITY",
                "VALUE",
                "SLEEPER",
                "LATE ROUND",
                "AVOID",
              ].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label>
            Availability
            <select
              value={filters.availability}
              onChange={(e) =>
                setFilters({ ...filters, availability: e.target.value })
              }
            >
              {["AVAILABLE", "DRAFTED", "ALL"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label>
            Order
            <select
              value={filters.sort}
              onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
            >
              {["RESEARCH", "PERSONAL", "DYNAMIC"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <button
            onClick={() =>
              setFilters({
                team: "",
                poolTier: "",
                risk: "",
                dataConfidence: "",
                projectionType: "",
                rosterStatus: "",
                personal: "",
                availability: "AVAILABLE",
                sort: "RESEARCH",
              })
            }
          >
            Clear filters
          </button>
        </div>
      )}
      <div className="board-legend">
        <span>RESEARCH / PLAYER</span>
        <span>FP/G</span>
        <span>VALUE / RISK</span>
        <span />
      </div>
      <div className="player-list">
        {result.length === 0 ? (
          <div className="empty">
            No matching players. Clear filters or enable Deep Mode.
          </div>
        ) : (
          result.map((p, index) => {
            const recommendation = dynamic.get(p.id);
            const pick = taken.get(p.id);
            return (
              <div
                key={p.id}
                className={
                  "player-row " +
                  (pick ? "taken" : "") +
                  (search && index === 0 ? " search-first" : "")
                }
              >
                <div className="player-identity">
                  <span className="rank">
                    {p.researchRank.toString().padStart(2, "0")}
                  </span>
                  <div>
                    <button
                      className="player-name"
                      onClick={() => onInspect(p.id)}
                      onKeyDown={(e) => {
                        if (
                          e.key === "Enter" &&
                          quickPick &&
                          !pick &&
                          !e.repeat
                        ) {
                          e.preventDefault();
                          onPick(p.id);
                          return;
                        }
                        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                          e.preventDefault();
                          const buttons =
                            document.querySelectorAll<HTMLButtonElement>(
                              ".player-name",
                            );
                          buttons[
                            Math.max(
                              0,
                              Math.min(
                                result.length - 1,
                                index + (e.key === "ArrowDown" ? 1 : -1),
                              ),
                            )
                          ]?.focus();
                        }
                      }}
                    >
                      {p.name}
                    </button>
                    <div className="player-sub">
                      <span>{p.team ?? "FA"}</span>
                      <span className={"pos pos-" + p.primaryPosition}>
                        {p.eligiblePositions.join(" / ")}
                      </span>
                      <span>T{tierNumber(p)}</span>
                      {state.personal[p.id]?.rank && (
                        <span>P#{state.personal[p.id].rank}</span>
                      )}
                    </div>
                  </div>
                </div>
                <span className="projection">
                  {p.projectedFpg?.toFixed(1) ?? "—"}
                </span>
                <div className="row-status">
                  <span
                    className={
                      recommendation && recommendation.value >= 7
                        ? "value"
                        : "muted"
                    }
                  >
                    {pick
                      ? "PICK " + pick.overall
                      : recommendation
                        ? valueLabel(recommendation.value)
                        : p.poolTier}
                  </span>
                  <small className={p.risk === "HIGH" ? "risk-high" : ""}>
                    {p.risk ?? "UNKNOWN"}
                  </small>
                </div>
                <div className="row-actions">
                  <button
                    className={
                      "icon watch " +
                      (state.personal[p.id]?.watch ? "starred" : "")
                    }
                    onClick={() => onWatch(p.id)}
                    aria-label={
                      (state.personal[p.id]?.watch ? "Unwatch " : "Watch ") +
                      p.name
                    }
                  >
                    <Star
                      size={16}
                      fill={
                        state.personal[p.id]?.watch ? "currentColor" : "none"
                      }
                    />
                  </button>
                  {!pick && (
                    <button
                      className="icon draft-icon"
                      onClick={() => onPick(p.id)}
                      aria-label={"Draft " + p.name}
                    >
                      <Plus size={18} />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className="board-footer">
        <span>
          {search
            ? "Search spans all 600 players"
            : "Research rank is the workbook’s authoritative order"}
        </span>
        <button
          className={
            state.preferences.deepMode ? "text-button blue" : "text-button"
          }
          onClick={() =>
            onPreference({ deepMode: !state.preferences.deepMode })
          }
        >
          DEEP MODE {state.preferences.deepMode ? "ON" : "OFF"}
        </button>
      </div>
    </section>
  );
}
