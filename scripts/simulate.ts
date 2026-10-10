// ルール処理をボット同士の対戦で大量に回して検証する。
//   npx tsx scripts/simulate.ts [試合数]
import { botAct } from "../lib/bot";
import { FLAGS } from "../lib/flags";
import { addBot, createRoom, startGame } from "../lib/gameEngine";
import { scoreOf } from "../lib/rules";
import { HOLD_LIMIT, MAX_PLAYERS, MIN_PLAYERS, ROLE_SIZE, type RoomState } from "../lib/types";

const games = Number(process.argv[2]) || 200;

function check(room: RoomState) {
  const seen = new Set<number>();
  const add = (id: number | null) => {
    if (id === null) return;
    if (seen.has(id)) throw new Error(`国旗が重複: ${FLAGS[id].name}`);
    seen.add(id);
  };
  room.deck.forEach(add);
  room.market.forEach(add);
  add(room.turn?.pending ?? null);
  for (const p of room.players) {
    if (p.hold.length > HOLD_LIMIT) throw new Error("保留が上限超え");
    for (const list of [...Object.values(p.colors), ...Object.values(p.regions)]) {
      if (list.length > ROLE_SIZE) throw new Error("役が5枚超え");
      list.forEach(add);
    }
    p.names.forEach(add);
    p.hold.forEach(add);
  }
  if (seen.size !== FLAGS.length) throw new Error(`国旗の総数が合わない: ${seen.size}`);
}

for (let count = MIN_PLAYERS; count <= MAX_PLAYERS; count++) {
  let rounds = 0;
  let deckEnds = 0;
  let ties = 0;
  let topScore = 0;
  for (let g = 0; g < games; g++) {
    let room = createRoom("host", "ホスト", true);
    for (let i = 1; i < count; i++) room = addBot(room, "host");
    room = startGame(room, "host");
    let guard = 0;
    while (room.phase === "playing") {
      room = botAct(room, room.turn!.playerId);
      check(room);
      if (++guard > 5000) throw new Error("終わらない");
    }
    rounds += room.round;
    if (room.endReason === "deck") deckEnds++;
    if (room.winners!.length > 1) ties++;
    topScore += Math.max(...room.players.map((p) => scoreOf(room, p)));
  }
  console.log(
    `${count}人: 平均${(rounds / games).toFixed(1)}ラウンド / 勝者の平均${(topScore / games).toFixed(1)}点 / 山札切れ終了${deckEnds}回 / 同着${ties}回 (${games}試合)`
  );
}
