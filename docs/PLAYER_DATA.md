# Player data contract

## Authority and provenance

The only canonical player universe is **Draft Board** in NBA_2026_27_Custom_Draft_Board_600_DraftDay_2026-10-10.xlsx. DRAFT DAY 10-13, PG, SG, SF, PF and C are views and are never independently imported. Other sheets provide research context; they do not add player identities.

The importer finds the header row by Overall and Player rather than assuming its physical row. It requires all 27 observed headers, normalizes numeric/text values, rejects invalid numeric values and positions, and preserves blanks as null. Source file SHA-256 is recorded in generated metadata and checked again after reading. The importer only reads bytes from the source workbook.

Original workbook fingerprint:

`c97f624b5949630af27b2342c083c0c5e43941284a3567ff2d7e0c26ad2ff197`

Metadata: season 2026-27; dataVersion 2026-10-10-draft-day-refresh; lastUpdated 2026-10-10; draftDate 2026-10-13; playerCount 600.

## Rankings and identity

Overall becomes researchRank; its order is not changed by FP/G. Research accounts for custom scoring, production, expected games, risk, role, availability and analyst judgment. Personal Rank is a local override for decision support, Dynamic Rank is the current engine's order, and Recommendation Score is an internal bounded value measure. None rewrites researchRank.

IDs derive from normalized player names, never rank, team or array position. Unicode accents decompose, apostrophes are removed, punctuation becomes separators, and suffix tokens such as Jr, Sr, II and III are retained. The original display name is preserved as name; searchName is normalized. Any collision fails validation. If a future source changes a player's spelling or suffix, reconcile the identity deliberately before importing old backups.

Explicit PG/SG/SF/PF/C tags supply eligibility, with Main group always included. Broad source tags G, F, GF and FC are not confirmed platform eligibility: these use Main group only. Generic roster slots G/F remain flexible. Review your fantasy platform's actual eligibility if it differs from the research snapshot.

## Research categories

| Field               | Source meaning / treatment                                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Pool tier           | CORE 120, DEEP 180, VERY_DEEP 129, WATCH 171. Describes research pool depth, not a projection-based rank.                            |
| Risk                | STANDARD, MEDIUM, HIGH are availability assessments. DEEP, VERY_DEEP and WATCH are depth labels, not automatically injury penalties. |
| Data confidence     | HIGH 312, MEDIUM 108, LOW 180. Low-confidence records stay out of normal recommendations and replacement/scarcity estimates.         |
| Projection type     | DRAFT_DAY_BLEND, DRAFT_DAY_FP, DRAFT_DAY_HEALTH, RESEARCH_BLEND, DEEP_ESTIMATE, MODEL, MODEL-ROOKIE, NONE. Preserved exactly.        |
| Roster status       | Source roster context; not a fabricated current NBA status.                                                                          |
| Verified / snapshot | Preserved source text; individual entries may have older snapshots than the workbook refresh date.                                   |

There are 429 projected records and 171 records explicitly marked NONE. NONE rows have zero/range placeholders in the source despite a rationale stating there is no reliable projection. The importer converts their projected low/high/center, planning games and season points to **null**. It does not invent production. Other actual numeric zeros are preserved. Nulls display as dashes and are excluded from production averages and VOR.

Normal views and recommendation calculations use known projections, non-LOW confidence, CORE/DEEP pool tiers and non-WATCH risk. Search reaches all 600 even with Deep Mode off. Deep Mode exposes all records on the board; records with no reliable forecast still cannot lead recommendations.

## Repeatable refresh

1. Preserve the original research workbook. Place an updated workbook in the project root.
2. With the same canonical filename, run npm run import-players and npm run validate-players.
3. For another filename use PLAYER_WORKBOOK (relative to the project root). DATA_VERSION and DATA_UPDATED can supply the new version/date metadata. For example in PowerShell:

```powershell
$env:PLAYER_WORKBOOK = 'updated-draft-board.xlsx'
$env:DATA_VERSION = '2026-10-12-refresh'
$env:DATA_UPDATED = '2026-10-12'
npm run import-players
npm run validate-players
```

4. Review the generated diff. The Oct. 10 Top 20 regression gate must pass; a deliberate later research change requires an explicit reviewed update to that gate, never silently sorting records.
5. Run npm run lint, npm run typecheck, npm test, npm run build, npm run test:e2e.
6. Export browser state before deploying a new data version. Imports of a different data version are rejected to avoid silently applying incompatible identities/ranks. Migrate a backup deliberately if needed.

Only the generated JSON is consumed at runtime. Workbook loading is resolved from process.cwd(), so the whole project can be moved to another directory or computer.

## Draft-night preview and eligibility

The read-only Settings XLSX preview and `npm run preview-players -- <file.xlsx>` share the exact canonical Draft Board parser with the importer. Preview reports rank, team, eligibility, projection, risk and roster-status changes, added/removed players, duplicate IDs and possible name/suffix identity changes. It writes no source workbook or dataset.

League eligibility overrides live in schema-2 user state and never alter workbook fields. Effective eligibility is passed consistently to roster assignment, scarcity, VOR, recommendations, opponent needs and mock logic. Unmatched personal IDs are retained for orphan review after a compatible dataset refresh. See [Draft-night operations](DRAFT_NIGHT.md) for the reviewed import workflow.
