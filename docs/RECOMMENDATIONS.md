# Recommendation methodology

This is a deterministic rules engine. It does not call a model or pretend to be AI. It explains observable factors and uses qualitative waiting estimates, never fabricated probability percentages.

## Four separate concepts

- **Research Rank:** workbook Overall; permanent authority for the canonical board.
- **Personal Rank:** optional local ordinal used as a player's base rank in decision support.
- **Recommendation Score:** 700 minus base rank, plus bounded context adjustments and explicit preference/deep-pool penalties.
- **Dynamic Rank:** ordering of eligible available candidates by Recommendation Score; stable research-rank tie break.

Best Available uses base Research/Personal rank. Best Fit is the highest Recommendation Score for your roster. Drafted players are excluded. Players without a feasible roster slot are excluded from fit recommendations; picks/corrections also enforce actual roster capacity.

## Centralized coefficients

All weights are in src/lib/recommendationWeights.ts. In rounds 1–3, context is capped at ±8 rank-equivalent points. Later it is capped at ±20. A clearly superior early player therefore remains dominant. Explicit AVOID costs 30, and modeled deep candidates cost 35; these are user preference/confidence penalties outside the contextual cap.

| Factor                                                           | Contribution                    |
| ---------------------------------------------------------------- | ------------------------------- |
| VOR                                                              | 0.12 per FP/G, capped ±4        |
| Primary/G/F need                                                 | +2 early, +7 later              |
| Additional explicit eligible position                            | +0.8                            |
| Thin relevant depth (≤3)                                         | +3                              |
| Last comparable tier option with ≥4 FP/G drop                    | +3                              |
| Opponent demand                                                  | +0.6 per unique team, capped +3 |
| Recent run plus thin supply                                      | +1.5                            |
| High-side projection spread                                      | +0.12 per FP/G, capped +2       |
| MEDIUM / HIGH availability risk                                  | −0.5 / −1.5                     |
| At least two HIGH-risk roster players and another HIGH candidate | Additional −3                   |
| PRIORITY target                                                  | +1.5                            |

Risk already influenced the workbook. These are modest additional situational adjustments, not an attempt to double-research an injury. HIGH-risk candidates remain available. DEEP/WATCH source risk labels do not imply an injury. Upside is range width, not a probability of hitting the high end.

## VOR and relevant scarcity

Replacement production uses the complete fantasy-relevant research pool, not all 600 records. Candidates need a known projection, non-LOW confidence, CORE/DEEP tier, and non-WATCH risk. First take research-ranked candidates up to the league's total regular roster capacity. Assign that pool to the league's repeated configured positions, including G/F/UTIL and bench, using a matching algorithm. Unassigned players are replacement candidates. The average forecast of the first three eligible research-ranked replacements gives each position baseline. No available replacements yields null.

For a multi-position player, VOR is projected FP/G minus the lowest eligible position baseline, representing the most useful placement. The baseline is a stable season planning benchmark; it is not lowered by unprojected fringe records or by a positional run. Scarcity is separately recalculated every pick.

Position Depth counts available fantasy-relevant candidates inside the larger of league regular roster capacity and current pick +45. Explicit multi-position players can count in more than one position; the five figures should not be summed. These are useful research options, not the entire database's position totals.

## Tiers and runs

Workbook Pool tier describes depth rather than fine draft tiers. Computed research-rank bands end at 12, 30, 60, 100, 150, 220, 300, 429 and 600. Labels display both Pool tier and computed T number. A tier alert requires no comparable eligible peer in that band plus at least a 4 FP/G gap to the first next-tier research option. The gap uses known forecasts. It is a heuristic grouping, not a workbook field pretending to exist.

A positional run means at least four primary-position selections in the last eight picks. REACT requires three or fewer relevant alternatives; otherwise DO NOT CHASE. At most three prominent alerts show across runs, major value slides, tier breaks, watches and roster risk.

## Opponent demand and survival

The engine fills every fantasy team's roster and checks open standard/G/F positions. It looks at the unique teams selecting before your upcoming turn; when you are currently up it looks between now and your following turn. Demand counts teams, so a snake-turn team does not double-count as two teams.

Wait Risk is VERY HIGH when at least five teams need the position and supply is within demand +3; HIGH uses at least three teams under the same supply rule; MEDIUM means at least one team needs it; otherwise LOW. An unknown actual draft slot produces no opponent horizon or invented future pick.

Survival starts with the number of available players ahead of the candidate by Research/Personal Rank versus picks to the horizon. Demand ≥3 adds two pressure units, depth ≤3 adds two, a tier break adds one, and a run adds one. If players-ahead +2 is less than distance +pressure: UNLIKELY TO SURVIVE. If players-ahead is greater than distance +pressure +4: LIKELY TO SURVIVE. Otherwise TOSS-UP. No known slot means an explicitly uncertain pre-draft view.

TAKE NOW maps to unlikely survival; CAN PROBABLY WAIT maps to likely; WAITING IS RISKY maps to toss-up. Review the reasons, which include the horizon's actual demand. These categories cannot predict an individual opponent's behavior.

## Value and two-pick planning

Value differential is current overall pick minus base rank. Less than seven places in either direction is FAIR. +7 is VALUE, +15 is STEAL, and −7 or worse is REACH. Personal rank takes precedence if set. These are differences in draft positions, not projected points.

The two-pick planner evaluates up to five current options and twenty plausible future targets, when a following turn is within twenty selections. Targets must have plausible survival and enough players ahead to reach the second selection. Complementary uncovered positions influence target ordering. It chooses the strongest scored pair and shows two fallbacks. It is a small deterministic scenario comparison, not exhaustive simulation or a guarantee that a player remains.

## Mock opponents

Mocks use the same research/fit engine for the team on clock. Opponents do not use your personal ranks. Standard adds 0–3 deterministic rank-equivalent variation to the top eight choices. Guard Heavy and Big Heavy add a modest five-point relevant preference. Chaotic considers fifteen choices and adds 0–18 variation. Seed, player ID and pick number determine variation reproducibly. Unprojected WATCH players never appear. If the normal pool has no legal roster fit late in an unusually large configured draft, opponents can fall back to projected deep candidates. Manual personal choices remain intentional confirmed selections. Real and mock picks and manual assignments live in different namespaces.

## Roster quality

Known-projection average: Excellent ≥40, Strong ≥30, Developing ≥22 FP/G; below that is Depth roster. This is a descriptive threshold, not a league-relative grade. Position coverage: Complete at five standard positions, Good at three or four, otherwise Building. Flexibility reports a count rather than an arbitrary score. Availability is Low at zero HIGH-risk players, Moderate at one or two, Elevated at three or more. Upside counts high projections ≥5 above center; stashes have fewer than 45 planning games. Season production is the sum of known planning season points, with projection coverage shown; it is not a scheduled starting-lineup total.

## Draft-night upgrades

### Actual score breakdown and movement

The recommendation exposes every numerical contribution used by its score: 700 minus research rank, personal-rank difference, VOR, roster fit, flexibility, scarcity, tier drop, opponent demand, run, upside, availability and cumulative risk, priority/avoid and deep confidence. The context-cap adjustment is displayed explicitly so components reconcile to the actual total. Scores are ordering units, not grades.

“Why this changed” compares the current analysis with replay of the state immediately before the latest recorded pick, under the same current scouting/eligibility settings. It reports factor changes of at least 0.1 and rank movements of at least two places. It does not invent causal explanations from arbitrary text or claim to audit earlier personal-rank edits.

### Advanced two-pick scenarios

Five first-pick candidates are evaluated in four deterministic opponent scenarios: baseline, position run, best available and needs heavy. Off-clock analysis first advances to your turn under the baseline scenario. Each path then records the first candidate and simulates opponents to your following turn, using legal roster capacity, research ranks, tiers, modest need/run preferences and fixed small variation.

For speed, second-pick candidates reuse the at-turn recommendation scores, filter out simulated selections and illegal fits, and add a modest remaining-needs bonus. Candidate pair score combines the first-pick score with the second candidate's average contribution across the four scenarios; unavailable candidates contribute zero. Three paths are displayed with targets and alternatives. This is a conservative scenario comparison, not a fitted probability model. A 4/4 survivor is not guaranteed. Null forecasts stay null; combined FP/G is rounded to avoid overstating tiny differences. Weights are centralized in recommendationWeights.ts.

### IR and starter opportunities

IR occupancy is actual manual slot placement. High-risk exposure is counted separately: zero is low, below IR capacity is moderate, at capacity high and above capacity overloaded. Risk does not establish legal IR eligibility. Planning GP below 45 marks a limited-games stash. Warnings identify potential bench burden without forbidding picks.

Starter planning uses projection-ordered augmenting matching into legal active slots. It can reassign flexible players to identify an eligible lineup improvement. Existing manually pinned IR players are excluded. A numeric upgrade requires an actual displaced active player, known candidate projection and no unprojected incumbent. Otherwise the UI reports depth, bench or stash. This projection-specific planning view never changes research rankings or actual roster assignments.

### Slot lab

Three repeatable first-three-round scenarios run for each league seat: baseline, center run and needs heavy. The lab lists possible starts, average research rank, rounded combined projection, maximum high-risk picks across the three starts, and center coverage pressure. It writes neither real nor mock state. Once the real seat is known, exact-slot Mock Draft remains the primary rehearsal.
