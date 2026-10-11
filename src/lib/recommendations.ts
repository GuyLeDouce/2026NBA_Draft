import {
  POSITIONS,
  type Player,
  type LeagueSettings,
  type DraftState,
  type PersonalPlayer,
  type Recommendation,
  type PositionScarcity,
  type Position,
  type DraftAlert,
} from "../types";
import {
  WEIGHTS as W,
  THRESHOLDS as T,
  TIER_BOUNDS,
} from "./recommendationWeights";
import { assignRoster, eligible, rosterNeeds, teamPlayers } from "./roster";
import { nextPick, orderedTeams, snakePick, totalPicks } from "./draft";
export const fantasyRelevant = (p: Player) =>
  p.projectedFpg !== null &&
  p.dataConfidence !== "LOW" &&
  p.poolTier !== "WATCH" &&
  p.poolTier !== "VERY_DEEP" &&
  p.risk !== "WATCH";
export const tierNumber = (p: Player) =>
  TIER_BOUNDS.findIndex((limit) => p.researchRank <= limit) + 1;
export const tierLabel = (p: Player) =>
  p.poolTier === "WATCH"
    ? "WATCH"
    : (p.poolTier ?? "RESEARCH") + " · T" + tierNumber(p);
export function valueLabel(value: number) {
  return value >= T.stealValue
    ? "STEAL +" + value
    : value >= T.meaningfulValue
      ? "VALUE +" + value
      : value <= -T.meaningfulValue
        ? "REACH " + value
        : "FAIR";
}
export function replacementLevels(
  players: Player[],
  league: LeagueSettings,
): Record<Position, number | null> {
  const relevant = players
    .filter(fantasyRelevant)
    .sort((a, b) => a.researchRank - b.researchRank);
  const pool = relevant.slice(
    0,
    league.teamCount * league.roster.slots.filter((s) => s !== "IR").length,
  );
  const slots = {
    slots: Array.from({ length: league.teamCount }, () =>
      league.roster.slots.filter((s) => s !== "IR"),
    ).flat(),
  };
  const starters = assignRoster(pool, slots);
  const assigned = new Set(
    starters.flatMap((s) => (s.player ? [s.player.id] : [])),
  );
  return Object.fromEntries(
    POSITIONS.map((pos) => {
      const candidates = relevant
        .filter((p) => !assigned.has(p.id) && p.eligiblePositions.includes(pos))
        .slice(0, 3);
      return [
        pos,
        candidates.length
          ? candidates.reduce((s, p) => s + p.projectedFpg!, 0) /
            candidates.length
          : null,
      ];
    }),
  ) as Record<Position, number | null>;
}
export function analyzeDraft(
  players: Player[],
  league: LeagueSettings,
  draft: DraftState,
  personal: Record<string, PersonalPlayer>,
  deepMode = false,
) {
  const overall = draft.picks.length + 1;
  const available = players.filter(
    (p) => !draft.picks.some((pick) => pick.playerId === p.id),
  );
  const myPlayers = teamPlayers(draft, league.myTeamId, players);
  const roster = assignRoster(myPlayers, league.roster, draft.slotOverrides);
  const needs = rosterNeeds(roster);
  const next = nextPick(
    overall,
    league.draftSlot,
    league.teamCount,
    totalPicks(league),
  );
  const following =
    next === null
      ? null
      : nextPick(
          next + 1,
          league.draftSlot,
          league.teamCount,
          totalPicks(league),
        );
  const horizon = next === overall ? following : next;
  const distance = horizon === null ? null : Math.max(0, horizon - overall);
  const teams = orderedTeams(league);
  const needsByTeam = new Map(
    teams.map((team) => [
      team.id,
      rosterNeeds(
        assignRoster(
          teamPlayers(draft, team.id, players),
          league.roster,
          draft.slotOverrides,
        ),
      ),
    ]),
  );
  const intervening = new Set<string>();
  if (horizon !== null)
    for (let n = overall; n < horizon; n++) {
      const id = teams[snakePick(n, league.teamCount).slot - 1].id;
      if (id !== league.myTeamId) intervening.add(id);
    }
  const relevant = available.filter(fantasyRelevant);
  const depthPool = relevant.filter(
    (p) =>
      p.researchRank <=
      Math.max(
        league.teamCount * league.roster.slots.filter((s) => s !== "IR").length,
        overall + T.scarcityHorizon,
      ),
  );
  const replacement = replacementLevels(players, league);
  const scarcity: PositionScarcity[] = POSITIONS.map((position) => {
    const remaining = depthPool.filter((p) =>
      p.eligiblePositions.includes(position),
    ).length;
    const demand = [...intervening].filter((id) =>
      needsByTeam.get(id)?.includes(position),
    ).length;
    return {
      position,
      remaining,
      replacement: replacement[position],
      demand,
      waitRisk:
        demand >= T.demandVeryHigh && remaining <= demand + T.thinDepth
          ? "VERY HIGH"
          : demand >= T.demandHigh && remaining <= demand + T.thinDepth
            ? "HIGH"
            : demand >= 1
              ? "MEDIUM"
              : "LOW",
    };
  });
  const recent = draft.picks
    .slice(-T.runWindow)
    .map((pick) => players.find((p) => p.id === pick.playerId)!);
  const runs = POSITIONS.map((position) => ({
    position,
    count: recent.filter((p) => p.primaryPosition === position).length,
  })).filter((r) => r.count >= T.runCount);
  const highRisks = myPlayers.filter((p) => p.risk === "HIGH").length;
  const early = snakePick(overall, league.teamCount).round <= T.earlyRounds;
  const recommendations: Recommendation[] = available
    .filter(
      (p) =>
        (deepMode
          ? p.projectedFpg !== null && p.risk !== "WATCH"
          : fantasyRelevant(p)) &&
        (roster.some(
          (s) => !s.player && s.type !== "IR" && eligible(p, s.type),
        ) ||
          assignRoster(
            [...myPlayers, p],
            league.roster,
            draft.slotOverrides,
          ).filter((s) => s.player).length ===
            myPlayers.length + 1),
    )
    .map<Recommendation>((player) => {
      const baseRank = personal[player.id]?.rank ?? player.researchRank;
      const positionStats = scarcity.filter((s) =>
        player.eligiblePositions.includes(s.position),
      );
      const bestPosition = [...positionStats].sort(
        (a, b) => b.demand - a.demand || a.remaining - b.remaining,
      )[0];
      const fits = player.eligiblePositions.some((pos) => needs.includes(pos));
      const openUseful = roster.some(
        (s) => !s.player && s.type !== "IR" && s.type !== "BN",
      );
      const baselines = player.eligiblePositions
        .map((p) => replacement[p])
        .filter((x): x is number => x !== null);
      const vor =
        player.projectedFpg !== null && baselines.length
          ? player.projectedFpg - Math.min(...baselines)
          : null;
      const tier = tierNumber(player);
      const peers = relevant.filter(
        (p) =>
          p.id !== player.id &&
          p.eligiblePositions.some((pos) =>
            player.eligiblePositions.includes(pos),
          ) &&
          tierNumber(p) === tier,
      );
      const nextTier = relevant
        .filter(
          (p) =>
            tierNumber(p) > tier &&
            p.eligiblePositions.some((pos) =>
              player.eligiblePositions.includes(pos),
            ),
        )
        .sort((a, b) => a.researchRank - b.researchRank)[0];
      const drop =
        player.projectedFpg !== null &&
        nextTier?.projectedFpg !== null &&
        nextTier?.projectedFpg !== undefined
          ? player.projectedFpg - nextTier.projectedFpg
          : 0;
      const last = peers.length === 0 && drop >= T.tierGap;
      const run = runs.some((r) =>
        player.eligiblePositions.includes(r.position),
      );
      const thin = bestPosition.remaining <= T.thinDepth;
      const ahead = available.filter(
        (p) => (personal[p.id]?.rank ?? p.researchRank) < baseRank,
      ).length;
      const pressure =
        (bestPosition.demand >= T.demandHigh ? 2 : 0) +
        (thin ? 2 : 0) +
        (last ? 1 : 0) +
        (run ? 1 : 0);
      const survival =
        distance === null
          ? "TOSS-UP"
          : ahead + 2 < distance + pressure
            ? "UNLIKELY TO SURVIVE"
            : ahead > distance + pressure + 4
              ? "LIKELY TO SURVIVE"
              : "TOSS-UP";
      const context = [
        {
          label: "VOR",
          value:
            vor === null
              ? 0
              : Math.max(-W.vorCap, Math.min(W.vorCap, vor * W.vor)),
        },
        {
          label: "Roster fit",
          value: fits ? (early ? W.needEarly : W.needLate) : 0,
        },
        {
          label: "Flexibility",
          value: (player.eligiblePositions.length - 1) * W.flex,
        },
        { label: "Position scarcity", value: thin ? W.scarcity : 0 },
        { label: "Tier drop", value: last ? W.tierDrop : 0 },
        {
          label: "Opponent demand",
          value: Math.min(3, bestPosition.demand * W.demand),
        },
        { label: "Position run", value: run && thin ? W.run : 0 },
        {
          label: "Upside",
          value: Math.min(
            2,
            Math.max(
              0,
              (player.projectedHigh ?? 0) - (player.projectedFpg ?? 0),
            ) * W.upside,
          ),
        },
        {
          label: "Availability risk",
          value:
            player.risk === "HIGH"
              ? -W.highRisk
              : player.risk === "MEDIUM"
                ? -W.mediumRisk
                : 0,
        },
        {
          label: "Cumulative roster risk",
          value:
            player.risk === "HIGH" && highRisks >= T.highRiskExposure
              ? -W.cumulativeRisk
              : 0,
        },
        {
          label: "Priority target",
          value: personal[player.id]?.target === "PRIORITY" ? W.priority : 0,
        },
      ];
      const raw = context.reduce((sum, f) => sum + f.value, 0);
      const cap = early ? W.contextCapEarly : W.contextCapLate;
      const capped = Math.max(-cap, Math.min(cap, raw));
      const breakdown = [
        { label: "Research value", value: 700 - player.researchRank },
        {
          label: "Personal rank adjustment",
          value: player.researchRank - baseRank,
        },
        ...context,
        { label: "Context cap adjustment", value: capped - raw },
        {
          label: "Avoid target",
          value: personal[player.id]?.target === "AVOID" ? -W.avoid : 0,
        },
        {
          label: "Deep confidence penalty",
          value: fantasyRelevant(player) ? 0 : -W.deepPenalty,
        },
      ];
      const score = breakdown.reduce((sum, f) => sum + f.value, 0);
      const reasons = [
        {
          label: "Research value",
          detail:
            "Research #" +
            player.researchRank +
            (personal[player.id]?.rank ? " · Personal #" + baseRank : "") +
            ". " +
            (player.draftRationale?.split(". ")[0] ??
              "Workbook judgment anchors this recommendation."),
        },
        {
          label: "Roster fit",
          detail: fits
            ? "Fills an open " +
              player.eligiblePositions
                .filter((p) => needs.includes(p))
                .join("/") +
              " path."
            : openUseful
              ? "Adds quality through an open utility or flex path."
              : "Adds bench depth; primary positions are covered.",
        },
      ];
      if (last)
        reasons.push({
          label: "Last in tier",
          detail:
            "Last comparable T" +
            tier +
            " option; next tier is about " +
            drop.toFixed(1) +
            " FP/G lower.",
        });
      else if (vor !== null)
        reasons.push({
          label: "Replacement value",
          detail:
            (vor >= 0 ? "+" : "") +
            vor.toFixed(1) +
            " FP/G versus the best eligible replacement baseline.",
        });
      if (distance !== null)
        reasons.push({
          label: "Wait risk",
          detail:
            bestPosition.demand +
            " opponent teams before your next turn need " +
            bestPosition.position +
            ". " +
            survival.toLowerCase() +
            ".",
        });
      if (player.risk === "HIGH")
        reasons.push({
          label: "Availability",
          detail:
            highRisks >= T.highRiskExposure
              ? "This would become your " +
                (highRisks === 2 ? "third" : highRisks + 1 + "th") +
                " major availability risk."
              : "Your roster can absorb this risk, but review the workbook rationale.",
        });
      if (player.projectedFpg === null)
        reasons.push({
          label: "No forecast",
          detail: "No reliable projection. Deep research only.",
        });
      return {
        player,
        score,
        breakdown,
        dynamicRank: 0,
        baseRank,
        value: overall - baseRank,
        vor,
        survival,
        action:
          distance === null
            ? "WAITING IS RISKY"
            : survival === "LIKELY TO SURVIVE"
              ? "CAN PROBABLY WAIT"
              : survival === "UNLIKELY TO SURVIVE"
                ? "TAKE NOW"
                : "WAITING IS RISKY",
        reasons: reasons.slice(0, 5),
        fit: fits
          ? "Position need"
          : openUseful
            ? "Flex / utility"
            : "Bench depth",
        tier: tierLabel(player),
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score || a.player.researchRank - b.player.researchRank,
    )
    .map((r, i) => ({ ...r, dynamicRank: i + 1 }));
  const alerts: DraftAlert[] = [];
  for (const run of runs) {
    const remaining = scarcity.find(
      (s) => s.position === run.position,
    )!.remaining;
    alerts.push({
      title:
        run.position +
        " RUN · " +
        (remaining <= T.thinDepth ? "REACT" : "DO NOT CHASE"),
      detail:
        run.count +
        " of the last " +
        recent.length +
        " picks. " +
        remaining +
        " draft-relevant options remain.",
    });
  }
  const slide = recommendations
    .filter((r) => r.value >= T.stealValue)
    .sort((a, b) => b.value - a.value)[0];
  if (slide)
    alerts.push({
      title: "VALUE DROP",
      detail:
        slide.player.name +
        " has fallen " +
        slide.value +
        " places beyond your base rank.",
    });
  const tierBreak = recommendations
    .slice(0, 5)
    .find((r) => r.reasons.some((reason) => reason.label === "Last in tier"));
  if (tierBreak)
    alerts.push({
      title: "TIER BREAK",
      detail:
        tierBreak.player.name +
        " is the last comparable option in " +
        tierBreak.tier +
        ".",
    });
  const watched = recommendations.find(
    (r) =>
      personal[r.player.id]?.watch && r.baseRank <= overall + (distance ?? 10),
  );
  if (watched)
    alerts.push({
      title: "WATCHLIST RANGE",
      detail: watched.player.name + " is in range. " + watched.survival + ".",
    });
  if (highRisks >= T.highRiskExposure)
    alerts.push({
      title: "ROSTER RISK",
      detail:
        highRisks +
        " high-risk players already drafted. Additional exposure gets a modest penalty.",
    });
  const bestAvailable =
    [...recommendations].sort((a, b) => a.baseRank - b.baseRank)[0] ?? null;
  return {
    currentOverall: overall,
    recommendations,
    bestAvailable,
    scarcity,
    alerts: alerts.slice(0, 3),
    roster,
    myPlayers,
    needs,
    next,
    following,
    distance,
    intervening: [...intervening],
    needsByTeam,
    runs,
  };
}
export function twoPickPlan(analysis: ReturnType<typeof analyzeDraft>) {
  if (
    analysis.following === null ||
    analysis.next === null ||
    analysis.following - analysis.next > T.twoPickDistance
  )
    return null;
  const options = analysis.recommendations.slice(0, 5);
  let best: null | {
    take: Recommendation;
    target: Recommendation;
    fallbacks: Recommendation[];
    next: number;
    score: number;
  } = null;
  for (const take of options) {
    const later = analysis.recommendations
      .filter(
        (r) =>
          r.player.id !== take.player.id &&
          r.survival !== "UNLIKELY TO SURVIVE" &&
          analysis.recommendations.filter(
            (other) => other.baseRank < r.baseRank,
          ).length >=
            analysis.following! - analysis.currentOverall - 3,
      )
      .slice(0, 20)
      .sort((a, b) => {
        const fit = (r: Recommendation) =>
          r.player.eligiblePositions.some(
            (p) =>
              analysis.needs.includes(p) &&
              !take.player.eligiblePositions.includes(p),
          )
            ? 4
            : 0;
        return b.score + fit(b) - (a.score + fit(a));
      });
    if (!later.length) continue;
    const score = take.score + later[0].score;
    if (!best || score > best.score)
      best = {
        take,
        target: later[0],
        fallbacks: later.slice(1, 3),
        next: analysis.following,
        score,
      };
  }
  return best;
}
