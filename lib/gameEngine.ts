import { COLORS, FLAGS, REGIONS, SYMBOLS, type Color, type Region, type Symbol } from "./flags";
import {
  bonusValue,
  canHold,
  canPlayHeld,
  canTake,
  cardsAvailable,
  nameLength,
  placeError,
  roleFlags,
  scoreOf,
} from "./rules";
import {
  DEFAULT_TARGET,
  MARKET_SIZE,
  MAX_PLAYERS,
  MIN_PLAYERS,
  NAME_GOAL,
  ROLE_SIZE,
  TAKES_PER_TURN,
  TEST_ROOM_CODE,
  type BonusKind,
  type EndReason,
  type Player,
  type PublicEvent,
  type RoleKey,
  type RoomSettings,
  type RoomState,
  type TurnState,
} from "./types";

export class GameError extends Error {}

const LOG_LIMIT = 80;

function rand(n: number): number {
  return Math.floor(Math.random() * n);
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeRoomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = TEST_ROOM_CODE;
  while (code === TEST_ROOM_CODE) {
    code = "";
    for (let i = 0; i < 5; i++) code += alphabet[rand(alphabet.length)];
  }
  return code;
}

// ---------------------------------------------------------------------------
// Rooms and lobby

function emptyBoard(): Pick<Player, "done" | "colors" | "regions" | "symbols" | "names" | "hold"> {
  return {
    done: [],
    colors: Object.fromEntries(COLORS.map((c) => [c, []])) as unknown as Record<Color, number[]>,
    regions: Object.fromEntries(REGIONS.map((r) => [r, []])) as unknown as Record<Region, number[]>,
    symbols: Object.fromEntries(SYMBOLS.map((s) => [s, []])) as unknown as Record<Symbol, number[]>,
    names: [],
    hold: [],
  };
}

function newPlayer(id: string, name: string, isHost: boolean, isBot = false): Player {
  return { id, name, connected: true, isHost, isBot, ...emptyBoard() };
}

export function createRoom(hostId: string, hostName: string, isTest = false): RoomState {
  return {
    code: makeRoomCode(),
    isTest,
    phase: "lobby",
    players: [newPlayer(hostId, hostName, true)],
    settings: { targetScore: DEFAULT_TARGET },
    deck: [],
    deckCount: 0,
    discard: [],
    market: [],
    order: [],
    turnIndex: 0,
    round: 0,
    turn: null,
    bonus: { color: null, region: null, name: null, symbol: null },
    log: [],
    eventCount: 0,
    winners: null,
    endReason: null,
    createdAt: Date.now(),
  };
}

export function addPlayer(room: RoomState, playerId: string, name: string): RoomState {
  if (room.phase !== "lobby") throw new GameError("このゲームはすでに開始されています");
  if (room.players.some((p) => p.id === playerId)) return room;
  if (room.players.length >= MAX_PLAYERS) throw new GameError(`部屋の定員(${MAX_PLAYERS}人)に達しています`);
  const players = [...room.players, newPlayer(playerId, name, false)];
  if (!players.some((p) => p.isHost)) players[0] = { ...players[0], isHost: true };
  return { ...room, players };
}

export function markConnection(room: RoomState, playerId: string, connected: boolean): RoomState {
  return { ...room, players: room.players.map((p) => (p.id === playerId ? { ...p, connected } : p)) };
}

export function removePlayer(room: RoomState, playerId: string): RoomState {
  const players = room.players.filter((p) => p.id !== playerId);
  if (players.length > 0 && !players.some((p) => p.isHost)) players[0] = { ...players[0], isHost: true };
  return { ...room, players };
}

export function updateSettings(room: RoomState, requesterId: string, settings: Partial<RoomSettings>): RoomState {
  const requester = room.players.find((p) => p.id === requesterId);
  if (!requester?.isHost) throw new GameError("ホストのみが設定を変更できます");
  if (room.phase !== "lobby" && room.phase !== "gameover") throw new GameError("ゲーム中は設定を変更できません");
  const next: RoomSettings = { ...room.settings };
  const v = settings.targetScore;
  if (typeof v === "number" && Number.isFinite(v)) next.targetScore = Math.min(25, Math.max(3, Math.round(v)));
  return { ...room, settings: next };
}

// Test rooms: the host can add bots that play automatically (see lib/bot.ts).

export function addBot(room: RoomState, requesterId: string): RoomState {
  const requester = room.players.find((p) => p.id === requesterId);
  if (!requester?.isHost) throw new GameError("ホストのみがボットを追加できます");
  if (!room.isTest) throw new GameError("ボットはテスト部屋でのみ使えます");
  if (room.phase !== "lobby") throw new GameError("ゲーム中はボットを追加できません");
  if (room.players.length >= MAX_PLAYERS) throw new GameError(`部屋の定員(${MAX_PLAYERS}人)に達しています`);
  let n = 1;
  while (room.players.some((p) => p.name === `ボット${n}`)) n++;
  const id = `bot-${Date.now().toString(36)}-${rand(1e6).toString(36)}`;
  return { ...room, players: [...room.players, newPlayer(id, `ボット${n}`, false, true)] };
}

export function removeBot(room: RoomState, requesterId: string, botId: string): RoomState {
  const requester = room.players.find((p) => p.id === requesterId);
  if (!requester?.isHost) throw new GameError("ホストのみがボットを外せます");
  if (room.phase !== "lobby") throw new GameError("ゲーム中はボットを外せません");
  if (!room.players.some((p) => p.id === botId && p.isBot)) throw new GameError("ボットが見つかりません");
  return { ...room, players: room.players.filter((p) => p.id !== botId) };
}

function dealNewGame(prev: RoomState): RoomState {
  if (prev.players.length < MIN_PLAYERS) throw new GameError(`${MIN_PLAYERS}人以上で開始できます`);
  const r = structuredClone(prev);
  r.players = r.players.map((p) => ({ ...p, ...emptyBoard() }));
  r.deck = shuffle(FLAGS.map((f) => f.id));
  r.market = r.deck.splice(0, MARKET_SIZE);
  r.deckCount = r.deck.length;
  r.discard = [];
  // Turn order is random each game.
  r.order = shuffle(r.players.map((p) => p.id));
  r.turnIndex = 0;
  r.round = 1;
  r.bonus = { color: null, region: null, name: null, symbol: null };
  r.log = [{ type: "round", round: 1 }];
  r.eventCount = 1;
  r.winners = null;
  r.endReason = null;
  r.phase = "playing";
  beginTurn(r);
  return r;
}

export function startGame(room: RoomState, requesterId: string): RoomState {
  const requester = room.players.find((p) => p.id === requesterId);
  if (!requester?.isHost) throw new GameError("ホストのみがゲームを開始できます");
  if (room.phase !== "lobby") throw new GameError("すでにゲームが開始されています");
  return dealNewGame(room);
}

export function playAgain(room: RoomState, requesterId: string): RoomState {
  const requester = room.players.find((p) => p.id === requesterId);
  if (!requester?.isHost) throw new GameError("ホストのみが再戦を開始できます");
  if (room.phase !== "gameover") throw new GameError("ゲームはまだ終わっていません");
  return dealNewGame(room);
}

/** Back to the lobby after a game (to change players or settings). */
export function backToLobby(room: RoomState, requesterId: string): RoomState {
  const requester = room.players.find((p) => p.id === requesterId);
  if (!requester?.isHost) throw new GameError("ホストのみが操作できます");
  if (room.phase !== "gameover") throw new GameError("ゲームはまだ終わっていません");
  return { ...room, phase: "lobby" };
}

// ---------------------------------------------------------------------------
// Turn flow

function byId(room: RoomState, id: string): Player {
  const p = room.players.find((x) => x.id === id);
  if (!p) throw new GameError("プレイヤーが見つかりません");
  return p;
}

function log(room: RoomState, event: PublicEvent) {
  room.log.push(event);
  room.eventCount++;
  if (room.log.length > LOG_LIMIT) room.log.splice(0, room.log.length - LOG_LIMIT);
}

/** Top flag of the deck; an empty deck is first rebuilt from the discard pile. */
function drawTop(room: RoomState): number | undefined {
  if (room.deck.length === 0 && room.discard.length > 0) {
    room.deck = shuffle(room.discard);
    room.discard = [];
    log(room, { type: "reshuffle", count: room.deck.length });
  }
  const flagId = room.deck.shift();
  room.deckCount = room.deck.length;
  return flagId;
}

function beginTurn(room: RoomState) {
  room.turn = { playerId: room.order[room.turnIndex], taken: 0, picked: null, bonus: false, pending: null, used: [] };
}

/** Clones the room and returns it with the acting player and their turn. */
function act(room: RoomState, playerId: string): { r: RoomState; player: Player; turn: TurnState } {
  if (room.phase !== "playing" || !room.turn) throw new GameError("ゲーム中ではありません");
  if (room.turn.playerId !== playerId) throw new GameError("あなたの手番ではありません");
  const r = structuredClone(room);
  return { r, player: byId(r, playerId), turn: r.turn! };
}

/**
 * Movable +2 bonuses work like Catan's longest road: the first to qualify
 * takes it, and it only moves when someone strictly beats the holder.
 */
function updateBonus(room: RoomState, player: Player, kind: BonusKind) {
  const mine = bonusValue(player, kind);
  if (!mine) return;
  const holderId = room.bonus[kind];
  if (holderId === player.id) return;
  if (holderId && mine <= bonusValue(byId(room, holderId), kind)) return;
  room.bonus[kind] = player.id;
  log(room, { type: "bonus", kind, playerId: player.id, from: holderId });
}

function place(room: RoomState, player: Player, turn: TurnState, flagId: number, role: RoleKey) {
  const error = placeError(player, turn, flagId, role);
  if (error) throw new GameError(error);
  if (role === "name") {
    const before = nameLength(player);
    player.names.push(flagId);
    if (before < NAME_GOAL && nameLength(player) >= NAME_GOAL) log(room, { type: "complete", playerId: player.id, role });
    updateBonus(room, player, "name");
    return;
  }
  const flags = roleFlags(player, role);
  flags.push(flagId);
  turn.used.push(role);
  if (flags.length >= ROLE_SIZE) {
    // A finished role stays scored, but its flags go back into circulation.
    player.done.push(role);
    room.discard.push(...flags.splice(0));
    log(room, { type: "complete", playerId: player.id, role });
  }
  if (role.startsWith("c:")) updateBonus(room, player, "color");
  if (role.startsWith("r:")) updateBonus(room, player, "region");
  // Everyone with all three symbol roles has the same value, so only the first ever gets this one.
  if (role.startsWith("s:")) updateBonus(room, player, "symbol");
}

function finish(room: RoomState, winners: Player[], reason: EndReason) {
  room.phase = "gameover";
  room.turn = null;
  room.winners = winners.map((p) => p.id);
  room.endReason = reason;
  log(room, { type: "win", winners: room.winners, reason });
}

function topScorers(room: RoomState, players: Player[]): Player[] {
  const best = Math.max(...players.map((p) => scoreOf(room, p)));
  return players.filter((p) => scoreOf(room, p) === best);
}

function endTurn(room: RoomState) {
  // Slots are refilled as flags are taken; this catches any left empty while the deck was out.
  room.market = room.market.map((m) => m ?? drawTop(room) ?? null);

  room.turnIndex++;
  if (room.turnIndex < room.order.length) return beginTurn(room);

  // Everyone has had the same number of turns: check for a winner.
  const reached = room.players.filter((p) => scoreOf(room, p) >= room.settings.targetScore);
  if (reached.length) return finish(room, topScorers(room, reached), "score");
  if (cardsAvailable(room) === 0) return finish(room, topScorers(room, room.players), "deck");
  room.turnIndex = 0;
  room.round++;
  log(room, { type: "round", round: room.round });
  beginTurn(room);
}

function afterTake(room: RoomState, turn: TurnState) {
  turn.taken++;
  if (turn.taken >= TAKES_PER_TURN || cardsAvailable(room) === 0) endTurn(room);
}

/** Turn start only: put a held flag into a role. */
export function placeHeld(room: RoomState, playerId: string, flagId: number, role: RoleKey): RoomState {
  const { r, player, turn } = act(room, playerId);
  if (!canPlayHeld(turn)) throw new GameError("保留カードを置けるのは、国旗を取る前だけです");
  const index = player.hold.indexOf(flagId);
  if (index < 0) throw new GameError("その国旗は保留していません");
  place(r, player, turn, flagId, role);
  player.hold.splice(index, 1);
  log(r, { type: "place", playerId, flag: flagId, to: role });
  return r;
}

/** Commit to an open flag. Its name is only shown after this, so there is no going back. */
export function pickMarket(room: RoomState, playerId: string, flagId: number): RoomState {
  const { r, turn } = act(room, playerId);
  if (!canTake(turn)) throw new GameError("いまは国旗を取れません");
  if (!r.market.includes(flagId)) throw new GameError("その国旗は公開されていません");
  turn.picked = flagId;
  return r;
}

/**
 * Give the picked open flag its role. Its slot is refilled at once, and if the
 * new flag is from the same region the player gets that one too (it becomes
 * `picked` and must be placed). A bonus flag never earns another bonus.
 */
export function takeMarket(room: RoomState, playerId: string, role: RoleKey): RoomState {
  const { r, player, turn } = act(room, playerId);
  const flagId = turn.picked;
  if (flagId === null) throw new GameError("先に公開の国旗を選んでください");
  const wasBonus = turn.bonus;
  place(r, player, turn, flagId, role);
  const refill = drawTop(r) ?? null;
  r.market[r.market.indexOf(flagId)] = refill;
  log(r, { type: "take", playerId, flag: flagId, from: wasBonus ? "bonus" : "market", to: role });
  if (!wasBonus && refill !== null && FLAGS[refill].region === FLAGS[flagId].region) {
    turn.picked = refill;
    turn.bonus = true;
    log(r, { type: "extra", playerId, flag: refill });
    return r;
  }
  turn.picked = null;
  turn.bonus = false;
  afterTake(r, turn);
  return r;
}

/** Draw the top flag of the deck; it then waits for resolveDraw. */
export function drawDeck(room: RoomState, playerId: string): RoomState {
  const { r, turn } = act(room, playerId);
  if (!canTake(turn)) throw new GameError("いまは国旗を取れません");
  const flagId = drawTop(r);
  if (flagId === undefined) throw new GameError("山札がありません");
  turn.pending = flagId;
  return r;
}

/** Place the drawn flag in a role, or keep it for a later turn. */
export function resolveDraw(room: RoomState, playerId: string, to: RoleKey | "hold"): RoomState {
  const { r, player, turn } = act(room, playerId);
  const flagId = turn.pending;
  if (flagId === null) throw new GameError("山札から引いた国旗がありません");
  if (to === "hold") {
    if (!canHold(player)) throw new GameError("保留できるのは3枚までです");
    player.hold.push(flagId);
  } else {
    place(r, player, turn, flagId, to);
  }
  turn.pending = null;
  log(r, { type: "take", playerId, flag: flagId, from: "deck", to });
  afterTake(r, turn);
  return r;
}

/** Only needed when there is nothing left to take. */
export function passTurn(room: RoomState, playerId: string): RoomState {
  const { r, turn } = act(room, playerId);
  if (turn.pending !== null || turn.picked !== null) throw new GameError("選んだ国旗の置き場所を決めてください");
  if (cardsAvailable(r) > 0) throw new GameError("国旗を2枚取ってください");
  endTurn(r);
  return r;
}

/** The host can move the game along when the player to act has dropped out. */
export function hostSkip(room: RoomState, requesterId: string): RoomState {
  const requester = room.players.find((p) => p.id === requesterId);
  if (!requester?.isHost) throw new GameError("ホストのみが操作できます");
  if (room.phase !== "playing" || !room.turn) throw new GameError("進められる手番がありません");
  const actor = byId(room, room.turn.playerId);
  if (actor.connected) throw new GameError("そのプレイヤーは接続中です");
  const r = structuredClone(room);
  const a = byId(r, actor.id);
  const turn = r.turn!;
  if (turn.pending !== null) {
    // A drawn flag can't go back: keep it if there's room, else it joins the name role.
    if (canHold(a)) a.hold.push(turn.pending);
    else place(r, a, turn, turn.pending, "name");
    turn.pending = null;
  }
  log(r, { type: "skip", playerId: actor.id });
  endTurn(r);
  return r;
}

// ---------------------------------------------------------------------------
// Visibility

/** Everything is open information except the order of the deck. */
export function sanitizeForPlayer(room: RoomState): RoomState {
  return { ...room, deck: [] };
}
