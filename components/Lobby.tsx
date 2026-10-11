"use client";

import { useState } from "react";
import { FLAGS } from "@/lib/flags";
import type { RoomSettings, RoomState } from "@/lib/types";
import { MAX_PLAYERS, MIN_PLAYERS } from "@/lib/types";
import RulesPanel from "./RulesPanel";

export default function Lobby({
  room,
  viewerId,
  onStart,
  onSettings,
  onAddBot,
  onRemoveBot,
}: {
  room: RoomState;
  viewerId: string;
  onStart: () => Promise<string | null>;
  onSettings: (settings: Partial<RoomSettings>) => Promise<string | null>;
  onAddBot: () => Promise<string | null>;
  onRemoveBot: (botId: string) => Promise<string | null>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const me = room.players.find((p) => p.id === viewerId);
  const isHost = !!me?.isHost;
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/room/${room.code}` : "";
  const count = room.players.length;
  const target = room.settings.targetScore;
  const startBlocker = count < MIN_PLAYERS ? `開始には${MIN_PLAYERS}人以上必要です(現在${count}人)` : null;
  const botControls = room.isTest && isHost;

  async function handleStart() {
    setStarting(true);
    const err = await onStart();
    setStarting(false);
    setError(err);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      // clipboard unavailable; user can copy manually
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl text-center">
      <p className="mb-1 text-white/60">部屋コード</p>
      <div className="mb-4 flex items-center justify-center gap-3">
        <span className="pl-[0.3em] text-5xl font-black tracking-[0.3em]">
          <span className="text-tri-blue-bright">{room.code.slice(0, 2)}</span>
          <span className="text-tri-white">{room.code.slice(2, 3)}</span>
          <span className="text-tri-red">{room.code.slice(3)}</span>
        </span>
      </div>
      <div className="mb-6 flex items-center justify-center gap-2">
        <input
          readOnly
          value={shareUrl}
          className="w-full max-w-sm rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70"
        />
        <button onClick={copyLink} className="whitespace-nowrap rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/20">
          リンクをコピー
        </button>
      </div>

      {room.isTest && (
        <p className="mb-4 rounded-lg border border-tri-blue-light/40 bg-tri-blue/15 px-4 py-2 text-sm text-tri-blue-light">
          🤖 テスト部屋: ボットが自動で相手をします。{isHost && "ボットの追加・削除ができます。"}
        </p>
      )}

      <ul className="mb-6 space-y-2 text-left">
        {room.players.map((p) => (
          <li key={p.id} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-3">
            <span className={`min-w-0 flex-1 truncate ${p.connected ? "" : "opacity-40"}`}>
              {p.name}
              {p.isBot && " 🤖"}
              {p.isHost && <span className="ml-1 text-xs text-white/40">(ホスト)</span>}
            </span>
            {p.id === viewerId && <span className="shrink-0 text-xs text-white/40">(あなた)</span>}
            {botControls && p.isBot && (
              <button
                onClick={async () => setError(await onRemoveBot(p.id))}
                className="rounded border border-white/15 px-1.5 text-xs text-white/60 hover:bg-white/10"
                title="ボットを外す"
              >
                ×
              </button>
            )}
          </li>
        ))}
        {botControls && count < MAX_PLAYERS && (
          <li>
            <button
              onClick={async () => setError(await onAddBot())}
              className="w-full rounded-lg border border-dashed border-white/15 py-2 text-sm text-white/60 hover:bg-white/10"
            >
              + ボットを追加
            </button>
          </li>
        )}
      </ul>

      <div className="mb-6 flex items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm">
        <span className="text-white/50">勝利点</span>
        <button
          disabled={!isHost || target <= 3}
          onClick={async () => setError(await onSettings({ targetScore: target - 1 }))}
          className="h-8 w-8 rounded-lg border border-white/10 enabled:hover:bg-white/10 disabled:opacity-30"
        >
          −
        </button>
        <span className="w-10 text-center text-base font-bold">{target}</span>
        <button
          disabled={!isHost || target >= 25}
          onClick={async () => setError(await onSettings({ targetScore: target + 1 }))}
          className="h-8 w-8 rounded-lg border border-white/10 enabled:hover:bg-white/10 disabled:opacity-30"
        >
          +
        </button>
        <span className="text-white/40">国旗 全{FLAGS.length}種</span>
      </div>

      {startBlocker && <p className="mb-4 text-sm text-white/50">{startBlocker}</p>}

      {isHost ? (
        <button
          onClick={handleStart}
          disabled={starting || !!startBlocker}
          className="rounded-full bg-tri-blue px-8 py-3 font-bold text-white hover:bg-tri-blue-bright disabled:cursor-not-allowed disabled:opacity-40"
        >
          {starting ? "開始中..." : "ゲームを始める"}
        </button>
      ) : (
        <p className="text-white/60">ホストの開始を待っています…</p>
      )}
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      <p className="mt-2 text-xs text-white/35">最大{MAX_PLAYERS}人</p>

      <div className="mt-10 text-left">
        <RulesPanel defaultOpen />
      </div>
    </div>
  );
}
