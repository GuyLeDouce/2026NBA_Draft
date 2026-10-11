# Draft-night upgrade validation

## Audited baseline

Commit: `17fb0572821149caaf9f5b4776965275565e018b`, branch `main`, clean tree.

Before feature work: offline npm install, importer, 600-player validation / exact Top 20, lint, typecheck, 62 domain tests, production static build and 8 Playwright acceptance tests all passed. Workbook SHA-256: `c97f624b5949630af27b2342c083c0c5e43941284a3567ff2d7e0c26ad2ff197`.

## Upgrade coverage

- Pick queue: separate real/mock persistence, buttons and drag ordering, taken markers, auto-removal preference, undo/correction status, wait-risk recalculation and contingency ladder.
- Recovery: before/after IndexedDB checkpoints, bounded retention, old-checkpoint restore, newer history retained, current scouting preserved, separate mock restoration, visible storage failure, unreadable active record protected.
- Multi-tab: Web Locks ownership and fallback lease takeover both tested in two-tab browser contexts. A read-only tab cannot record or undo picks.
- Planner: deterministic four-scenario intervening picks, legal rosters, excluded taken players, target/fallback paths, current/following snake turns.
- Recommendations: factor totals reconcile; 4,635 scores compared against the baseline at 18 draft states, with identical top ten and only floating-point tolerance in numeric totals.
- Eligibility: canonical positions unchanged; effective roster, scarcity, VOR and recommendations change; resets and backup-specific validation tested.
- Lock: configuration/import/reset controls disabled; picks, undo, correction, queue and scouting remain available; typed RESET for destructive live-data replacement.
- Availability: 0/2, 1/2, 2/2 and overloaded risk exposure tested; platform IR eligibility is not inferred.
- Starter planning: eligible active comparison, flexible reassignment, bench-only exclusion and unknown-projection withholding.
- Workbook preview: browser and CLI report unchanged canonical data; field diffs, new/removed/ambiguous identities tested. Importer itself blocks ambiguous refreshes before writing, verified in an isolated fixture workspace.
- Slot lab: all ten slots, deterministic three-round starts, valid snake picks and no duplicates.
- Storage migration: original schema 1 migrates to schema 2, retaining settings, picks, notes, watchlist, targets and personal ranks. Orphan personal/queue/eligibility IDs are preserved for review.

## Rehearsal and responsive inspection

An isolated browser acceptance draft recorded 80 picks (eight rounds, temporary slot 7), including queued players taken by opponents, two-pick plans, undo, correction, old-checkpoint restore, reload, opponent needs, draft lock and comparison. A separate UI-driven manual rehearsal also recorded 80 picks. Four rounds each of STANDARD and BIG HEAVY mock styles reached pick 34 while the 80 real test picks remained intact.

Manually inspected 1920×1080, 1440×900 and 390×844 views, including queue cards, recommendation hero, planner and recovery timeline. Automated overflow checks also pass at all three widths. Keyboard confirmation was fixed and verified as two deliberate Enter actions. Q and / reveal the correct mobile panels from other sections.

No test used the user's normal browser profile. Temporary contexts were closed, not imported into real user state. Default real slot remains null, date October 13, 2026, and drafts remain empty on a fresh install.

## Results

91 domain tests pass (29 added); 26 browser tests pass (18 added). Browser coverage includes offline reload, queue/picks/checkpoints/planning/mock while offline, migration, failure handling, multi-tab control and the eight-round rehearsal. Lint, typecheck, formatting, importer, validation and production static build pass. PWA precaches 40 static assets.

Canonical XLSX SHA-256 remains unchanged. Generated player data, identity normalization and scoring source have no diff from the baseline. All 600 IDs and the exact Top 20 are unchanged. No backend, external API, dependency upgrade, raw-stat rescoring or automatic in-draft workbook replacement was introduced.

## Operational limits

- Recovery remains local to this browser/device; JSON export is the portable backup.
- Scenario survival counts are deterministic scenario results, not probabilities or guaranteed availability.
- Data preview is read-only. Reviewed dataset application uses the documented importer/validation/build workflow; runtime dataset replacement is intentionally unavailable during the draft.
- Close pre-upgrade app tabs and open the upgraded app once so all active clients use the new ownership protections.
- All requested upgrade priorities are implemented; no core feature is deferred.

## Git handoff

Release source is published to `GuyLeDouce/2026NBA_Draft` through the authorized GitHub connection. The new repository starts with this validated release; the audited local baseline is `17fb0572821149caaf9f5b4776965275565e018b`.

The local checkout remains on that baseline with the upgrade in its working tree because this session grants read-only access to `.git`. Direct Git network access is also restricted. Remote publication does not alter the local index, branch, or history. The canonical workbook is uploaded byte-for-byte, and remote Git blob hashes are checked against the local release files.
