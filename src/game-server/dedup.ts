/**
 * 동시 쿼리 Dedup - pendingQueries Map (명세 §6.3)
 */

import { queryServer } from "./query.js";
import { getCached, setCache } from "./cache.js";
import { pushTrendSample } from "./trend.js";
import type { ServerState } from "./types.js";

const pendingQueries = new Map<string, Promise<ServerState>>();

/** 캐시 + Dedup 적용 쿼리 */
export async function queryWithDedup(serverId: string): Promise<ServerState> {
  const cached = getCached(serverId);
  if (cached) return cached;

  const existing = pendingQueries.get(serverId);
  if (existing) return existing;

  const promise = queryServer(serverId)
    .then((result) => {
      setCache(serverId, result);
      pendingQueries.delete(serverId);
      // server_trend 연동: 쿼리 성공 시 샘플 추가
      pushTrendSample(serverId, result.players);
      return result;
    })
    .catch((err) => {
      pendingQueries.delete(serverId);
      throw err;
    });

  pendingQueries.set(serverId, promise);
  return promise;
}
