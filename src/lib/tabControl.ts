"use client";
import { LEASE_KEY, ownsLease, readLease } from "./draftGuard";
const id = typeof crypto !== "undefined" ? crypto.randomUUID() : "server";
let active = false,
  initialized = false,
  release: (() => void) | null = null;
let channel: BroadcastChannel | null = null;
const listeners = new Set<() => void>();
export function canWrite() {
  return active && ownsLease(readLease(), id, Date.now());
}
function publish() {
  listeners.forEach((fn) => fn());
  window.dispatchEvent(new Event("draft-ownership"));
}
function relinquish() {
  active = false;
  release?.();
  release = null;
  publish();
}
async function claim(force = false) {
  const lease = readLease();
  if (!force && lease && lease.id !== id && lease.expires > Date.now()) {
    active = false;
    publish();
    return;
  }
  if (force) channel?.postMessage({ take: id });
  const acquire = () => {
    try {
      localStorage.setItem(
        LEASE_KEY,
        JSON.stringify({ id, expires: Date.now() + 12000 }),
      );
      active = true;
      publish();
    } catch {
      active = false;
      publish();
    }
  };
  if (navigator.locks) {
    if (force) {
      // Wait for the old owner to release after the fenced lease changes.
      localStorage.setItem(
        LEASE_KEY,
        JSON.stringify({ id, expires: Date.now() + 12000 }),
      );
    }
    void navigator.locks
      .request(
        "nba-draft-writer",
        force ? { steal: true } : { ifAvailable: true },
        async (lock) => {
          if (!lock) {
            active = false;
            publish();
            return;
          }
          acquire();
          await new Promise<void>((resolve) => {
            release = resolve;
          });
        },
      )
      .catch(() => {
        active = false;
        publish();
      });
  } else {
    // Settle competing claims before allowing writes; a displaced tab fails the per-write fence.
    try {
      localStorage.setItem(
        LEASE_KEY,
        JSON.stringify({ id, expires: Date.now() + 12000 }),
      );
    } catch {
      active = false;
      publish();
      return;
    }
    active = false;
    publish();
    setTimeout(() => {
      active = ownsLease(readLease(), id, Date.now());
      publish();
    }, 250);
  }
}
export function startTabControl(listener: () => void) {
  listeners.add(listener);
  if (!initialized) {
    initialized = true;
    if (typeof BroadcastChannel !== "undefined") {
      channel = new BroadcastChannel("nba-draft-ownership");
      channel.onmessage = (e) => {
        if (e.data?.take && e.data.take !== id) relinquish();
      };
    }
    window.addEventListener("storage", (e) => {
      if (e.key === LEASE_KEY && !ownsLease(readLease(), id, Date.now()))
        relinquish();
    });
    window.addEventListener("pagehide", () => {
      if (canWrite()) localStorage.removeItem(LEASE_KEY);
      relinquish();
    });
    window.addEventListener("pageshow", () => {
      if (!active) void claim();
    });
    setInterval(() => {
      if (canWrite())
        localStorage.setItem(
          LEASE_KEY,
          JSON.stringify({ id, expires: Date.now() + 12000 }),
        );
      else if (active) relinquish();
    }, 3000);
    void claim();
  }
  return () => {
    listeners.delete(listener);
  };
}
export function takeControl() {
  if (!canWrite()) void claim(true);
}
