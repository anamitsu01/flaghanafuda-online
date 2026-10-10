import type { Color, Region } from "./flags";

/** Where a flag can go: one color role, one region role, or the name role. */
export type RoleKey = `c:${Color}` | `r:${Region}` | "name";

export interface Player {
  id: string;
  name: string;
  connected: boolean;
  isHost: boolean;
  /** Server-driven test player (only in test rooms). */
  isBot: boolean;
  /** Completed color/region roles. Their flags have gone to the discard pile. */
  done: RoleKey[];
  /** Flag ids placed in each color role that is still being built. */
  colors: Record<Color, number[]>;
  regions: Record<Region, number[]>;
  /** Name role, in the order the flags were added. */
  names: number[];
  /** Deck flags kept without a role yet (public). */
  hold: number[];
}

export interface TurnState {
  playerId: string;
  /** Flags taken this turn (market or deck), 0..TAKES_PER_TURN. */
  taken: number;
  /** Flag just drawn from the deck, waiting to be placed or held. */
  pending: number | null;
  /** Color/region roles that already received a flag this turn. */
  used: RoleKey[];
}

export type BonusKind = "color" | "region" | "name";

export type PublicEvent =
  | { type: "round"; round: number }
  | { type: "take"; playerId: string; flag: number; from: "market" | "deck"; to: RoleKey | "hold" }
  | { type: "place"; playerId: string; flag: number; to: RoleKey }
  | { type: "complete"; playerId: string; role: RoleKey }
  | { type: "bonus"; kind: BonusKind; playerId: string; from: string | null }
  | { type: "reshuffle"; count: number }
  | { type: "skip"; playerId: string }
  | { type: "win"; winners: string[]; reason: EndReason };

/** "score": someone had the target at a round end. "deck": the flags ran out. */
export type EndReason = "score" | "deck";

export interface RoomSettings {
  targetScore: number;
}

export interface RoomState {
  code: string;
  /** Test room (opened with TEST_ROOM_CODE): the host can add bots that play automatically. */
  isTest: boolean;
  phase: "lobby" | "playing" | "gameover";
  players: Player[];
  settings: RoomSettings;
  /** Server only; emptied for clients (see deckCount). */
  deck: number[];
  deckCount: number;
  /** Flags from completed color/region roles; shuffled back into the deck when it runs out. */
  discard: number[];
  /** Open flags. A taken slot stays null until the turn ends. */
  market: (number | null)[];
  order: string[];
  turnIndex: number;
  round: number;
  turn: TurnState | null;
  /** Current holder (player id) of each movable +2 bonus. */
  bonus: Record<BonusKind, string | null>;
  log: PublicEvent[];
  winners: string[] | null;
  endReason: EndReason | null;
  createdAt: number;
}

/** Entering this room code opens a fresh private test room with bots. */
export const TEST_ROOM_CODE = "ZZZZZ";
export const TEST_ROOM_BOTS = 3;

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;

export const MARKET_SIZE = 6;
export const TAKES_PER_TURN = 2;
export const HOLD_LIMIT = 3;
/** Flags needed to complete a color or region role. */
export const ROLE_SIZE = 5;
/** Total name characters needed to complete the name role. */
export const NAME_GOAL = 20;
/** Completed roles needed before the "most roles" bonus can be held. */
export const BONUS_MIN_ROLES = 3;
export const BONUS_POINTS = 2;
export const DEFAULT_TARGET = 10;
