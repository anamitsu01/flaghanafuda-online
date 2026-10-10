// Pure rule helpers shared by the server engine and the client UI.
import { COLORS, COLOR_JA, FLAGS, REGIONS, REGION_JA, type Color, type Region } from "./flags";
import {
  BONUS_MIN_ROLES,
  BONUS_POINTS,
  HOLD_LIMIT,
  NAME_GOAL,
  TAKES_PER_TURN,
  type BonusKind,
  type Player,
  type RoleKey,
  type RoomState,
  type TurnState,
} from "./types";

export function roleLabel(role: RoleKey): string {
  if (role === "name") return "国名役";
  const [kind, key] = role.split(":");
  return kind === "c" ? `${COLOR_JA[key as Color]}役` : `${REGION_JA[key as Region]}役`;
}

export function roleFlags(player: Player, role: RoleKey): number[] {
  if (role === "name") return player.names;
  const [kind, key] = role.split(":");
  return kind === "c" ? player.colors[key as Color] : player.regions[key as Region];
}

export function roleDone(player: Player, role: RoleKey): boolean {
  return player.done.includes(role);
}

export function colorRolesDone(player: Player): number {
  return COLORS.filter((c) => roleDone(player, `c:${c}`)).length;
}

export function regionRolesDone(player: Player): number {
  return REGIONS.filter((r) => roleDone(player, `r:${r}`)).length;
}

export function nameLength(player: Player): number {
  return player.names.reduce((n, id) => n + FLAGS[id].len, 0);
}

/** What a player must beat to take each bonus; 0 while they don't qualify. */
export function bonusValue(player: Player, kind: BonusKind): number {
  if (kind === "name") {
    const len = nameLength(player);
    return len >= NAME_GOAL ? len : 0;
  }
  const done = kind === "color" ? colorRolesDone(player) : regionRolesDone(player);
  return done >= BONUS_MIN_ROLES ? done : 0;
}

export function baseScore(player: Player): number {
  return colorRolesDone(player) + regionRolesDone(player) + (nameLength(player) >= NAME_GOAL ? 1 : 0);
}

export function bonusesHeld(room: RoomState, playerId: string): BonusKind[] {
  return (["color", "region", "name"] as const).filter((k) => room.bonus[k] === playerId);
}

export function scoreOf(room: RoomState, player: Player): number {
  return baseScore(player) + bonusesHeld(room, player.id).length * BONUS_POINTS;
}

/** Why `flagId` can't go to `role` right now, or null if it can. */
export function placeError(player: Player, turn: TurnState, flagId: number, role: RoleKey): string | null {
  const flag = FLAGS[flagId];
  if (role === "name") return null;
  const [kind, key] = role.split(":");
  if (kind === "c" && !flag.colors.includes(key as Color)) return `${flag.name}に${COLOR_JA[key as Color]}はありません`;
  if (kind === "r" && flag.region !== key) return `${flag.name}は${REGION_JA[key as Region]}ではありません`;
  if (roleDone(player, role)) return `${roleLabel(role)}はもう完成しています`;
  if (turn.used.includes(role)) return `${roleLabel(role)}には、このターンもう1枚置いています`;
  return null;
}

/** Every role `flagId` may be placed in right now (the name role always qualifies). */
export function legalRoles(player: Player, turn: TurnState, flagId: number): RoleKey[] {
  const flag = FLAGS[flagId];
  const roles: RoleKey[] = [...flag.colors.map((c) => `c:${c}` as RoleKey), `r:${flag.region}`, "name"];
  return roles.filter((role) => !placeError(player, turn, flagId, role));
}

export function canHold(player: Player): boolean {
  return player.hold.length < HOLD_LIMIT;
}

/** Flags that can still be drawn: the deck plus the discard pile that refills it. */
export function deckAvailable(room: RoomState): number {
  return room.deckCount + room.discard.length;
}

export function cardsAvailable(room: RoomState): number {
  return deckAvailable(room) + room.market.filter((m) => m !== null).length;
}

/** Held flags may only be played before the first take of the turn. */
export function canPlayHeld(turn: TurnState): boolean {
  return turn.taken === 0 && turn.pending === null && turn.picked === null;
}

export function canTake(turn: TurnState): boolean {
  return turn.taken < TAKES_PER_TURN && turn.pending === null && turn.picked === null;
}
