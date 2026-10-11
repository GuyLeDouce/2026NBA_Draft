export const POSITIONS = ["PG", "SG", "SF", "PF", "C"] as const;
export type Position = (typeof POSITIONS)[number];
export type SlotType = Position | "G" | "F" | "UTIL" | "BN" | "IR";
export type PlayerRisk = string;
export type PoolTier = string;
export type DataConfidence = string;
export type ProjectionType = string;
export interface Player {
  id: string;
  name: string;
  searchName: string;
  team: string | null;
  primaryPosition: Position;
  eligiblePositions: Position[];
  researchRank: number;
  historicalGames: number | null;
  historicalFpg: number | null;
  projectedLow: number | null;
  projectedHigh: number | null;
  projectedFpg: number | null;
  planningGames: number | null;
  planningSeasonPoints: number | null;
  risk: PlayerRisk | null;
  status: string | null;
  draftRationale: string | null;
  fantasyProsFpg: number | null;
  hashtagFpg: number | null;
  rawConsensus: number | null;
  analystAdjustment: number | null;
  poolTier: PoolTier | null;
  dataConfidence: DataConfidence | null;
  projectionType: ProjectionType | null;
  rosterStatus: string | null;
  verifiedAt: string | null;
  contextSource: string | null;
  rosterSource: string | null;
  historySource: string | null;
}
export interface FantasyTeam {
  id: string;
  name: string;
}
export interface RosterSettings {
  slots: SlotType[];
}
export interface LeagueSettings {
  name: string;
  teamCount: number;
  teams: FantasyTeam[];
  myTeamId: string;
  draftSlot: number | null;
  draftDate: string;
  roster: RosterSettings;
}
export interface DraftPick {
  overall: number;
  playerId: string;
  teamId: string;
}
export interface DraftState {
  picks: DraftPick[];
  slotOverrides: Record<string, string>;
}
export type MockStyle = "STANDARD" | "GUARD HEAVY" | "BIG HEAVY" | "CHAOTIC";
export interface MockDraftState extends DraftState {
  slot: number;
  style: MockStyle;
  seed: number;
}
export type TargetType =
  "PRIORITY" | "VALUE" | "SLEEPER" | "LATE ROUND" | "AVOID";
export interface PersonalPlayer {
  watch?: boolean;
  target?: TargetType;
  note?: string;
  rank?: number;
}
export type ScoringKey =
  | "PTS"
  | "FGM"
  | "FGMISS"
  | "FTM"
  | "FTMISS"
  | "3PM"
  | "OREB"
  | "REB"
  | "AST"
  | "STL"
  | "BLK"
  | "TO"
  | "EJ";
export type ScoringSettings = Record<ScoringKey, number>;
export interface AppState {
  schemaVersion: 2;
  appVersion: string;
  dataVersion: string;
  leagueSettings: LeagueSettings;
  scoringSettings: ScoringSettings;
  realDraft: DraftState;
  mockDraft: MockDraftState;
  personal: Record<string, PersonalPlayer>;
  preferences: { deepMode: boolean; draftDay: boolean; pool: number };
  setupDone: boolean;
  queues: { real: string[]; mock: string[] };
  autoRemoveQueued: boolean;
  eligibilityOverrides: Record<string, Position[]>;
  draftLocked: boolean;
}
export interface RosterSlot {
  id: string;
  type: SlotType;
  player: Player | null;
}
export interface RecommendationReason {
  label: string;
  detail: string;
}
export type Survival = "LIKELY TO SURVIVE" | "TOSS-UP" | "UNLIKELY TO SURVIVE";
export interface Recommendation {
  player: Player;
  score: number;
  breakdown: { label: string; value: number }[];
  dynamicRank: number;
  baseRank: number;
  value: number;
  vor: number | null;
  survival: Survival;
  action: "TAKE NOW" | "CAN PROBABLY WAIT" | "WAITING IS RISKY";
  reasons: RecommendationReason[];
  fit: string;
  tier: string;
}
export interface PositionScarcity {
  position: Position;
  remaining: number;
  replacement: number | null;
  demand: number;
  waitRisk: "LOW" | "MEDIUM" | "HIGH" | "VERY HIGH";
}
export interface OpponentNeed {
  teamId: string;
  positions: Position[];
}
export interface DraftAlert {
  title: string;
  detail: string;
}
