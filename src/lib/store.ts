"use client";
import { useSyncExternalStore } from "react";
import type { AppState, Player } from "../types";
import { defaultState } from "./defaults";
import { importState, STORAGE_KEY } from "./storage";
import { checkpoint, recoveryAction, saveCheckpoint } from "./recovery";
import { lockedChange } from "./draftGuard";
import { canWrite, startTabControl, takeControl } from "./tabControl";
let current: AppState | null = null;
let message = "",
  checkpointStatus = "LOCAL SAVE READY";
const listeners = new Set<() => void>();
let bound = false;
let recoveryRequired = false;
let checkpointChain = Promise.resolve();
function notify() {
  if (current) current = { ...current };
  listeners.forEach((l) => l());
}
export function useDraftStore(players: Player[]) {
  function getSnapshot() {
    if (!current) {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        current = saved ? importState(saved, players) : defaultState();
      } catch {
        recoveryRequired = true;
        current = defaultState();
        message =
          "Saved data could not be read. Original browser data has not been overwritten. Export / recover a valid backup before making changes.";
      }
    }
    return current;
  }
  function subscribe(listener: () => void) {
    listeners.add(listener);
    if (!bound) {
      bound = true;
      startTabControl(() => {
        if (canWrite()) {
          try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
              current = importState(saved, players);
              recoveryRequired = false;
            }
          } catch {
            message =
              "Saved state could not be synchronized. Export before proceeding.";
          }
        }
        notify();
      });
      window.addEventListener("storage", (event) => {
        if (event.key === STORAGE_KEY && event.newValue) {
          try {
            current = importState(event.newValue, players);
            recoveryRequired = false;
            message = "State synchronized from the controlling tab.";
            notify();
          } catch {
            message = "Invalid update from another tab ignored.";
            notify();
          }
        }
      });
    }
    return () => {
      listeners.delete(listener);
    };
  }
  const state = useSyncExternalStore(subscribe, getSnapshot, () => null);
  const update = (
    next: AppState | ((prev: AppState) => AppState),
    checkpointAction?: { kind: "real" | "mock"; action: string },
  ) => {
    if (!canWrite()) {
      message =
        "DRAFT ACTIVE IN ANOTHER TAB. Take control before making changes.";
      notify();
      return;
    }
    if (recoveryRequired && !checkpointAction) {
      message =
        "Saved state needs recovery. Import a valid JSON backup or restore a checkpoint before saving changes. The original localStorage record is protected.";
      notify();
      return;
    }
    const before = getSnapshot();
    let after = typeof next === "function" ? next(before) : next;
    if (lockedChange(before, after)) {
      message =
        "LIVE DRAFT LOCKED. Unlock settings before changing configuration or restoring a different draft configuration.";
      notify();
      return;
    }
    if (after.autoRemoveQueued)
      after = {
        ...after,
        queues: {
          real: after.queues.real.filter(
            (id) => !after.realDraft.picks.some((p) => p.playerId === id),
          ),
          mock: after.queues.mock.filter(
            (id) => !after.mockDraft.picks.some((p) => p.playerId === id),
          ),
        },
      };
    if (!canWrite()) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(after));
      recoveryRequired = false;
      message = "";
    } catch {
      message = "Browser storage unavailable. Export your draft now.";
    }
    current = after;
    const action = checkpointAction
      ? { ...checkpointAction, major: true }
      : recoveryAction(before, after);
    if (action) {
      const prior = checkpoint(
        before,
        action.kind,
        "Before: " + action.action,
        action.major,
      );
      const saved = checkpoint(after, action.kind, action.action, action.major);
      checkpointStatus = "SAVING CHECKPOINT";
      checkpointChain = checkpointChain
        .then(async () => {
          await saveCheckpoint(prior);
          await saveCheckpoint(saved);
          checkpointStatus = "CHECKPOINT SAVED";
          notify();
        })
        .catch(() => {
          checkpointStatus = "CHECKPOINT FAILED";
          message =
            "Recovery storage unavailable. Your active state still uses localStorage; export a JSON backup now.";
          notify();
        });
    }
    notify();
  };
  return {
    state,
    update,
    storageMessage: message,
    readOnly: !canWrite(),
    takeControl,
    checkpointStatus,
  };
}
