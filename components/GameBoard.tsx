"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { COLORS, COLOR_HEX, COLOR_JA, FLAGS, REGIONS, REGION_JA } from "@/lib/flags";
import {
  baseScore,
  bonusValue,
  bonusesHeld,
  canHold,
  canPlayHeld,
  canTake,
  cardsAvailable,
  deckAvailable,
  legalRoles,
  nameLength,
  roleDone,
  roleFlags,
  roleLabel,
  scoreOf,
} from "@/lib/rules";
import type { ClientToServerEvents } from "@/lib/socketEvents";
import type { BonusKind, Player, PublicEvent, RoleKey, RoomState } from "@/lib/types";
import { BONUS_POINTS, HOLD_LIMIT, NAME_GOAL, ROLE_SIZE, TAKES_PER_TURN } from "@/lib/types";

type Act = <E extends keyof ClientToServerEvents>(
  event: E,
  payload: Omit<Parameters<ClientToServerEvents[E]>[0], "code">
) => Promise<string | null>;

type Selection = { src: "market" | "hold"; flag: number };

const BONUS_LABEL: Record<BonusKind, string> = { color: "色役最多", region: "地域役最多", name: "最長国名" };
const BONUS_ICON: Record<BonusKind, string> = { color: "🎨", region: "🌍", name: "🔤" };
const BONUS_KINDS: BonusKind[] = ["color", "region", "name"];

export default function GameBoard({ room, viewerId, act }: { room: RoomState; viewerId: string; act: Act }) {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [error, setError] = useState<string | null>(null);

  const me = room.players.find((p) => p.id === viewerId);
  const turn = room.turn;
  const actor = turn ? room.players.find((p) => p.id === turn.playerId) : undefined;
  const myTurn = !!me && !!turn && turn.playerId === viewerId;
  const pending = turn?.pending ?? null;

  // A selection only counts while it is still something I could act on.
  const sel =
    selection && myTurn && me && pending === null
      ? selection.src === "market"
        ? canTake(turn!) && room.market.includes(selection.flag)
          ? selection
          : null
        : canPlayHeld(turn!) && me.hold.includes(selection.flag)
          ? selection
          : null
      : null;
  const activeFlag = myTurn ? (pending ?? sel?.flag ?? null) : null;
  const targets = activeFlag !== null && me && turn ? legalRoles(me, turn, activeFlag) : [];

  async function run(p: Promise<string | null>) {
    setError(await p);
    setSelection(null);
  }

  function placeAt(role: RoleKey) {
    if (activeFlag === null) return;
    if (pending !== null) run(act("game:resolveDraw", { to: role }));
    else if (sel?.src === "market") run(act("game:takeMarket", { flag: activeFlag, role }));
    else run(act("game:placeHeld", { flag: activeFlag, role }));
  }

  function toggle(next: Selection) {
    setError(null);
    setSelection(sel && sel.flag === next.flag ? null : next);
  }

  const takesLeft = turn ? TAKES_PER_TURN - turn.taken : 0;
  const nothingToTake = cardsAvailable(room) === 0;
  const hint = !turn
    ? null
    : !myTurn
      ? `${actor?.name ?? "?"}さんの手番です`
      : pending !== null
        ? "引いた国旗を置く役を選ぶか、保留してください"
        : sel
          ? "光っている役をタップして置きます"
          : nothingToTake
            ? "取れる国旗がありません。保留カードを置いたら手番を終えてください"
            : turn.taken === 0 && me!.hold.length > 0
              ? `保留カードを置くなら今(国旗を取ると置けません)。その後、国旗を${takesLeft}枚取ります`
              : `国旗をあと${takesLeft}枚取ってください(公開の国旗か山札をタップ)`;

  const others = room.order.map((id) => room.players.find((p) => p.id === id)!).filter((p) => p && p.id !== viewerId);
  const leading = Math.max(...room.players.map((p) => scoreOf(room, p)));

  return (
    <div className="flex flex-col gap-4">
      {room.phase === "gameover" && <Result room={room} viewerId={viewerId} act={act} onError={setError} />}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-white/10 bg-panel/80 px-4 py-3">
        <span className="text-sm text-white/50">
          第{room.round}ラウンド ・ 勝利点 <b className="text-ink">{room.settings.targetScore}</b>
        </span>
        {room.phase === "playing" && leading >= room.settings.targetScore && (
          <span className="rounded-full bg-red-500/20 px-3 py-0.5 text-sm font-bold text-red-300">最終ラウンド!</span>
        )}
        {hint && <span className={`text-sm font-semibold ${myTurn ? "text-lamp-light" : "text-white/70"}`}>{hint}</span>}
        {myTurn && nothingToTake && pending === null && (
          <button onClick={() => run(act("game:pass", {}))} className="rounded-full bg-lamp px-4 py-1 text-sm font-bold text-black hover:bg-lamp-light">
            手番を終える
          </button>
        )}
        {me?.isHost && actor && !actor.connected && (
          <button
            onClick={() => run(act("game:hostSkip", {}))}
            className="rounded-full border border-white/15 px-4 py-1 text-sm text-white/70 hover:bg-white/10"
          >
            {actor.name}さん(切断中)の手番を飛ばす
          </button>
        )}
        {error && <span className="text-sm text-red-400">{error}</span>}
      </div>

      <section className="rounded-xl border border-white/10 bg-panel/80 p-3 sm:p-4">
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8 sm:gap-3">
          {room.market.map((flagId, i) =>
            flagId === null ? (
              <div key={`empty-${i}`} className="flex min-h-24 items-center justify-center rounded-lg border border-dashed border-white/10 text-xs text-white/25">
                空き
              </div>
            ) : (
              <FlagCard
                key={flagId}
                flagId={flagId}
                selected={sel?.flag === flagId}
                onClick={myTurn && pending === null && canTake(turn!) ? () => toggle({ src: "market", flag: flagId }) : undefined}
              />
            )
          )}
          <button
            disabled={!myTurn || pending !== null || !canTake(turn!) || deckAvailable(room) === 0}
            onClick={() => run(act("game:draw", {}))}
            className="flex min-h-24 flex-col items-center justify-center gap-1 rounded-lg border-2 border-lamp-deep bg-gradient-to-br from-lamp-deep/60 to-black/40 p-2 enabled:hover:border-lamp disabled:opacity-60"
          >
            <span className="text-2xl">🂠</span>
            <span className="text-xs font-bold text-lamp-light">山札</span>
            <span className="text-xs text-white/50">残り{room.deckCount}枚</span>
            <span className="text-[10px] text-white/35">捨て札{room.discard.length}枚</span>
          </button>
          {pending !== null ? (
            <div className="flex flex-col gap-1">
              <FlagCard flagId={pending} selected />
              {myTurn && me && canHold(me) && (
                <button
                  onClick={() => run(act("game:resolveDraw", { to: "hold" }))}
                  className="rounded-full bg-lamp px-2 py-1 text-xs font-bold text-black hover:bg-lamp-light"
                >
                  保留する
                </button>
              )}
            </div>
          ) : (
            <div className="flex min-h-24 items-center justify-center rounded-lg border border-dashed border-white/10 p-1 text-center text-xs text-white/25">
              引いた国旗
            </div>
          )}
        </div>
      </section>

      {me && (
        <PlayerBoard
          room={room}
          player={me}
          isMe
          isTurn={myTurn}
          targets={targets}
          onRole={placeAt}
          selectedFlag={sel?.src === "hold" ? sel.flag : null}
          onHold={myTurn && pending === null && canPlayHeld(turn!) ? (flag) => toggle({ src: "hold", flag }) : undefined}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {others.map((p) => (
          <PlayerBoard key={p.id} room={room} player={p} isTurn={turn?.playerId === p.id} targets={[]} compact />
        ))}
      </div>

      <LogPanel room={room} />
    </div>
  );
}

function FlagImg({ flagId, className = "" }: { flagId: number; className?: string }) {
  const flag = FLAGS[flagId];
  return (
    <img
      src={`/flags/${flag.code}.svg`}
      alt={flag.name}
      title={`${flag.name}(${flag.len}文字・${REGION_JA[flag.region]})`}
      className={`aspect-[4/3] rounded-sm border border-white/20 bg-white/5 object-cover ${className}`}
    />
  );
}

function ColorDots({ flagId }: { flagId: number }) {
  return (
    <span className="flex gap-0.5">
      {FLAGS[flagId].colors.map((c) => (
        <span key={c} title={COLOR_JA[c]} className="h-2.5 w-2.5 rounded-full border border-white/40" style={{ background: COLOR_HEX[c] }} />
      ))}
    </span>
  );
}

function FlagCard({ flagId, selected, onClick }: { flagId: number; selected?: boolean; onClick?: () => void }) {
  const flag = FLAGS[flagId];
  return (
    <button
      disabled={!onClick}
      onClick={onClick}
      className={`kk-pop flex flex-col items-center gap-1 rounded-lg border-2 bg-white/5 p-1.5 text-center ${
        selected ? "border-lamp bg-lamp/15" : "border-white/10 enabled:hover:border-white/40"
      }`}
    >
      <FlagImg flagId={flagId} className="w-full" />
      <span className="w-full truncate text-xs font-bold leading-tight text-ink" title={flag.name}>
        {flag.name}
      </span>
      <span className="flex w-full items-center justify-between gap-1 text-[10px] text-white/50">
        <span className="truncate">{REGION_JA[flag.region]}</span>
        <span className="shrink-0">{flag.len}字</span>
      </span>
      <ColorDots flagId={flagId} />
    </button>
  );
}

function PlayerBoard({
  room,
  player,
  isMe = false,
  isTurn,
  targets,
  onRole,
  onHold,
  selectedFlag = null,
  compact = false,
}: {
  room: RoomState;
  player: Player;
  isMe?: boolean;
  isTurn: boolean;
  targets: RoleKey[];
  onRole?: (role: RoleKey) => void;
  onHold?: (flagId: number) => void;
  selectedFlag?: number | null;
  compact?: boolean;
}) {
  const bonuses = bonusesHeld(room, player.id);
  const len = nameLength(player);
  const nameTarget = targets.includes("name");
  const won = room.winners?.includes(player.id);

  return (
    <section className={`rounded-xl border bg-panel/80 p-3 ${isTurn ? "border-lamp/70" : "border-white/10"} ${compact ? "" : "sm:p-4"}`}>
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className={`font-bold ${player.connected ? "text-ink" : "text-white/40"}`}>
          {won && "👑 "}
          {player.name}
          {player.isBot && " 🤖"}
          {isMe && <span className="ml-1 text-xs font-normal text-white/40">(あなた)</span>}
        </span>
        {isTurn && <span className="rounded-full bg-lamp px-2 py-0.5 text-xs font-bold text-black">手番</span>}
        <span className="text-2xl font-black text-lamp">
          {scoreOf(room, player)}
          <span className="text-sm font-bold">点</span>
        </span>
        <span className="text-xs text-white/40">
          役{baseScore(player)}
          {bonuses.length > 0 && ` + ボーナス${bonuses.length * BONUS_POINTS}`}
        </span>
        {bonuses.map((k) => (
          <span key={k} className="rounded-full border border-lamp/50 bg-lamp/10 px-2 py-0.5 text-xs text-lamp-light">
            {BONUS_ICON[k]} {BONUS_LABEL[k]} +{BONUS_POINTS}
          </span>
        ))}
      </div>

      <div className={`grid grid-cols-3 gap-1.5 ${compact ? "" : "sm:grid-cols-6"}`}>
        {COLORS.map((c) => (
          <RoleCell key={c} player={player} role={`c:${c}`} target={targets.includes(`c:${c}`)} onRole={onRole}>
            <span className="h-3 w-3 rounded-full border border-white/40" style={{ background: COLOR_HEX[c] }} />
            {COLOR_JA[c]}
          </RoleCell>
        ))}
      </div>
      <div className={`mt-1.5 grid grid-cols-3 gap-1.5 ${compact ? "" : "sm:grid-cols-5"}`}>
        {REGIONS.map((r) => (
          <RoleCell key={r} player={player} role={`r:${r}`} target={targets.includes(`r:${r}`)} onRole={onRole}>
            {REGION_JA[r]}
          </RoleCell>
        ))}
      </div>

      <div className="mt-1.5 grid gap-1.5 sm:grid-cols-[1fr_auto]">
        <button
          disabled={!nameTarget}
          onClick={() => onRole?.("name")}
          className={`flex flex-col gap-1 rounded-lg border p-1.5 text-left ${
            nameTarget ? "kk-pulse cursor-pointer border-lamp bg-lamp/10" : len >= NAME_GOAL ? "border-emerald-400/40 bg-emerald-400/5" : "border-white/10 bg-white/[0.03]"
          }`}
        >
          <span className="flex items-center gap-2 text-xs">
            <b className="text-ink">国名役</b>
            <span className={len >= NAME_GOAL ? "font-bold text-emerald-300" : "text-white/50"}>
              {len} / {NAME_GOAL}文字{len >= NAME_GOAL && " ✓"}
            </span>
          </span>
          <span className="flex min-h-6 flex-wrap gap-1">
            {player.names.map((id) => (
              <span key={id} className="kk-pop flex items-center gap-1 rounded bg-white/5 px-1 py-0.5 text-[11px] text-white/80">
                <FlagImg flagId={id} className="w-5" />
                {FLAGS[id].name}
              </span>
            ))}
          </span>
        </button>

        <div className="flex flex-col gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-1.5">
          <span className="text-xs text-white/50">
            保留 {player.hold.length}/{HOLD_LIMIT}
          </span>
          <span className="flex gap-1">
            {Array.from({ length: HOLD_LIMIT }, (_, i) => {
              const flagId = player.hold[i];
              if (flagId === undefined) return <span key={`empty-${i}`} className="aspect-[4/3] w-14 rounded border border-dashed border-white/10" />;
              return (
                <button
                  key={flagId}
                  disabled={!onHold}
                  onClick={() => onHold?.(flagId)}
                  className={`kk-pop w-14 rounded border-2 p-0.5 ${
                    selectedFlag === flagId ? "border-lamp bg-lamp/15" : "border-transparent enabled:hover:border-white/40"
                  }`}
                >
                  <FlagImg flagId={flagId} className="w-full" />
                  <span className="block truncate text-[9px] leading-tight text-white/70">{FLAGS[flagId].name}</span>
                </button>
              );
            })}
          </span>
        </div>
      </div>
    </section>
  );
}

function RoleCell({
  player,
  role,
  target,
  onRole,
  children,
}: {
  player: Player;
  role: RoleKey;
  target: boolean;
  onRole?: (role: RoleKey) => void;
  children: React.ReactNode;
}) {
  const flags = roleFlags(player, role);
  const done = roleDone(player, role);
  return (
    <button
      disabled={!target}
      onClick={() => onRole?.(role)}
      className={`flex flex-col gap-1 rounded-lg border p-1.5 text-left ${
        target ? "kk-pulse cursor-pointer border-lamp bg-lamp/10" : done ? "border-emerald-400/40 bg-emerald-400/5" : "border-white/10 bg-white/[0.03]"
      }`}
    >
      <span className="flex items-center justify-between gap-1 text-xs">
        <b className="flex items-center gap-1 truncate text-ink">{children}</b>
        <span className={done ? "font-bold text-emerald-300" : "text-white/40"}>{done ? "✓" : `${flags.length}/${ROLE_SIZE}`}</span>
      </span>
      {done && <span className="flex aspect-[20/3] items-center justify-center text-[11px] font-bold text-emerald-300/80">完成 +1点</span>}
      <span className={done ? "hidden" : "grid grid-cols-5 gap-0.5"}>
        {Array.from({ length: ROLE_SIZE }, (_, i) =>
          flags[i] === undefined ? (
            <span key={`empty-${i}`} className="aspect-[4/3] rounded-sm border border-dashed border-white/10" />
          ) : (
            <FlagImg key={flags[i]} flagId={flags[i]} className="kk-pop w-full" />
          )
        )}
      </span>
    </button>
  );
}

function Result({ room, viewerId, act, onError }: { room: RoomState; viewerId: string; act: Act; onError: (e: string | null) => void }) {
  const ranked = [...room.players].sort((a, b) => scoreOf(room, b) - scoreOf(room, a));
  const winners = room.players.filter((p) => room.winners?.includes(p.id));
  const isHost = room.players.find((p) => p.id === viewerId)?.isHost;
  return (
    <section className="rounded-xl border-2 border-lamp bg-lamp/10 p-4 text-center">
      <p className="text-sm text-lamp-light">{room.endReason === "deck" ? "国旗がなくなりました" : "ゲーム終了"}</p>
      <h2 className="mb-3 text-2xl font-black text-ink">
        👑 {winners.map((p) => p.name).join(" と ")} の勝ち{winners.length > 1 && "(同着1位)"}
      </h2>
      <ul className="mx-auto mb-4 max-w-xs space-y-1 text-left text-sm">
        {ranked.map((p) => (
          <li key={p.id} className="flex justify-between gap-3">
            <span className="truncate">{p.name}</span>
            <b className="text-lamp">{scoreOf(room, p)}点</b>
          </li>
        ))}
      </ul>
      {isHost ? (
        <div className="flex justify-center gap-3">
          <button
            onClick={async () => onError(await act("game:playAgain", {}))}
            className="rounded-full bg-lamp px-6 py-2 font-bold text-black hover:bg-lamp-light"
          >
            もう一度遊ぶ
          </button>
          <button
            onClick={async () => onError(await act("game:backToLobby", {}))}
            className="rounded-full border border-white/15 px-6 py-2 font-semibold hover:bg-white/10"
          >
            ロビーへ戻る
          </button>
        </div>
      ) : (
        <p className="text-sm text-white/50">ホストの操作を待っています…</p>
      )}
    </section>
  );
}

function LogPanel({ room }: { room: RoomState }) {
  const name = (id: string | null) => room.players.find((p) => p.id === id)?.name ?? "?";
  const flag = (id: number) => FLAGS[id].name;
  function text(e: PublicEvent): string {
    switch (e.type) {
      case "round":
        return `— 第${e.round}ラウンド —`;
      case "take":
        return `${name(e.playerId)}: ${e.from === "market" ? "公開" : "山札"}から「${flag(e.flag)}」→ ${e.to === "hold" ? "保留" : roleLabel(e.to)}`;
      case "place":
        return `${name(e.playerId)}: 保留の「${flag(e.flag)}」→ ${roleLabel(e.to)}`;
      case "complete":
        return `🎉 ${name(e.playerId)}が${roleLabel(e.role)}を完成!(+1点)`;
      case "bonus":
        return `${BONUS_ICON[e.kind]} ${name(e.playerId)}が「${BONUS_LABEL[e.kind]}」を${e.from ? `${name(e.from)}から奪った` : "獲得"}!(+${BONUS_POINTS}点)`;
      case "reshuffle":
        return `♻️ 山札がなくなったので、捨て札${e.count}枚を混ぜて山札にした`;
      case "skip":
        return `${name(e.playerId)}の手番を飛ばした`;
      case "win":
        return `👑 ${e.winners.map(name).join(" と ")}の勝ち`;
    }
  }
  return (
    <section className="rounded-xl border border-white/10 bg-panel/80 p-3 text-sm">
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/50">
        {BONUS_KINDS.map((k) => {
          const holder = room.players.find((p) => p.id === room.bonus[k]);
          return (
            <span key={k}>
              {BONUS_ICON[k]} {BONUS_LABEL[k]}:{" "}
              {holder ? (
                <b className="text-lamp-light">
                  {holder.name}({bonusValue(holder, k)}
                  {k === "name" ? "文字" : "役"})
                </b>
              ) : (
                "まだいない"
              )}
            </span>
          );
        })}
      </div>
      <ul className="max-h-48 space-y-0.5 overflow-y-auto text-white/60">
        {[...room.log].reverse().map((e, i) => (
          <li key={room.log.length - i} className={e.type === "complete" || e.type === "bonus" || e.type === "win" ? "text-lamp-light" : ""}>
            {text(e)}
          </li>
        ))}
      </ul>
    </section>
  );
}
