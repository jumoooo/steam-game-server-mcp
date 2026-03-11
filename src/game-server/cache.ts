/**
 * 서버 쿼리 캐시 - TTL 30초 (명세 §6.2)
 */

import type { ServerState } from "./types.js";

/** 캐시 TTL (ms) */
export const CACHE_TTL = 30_000;

const cache = new Map<string, { data: ServerState; ts: number }>();

export function getCached(serverId: string): ServerState | null {
  const cached = cache.get(serverId);
  if (!cached) return null;
  if (Date.now() - cached.ts >= CACHE_TTL) {
    cache.delete(serverId);
    return null;
  }
  return cached.data;
}

export function setCache(serverId: string, data: ServerState): void {
  cache.set(serverId, { data, ts: Date.now() });
}

export function invalidateCache(serverId: string): void {
  cache.delete(serverId);
}
