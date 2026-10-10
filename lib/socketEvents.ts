import type { RoleKey, RoomSettings, RoomState } from "./types";

type Ack = (res: SocketResult<null>) => void;

// Client -> server
export interface ClientToServerEvents {
  "room:create": (payload: { name: string }, cb: (res: SocketResult<{ room: RoomState; playerId: string }>) => void) => void;
  "room:createTest": (payload: { name: string }, cb: (res: SocketResult<{ room: RoomState; playerId: string }>) => void) => void;
  "room:join": (payload: { code: string; name: string }, cb: (res: SocketResult<{ room: RoomState; playerId: string }>) => void) => void;
  "room:rejoin": (payload: { code: string; playerId: string }, cb: (res: SocketResult<{ room: RoomState }>) => void) => void;
  "room:start": (payload: { code: string }, cb: Ack) => void;
  "room:settings": (payload: { code: string; settings: Partial<RoomSettings> }, cb: Ack) => void;
  "room:addBot": (payload: { code: string }, cb: Ack) => void;
  "room:removeBot": (payload: { code: string; botId: string }, cb: Ack) => void;
  "game:placeHeld": (payload: { code: string; flag: number; role: RoleKey }, cb: Ack) => void;
  "game:takeMarket": (payload: { code: string; flag: number; role: RoleKey }, cb: Ack) => void;
  "game:draw": (payload: { code: string }, cb: Ack) => void;
  "game:resolveDraw": (payload: { code: string; to: RoleKey | "hold" }, cb: Ack) => void;
  "game:pass": (payload: { code: string }, cb: Ack) => void;
  "game:hostSkip": (payload: { code: string }, cb: Ack) => void;
  "game:playAgain": (payload: { code: string }, cb: Ack) => void;
  "game:backToLobby": (payload: { code: string }, cb: Ack) => void;
}

// server -> client
export interface ServerToClientEvents {
  "room:update": (room: RoomState) => void;
  "room:error": (message: string) => void;
  "room:closed": () => void;
}

export type SocketResult<T> = { ok: true; data: T } | { ok: false; error: string };

export interface SocketData {
  playerId?: string;
  roomCode?: string;
}
