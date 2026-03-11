/**
 * 게임 서버 데이터 모델 (명세 §5)
 */

/** ping 기반 지연 카테고리 */
export type LatencyCategory = "GOOD" | "NORMAL" | "HIGH" | "CRITICAL";

/** 서버 상태 (정규화된 형태) */
export interface ServerState {
  id: string;
  name: string;
  map: string;
  players: number;
  maxPlayers: number;
  ping: number;
  game: string;
  latencyCategory: LatencyCategory;
  playerList?: ServerPlayer[];
  rules?: Record<string, string>;
  queriedAt: string; // ISO 8601
}

/** 플레이어 정보 */
export interface ServerPlayer {
  name: string;
  score?: number;
  time?: number;
}

/** HealthStatus (server_health, server_diagnose) */
export type HealthStatus = "GOOD" | "WARNING" | "HIGH_LOAD" | "CRITICAL";
