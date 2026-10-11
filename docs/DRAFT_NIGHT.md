# Draft-night command center

## Before the draft

1. Export state JSON. Existing schema-1 data migrates to schema 2 at the same localStorage key; no reset is needed.
2. Leave the real draft slot unknown until assigned. Use Draft Slot Lab or a separate mock to rehearse.
3. Confirm team order, scoring, 15 regular roster slots and two IR slots.
4. Use player details to set league eligibility where your platform differs from the workbook. Existing pinned slots must remain legal.
5. Build a queue of up to 15 players. Queue order is independent of research rank, personal rank, watchlist and targets.
6. Choose **Lock for live draft**. Configuration, imports and destructive real-draft resets are protected. Unlock requires confirmation.

## During the draft

- Press **/**, type a name, **Enter** to open confirmation, then **Enter** again to record to the team on the clock. Arrow keys select other search results. Escape cancels. A single key never records a player from the board.
- **Q** opens the queue. Reorder with drag or up/down buttons (buttons work on touch and keyboard). Taken entries stay visible by default; undo/correction automatically changes their status. Optional auto-removal deletes entries deliberately and does not reinsert them on undo.
- Queue wait risk comes from the existing deterministic survival engine. Unknown slots have unknown wait risk. The contingency ladder uses active queue order, then current recommendations.
- Undo remains immediate; pick corrections remain on the draft board. Real-draft resets / backup replacement during a started draft require typing **RESET**.
- **Checkpoint saved** indicates IndexedDB completion. Storage errors remain prominent; export a backup if one appears.

## Recovery scope and retention

Active state remains in localStorage. IndexedDB stores before/after checkpoints for picks, corrections, undo, roster changes, league/scoring configuration, queue changes, eligibility changes, draft lock and scouting changes. Drawer/search/filter events do not create history. Minor scouting checkpoints mark the action but do not rewind personal data.

A restore rewinds the selected real or mock draft, its queue, league/scoring and eligibility context. Current global notes, targets, watchlist, personal ranks and lock state are preserved. The other draft namespace remains intact. A restore is validated against current players and both rosters before application; incompatible formats are rejected. Restoring requires unlocked settings and creates a fresh checkpoint while retaining newer history.

Retention is bounded: 800 major real checkpoints (enough for before/after all 300 supported selections plus configuration changes), 40 minor real checkpoints, 80 major mock and 15 minor mock checkpoints. Older entries in each class expire first. Recovery is device/browser local; exported JSON remains the portable backup. Browser-data deletion also deletes recovery history.

## Multiple tabs

One tab owns draft writes using Web Locks plus a localStorage ownership fence. Other tabs synchronize but are read-only. **Take control** explicitly fences the old owner and obtains the lock. Without Web Locks, a renewed lease, BroadcastChannel where available, storage events and a settling period coordinate ownership. Every state write rechecks its lease. An expired or displaced tab cannot keep saving. Tabs never automatically compete to steal control.

## Research refresh

Settings → **Preview data update** reads a trusted XLSX locally and compares only Draft Board. It cannot alter the canonical workbook or active dataset. Duplicate identities / ranks, wrong player count and ambiguous name changes block approval in the preview. New / removed players and all requested field differences are listed.

For a reviewed refresh, keep the original workbook and put the new file beside it. Run:

```powershell
npm run preview-players -- "NBA_Updated.xlsx"
$env:PLAYER_WORKBOOK = "NBA_Updated.xlsx"
$env:DATA_VERSION = "2026-10-13-draft-day-refresh"
$env:DATA_UPDATED = "2026-10-13"
npm run import-players
npm run validate-players
npm test
npm run build
```

The importer retains the explicit Top-20 regression gate. If legitimate new research changes it, review and intentionally update that gate before importing; never silently reorder data to pass. Preview does not grant approval to bypass a gate. Runtime replacement during a live draft is intentionally unavailable.

Identity uses the same normalized stable IDs as version 1. Notes, watchlists, queue, targets, ranks and eligibility persist across compatible dataset versions. Unmatched personal records and queue IDs remain in orphan review / exports. A removed player already drafted blocks state validation rather than silently dropping that pick. Export and resolve that identity before upgrading the dataset.

Unreadable saved records are protected from ordinary writes. A validated backup import or checkpoint restore is required before saving again; opening setup or changing a queue cannot overwrite the original corrupted record.

The importer also enforces identity-review failures before writing generated data, even if the preview step is accidentally skipped. After upgrading, close pre-upgrade app tabs and open one fresh instance so every active client uses the new ownership guard.
