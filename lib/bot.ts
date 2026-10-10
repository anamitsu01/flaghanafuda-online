import { FLAGS } from "./flags";
import { drawDeck, passTurn, placeHeld, resolveDraw, takeMarket } from "./gameEngine";
import { canHold, canPlayHeld, deckAvailable, legalRoles, nameLength, roleFlags } from "./rules";
import { NAME_GOAL, type Player, type RoleKey, type RoomState, type TurnState } from "./types";

/** How much the bot likes putting `flagId` into `role`: roles closer to done score higher. */
function value(room: RoomState, bot: Player, flagId: number, role: RoleKey): number {
  if (role === "name") {
    const len = FLAGS[flagId].len;
    if (nameLength(bot) < NAME_GOAL) return len / 3;
    return room.bonus.name === bot.id ? len / 8 : len / 5;
  }
  return roleFlags(bot, role).length + 1 + (role.startsWith("r:") ? 0.5 : 0);
}

function best(room: RoomState, bot: Player, turn: TurnState, flagId: number): { role: RoleKey; value: number } {
  return legalRoles(bot, turn, flagId)
    .map((role) => ({ role, value: value(room, bot, flagId, role) }))
    .sort((a, b) => b.value - a.value)[0];
}

/** One action for the bot whose turn it is: simple greedy play, no lookahead. */
export function botAct(room: RoomState, botId: string): RoomState {
  const turn = room.turn!;
  const bot = room.players.find((p) => p.id === botId)!;

  if (turn.pending !== null) {
    const pick = best(room, bot, turn, turn.pending);
    return resolveDraw(room, botId, pick.value < 2.5 && canHold(bot) ? "hold" : pick.role);
  }

  if (canPlayHeld(turn)) {
    // Play held flags that have somewhere useful to go; when the hold is full, free a slot anyway.
    const options = bot.hold.map((flagId) => ({ flagId, ...best(room, bot, turn, flagId) })).sort((a, b) => b.value - a.value);
    const pick = options[0];
    if (pick && (pick.value >= 2.5 || !canHold(bot))) return placeHeld(room, botId, pick.flagId, pick.role);
  }

  const open = room.market
    .flatMap((flagId) => (flagId === null ? [] : [{ flagId, ...best(room, bot, turn, flagId) }]))
    .sort((a, b) => b.value - a.value);
  if (open[0] && (open[0].value >= 3 || deckAvailable(room) === 0)) return takeMarket(room, botId, open[0].flagId, open[0].role);
  if (deckAvailable(room) > 0) return drawDeck(room, botId);
  return passTurn(room, botId);
}
