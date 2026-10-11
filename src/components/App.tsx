"use client";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  Expand,
  Flag,
  GitCompareArrows,
  RotateCcw,
  ShieldCheck,
  Target,
  Trophy,
  Zap,
} from "lucide-react";
import dataset from "../data/players.generated.json";
import type {
  AppState,
  DraftState,
  Player,
  PersonalPlayer,
  MockStyle,
} from "../types";
import { useDraftStore } from "../lib/store";
import { defaultState } from "../lib/defaults";
import {
  correctPick,
  emptyDraft,
  nextPick,
  recordPick,
  snakePick,
  teamOnClock,
  totalPicks,
  undoPick,
} from "../lib/draft";
import { analyzeDraft, valueLabel } from "../lib/recommendations";
import { mockLeague, simulateToMyPick } from "../lib/mock";
import { movePlayer, rosterQuality, teamPlayers } from "../lib/roster";
import { exportState, importState, parseState } from "../lib/storage";
import { scoringChanged } from "../lib/scoring";
import { riskCapacity, starterUpgrade } from "../lib/lineupIntelligence";
import { RiskPanel, StarterValue } from "./LineupIntelligence";
import { leaguePlayers } from "../lib/eligibility";
import {
  advancedTwoPickPlan,
  slotLab,
  type SlotScenarioResult,
} from "../lib/planner";
import { recommendationDeltas } from "../lib/recommendationDelta";
import {
  ScoreBreakdown,
  TwoPickPlans,
  WhyChanged,
  SlotLabResults,
} from "./Planning";
import { addQueue } from "../lib/queue";
import { WorkbookPreview } from "./WorkbookPreview";
import { Recovery } from "./Recovery";
import { PickQueue } from "./PickQueue";
import { Board } from "./Board";
import { PlayerDetail } from "./PlayerDetail";
import { Settings } from "./Settings";
import { DraftBoard, Roster, TeamView } from "./TeamPanels";
import { Compare } from "./Compare";
import { Modal } from "./Modal";
const canonicalPlayers = dataset.players as Player[];
const NAV = [
  "WAR ROOM",
  "BIG BOARD",
  "MOCK DRAFT",
  "MY TEAM",
  "DRAFT BOARD",
  "SETTINGS",
] as const;
type Tab = (typeof NAV)[number];
export default function App() {
  const store = useDraftStore(canonicalPlayers);
  return store.state ? (
    <Room
      state={store.state}
      update={store.update}
      storageMessage={store.storageMessage}
      readOnly={store.readOnly}
      takeControl={store.takeControl}
      checkpointStatus={store.checkpointStatus}
    />
  ) : (
    <div className="loading">
      <span className="brand-mark">D</span>
      <h1>Opening the war room</h1>
    </div>
  );
}
function Room({
  state,
  update,
  storageMessage,
  readOnly,
  takeControl,
  checkpointStatus,
}: {
  state: AppState;
  update: (
    value: AppState | ((prev: AppState) => AppState),
    checkpointAction?: { kind: "real" | "mock"; action: string },
  ) => void;
  storageMessage: string;
  readOnly: boolean;
  takeControl: () => void;
  checkpointStatus: string;
}) {
  const players = useMemo(
    () =>
      leaguePlayers(dataset.players as Player[], state.eligibilityOverrides),
    [state.eligibilityOverrides],
  );
  const playerMap = useMemo(
    () => new Map(players.map((p) => [p.id, p])),
    [players],
  );
  const [lab, setLab] = useState<SlotScenarioResult[] | null>(null);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("WAR ROOM");
  const [mobile, setMobile] = useState("PICK");
  const [detail, setDetail] = useState<string | null>(null);
  const [pendingPick, setPendingPick] = useState<string | null>(null);
  const [correction, setCorrection] = useState<number | null>(null);
  const [correctionSearch, setCorrectionSearch] = useState("");
  const [replacement, setReplacement] = useState("");
  const [comparison, setComparison] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [setup, setSetup] = useState(!state.setupDone);
  const [notice, setNotice] = useState("");
  const [confirmationText, setConfirmationText] = useState("");
  const [confirm, setConfirm] = useState<{
    title: string;
    detail: string;
    action: () => void;
    requireReset?: boolean;
  } | null>(null);
  const [mockBoard, setMockBoard] = useState(false);
  const isMock = tab === "MOCK DRAFT";
  const draft = isMock ? state.mockDraft : state.realDraft;
  const league = useMemo(
    () =>
      isMock
        ? mockLeague(state.leagueSettings, state.mockDraft)
        : state.leagueSettings,
    [isMock, state.leagueSettings, state.mockDraft],
  );
  const analysis = useMemo(
    () =>
      analyzeDraft(
        players,
        league,
        draft,
        state.personal,
        state.preferences.deepMode,
      ),
    [players, league, draft, state.personal, state.preferences.deepMode],
  );
  const hero = analysis.recommendations[0];
  const plans = useMemo(
    () => advancedTwoPickPlan(players, league, draft, state.personal, analysis),
    [players, league, draft, state.personal, analysis],
  );
  const deltas = useMemo(
    () =>
      draft.picks.length
        ? recommendationDeltas(
            analyzeDraft(
              players,
              league,
              undoPick(draft),
              state.personal,
              state.preferences.deepMode,
            ).recommendations,
            analysis.recommendations,
            playerMap.get(draft.picks.at(-1)!.playerId)?.name,
          )
        : [],
    [
      players,
      league,
      draft,
      state.personal,
      state.preferences.deepMode,
      analysis,
      playerMap,
    ],
  );
  const clock = teamOnClock(draft, league);
  const complete = draft.picks.length >= totalPicks(league);
  const pick = snakePick(draft.picks.length + 1, league.teamCount);
  const myClock = clock?.id === league.myTeamId;
  const nextAfter = nextPick(
    pick.overall + 1,
    league.draftSlot,
    league.teamCount,
    totalPicks(league),
  );
  const setDraft = (fn: (draft: DraftState) => DraftState) =>
    update((prev) =>
      isMock
        ? { ...prev, mockDraft: { ...prev.mockDraft, ...fn(prev.mockDraft) } }
        : { ...prev, realDraft: fn(prev.realDraft) },
    );
  const personal = (id: string, patch: Partial<PersonalPlayer>) =>
    update((prev) => ({
      ...prev,
      personal: { ...prev.personal, [id]: { ...prev.personal[id], ...patch } },
    }));
  const watch = (id: string) =>
    personal(id, { watch: !state.personal[id]?.watch });
  const preference = (patch: Partial<AppState["preferences"]>) =>
    update((prev) => ({
      ...prev,
      preferences: { ...prev.preferences, ...patch },
    }));
  const safe = (action: () => void) => {
    try {
      action();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Something went wrong.");
    }
  };
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
        target.isContentEditable
      )
        return;
      if (event.key === "/" && !document.querySelector("dialog[open]")) {
        event.preventDefault();
        if (tab !== "WAR ROOM" && tab !== "MOCK DRAFT" && tab !== "BIG BOARD")
          setTab("WAR ROOM");
        setMockBoard(false);
        setMobile("BOARD");
        requestAnimationFrame(() =>
          document.getElementById("player-search")?.focus(),
        );
      }
      if (
        event.key.toLowerCase() === "q" &&
        !document.querySelector("dialog[open]")
      ) {
        event.preventDefault();
        if (!isMock) setTab("WAR ROOM");
        setMockBoard(false);
        setMobile("QUEUE");
        requestAnimationFrame(() => {
          document
            .getElementById("pick-queue")
            ?.scrollIntoView({ block: "center" });
          document.getElementById("pick-queue")?.focus();
        });
      }
      if (event.key.toLowerCase() === "w" && detail && !pendingPick) {
        event.preventDefault();
        personal(detail, { watch: !state.personal[detail]?.watch });
      }
    }
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  });
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production")
      navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  function requestPick(id: string) {
    if (readOnly) {
      setNotice("This tab is read-only. Take control to record picks.");
      return;
    }
    if (league.draftSlot === null) {
      setNotice(
        "Enter your real draft position in Settings before recording picks. Research remains available.",
      );
      return;
    }
    if (complete) {
      setNotice(
        "This draft is complete. Use the draft board to correct a pick.",
      );
      return;
    }
    setDetail(null);
    setPendingPick(id);
  }
  function addCompare(id: string) {
    if (comparison.includes(id)) {
      setCompareOpen(true);
      setDetail(null);
      return;
    }
    if (comparison.length >= 4) {
      setNotice("Compare up to four players. Remove one to add another.");
      return;
    }
    const next = [...comparison, id];
    setComparison(next);
    setDetail(null);
    if (next.length >= 2) setCompareOpen(true);
    else
      setNotice(
        "First player added. Choose Compare on another player to see them side by side.",
      );
  }
  function exportBackup() {
    const blob = new Blob([exportState(state)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download =
      "nba-draft-backup-" + new Date().toISOString().slice(0, 10) + ".json";
    a.click();
    URL.revokeObjectURL(url);
    setNotice("Draft backup exported.");
  }
  async function importBackup(file: File) {
    if (state.draftLocked) {
      setNotice("Unlock settings before importing a backup.");
      return;
    }
    setConfirmationText("");
    try {
      const imported = importState(await file.text(), canonicalPlayers);
      setConfirm({
        title: "Restore this backup?",
        requireReset: state.realDraft.picks.length > 0,
        detail:
          imported.realDraft.picks.length +
          " real picks, " +
          imported.mockDraft.picks.length +
          " mock picks. This replaces current app state.",
        action: () => {
          update(imported, {
            kind: "real",
            action: "Imported validated backup",
          });
          setNotice("Backup restored.");
        },
      });
    } catch (e) {
      setNotice(
        "Import rejected: " +
          (e instanceof Error ? e.message : "Invalid backup"),
      );
    }
  }
  function reset(kind: string) {
    if (
      state.draftLocked &&
      kind !== "MOCK DRAFT" &&
      kind !== "PERSONAL RANKINGS"
    ) {
      setNotice("Unlock settings before resetting real draft data.");
      return;
    }
    setConfirmationText("");
    setConfirm({
      title: "Reset " + kind.toLowerCase() + "?",
      requireReset:
        state.realDraft.picks.length > 0 &&
        (kind === "REAL DRAFT" || kind === "ALL APP DATA"),
      detail:
        kind === "MOCK DRAFT"
          ? "This clears practice selections. Your real draft is stored separately."
          : "Export a backup if you want to preserve this data. This action cannot be undone.",
      action: () => {
        update((prev) =>
          kind === "ALL APP DATA"
            ? defaultState()
            : kind === "REAL DRAFT"
              ? { ...prev, realDraft: emptyDraft() }
              : kind === "MOCK DRAFT"
                ? { ...prev, mockDraft: { ...prev.mockDraft, ...emptyDraft() } }
                : {
                    ...prev,
                    personal: Object.fromEntries(
                      Object.entries(prev.personal).map(([id, data]) => [
                        id,
                        { ...data, rank: undefined },
                      ]),
                    ),
                  },
        );
        setNotice(kind + " reset.");
      },
    });
  }
  const inspect = (id: string) => setDetail(id);
  const onMove = (id: string, slot: string) =>
    safe(() =>
      setDraft((d) =>
        movePlayer(
          d,
          teamPlayers(d, league.myTeamId, players),
          league.roster,
          id,
          slot,
        ),
      ),
    );
  const queueKey = isMock ? "mock" : "real";
  const setQueue = (queue: string[]) =>
    update((prev) => ({
      ...prev,
      queues: { ...prev.queues, [queueKey]: queue },
    }));
  const board = (
    <Board
      players={players}
      state={state}
      draft={draft}
      recommendations={analysis.recommendations}
      onInspect={inspect}
      onPick={requestPick}
      onWatch={watch}
      onPreference={preference}
      compact={tab !== "BIG BOARD"}
      quickPick={league.draftSlot !== null}
    />
  );
  const queueTaken = draft.picks.at(-1);
  const endangered = state.queues[queueKey]
    .map((id) => analysis.recommendations.find((r) => r.player.id === id))
    .find((r) => r?.survival === "UNLIKELY TO SURVIVE");
  const alerts = [
    ...(queueTaken && state.queues[queueKey].includes(queueTaken.playerId)
      ? [
          {
            title: "QUEUE PLAYER TAKEN",
            detail:
              (playerMap.get(queueTaken.playerId)?.name ??
                queueTaken.playerId) +
              " was selected. Your next active option is promoted.",
          },
        ]
      : []),
    ...(endangered && analysis.distance !== null
      ? [
          {
            title: "QUEUE ALERT",
            detail:
              endangered.player.name + " is unlikely to reach your next turn.",
          },
        ]
      : []),
    ...analysis.alerts,
  ].slice(0, 3);
  const quality = rosterQuality(analysis.myPlayers, analysis.roster);
  return (
    <div className={"app " + (state.preferences.draftDay ? "draft-day" : "")}>
      <header className="topbar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setTab("WAR ROOM");
          }}
          aria-label="NBA Draft Assistant home"
        >
          <span className="brand-mark">
            <svg viewBox="0 0 40 40" aria-hidden="true">
              <circle cx="20" cy="20" r="16" />
              <path d="M4 20h32M20 4v32M9 8c14 6 14 18 0 24M31 8c-14 6-14 18 0 24" />
            </svg>
          </span>
          <span>
            NBA DRAFT ASSISTANT<small>2026–27 · FANTASY BASKETBALL</small>
          </span>
        </a>
        <div className="header-actions">
          <span className="save-status" aria-live="polite">
            {checkpointStatus}
          </span>
          <button className="secondary" onClick={() => setRecoveryOpen(true)}>
            Recovery
          </button>
          <button
            className={state.draftLocked ? "lock-badge selected" : "secondary"}
            onClick={() =>
              state.draftLocked
                ? setConfirm({
                    title: "Unlock live draft settings?",
                    detail:
                      "Scoring, configuration, imports and destructive reset controls become available.",
                    action: () =>
                      update((prev) => ({ ...prev, draftLocked: false })),
                  })
                : update((prev) => ({ ...prev, draftLocked: true }))
            }
          >
            {state.draftLocked
              ? "LIVE DRAFT LOCKED · Unlock settings"
              : "Lock for live draft"}
          </button>
          <span className="local-badge">
            <span />
            LOCAL FIRST
          </span>
          <button
            className={state.preferences.draftDay ? "toggle active" : "toggle"}
            onClick={() =>
              preference({ draftDay: !state.preferences.draftDay })
            }
          >
            <Zap size={14} />
            DRAFT DAY MODE
          </button>
          <button
            className="icon"
            aria-label="Toggle fullscreen"
            onClick={() => {
              if (document.fullscreenElement)
                document
                  .exitFullscreen()
                  .catch(() => setNotice("Fullscreen is unavailable."));
              else
                document.documentElement
                  .requestFullscreen?.()
                  .catch(() => setNotice("Fullscreen is unavailable."));
            }}
          >
            <Expand size={19} />
          </button>
        </div>
      </header>
      <nav className="main-nav" aria-label="Main navigation">
        {NAV.map((item) => (
          <button
            key={item}
            className={tab === item ? "active" : ""}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
        <span className="nav-date">
          TUE, OCT 13 <span>•</span> DRAFT NIGHT
        </span>
      </nav>
      <main>
        {readOnly && (
          <div className="notice ownership-banner">
            <strong>DRAFT ACTIVE IN ANOTHER TAB · READ-ONLY</strong>
            <button
              className="secondary"
              onClick={() =>
                setConfirm({
                  title: "Take control of this draft?",
                  detail:
                    "The other tab will become read-only. Saved state will synchronize here.",
                  action: takeControl,
                })
              }
            >
              Take control
            </button>
          </div>
        )}
        <div className="page-heading">
          <div>
            <span className="eyebrow">
              <span className="orange-dash" />
              {isMock
                ? "PRACTICE MAKES PREPARED"
                : state.leagueSettings.name.toUpperCase()}
            </span>
            <h1>
              {tab === "WAR ROOM"
                ? "DRAFT WAR ROOM"
                : tab === "BIG BOARD"
                  ? "TRUST THE RESEARCH"
                  : tab === "MOCK DRAFT"
                    ? "THE DRAFT REHEARSAL"
                    : tab === "MY TEAM"
                      ? "BUILD YOUR CONTENDER"
                      : tab === "DRAFT BOARD"
                        ? "THE ROOM, ROUND BY ROUND"
                        : "MAKE IT YOUR LEAGUE"}
              <span className="season-mark">26 / 27</span>
            </h1>
          </div>
          <div className="heading-actions">
            {comparison.length > 0 && (
              <button
                className="secondary"
                onClick={() => setCompareOpen(true)}
              >
                <GitCompareArrows size={16} />
                Compare ({comparison.length})
              </button>
            )}
            <button
              className="secondary"
              onClick={() => setLab(slotLab(players, state.leagueSettings))}
            >
              {state.leagueSettings.draftSlot === null
                ? "Draft slot lab"
                : "Compare draft slots"}
            </button>
            <button className="secondary" onClick={exportBackup}>
              Export backup
              <ArrowUpRight size={15} />
            </button>
          </div>
        </div>
        {(notice || storageMessage) && (
          <div className="toast" role="status">
            <span>{storageMessage || notice}</span>
            <button
              aria-label="Dismiss notification"
              onClick={() => setNotice("")}
            >
              ×
            </button>
          </div>
        )}
        {scoringChanged(state.scoringSettings) && (
          <div className="notice">
            Custom scoring has changed. Workbook ranks and forecasts still
            reflect the original league scoring. Settings includes a scoring
            calculator.
          </div>
        )}
        {tab !== "SETTINGS" && (
          <section
            className={"scoreboard " + (myClock ? "your-clock" : "")}
            aria-label="Draft status"
          >
            <div className="clock-team">
              <span className="eyebrow">
                {complete
                  ? "DRAFT COMPLETE"
                  : myClock
                    ? "YOU’RE ON THE CLOCK"
                    : isMock
                      ? "PRACTICE · ON THE CLOCK"
                      : "ON THE CLOCK"}
              </span>
              <strong>
                {complete
                  ? "Your roster is set"
                  : (clock?.name ?? "Draft position unknown")}
              </strong>
              <small>
                {league.teamCount} TEAMS · SNAKE DRAFT
                {isMock ? " · MOCK STATE" : ""}
              </small>
            </div>
            <div>
              <span>ROUND</span>
              <strong>
                {complete ? "—" : pick.round.toString().padStart(2, "0")}
                <small>
                  {" "}
                  / {Math.round(totalPicks(league) / league.teamCount)}
                </small>
              </strong>
            </div>
            <div>
              <span>OVERALL PICK</span>
              <strong>
                {complete ? "—" : pick.overall.toString().padStart(2, "0")}
              </strong>
            </div>
            <div>
              <span>MY NEXT PICK</span>
              <strong>{analysis.next ?? "—"}</strong>
            </div>
            <div>
              <span>MY PICK IN · SELECTIONS</span>
              <strong className={myClock ? "orange" : ""}>
                {analysis.next === null ? "—" : analysis.next - pick.overall}
              </strong>
            </div>
            <button
              className="undo"
              disabled={!draft.picks.length}
              onClick={() =>
                safe(() => {
                  setDraft(undoPick);
                  setNotice("");
                })
              }
            >
              <RotateCcw size={16} />
              <span>UNDO LAST PICK</span>
            </button>
          </section>
        )}
        {isMock && (
          <section className="mock-controls panel">
            <div>
              <span className="eyebrow">SEPARATE PRACTICE DRAFT</span>
              <p>Try a seat. Read the room. Your real draft stays saved.</p>
            </div>
            <label>
              Practice position
              <select
                aria-label="Mock draft position"
                disabled={draft.picks.length > 0}
                value={state.mockDraft.slot}
                onChange={(e) =>
                  update({
                    ...state,
                    mockDraft: {
                      ...state.mockDraft,
                      slot: Number(e.target.value),
                    },
                  })
                }
              >
                {league.teams.map((_, i) => (
                  <option value={i + 1} key={i}>
                    {i + 1}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Opponent style
              <select
                aria-label="Mock draft style"
                disabled={draft.picks.length > 0}
                value={state.mockDraft.style}
                onChange={(e) =>
                  update({
                    ...state,
                    mockDraft: {
                      ...state.mockDraft,
                      style: e.target.value as MockStyle,
                    },
                  })
                }
              >
                {["STANDARD", "GUARD HEAVY", "BIG HEAVY", "CHAOTIC"].map(
                  (s) => (
                    <option key={s}>{s}</option>
                  ),
                )}
              </select>
            </label>
            <button
              className="primary"
              disabled={myClock || complete}
              onClick={() =>
                safe(() =>
                  update((prev) => ({
                    ...prev,
                    mockDraft: simulateToMyPick(
                      players,
                      prev.leagueSettings,
                      prev.mockDraft,
                    ),
                  })),
                )
              }
            >
              Fast forward to my pick
              <ChevronRight size={18} />
            </button>
            <button onClick={() => reset("MOCK DRAFT")}>Restart mock</button>
            <button onClick={() => setMockBoard(!mockBoard)}>
              {mockBoard ? "War room" : "Practice draft board"}
            </button>
          </section>
        )}
        {(tab === "WAR ROOM" || (isMock && !mockBoard)) && (
          <>
            <div className="mobile-tabs">
              {["BOARD", "PICK", "QUEUE", "ROSTER", "DRAFT"].map((t) => (
                <button
                  key={t}
                  className={mobile === t ? "selected" : ""}
                  onClick={() => setMobile(t)}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className={"war-grid mobile-" + mobile.toLowerCase()}>
              <div className="board-column">{board}</div>
              <div className="intel-column">
                {!complete && hero ? (
                  <>
                    <section className="recommendation-hero">
                      <div className="hero-top">
                        <span>
                          <Target size={15} />
                          RECOMMENDED PICK
                        </span>
                        <span className="model-label">
                          RESEARCH + ROSTER FIT
                        </span>
                      </div>
                      <div className="hero-player">
                        <span className="eyebrow">
                          {hero.player.team} <span> / </span>{" "}
                          {hero.player.eligiblePositions.join(" · ")}
                        </span>
                        <button onClick={() => inspect(hero.player.id)}>
                          <h2>{hero.player.name}</h2>
                        </button>
                        <span className="tier-label">
                          {hero.tier} <span>•</span> {hero.player.risk} RISK
                        </span>
                      </div>
                      <div className="hero-numbers">
                        <div>
                          <span>PROJECTED FP/G</span>
                          <strong>
                            {hero.player.projectedFpg?.toFixed(1) ?? "—"}
                          </strong>
                        </div>
                        <div>
                          <span>RESEARCH RANK</span>
                          <strong>
                            <small>#</small>
                            {hero.player.researchRank}
                          </strong>
                        </div>
                        <div>
                          <span>VALUE</span>
                          <strong className={hero.value >= 7 ? "orange" : ""}>
                            {hero.value > 0 ? "+" : ""}
                            {hero.value}
                          </strong>
                        </div>
                      </div>
                      <div className="take-label">
                        <Zap size={15} />
                        {league.draftSlot === null
                          ? "PRE-DRAFT RESEARCH"
                          : hero.action}
                      </div>
                      <div className="hero-reasons">
                        <h3>THE CASE FOR THIS PICK</h3>
                        {hero.reasons.map((reason) => (
                          <div key={reason.label}>
                            <Check size={14} />
                            <p>{reason.detail}</p>
                          </div>
                        ))}
                      </div>
                      <button
                        className="primary pick-action"
                        onClick={() => requestPick(hero.player.id)}
                      >
                        {myClock ? "MAKE MY PICK" : "RECORD THIS PICK"}
                        <ArrowRight size={18} />
                      </button>
                      <StarterValue
                        value={starterUpgrade(
                          hero.player,
                          analysis.myPlayers,
                          league.roster,
                          draft.slotOverrides,
                        )}
                      />
                      <ScoreBreakdown rec={hero} />
                      <div className="hero-foot">
                        <span>
                          Best available:{" "}
                          <button
                            onClick={() =>
                              inspect(analysis.bestAvailable!.player.id)
                            }
                          >
                            {analysis.bestAvailable?.player.name}
                          </button>
                        </span>
                        <span>Best fit above ↑</span>
                      </div>
                    </section>
                    <section className="panel alternatives">
                      <div className="panel-heading">
                        <h3>ALSO IN PLAY</h3>
                        <span className="muted">Your next best options</span>
                      </div>
                      {analysis.recommendations.slice(1, 5).map((r, i) => (
                        <button
                          className="alternative"
                          key={r.player.id}
                          onClick={() => inspect(r.player.id)}
                        >
                          <span className="alternative-number">0{i + 2}</span>
                          <div>
                            <b>{r.player.name}</b>
                            <small>
                              {r.player.team} ·{" "}
                              {r.player.eligiblePositions.join("/")} · {r.fit}
                            </small>
                            <span className="alternative-reason">
                              {r.reasons.find(
                                (reason) => reason.label === "Last in tier",
                              )?.detail ??
                                r.reasons.find(
                                  (reason) =>
                                    reason.label === "Replacement value",
                                )?.detail ??
                                r.reasons[1]?.detail}
                            </span>
                          </div>
                          <div>
                            <strong>
                              {r.player.projectedFpg?.toFixed(1) ?? "—"}
                            </strong>
                            <small>
                              {r.survival === "LIKELY TO SURVIVE"
                                ? "CAN WAIT"
                                : r.survival === "TOSS-UP"
                                  ? "TOSS-UP"
                                  : "TAKE NOW"}
                            </small>
                          </div>
                          <ChevronRight size={15} />
                        </button>
                      ))}
                    </section>
                    <WhyChanged deltas={deltas} players={players} />
                    <TwoPickPlans paths={plans} onInspect={inspect} />
                  </>
                ) : (
                  <section className="panel quality">
                    <Trophy size={32} />
                    <h2>
                      {complete
                        ? "Draft complete"
                        : "No active recommendations"}
                    </h2>
                    <p>
                      {complete
                        ? "Review your roster, export your draft, or correct selections on the draft board."
                        : "Enable Deep Mode to explore the remaining pool."}
                    </p>
                  </section>
                )}
                {alerts.length > 0 && (
                  <section className="alerts" aria-label="Draft alerts">
                    {alerts.map((alert) => (
                      <div key={alert.title}>
                        <Flag size={15} />
                        <div>
                          <h3>{alert.title}</h3>
                          <p>{alert.detail}</p>
                        </div>
                      </div>
                    ))}
                  </section>
                )}
              </div>
              <aside className="roster-column">
                <PickQueue
                  state={state}
                  draft={draft}
                  players={players}
                  recs={analysis.recommendations}
                  isMock={isMock}
                  onClock={myClock}
                  next={
                    analysis.next === pick.overall
                      ? analysis.following
                      : analysis.next
                  }
                  distance={analysis.distance}
                  onChange={setQueue}
                  onInspect={inspect}
                  onPick={requestPick}
                  onAutoRemove={(value) =>
                    update((prev) => ({ ...prev, autoRemoveQueued: value }))
                  }
                  onClear={() =>
                    setConfirm({
                      title: "Clear pick queue?",
                      detail: "This clears only the current draft queue.",
                      action: () => setQueue([]),
                    })
                  }
                />
                <RiskPanel
                  risk={riskCapacity(analysis.myPlayers, analysis.roster)}
                  candidateHigh={hero?.player.risk === "HIGH"}
                />
                <section className="panel depth-panel">
                  <div className="panel-heading">
                    <h3>POSITION DEPTH</h3>
                    <span className="eyebrow">DRAFT RELEVANT</span>
                  </div>
                  <div className="depth-grid">
                    {analysis.scarcity.map((s) => (
                      <div key={s.position}>
                        <span className={"pos pos-" + s.position}>
                          {s.position}
                        </span>
                        <strong>{s.remaining}</strong>
                        <span className="depth-track">
                          <i
                            style={{
                              width: Math.min(100, s.remaining * 3) + "%",
                            }}
                          />
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="wait-risks">
                    <h3>WAIT RISK</h3>
                    {league.draftSlot === null ? (
                      <p>
                        Enter your draft position to analyze opponents before
                        your turn.
                      </p>
                    ) : (
                      analysis.scarcity.map((s) => (
                        <div key={s.position}>
                          <span>
                            {s.position} <small>{s.demand} teams need</small>
                          </span>
                          <b
                            className={
                              s.waitRisk.includes("HIGH") ? "orange" : ""
                            }
                          >
                            {s.waitRisk}
                          </b>
                        </div>
                      ))
                    )}
                  </div>
                </section>
                {players.some(
                  (p) =>
                    state.personal[p.id]?.watch || state.personal[p.id]?.target,
                ) && (
                  <section className="panel watch-panel">
                    <div className="panel-heading">
                      <h3>WATCHLIST & TARGETS</h3>
                    </div>
                    {players
                      .filter(
                        (p) =>
                          state.personal[p.id]?.watch ||
                          (state.personal[p.id]?.target &&
                            state.personal[p.id]?.target !== "AVOID"),
                      )
                      .slice(0, 6)
                      .map((p) => (
                        <button
                          className="watchlist-row"
                          key={p.id}
                          onClick={() => inspect(p.id)}
                        >
                          <b>{p.name}</b>
                          <span>
                            {draft.picks.some((pick) => pick.playerId === p.id)
                              ? "TAKEN"
                              : (state.personal[p.id]?.target ?? "WATCHING")}
                          </span>
                        </button>
                      ))}
                  </section>
                )}
                <section className="panel my-roster">
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow">YOUR LINEUP</span>
                      <h2>
                        {
                          league.teams.find((t) => t.id === league.myTeamId)
                            ?.name
                        }
                      </h2>
                    </div>
                    <span className="count">
                      {analysis.myPlayers.length}/
                      {totalPicks(league) / league.teamCount}
                    </span>
                  </div>
                  <Roster
                    slots={analysis.roster}
                    onInspect={inspect}
                    onMove={onMove}
                    compact
                  />
                  <div className="roster-bottom">
                    Next after this selection <b>#{nextAfter ?? "—"}</b>
                  </div>
                </section>
              </aside>
              <section className="panel recent-picks">
                <div className="panel-heading">
                  <h3>RECENT PICKS</h3>
                  <button
                    className="text-button"
                    onClick={() =>
                      isMock ? setMockBoard(true) : setTab("DRAFT BOARD")
                    }
                  >
                    View draft board →
                  </button>
                </div>
                <div className="recent-strip">
                  {draft.picks.slice(-6).map((p) => {
                    const player = playerMap.get(p.playerId)!;
                    return (
                      <button
                        key={p.overall}
                        onClick={() => inspect(player.id)}
                      >
                        <span className="rank">{p.overall}</span>
                        <div>
                          <b>{player.name}</b>
                          <small>
                            {player.team} · {player.primaryPosition}
                          </small>
                        </div>
                      </button>
                    );
                  })}
                  {!complete && (
                    <div className="up-next">
                      <span>#{pick.overall}</span>
                      <b>
                        {myClock
                          ? "YOU’RE UP"
                          : (clock?.name ?? "SET YOUR POSITION")}
                      </b>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </>
        )}
        {tab === "BIG BOARD" && board}
        {tab === "MY TEAM" && (
          <TeamView
            state={state}
            draft={draft}
            league={league}
            players={players}
            onInspect={inspect}
            onMove={onMove}
          />
        )}{" "}
        {(tab === "DRAFT BOARD" || (isMock && mockBoard)) && (
          <DraftBoard
            draft={draft}
            league={league}
            players={players}
            onInspect={inspect}
            onCorrect={(n) => {
              setCorrection(n);
              setReplacement("");
              setCorrectionSearch("");
            }}
          />
        )}
        {tab === "SETTINGS" && (
          <>
            <section className="panel settings-section">
              <h3>League eligibility overrides</h3>
              <p>
                {Object.keys(state.eligibilityOverrides).length} overrides.
                Workbook eligibility is preserved.
              </p>
              {Object.keys(state.eligibilityOverrides).map((id) => (
                <div className="override-row" key={id}>
                  <button
                    disabled={!playerMap.has(id)}
                    onClick={() => inspect(id)}
                  >
                    {playerMap.get(id)?.name ?? id}
                  </button>
                  <span>{state.eligibilityOverrides[id].join(" / ")}</span>
                  <button
                    onClick={() =>
                      safe(() => {
                        const overrides = { ...state.eligibilityOverrides };
                        delete overrides[id];
                        update(
                          parseState(
                            { ...state, eligibilityOverrides: overrides },
                            dataset.players as Player[],
                          ),
                        );
                      })
                    }
                  >
                    Reset override
                  </button>
                </div>
              ))}
              <button
                disabled={!Object.keys(state.eligibilityOverrides).length}
                onClick={() =>
                  setConfirm({
                    title: "Reset all eligibility overrides?",
                    detail:
                      "Roster assignments must still fit workbook eligibility.",
                    action: () =>
                      update(
                        parseState(
                          { ...state, eligibilityOverrides: {} },
                          dataset.players as Player[],
                        ),
                      ),
                  })
                }
              >
                Reset all eligibility overrides
              </button>
            </section>
            {Object.keys(state.personal).some((id) => !playerMap.has(id)) && (
              <section className="panel settings-section">
                <h3>Orphan personal data · review</h3>
                {Object.keys(state.personal)
                  .filter((id) => !playerMap.has(id))
                  .map((id) => (
                    <p key={id}>
                      {id}: {JSON.stringify(state.personal[id])}
                    </p>
                  ))}
                <p>
                  Preserved in JSON exports. No automatic identity remapping.
                </p>
              </section>
            )}
            <WorkbookPreview
              players={dataset.players as Player[]}
              locked={state.draftLocked}
            />
            <Settings
              key={JSON.stringify([
                state.leagueSettings,
                state.scoringSettings,
                state.realDraft.picks.length,
                state.mockDraft.picks.length,
              ])}
              state={state}
              onSave={(value) => {
                update(
                  parseState(
                    {
                      ...state,
                      leagueSettings: value.leagueSettings,
                      scoringSettings: value.scoringSettings,
                      setupDone: true,
                    },
                    canonicalPlayers,
                  ),
                );
                setNotice("Settings saved.");
              }}
              onExport={exportBackup}
              onImport={importBackup}
              onReset={reset}
            />
          </>
        )}
        {isMock && draft.picks.length > 0 && (
          <section className="panel mock-summary">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">
                  {complete ? "FINAL PRACTICE REPORT" : "PRACTICE CHECKPOINT"}
                </span>
                <h2>Your mock, in review</h2>
              </div>
              <span>{state.mockDraft.style}</span>
            </div>
            <div className="summary-stats">
              <div>
                <span>AVG PROJECTED FP/G</span>
                <strong>{quality.average?.toFixed(1) ?? "—"}</strong>
              </div>
              <div>
                <span>COVERAGE</span>
                <strong>{quality.coverage}</strong>
              </div>
              <div>
                <span>RISK</span>
                <strong>{quality.availability}</strong>
              </div>
            </div>
            <div className="mock-rounds">
              {draft.picks
                .filter((p) => p.teamId === league.myTeamId)
                .map((p) => {
                  const player = playerMap.get(p.playerId)!;
                  return (
                    <button key={p.overall} onClick={() => inspect(player.id)}>
                      <span>
                        ROUND {snakePick(p.overall, league.teamCount).round} · #
                        {p.overall}
                      </span>
                      <b>{player.name}</b>
                      <small>
                        {valueLabel(
                          p.overall -
                            (state.personal[p.playerId]?.rank ??
                              player.researchRank),
                        )}
                      </small>
                    </button>
                  );
                })}
            </div>
            <p>
              {(() => {
                const mine = draft.picks
                  .filter((p) => p.teamId === league.myTeamId)
                  .map((p) => ({
                    ...p,
                    value:
                      p.overall -
                      (state.personal[p.playerId]?.rank ??
                        playerMap.get(p.playerId)!.researchRank),
                  }))
                  .sort((a, b) => b.value - a.value);
                return mine.length
                  ? "Best value: " +
                      playerMap.get(mine[0].playerId)!.name +
                      " (" +
                      valueLabel(mine[0].value) +
                      "). Biggest reach: " +
                      playerMap.get(mine.at(-1)!.playerId)!.name +
                      " (" +
                      valueLabel(mine.at(-1)!.value) +
                      ")."
                  : "Make your first practice pick.";
              })()}
            </p>
            <p className="muted">
              Missed targets:{" "}
              {draft.picks
                .filter(
                  (p) =>
                    p.teamId !== league.myTeamId &&
                    state.personal[p.playerId]?.target &&
                    state.personal[p.playerId].target !== "AVOID",
                )
                .map((p) => playerMap.get(p.playerId)!.name)
                .join(", ") || "None so far"}
            </p>
          </section>
        )}
        <footer>
          <div>
            <ShieldCheck size={16} />
            <b>PLAYER DATABASE</b>
            <span>{dataset.metadata.playerCount} Players</span>
            <span>Updated Oct. 10, 2026</span>
            <span>Draft: Oct. 13, 2026</span>
          </div>
          <span>
            STATIC RESEARCH DATA <span className="footer-dot">•</span> SAVED ON
            THIS DEVICE
          </span>
        </footer>
      </main>
      {(tab === "WAR ROOM" || (isMock && !mockBoard)) && hero && !complete && (
        <div className="mobile-pick-bar">
          <div>
            <small>
              {myClock ? "YOU’RE ON THE CLOCK" : "RECOMMENDED PICK"}
            </small>
            <b>{hero.player.name}</b>
          </div>
          <button
            className="primary"
            onClick={() => requestPick(hero.player.id)}
          >
            Draft
            <ArrowRight size={16} />
          </button>
        </div>
      )}
      {lab && (
        <Modal title="DRAFT SLOT LAB" wide onClose={() => setLab(null)}>
          <SlotLabResults
            results={lab}
            known={state.leagueSettings.draftSlot}
          />
        </Modal>
      )}
      {recoveryOpen && (
        <Recovery
          state={state}
          players={players}
          onClose={() => setRecoveryOpen(false)}
          onRestore={(value, kind) => {
            if (readOnly)
              throw Error("Take control before restoring a checkpoint.");
            if (state.draftLocked)
              throw Error("Unlock settings before restoring a checkpoint.");
            update(parseState(value, canonicalPlayers), {
              kind,
              action: "Restored recovery checkpoint",
            });
            setNotice(
              "Checkpoint restored. A new recovery checkpoint was created.",
            );
          }}
        />
      )}
      {detail && (
        <PlayerDetail
          player={playerMap.get(detail)!}
          personal={state.personal[detail] ?? {}}
          recommendation={analysis.recommendations.find(
            (r) => r.player.id === detail,
          )}
          taken={
            draft.picks.some((p) => p.playerId === detail)
              ? "Drafted to " +
                league.teams.find(
                  (t) =>
                    t.id ===
                    draft.picks.find((p) => p.playerId === detail)?.teamId,
                )?.name
              : null
          }
          onClose={() => setDetail(null)}
          onChange={(patch) => personal(detail, patch)}
          onPick={() => requestPick(detail)}
          onCompare={() => addCompare(detail)}
          starterValue={starterUpgrade(
            playerMap.get(detail)!,
            analysis.myPlayers.filter((p) => p.id !== detail),
            league.roster,
            draft.slotOverrides,
          )}
          workbookPlayer={(dataset.players as Player[]).find(
            (p) => p.id === detail,
          )!}
          onEligibility={(positions) =>
            safe(() => {
              const overrides = { ...state.eligibilityOverrides };
              if (positions) overrides[detail] = positions;
              else delete overrides[detail];
              const next = { ...state, eligibilityOverrides: overrides };
              update(parseState(next, dataset.players as Player[]));
            })
          }
          queued={state.queues[queueKey].includes(detail)}
          onQueue={() =>
            safe(() =>
              setQueue(
                state.queues[queueKey].includes(detail)
                  ? state.queues[queueKey].filter((id) => id !== detail)
                  : addQueue(state.queues[queueKey], detail),
              ),
            )
          }
        />
      )}
      {pendingPick && (
        <Modal title="CONFIRM SELECTION" onClose={() => setPendingPick(null)}>
          <div className="confirm-pick">
            <span className="eyebrow">
              {isMock ? "MOCK DRAFT" : "REAL DRAFT"} · ROUND {pick.round} · PICK{" "}
              {pick.pick}
            </span>
            <h2>{playerMap.get(pendingPick)?.name}</h2>
            <p>
              Draft to <strong>{clock?.name}</strong>?
            </p>
            {myClock && playerMap.get(pendingPick)?.risk === "HIGH" && (
              <RiskPanel
                risk={riskCapacity(analysis.myPlayers, analysis.roster)}
                candidateHigh
              />
            )}
            <p className="muted">
              Overall selection #{pick.overall}. This advances the snake draft.
            </p>
          </div>
          <div className="modal-actions">
            <button onClick={() => setPendingPick(null)}>Cancel</button>
            <button
              autoFocus
              data-autofocus
              className="primary"
              onClick={() =>
                safe(() => {
                  setDraft((d) => recordPick(d, league, pendingPick, players));
                  setPendingPick(null);
                  setNotice("");
                })
              }
            >
              Confirm draft pick
              <Check size={18} />
            </button>
          </div>
        </Modal>
      )}
      {correction !== null && (
        <Modal
          title={"CORRECT PICK #" + correction}
          onClose={() => setCorrection(null)}
        >
          <p>
            Recorded:{" "}
            <strong>
              {
                playerMap.get(
                  draft.picks.find((p) => p.overall === correction)!.playerId,
                )?.name
              }
            </strong>
            . Team assignment stays fixed.
          </p>
          <label>
            Find replacement
            <input
              autoFocus
              aria-label="Search replacement"
              value={correctionSearch}
              onChange={(e) => setCorrectionSearch(e.target.value)}
              placeholder="Player name"
            />
          </label>
          <div className="correction-results">
            {players
              .filter(
                (p) =>
                  p.name
                    .toLowerCase()
                    .includes(correctionSearch.toLowerCase()) &&
                  !draft.picks.some(
                    (pick) =>
                      pick.playerId === p.id && pick.overall !== correction,
                  ),
              )
              .slice(0, 20)
              .map((p) => (
                <button
                  className={replacement === p.id ? "selected" : ""}
                  key={p.id}
                  onClick={() => setReplacement(p.id)}
                >
                  #{p.researchRank} {p.name}
                  <span>
                    {p.team} · {p.primaryPosition}
                  </span>
                </button>
              ))}
          </div>
          <div className="modal-actions">
            <button onClick={() => setCorrection(null)}>Cancel</button>
            <button
              className="primary"
              disabled={!replacement}
              onClick={() =>
                safe(() => {
                  setDraft((d) =>
                    correctPick(d, correction, replacement, players, league),
                  );
                  setCorrection(null);
                  setNotice("Pick corrected; draft analysis recalculated.");
                })
              }
            >
              Confirm correction
            </button>
          </div>
        </Modal>
      )}
      {compareOpen && (
        <Compare
          players={comparison.map((id) => playerMap.get(id)!)}
          recommendations={analysis.recommendations}
          personal={state.personal}
          scarcity={analysis.scarcity}
          onClose={() => setCompareOpen(false)}
          onRemove={(id) => setComparison(comparison.filter((p) => p !== id))}
        />
      )}
      {setup && (
        <Modal
          title="WELCOME TO YOUR DRAFT ROOM"
          wide
          onClose={() => {
            setSetup(false);
            update((prev) => ({ ...prev, setupDone: true }));
          }}
        >
          <Settings
            wizard
            state={state}
            onSave={(value) => update(parseState(value, canonicalPlayers))}
            onClose={() => {
              setSetup(false);
              update((prev) => ({ ...prev, setupDone: true }));
            }}
            onExport={exportBackup}
            onImport={importBackup}
            onReset={reset}
          />
        </Modal>
      )}
      {confirm && (
        <Modal title={confirm.title} onClose={() => setConfirm(null)}>
          <p>{confirm.detail}</p>
          {confirm.requireReset && (
            <label>
              Type RESET to replace real draft data
              <input
                aria-label="Type RESET"
                autoComplete="off"
                value={confirmationText}
                onChange={(e) => setConfirmationText(e.target.value)}
              />
            </label>
          )}
          <div className="modal-actions">
            <button onClick={() => setConfirm(null)}>Cancel</button>
            <button
              className="primary"
              disabled={Boolean(
                confirm.requireReset && confirmationText !== "RESET",
              )}
              onClick={() =>
                safe(() => {
                  confirm.action();
                  setConfirm(null);
                })
              }
            >
              Confirm
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
