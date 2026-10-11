import type { AppState, DraftState, MockDraftState } from "../types";
export type RecoveryKind = "real" | "mock";
export interface RecoveryCheckpoint {
  id: string;
  timestamp: number;
  kind: RecoveryKind;
  action: string;
  pick: number;
  major: boolean;
  scope: Pick<
    AppState,
    "leagueSettings" | "scoringSettings" | "eligibilityOverrides"
  > & { draft: DraftState | MockDraftState; queue: string[] };
}
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
export function recoveryAction(
  before: AppState,
  after: AppState,
): { kind: RecoveryKind; action: string; major: boolean } | null {
  for (const kind of ["real", "mock"] as const) {
    const a = before[kind === "real" ? "realDraft" : "mockDraft"],
      b = after[kind === "real" ? "realDraft" : "mockDraft"];
    if (!same(a, b)) {
      const changed = b.picks.find(
        (p, i) => a.picks[i]?.playerId !== p.playerId,
      );
      return {
        kind,
        major: true,
        action:
          b.picks.length > a.picks.length
            ? "Drafted " +
              b.picks.at(-1)!.playerId +
              " to " +
              b.picks.at(-1)!.teamId
            : b.picks.length < a.picks.length
              ? "Undo / reset to pick " + (b.picks.length + 1)
              : changed
                ? "Corrected pick " +
                  changed.overall +
                  " to " +
                  changed.playerId
                : "Roster / practice setup changed",
      };
    }
  }
  if (
    !same(before.leagueSettings, after.leagueSettings) ||
    !same(before.scoringSettings, after.scoringSettings)
  )
    return {
      kind: "real",
      action: "League / scoring configuration changed",
      major: true,
    };
  if (!same(before.eligibilityOverrides, after.eligibilityOverrides))
    return { kind: "real", action: "League eligibility changed", major: true };
  if (!same(before.queues, after.queues))
    return {
      kind: same(before.queues.real, after.queues.real) ? "mock" : "real",
      action: "Pick queue updated",
      major: false,
    };
  if (!same(before.personal, after.personal))
    return {
      kind: "real",
      action: "Scouting notes / rankings / targets updated",
      major: false,
    };
  if (before.draftLocked !== after.draftLocked)
    return {
      kind: "real",
      action: after.draftLocked ? "Live draft locked" : "Settings unlocked",
      major: false,
    };
  return null;
}
export function checkpoint(
  state: AppState,
  kind: RecoveryKind,
  action: string,
  major = true,
  timestamp = Date.now(),
): RecoveryCheckpoint {
  const draft = kind === "real" ? state.realDraft : state.mockDraft;
  return {
    id: timestamp + "-" + crypto.randomUUID(),
    timestamp,
    kind,
    action,
    major,
    pick: draft.picks.length + 1,
    scope: structuredClone({
      leagueSettings: state.leagueSettings,
      scoringSettings: state.scoringSettings,
      eligibilityOverrides: state.eligibilityOverrides,
      draft,
      queue: state.queues[kind],
    }),
  };
}
export function restoreCheckpoint(
  state: AppState,
  saved: RecoveryCheckpoint,
): AppState {
  return {
    ...state,
    leagueSettings: saved.scope.leagueSettings,
    scoringSettings: saved.scope.scoringSettings,
    eligibilityOverrides: saved.scope.eligibilityOverrides,
    [saved.kind === "real" ? "realDraft" : "mockDraft"]: saved.scope.draft,
    queues: { ...state.queues, [saved.kind]: saved.scope.queue },
  };
}
export function retainedCheckpoints(items: RecoveryCheckpoint[]) {
  const sorted = [...items].sort(
    (a, b) => b.timestamp - a.timestamp || b.id.localeCompare(a.id),
  );
  const counts = { realMajor: 0, realMinor: 0, mockMajor: 0, mockMinor: 0 };
  return sorted.filter((c) => {
    const key = (c.kind + (c.major ? "Major" : "Minor")) as keyof typeof counts;
    return (
      ++counts[key] <=
      { realMajor: 800, realMinor: 40, mockMajor: 80, mockMinor: 15 }[key]
    );
  });
}
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("nba-draft-recovery", 1);
    req.onupgradeneeded = () =>
      req.result.createObjectStore("checkpoints", { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export async function listCheckpoints(): Promise<RecoveryCheckpoint[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("checkpoints", "readonly");
    const req = tx.objectStore("checkpoints").getAll();
    req.onsuccess = () =>
      resolve(
        (req.result as RecoveryCheckpoint[]).sort(
          (a, b) => b.timestamp - a.timestamp,
        ),
      );
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}
export async function saveCheckpoint(item: RecoveryCheckpoint) {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("checkpoints", "readwrite");
    const store = tx.objectStore("checkpoints");
    store.put(item);
    const req = store.getAll();
    req.onsuccess = () => {
      const all = req.result as RecoveryCheckpoint[];
      const keep = new Set(retainedCheckpoints(all).map((x) => x.id));
      all.filter((x) => !keep.has(x.id)).forEach((x) => store.delete(x.id));
    };
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error);
    };
  });
}
