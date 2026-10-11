# NBA Draft Assistant

A complete local-first **2026–27 Fantasy Basketball Draft War Room** for a 10-team head-to-head points snake draft on **October 13, 2026**. The real draft position starts **unknown**. No account, database, server API, or paid service is required.

## Start

Requires Node.js 20.9+ (built and verified with Node 24.14.0).

```sh
npm install
npm run dev
```

Open http://localhost:3000. For the production build:

```sh
npm run build
npm start
```

The build produces a portable static site in **out/**. Deploy that directory to any static host at the domain root. Next.js App Router, React, TypeScript and Tailwind CSS power the UI. No environment configuration is needed. The included local production server binds to 127.0.0.1; set PORT to change its port.

## Canonical research

**NBA_2026_27_Custom_Draft_Board_600_DraftDay_2026-10-10.xlsx** in the project root is the only source of player records. The importer reads **Draft Board** only. It never writes to the workbook. The generated JSON is committed so the app can run without parsing Excel in the browser.

- 600 unique players, research ranks 1–600.
- Dataset: **2026-10-10-draft-day-refresh**.
- 429 players with projections; 171 explicitly unprojected entries.
- All Top 20 names/order are enforced by the import, validation, and test gates.
- Research rank is authoritative. Projected FP/G is a separate measurement.
- This is **static research data**, updated October 10, 2026.

```sh
npm run import-players
npm run validate-players
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

The browser suite uses installed Google Chrome; install Chrome or change the Playwright channel to your installed browser. It starts the production server if needed. Tests use isolated browser contexts and temporary slot 7, never a preconfigured real slot. See [player data](docs/PLAYER_DATA.md) for refresh instructions and source semantics.

## Using the war room

1. Complete setup or choose **Research first**. Set team names, select My Team, and enter the actual draft position when known. Other teams retain list order, with your team inserted at your selected seat.
2. Research all 600 players in **Big Board**. The default Top 250 view excludes fringe and low-confidence players. Search always reaches the whole database. Deep Mode exposes the full pool.
3. Record a pick with search → **+** → **Confirm draft pick**. The current snake team is always the destination. Pick confirmation is intentional; there is no one-key drafting shortcut.
4. See the recommended pick, alternatives, reasons, positional depth, opponents' needs, survival categories, and two-pick plan in **War Room**.
5. Use **Undo last pick** repeatedly or click a prior tile in **Draft Board** to correct it directly.
6. Review every team's roster in **My Team**. Move your players with slot selectors; legal swaps and eligibility are enforced. IR is manual, never automatically filled.
7. Export a JSON backup before leaving the device. **Settings** validates and confirms restores and provides separate destructive reset confirmations.

Shortcuts: **/** focuses board search, **↑/↓** navigate results, **Escape** closes dialogs, **W** toggles the inspected player's watch status outside text fields. On mobile, Board / Pick / Roster / Draft tabs prioritize the active task. Draft Day Mode increases pick-action size and keeps the scoreboard visible. Fullscreen is available where supported.

## League scoring

The single scoring module is src/lib/scoring.ts. PTS +1, FGM +1, FG misses −1, FTM +1, FT misses −1, 3PM +1, OREB +2, REB +1, AST +1.5, STL +2, BLK +1.5, TO −2, ejections +10.

Stacking is intentional: offensive rebound = 3, made two = 3, made three = 5, made free throw = 2. Misses are event counts; OREB is also included in REB. Ejections are enabled in scoring but omitted from workbook forecasts because no reliable inputs exist.

Scoring is editable and the Settings calculator immediately reflects edits. **The workbook supplies precomputed research projections; changing scoring does not invent new player projections.** The app displays a notice when settings differ. Import a workbook researched/rescored for the new rules to update forecasts.

Default roster: PG, SG, SF, PF, C, G, F, four UTIL, four BN, and two IR. Fifteen regular draft rounds; IR adds no draft rounds. G accepts PG/SG; F accepts SF/PF; UTIL/BN accept any standard position. Structural settings are locked while either draft contains picks.

## Recommendations and mock drafts

The engine is deterministic and explainable. Research or Personal Rank anchors value. Bounded adjustments consider eligibility-aware replacement value, roster needs, scarcity, research tiers, opponent demand, positional runs, upside, flexibility, and cumulative HIGH risk. There are no AI claims or probability percentages. The methodology, coefficients, and limitations are in [RECOMMENDATIONS.md](docs/RECOMMENDATIONS.md).

Mock Draft uses its own saved state and practice position. Choose Standard, Guard Heavy, Big Heavy, or Chaotic, then fast-forward to your selection. Make the pick and repeat. A checkpoint/final report lists your selections, production, coverage, risk, best value, biggest reach, and missed targets. Restarting a mock leaves the real draft intact.

## Persistence, backups, and offline use

The versioned localStorage key is **nba-draft-assistant:v1**. Settings, real/mock picks, manual slots, personal ranks, targets, notes, watches and preferences persist. Watchlist players stay visible as taken when drafted. Export includes schema/app/data versions, settings, rosters, teams, drafts and personal data. Import rejects incompatible versions, unknown player IDs, invalid snake sequences, duplicate picks, and illegal roster assignments.

This browser/device owns the state. Clearing site data removes it. Storage failures display an export warning. Invalid saved data is reported and is not overwritten until an explicit app change. Another tab's valid update is synchronized.

The manifest, original basketball icon, and production service worker support installation on compatible browsers. The build generates a content-versioned precache of the entire static site. After the first successful load and worker activation, the app can reload offline. Updates do not force activation in the middle of a draft. Local HTTP is supported; hosted PWA installation requires HTTPS.

## Project map

- src/app — App Router shell, metadata, responsive design tokens/styles.
- src/components — war room, board, player drawer, comparisons, settings, team views.
- src/data/players.generated.json — canonical generated dataset and provenance.
- src/lib — pure scoring, draft, roster, recommendation, mock, identity, storage logic.
- src/types — shared domain types.
- scripts — workbook import/validation, portable TypeScript CLI loader, static server, PWA build.
- tests/run.ts — Node's built-in test runner for domain/data regression tests.
- tests/browser — browser acceptance and responsive tests.
- docs — data rules, recommendation methodology, and validation report.

The XLSX parser is used only by the trusted local workbook import, never shipped as a browser upload parser. Do not import untrusted workbooks. Generated screenshots, caches, dependencies, and test traces are ignored by Git.

## Draft-night upgrade (1.1)

Persistent real/mock pick queues, contingency ladder, IndexedDB checkpoint recovery, single-tab draft ownership, live settings lock, controlled two-pick scenarios, actual score breakdowns, league eligibility overrides, IR exposure, eligible starter upgrades, read-only workbook refresh preview and all-slot scenario lab are included.

See [Draft-night operations](docs/DRAFT_NIGHT.md) for keyboard entry, migration, recovery scope/retention and safe refresh instructions. Existing version-1 saved state migrates without clearing localStorage. The canonical workbook and player IDs are unchanged.
