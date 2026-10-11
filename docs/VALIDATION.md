# Build validation report

Validated October 10, 2026 (America/Toronto) in the project root. Real draft slot remains unknown by default. Browser test contexts used temporary slot 7 and are isolated from user state.

## Quality gates

| Gate                     | Result                                                                                                                                                                                 |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| npm install              | PASS; installed from local npm cache because outbound registry access was unavailable. Subsequent offline install reports up to date. Lockfile uses standard public npm registry URLs. |
| npm run import-players   | PASS; reads Draft Board only; original workbook unchanged.                                                                                                                             |
| npm run validate-players | PASS; 600 unique players; ranks 1–600; zero missing/duplicate ranks or IDs; exact Top 20.                                                                                              |
| npm run lint             | PASS; zero warnings/errors.                                                                                                                                                            |
| npm run typecheck        | PASS.                                                                                                                                                                                  |
| npm test                 | PASS; 62 domain/data tests, zero failures/skips/TODOs.                                                                                                                                 |
| npm run build            | PASS; Next.js 16.3.6 production webpack build and static export.                                                                                                                       |
| PWA postbuild            | PASS; 38 versioned static assets precached.                                                                                                                                            |
| npm run test:e2e         | PASS; 8 browser acceptance tests, 31.2 seconds.                                                                                                                                        |

Runtime: Node 24.14.0, Next.js 16.3.6, React 19.3.0, TypeScript 5.9.3, Tailwind 4.3.3. Build output is out/. No backend service is required.

## Domain verification

- All scoring events tested, including OREB/REB, PTS/FGM/3PM, FT stacking and every penalty.
- Every draft slot 1–10 tested through 15 snake rounds, plus reversal, future picks, turn picks, unknown slot and completion boundaries.
- Restrictive roster placement, G/F/UTIL/bench eligibility, multi-position rearrangement, manual movement and capacity enforcement tested. Tests caught and fixed an assignment issue that could prematurely use flexible slots; starters also stay ahead of inferior bench candidates.
- Recording, drafted-player exclusion, team assignment, 25 sequential undos and prior-pick correction verified with dependent recommendations recalculated.
- Research dominance, personal rank, bounded scarcity adjustments, cumulative HIGH risk, relevant replacement levels, runs, tier/value boundaries and unknown-slot planning tested.
- All four mock styles completed 150-pick drafts in tests; early selections stayed within research top 50, unprojected WATCH entries were absent, and real state remained separate.
- State serialization/restore, corrupted JSON, schema/data version rejection, illegal picks, team/position validation and separate state namespaces verified.

## Browser acceptance

1. All-600 search, deep-mode pool, position filters, dossier, saved note/watch/target/personal rank and comparison.
2. Temporary 10-team slot-7 real-draft simulation through 27 picks; three personal selections, reload persistence, correction and two undos.
3. Four practice rounds in Standard, restart, alternate Big Heavy mode, and preserved real selections.
4. JSON download, reset cancel/confirm, valid restore and rejected incompatible import.
5. Desktop 1920×1080: no page overflow; keyboard search and dossier controls.
6. Laptop 1440×900: same checks.
7. Mobile 390×844: task tabs, readable board, keyboard/dialog behavior and no page overflow.
8. Production service worker activation, offline reload, complete database search while offline.

Manual visual review also covered 1920×1080, 1440×900 and 390×844. Screenshots showed aligned panels, no overlapping controls, visible recommendations and roster access. A fixed mobile pick action keeps drafting reachable. Large draft grids and comparison tables scroll inside their containers. Source workbook context for Jalen Duren was checked in the dossier, including STANDARD risk and resolved contract rationale. No browser page errors were observed in research/live acceptance flows.

## Data integrity

Canonical workbook: NBA_2026_27_Custom_Draft_Board_600_DraftDay_2026-10-10.xlsx.

SHA-256 before and after:

`c97f624b5949630af27b2342c083c0c5e43941284a3567ff2d7e0c26ad2ff197`

Dataset 2026-10-10-draft-day-refresh: 429 projected players; 171 NONE entries with null forecast fields. No runtime NBA data feed is used.

## Practical limits

- Research is static, with individual verification dates preserved. No live injury or roster feeds.
- Scoring edits affect the centralized calculator/settings. Workbook forecasts are already aggregated and need a rescored workbook to reflect another scoring system; the UI explains this.
- Broad source tags use only the main position when exact platform eligibility is unspecified.
- Survival, tiers, value and roster-quality labels are documented deterministic heuristics, not calibrated probabilities or league outcome promises.
- Browser storage is device-specific; use JSON export to transfer/back up a draft. Incompatible dataset versions require deliberate migration.
- Browser suite supports PLAYWRIGHT_EXECUTABLE_PATH when a sandbox does not expose the normal Chrome installation environment. No machine path is embedded in application runtime logic.
