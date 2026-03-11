/**
 * gamedig raw 결과 → ServerState 정규화 (명세 §5.3)
 */

import type { ServerState, LatencyCategory, ServerPlayer } from "./types.js";

/** gamedig v5 결과 타입 (Results + 확장) */
export interface GamedigResult {
  name?: string;
  map?: string;
  players?: Array<{ name?: string; score?: number; time?: number; raw?: Record<string, unknown> }>;
  numplayers?: number;
  maxplayers?: number;
  ping?: number;
  type?: string;
  raw?: Record<string, string | number | unknown>;
}

/** ping → LatencyCategory (명세 §5.2) */
export function getLatencyCategory(ping: number): LatencyCategory {
  if (ping < 0) return "CRITICAL";
  if (ping <= 100) return "GOOD";
  if (ping <= 200) return "NORMAL";
  if (ping <= 300) return "HIGH";
  return "CRITICAL";
}

/** gamedig raw → ServerState 변환 */
export function normalize(raw: GamedigResult, serverId: string): ServerState {
  const ping = raw.ping ?? -1;
  const playerList: ServerPlayer[] | undefined = raw.players?.map((p) => ({
    name: p.name ?? "Unknown",
    score: p.score,
    time: p.time,
  }));

  const playerCount = raw.players?.length ?? raw.numplayers ?? 0;
  return {
    id: serverId,
    name: (raw.name ?? "Unknown").trim(),
    map: raw.map ?? "Unknown",
    players: playerCount,
    maxPlayers: raw.maxplayers ?? 0,
    ping,
    game: (raw.raw?.game as string) ?? raw.type ?? "unknown",
    latencyCategory: getLatencyCategory(ping),
    playerList: playerList?.length ? playerList : undefined,
    rules: raw.raw as Record<string, string> | undefined,
    queriedAt: new Date().toISOString(),
  };
}
