import type { Color, Region, Symbol } from "./flags";

/** Where a flag can go: one color role, one region role, one symbol role, or the name role. */
export type RoleKey = `c:${Color}` | `r:${Region}` | `s:${Symbol}` | "name";

export interface Player {
  id: string;
  name: string;
  connected: boolean;
  isHost: boolean;
  /** Server-driven test player (only in test rooms). */
  isBot: boolean;
  /** Completed color/region/symbol roles. Their flags have gone to the discard pile. */
  done: RoleKey[];
  /** Flag ids placed in each color role that is still being built. */
  colors: Record<Color, number[]>;
  regions: Record<Region, number[]>;
  symbols: Record<Symbol, number[]>;
  /** Name role, in the order the flags were added. */
  names: number[];
  /** Deck flags kept without a role yet (public). */
  hold: number[];
}

export interface TurnState {
  playerId: string;
  /** Flags taken this turn (market or deck), 0..TAKES_PER_TURN. */
  taken: number;
  /** Open flag the player has committed to; it must now be given a role. */
  picked: number | null;
  /** `picked` is a bonus flag: the refill that matched the region of the open flag just taken. */
  bonus: boolean;
  /** Flag just drawn from the deck, waiting to be placed or held. */
  pending: number | null;
  /** Color/region/symbol roles that already received a flag this turn. */
  used: RoleKey[];
}

/** "symbol" is different from the rest: the first to finish all three symbol roles keeps it for good. */
export type BonusKind = "color" | "region" | "name" | "symbol";

export type PublicEvent =
  | { type: "round"; round: number }
  | { type: "take"; playerId: string; flag: number; from: "market" | "deck" | "bonus"; to: RoleKey | "hold" }
  /** The refill matched the region of the flag just taken, so the player gets it too. */
  | { type: "extra"; playerId: string; flag: number }
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
  /** Open flags, refilled as soon as one is taken. A slot is only null when there was nothing to refill it with. */
  market: (number | null)[];
  order: string[];
  turnIndex: number;
  round: number;
  turn: TurnState | null;
  /** Current holder (player id) of each +2 bonus. */
  bonus: Record<BonusKind, string | null>;
  log: PublicEvent[];
  /** Events logged so far this game. The log itself is capped, so clients use this to spot new ones. */
  eventCount: number;
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
/** Flags needed to complete a color, region or symbol role. */
export const ROLE_SIZE = 5;
/** Total name characters needed to complete the name role. */
export const NAME_GOAL = 20;
/** Completed roles needed before each "most roles" bonus can be held. */
export const BONUS_MIN_ROLES = { color: 4, region: 3 } as const;
export const BONUS_POINTS = 2;
export const DEFAULT_TARGET = 10;
/** Moon and sun roles are worth more because so few flags have one. */
export const SYMBOL_POINTS: Record<Symbol, number> = { star: 1, moon: 2, sun: 2 };
