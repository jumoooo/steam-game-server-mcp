/**
 * server_trend - Map<serverId, Array<{ts, players}>>
 * 명세 §13.1: 최대 20샘플, "Trend: increasing" 출력
 */

export interface TrendSample {
  ts: number;
  players: number;
}

const MAX_SAMPLES = 20;
const trendHistory = new Map<string, TrendSample[]>();

/** 샘플 추가 (최대 20개 유지) */
export function pushTrendSample(serverId: string, players: number): void {
  const arr = trendHistory.get(serverId) ?? [];
  arr.push({ ts: Date.now(), players });
  if (arr.length > MAX_SAMPLES) arr.shift();
  trendHistory.set(serverId, arr);
}

/** 서버별 히스토리 조회 */
export function getTrendHistory(serverId: string): TrendSample[] {
  return trendHistory.get(serverId) ?? [];
}

/** 트렌드 방향 계산: increasing | decreasing | stable */
export function computeTrend(history: TrendSample[]): "increasing" | "decreasing" | "stable" {
  if (history.length < 2) return "stable";
  const first = history[0].players;
  const last = history[history.length - 1].players;
  const diff = last - first;
  if (diff > 0) return "increasing";
  if (diff < 0) return "decreasing";
  return "stable";
}

/** "Players last 10 minutes: 12 → 18 → 25, Trend: increasing" 형식 */
export function formatTrendOutput(serverId: string): string {
  const history = getTrendHistory(serverId);
  if (history.length === 0) return `서버 ${serverId}: 트렌드 데이터 없음`;
  const players = history.map((s) => s.players).join(" → ");
  const trend = computeTrend(history);
  return `Players last 10 minutes: ${players}, Trend: ${trend}`;
}
