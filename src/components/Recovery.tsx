"use client";
import { useEffect, useState } from "react";
import type { AppState, Player } from "../types";
import {
  listCheckpoints,
  restoreCheckpoint,
  type RecoveryCheckpoint,
} from "../lib/recovery";
import { Modal } from "./Modal";
export function Recovery({
  state,
  players,
  onClose,
  onRestore,
}: {
  state: AppState;
  players: Player[];
  onClose: () => void;
  onRestore: (value: AppState, kind: "real" | "mock") => void;
}) {
  const names = new Map(players.map((p) => [p.id, p.name]));
  const describe = (item: RecoveryCheckpoint) =>
    item.action
      .split(" ")
      .map(
        (word) =>
          names.get(word) ??
          item.scope.leagueSettings.teams.find((t) => t.id === word)?.name ??
          word,
      )
      .join(" ");
  const [items, setItems] = useState<RecoveryCheckpoint[]>([]),
    [error, setError] = useState(""),
    [selected, setSelected] = useState<RecoveryCheckpoint | null>(null);
  const [kind, setKind] = useState("real");
  useEffect(() => {
    listCheckpoints()
      .then(setItems)
      .catch(() =>
        setError(
          "Recovery storage could not be opened. Use your exported JSON backup.",
        ),
      );
  }, []);
  return (
    <Modal title="DRAFT RECOVERY" onClose={onClose} wide>
      <p>
        Restore draft, lineup, queue and configuration from a checkpoint. Your
        current notes, watchlist, targets and personal ranks stay intact. Newer
        checkpoints remain in the timeline.
      </p>
      <div className="button-row">
        <button
          onClick={() => setKind("real")}
          className={kind === "real" ? "selected" : ""}
        >
          Real draft
        </button>
        <button
          onClick={() => setKind("mock")}
          className={kind === "mock" ? "selected" : ""}
        >
          Mock draft
        </button>
      </div>
      <p className="eyebrow">
        CURRENT · PICK{" "}
        {(kind === "real" ? state.realDraft : state.mockDraft).picks.length + 1}
      </p>
      {error && <p role="alert">{error}</p>}
      <div className="recovery-timeline">
        {items
          .filter((x) => x.kind === kind)
          .map((item) => (
            <button key={item.id} onClick={() => setSelected(item)}>
              <b>Pick {item.pick}</b>
              <span>{describe(item)}</span>
              <time>{new Date(item.timestamp).toLocaleString()}</time>
            </button>
          ))}
        {!items.length && (
          <p>
            No checkpoints yet. Confirm a pick or save configuration to begin.
          </p>
        )}
      </div>
      {selected && (
        <div className="restore-confirm">
          <h3>Restore checkpoint at pick {selected.pick}?</h3>
          <p>
            {describe(selected)}. Current {selected.kind} picks will be
            replaced. This creates a new checkpoint.
          </p>
          <div className="button-row">
            <button onClick={() => setSelected(null)}>Cancel restore</button>
            <button
              className="primary"
              onClick={() => {
                try {
                  onRestore(restoreCheckpoint(state, selected), selected.kind);
                  onClose();
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : "Invalid checkpoint",
                  );
                }
              }}
            >
              Confirm restore checkpoint
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
