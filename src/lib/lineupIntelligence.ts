import type { Player, RosterSettings, RosterSlot, SlotType } from "../types";
import { eligible } from "./roster";
export interface RiskCapacity {
  capacity: number;
  occupied: number;
  highRisk: number;
  stash: number;
  exposure:
    "LOW EXPOSURE" | "MODERATE EXPOSURE" | "HIGH EXPOSURE" | "OVERLOADED";
  benchBurden: number;
}
export function riskCapacity(
  players: Player[],
  slots: RosterSlot[],
): RiskCapacity {
  const capacity = slots.filter((s) => s.type === "IR").length,
    occupied = slots.filter((s) => s.type === "IR" && s.player).length;
  const highRisk = players.filter((p) => p.risk === "HIGH").length;
  const stash = players.filter(
    (p) => p.planningGames !== null && p.planningGames < 45,
  ).length;
  return {
    capacity,
    occupied,
    highRisk,
    stash,
    benchBurden: Math.max(0, highRisk - capacity),
    exposure:
      highRisk > capacity
        ? "OVERLOADED"
        : highRisk === 0
          ? "LOW EXPOSURE"
          : highRisk === capacity
            ? "HIGH EXPOSURE"
            : "MODERATE EXPOSURE",
  };
}
export function optimizeActive(
  players: Player[],
  settings: RosterSettings,
): RosterSlot[] {
  const slots = settings.slots
    .map((type, i) => ({
      type,
      id: type + "-" + i,
      player: null as Player | null,
    }))
    .filter((s) => s.type !== "IR" && s.type !== "BN");
  const priority = (t: SlotType) =>
    t === "UTIL" ? 2 : t === "G" || t === "F" ? 1 : 0;
  const order = [...slots].sort((a, b) => priority(a.type) - priority(b.type));
  const sorted = [...players]
    .filter((p) => p.projectedFpg !== null)
    .sort(
      (a, b) =>
        b.projectedFpg! - a.projectedFpg! || a.researchRank - b.researchRank,
    );
  function place(player: Player, visited: Set<string>): boolean {
    const free = order.find((s) => !s.player && eligible(player, s.type));
    if (free) {
      free.player = player;
      return true;
    }
    for (const slot of order) {
      if (visited.has(slot.id) || !eligible(player, slot.type)) continue;
      visited.add(slot.id);
      if (slot.player && place(slot.player, visited)) {
        slot.player = player;
        return true;
      }
    }
    return false;
  }
  for (const p of sorted) place(p, new Set());
  return slots;
}
export interface StarterUpgrade {
  classification:
    | "STARTER UPGRADE"
    | "STARTER DEPTH"
    | "BENCH VALUE"
    | "UPSIDE STASH"
    | "IR STASH";
  slot: string;
  upgrade: number | null;
  replaces: Player | null;
  unknown: number;
}
export function starterUpgrade(
  candidate: Player,
  owned: Player[],
  settings: RosterSettings,
  overrides: Record<string, string> = {},
): StarterUpgrade {
  const active = owned.filter((p) => !overrides[p.id]?.startsWith("IR-"));
  const before = optimizeActive(active, settings),
    after = optimizeActive([...active, candidate], settings);
  const inserted = after.find((s) => s.player?.id === candidate.id);
  const ids = new Set(after.flatMap((s) => (s.player ? [s.player.id] : [])));
  const replaced =
    before.find((s) => s.player && !ids.has(s.player.id))?.player ?? null;
  const sum = (slots: RosterSlot[]) =>
    slots.reduce((total, s) => total + (s.player?.projectedFpg ?? 0), 0);
  const unknown = active.filter((p) => p.projectedFpg === null).length;
  const stash =
    candidate.planningGames !== null && candidate.planningGames < 45;
  const upgrade =
    inserted && replaced && !unknown && candidate.projectedFpg !== null
      ? sum(after) - sum(before)
      : null;
  return {
    classification: stash
      ? candidate.risk === "HIGH"
        ? "IR STASH"
        : "UPSIDE STASH"
      : inserted
        ? replaced && upgrade !== null && upgrade > 0.05
          ? "STARTER UPGRADE"
          : "STARTER DEPTH"
        : candidate.projectedHigh !== null &&
            candidate.projectedFpg !== null &&
            candidate.projectedHigh - candidate.projectedFpg >= 5
          ? "UPSIDE STASH"
          : "BENCH VALUE",
    slot: inserted?.type ?? "BN",
    upgrade,
    replaces: replaced,
    unknown,
  };
}
