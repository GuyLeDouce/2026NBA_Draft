"use client";
import { useState } from "react";
import type { AppState, DraftState, Player, Recommendation } from "../types";
import {
  contingencyLadder,
  queueView,
  queueWaitLabel,
  reorderQueue,
} from "../lib/queue";
export function PickQueue({
  state,
  draft,
  players,
  recs,
  isMock,
  next,
  distance,
  onChange,
  onInspect,
  onPick,
  onClear,
  onAutoRemove,
  onClock,
}: {
  state: AppState;
  draft: DraftState;
  players: Player[];
  recs: Recommendation[];
  isMock: boolean;
  next: number | null;
  distance: number | null;
  onChange: (queue: string[]) => void;
  onInspect: (id: string) => void;
  onPick: (id: string) => void;
  onClear: () => void;
  onAutoRemove: (value: boolean) => void;
  onClock: boolean;
}) {
  const queue = state.queues[isMock ? "mock" : "real"];
  const [drag, setDrag] = useState<string | null>(null);
  const ladder = contingencyLadder(
    queue.filter((id) => players.some((p) => p.id === id)),
    draft,
    recs,
  );
  return (
    <section
      className="panel queue-panel"
      id="pick-queue"
      tabIndex={-1}
      aria-label="Pick queue"
    >
      <div className="panel-heading">
        <div>
          <span className="eyebrow">YOUR CONTINGENCY LADDER</span>
          <h2>
            MY QUEUE <small>{queue.length}/15</small>
          </h2>
        </div>
        <button disabled={!queue.length} onClick={onClear}>
          Clear queue
        </button>
      </div>
      <p className="queue-horizon">
        NEXT TURN <b>{next ? "#" + next : "SLOT UNKNOWN"}</b> ·{" "}
        {distance === null
          ? "Set your seat for wait risk"
          : distance + " selections away"}
      </p>
      {!queue.length && (
        <p className="muted">
          Open any player and choose Add to queue. Put the players you would
          actually take next here.
        </p>
      )}
      <ol className="queue-stack">
        {queueView(queue, draft, recs).map((item, i) => {
          const player = players.find((p) => p.id === item.id);
          return (
            <li
              key={item.id}
              className={item.taken ? "queue-taken" : ""}
              draggable
              onDragStart={() => setDrag(item.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (drag) onChange(reorderQueue(queue, drag, i));
                setDrag(null);
              }}
            >
              <span className="rank">{i + 1}</span>
              <div className="queue-name">
                <button onClick={() => player && onInspect(item.id)}>
                  {player?.name ?? item.id}
                </button>
                <small>
                  {item.taken
                    ? "TAKEN"
                    : !player
                      ? "MISSING FROM DATASET · REVIEW"
                      : queueWaitLabel(item.recommendation, distance)}
                </small>
              </div>
              <div className="queue-actions">
                <button
                  aria-label={"Move up " + (player?.name ?? item.id)}
                  disabled={i === 0}
                  onClick={() => onChange(reorderQueue(queue, item.id, i - 1))}
                >
                  ↑
                </button>
                <button
                  aria-label={"Move down " + (player?.name ?? item.id)}
                  disabled={i === queue.length - 1}
                  onClick={() => onChange(reorderQueue(queue, item.id, i + 1))}
                >
                  ↓
                </button>
                <button
                  aria-label={"Remove from queue " + (player?.name ?? item.id)}
                  onClick={() => onChange(queue.filter((id) => id !== item.id))}
                >
                  ×
                </button>
                {!item.taken && player && (
                  <button
                    aria-label={"Queue draft " + player.name}
                    onClick={() => onPick(item.id)}
                  >
                    Pick
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <details open={onClock || undefined}>
        <summary>Plan A → emergency fallback</summary>
        <ol className="ladder">
          {ladder.map((id, i) => (
            <li key={id}>
              <span>
                {
                  [
                    "PLAN A",
                    "PLAN B",
                    "PLAN C",
                    "PLAN D",
                    "EMERGENCY FALLBACK",
                  ][i]
                }
              </span>
              <button onClick={() => onInspect(id)}>
                {players.find((p) => p.id === id)?.name ?? id}
              </button>
              <small>
                {queue.includes(id)
                  ? "Your queue"
                  : "Roster / tier / demand recommendation"}
              </small>
            </li>
          ))}
        </ol>
        <p className="muted">
          Manual queue leads; current recommendations fill gaps. Taken players
          are skipped.
        </p>
      </details>
      <label className="inline-check">
        <input
          type="checkbox"
          checked={state.autoRemoveQueued}
          onChange={(e) => onAutoRemove(e.target.checked)}
        />
        Auto-remove taken players (default off)
      </label>
    </section>
  );
}
