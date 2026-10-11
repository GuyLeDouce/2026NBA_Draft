import type { AppState } from "../types";
export function lockedChange(before: AppState, after: AppState) {
  if (!before.draftLocked) return false;
  const changed = (a: unknown, b: unknown) =>
    JSON.stringify(a) !== JSON.stringify(b);
  return (
    changed(before.leagueSettings, after.leagueSettings) ||
    changed(before.scoringSettings, after.scoringSettings) ||
    (before.realDraft.picks.length > 1 && after.realDraft.picks.length === 0) ||
    before.realDraft.picks.length - after.realDraft.picks.length > 1
  );
}
export interface TabLease {
  id: string;
  expires: number;
}
export const LEASE_KEY = "nba-draft-assistant:writer";
export function ownsLease(lease: TabLease | null, id: string, now: number) {
  return lease?.id === id && lease.expires > now;
}
export function readLease(): TabLease | null {
  try {
    return JSON.parse(localStorage.getItem(LEASE_KEY) ?? "null");
  } catch {
    return null;
  }
}
