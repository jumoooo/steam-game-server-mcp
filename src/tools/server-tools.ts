/**
 * 게임 서버 및 모니터링 MCP 도구 (명세 §7.3, §7.4)
 */

import { z } from "zod";
import { queryWithDedup } from "../game-server/dedup.js";
import { formatTrendOutput, getTrendHistory } from "../game-server/trend.js";
import { getQueryableServers, getServerConfig } from "../config/servers.js";
import type { ServerState, HealthStatus } from "../game-server/types.js";

export type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
};

const serverIdSchema = z.string().min(1, "serverId는 필수입니다");

/** ServerState → 사용자용 텍스트 포맷 */
function formatServerState(state: ServerState, health?: HealthStatus, reason?: string): string {
  const lines = [
    `Server ${state.name}`,
    `Players: ${state.players}/${state.maxPlayers} | Map: ${state.map} | Ping: ${state.ping === -1 ? "N/A" : `${state.ping}ms`}`,
    `Health: ${health ?? "N/A"} | Latency: ${state.latencyCategory}`,
  ];
  if (reason) lines.push(`Reason: ${reason}`);
  return lines.join("\n");
}

/** evaluateHealth (명세 §5.4) */
function evaluateHealth(state: ServerState): { status: HealthStatus; reason?: string } {
  if (state.ping === -1) return { status: "CRITICAL", reason: "Server offline or timeout" };
  if (state.ping > 300) return { status: "WARNING", reason: "High ping" };
  const ratio = state.maxPlayers > 0 ? state.players / state.maxPlayers : 0;
  if (ratio > 0.95) return { status: "HIGH_LOAD", reason: "Server nearly full" };
  return { status: "GOOD" };
}

/** detectAlert (명세 §5.5) */
function detectAlert(server: ServerState): string | null {
  if (server.ping === -1) return "OFFLINE";
  if (server.ping > 300) return "HIGH_PING";
  const ratio = server.maxPlayers > 0 ? server.players / server.maxPlayers : 0;
  if (ratio > 0.95) return "HIGH_LOAD";
  return null;
}

/** server_diagnose용 분석 항목 생성 */
function buildAnalysis(state: ServerState, health: { status: HealthStatus; reason?: string }): string[] {
  const items: string[] = [];
  if (state.ping === -1) items.push("서버 오프라인 또는 타임아웃");
  else if (state.ping > 200) items.push("네트워크 지연");
  const ratio = state.maxPlayers > 0 ? state.players / state.maxPlayers : 0;
  if (ratio > 0.9) items.push("서버 과부하 가능성");
  if (health.reason) items.push(health.reason);
  return items.length ? items : ["정상 범위"];
}

// --- game_server_query ---
export const gameServerQuerySchema = z.object({ serverId: serverIdSchema });

export async function handleGameServerQuery(
  args: z.infer<typeof gameServerQuerySchema>
): Promise<ToolResult> {
  getServerConfig(args.serverId); // 등록 여부 검증
  const state = await queryWithDedup(args.serverId);
  const text = formatServerState(state) + "\n\nJSON:\n" + JSON.stringify(state, null, 2);
  return { content: [{ type: "text", text }] };
}

// --- game_server_players ---
export async function handleGameServerPlayers(
  args: z.infer<typeof gameServerQuerySchema>
): Promise<ToolResult> {
  getServerConfig(args.serverId);
  const state = await queryWithDedup(args.serverId);
  const playerList = state.playerList ?? [];
  const text =
    `Players (${playerList.length}):\n` +
    playerList.map((p) => `- ${p.name}${p.score != null ? ` (score: ${p.score})` : ""}`).join("\n") +
    "\n\nJSON:\n" +
    JSON.stringify({ playerList }, null, 2);
  return { content: [{ type: "text", text }] };
}

// --- game_server_rules ---
export async function handleGameServerRules(
  args: z.infer<typeof gameServerQuerySchema>
): Promise<ToolResult> {
  getServerConfig(args.serverId);
  const state = await queryWithDedup(args.serverId);
  const rules = state.rules ?? {};
  const text =
    `Rules:\n` +
    Object.entries(rules)
      .map(([k, v]) => `- ${k}: ${v}`)
      .join("\n") +
    "\n\nJSON:\n" +
    JSON.stringify({ rules }, null, 2);
  return { content: [{ type: "text", text }] };
}

// --- server_overview ---
export async function handleServerOverview(): Promise<ToolResult> {
  const servers = getQueryableServers();
  if (servers.length === 0) {
    return {
      content: [{ type: "text", text: "등록된 쿼리 가능 서버가 없습니다.\n\nJSON:\n[]" }],
    };
  }
  const results = await Promise.all(
    servers.map((s) => queryWithDedup(s.id).catch((err) => ({ error: err.message, id: s.id })))
  );
  const states: ServerState[] = [];
  const errors: string[] = [];
  for (const r of results) {
    if ("error" in r) errors.push(`${r.id}: ${r.error}`);
    else states.push(r);
  }
  const summary = states
    .map((s) => `${s.name}: ${s.players}/${s.maxPlayers} | ${s.map} | ${s.ping}ms`)
    .join("\n");
  const json = JSON.stringify({ servers: states, errors: errors.length ? errors : undefined }, null, 2);
  const text = `Overview:\n${summary}${errors.length ? `\nErrors:\n${errors.join("\n")}` : ""}\n\nJSON:\n${json}`;
  return { content: [{ type: "text", text }] };
}

// --- server_health ---
export async function handleServerHealth(
  args: z.infer<typeof gameServerQuerySchema>
): Promise<ToolResult> {
  getServerConfig(args.serverId);
  const state = await queryWithDedup(args.serverId);
  const health = evaluateHealth(state);
  const text =
    formatServerState(state, health.status, health.reason) +
    "\n\nJSON:\n" +
    JSON.stringify({ ...state, health: health.status, reason: health.reason }, null, 2);
  return { content: [{ type: "text", text }] };
}

// --- server_diagnose ---
export async function handleServerDiagnose(
  args: z.infer<typeof gameServerQuerySchema>
): Promise<ToolResult> {
  getServerConfig(args.serverId);
  const state = await queryWithDedup(args.serverId);
  const health = evaluateHealth(state);
  const analysis = buildAnalysis(state, health);
  const text =
    `Server Diagnosis: ${state.name}\n\n` +
    `Ping: ${state.ping === -1 ? "N/A" : `${state.ping}ms`} (${state.latencyCategory})\n` +
    `Player load: ${state.players}/${state.maxPlayers}\n\n` +
    `Possible issues:\n${analysis.map((a) => `- ${a}`).join("\n")}\n\n` +
    `JSON:\n` +
    JSON.stringify({ status: health.status, reason: health.reason, analysis, ...state }, null, 2);
  return { content: [{ type: "text", text }] };
}

// --- server_compare ---
export const serverCompareSchema = z.object({
  serverIds: z.array(serverIdSchema).optional(),
});

export async function handleServerCompare(
  args: z.infer<typeof serverCompareSchema>
): Promise<ToolResult> {
  const servers = args.serverIds?.length
    ? args.serverIds.map((id) => getServerConfig(id))
    : getQueryableServers();
  const ids = servers.map((s) => s.id);
  const states = await Promise.all(
    ids.map((id) => queryWithDedup(id).catch(() => null))
  );
  const valid = states.filter((s): s is ServerState => s !== null);
  if (valid.length === 0) {
    return { content: [{ type: "text", text: "비교할 수 있는 서버가 없습니다.\n\nJSON:\n[]" }] };
  }
  const bestPing = valid.reduce((a, b) => (a.ping >= 0 && (b.ping < 0 || b.ping < a.ping) ? b : a));
  const mostPlayers = valid.reduce((a, b) => (b.players > a.players ? b : a));
  const recommendation = `추천: 낮은 ping → ${bestPing.name} (${bestPing.ping}ms), 인원 많음 → ${mostPlayers.name} (${mostPlayers.players}명)`;
  const text =
    `Compare:\n${valid.map((s) => `${s.name}: ${s.players}/${s.maxPlayers} | ${s.ping}ms`).join("\n")}\n\n${recommendation}\n\nJSON:\n` +
    JSON.stringify({ servers: valid, recommendation }, null, 2);
  return { content: [{ type: "text", text }] };
}

// --- server_trend (명세 §13.1) ---
export async function handleServerTrend(
  args: z.infer<typeof gameServerQuerySchema>
): Promise<ToolResult> {
  getServerConfig(args.serverId); // 등록 여부 검증
  // 트렌드 데이터가 없으면 한 번 쿼리해서 샘플 생성
  const history = getTrendHistory(args.serverId);
  if (history.length === 0) {
    await queryWithDedup(args.serverId);
  }
  const text =
    formatTrendOutput(args.serverId) +
    "\n\nJSON:\n" +
    JSON.stringify({ serverId: args.serverId, history: getTrendHistory(args.serverId) }, null, 2);
  return { content: [{ type: "text", text }] };
}

// --- server_alert ---
export async function handleServerAlert(): Promise<ToolResult> {
  const servers = getQueryableServers();
  if (servers.length === 0) {
    return { content: [{ type: "text", text: "등록된 서버가 없습니다.\n\nJSON:\n[]" }] };
  }
  const states = await Promise.all(
    servers.map((s) => queryWithDedup(s.id).catch(() => null))
  );
  const alerts = states
    .filter((s): s is ServerState => s !== null)
    .map((s) => ({ serverId: s.id, alertType: detectAlert(s) }))
    .filter((a) => a.alertType !== null) as Array<{ serverId: string; alertType: string }>;
  const text =
    alerts.length === 0
      ? "문제가 감지된 서버가 없습니다.\n\nJSON:\n[]"
      : `Alerts:\n${alerts.map((a) => `- ${a.serverId}: ${a.alertType}`).join("\n")}\n\nJSON:\n` +
        JSON.stringify(alerts, null, 2);
  return { content: [{ type: "text", text }] };
}
