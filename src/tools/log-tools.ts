/**
 * Log 도구 (명세 §7.6)
 * log_recent_events - 서버 로그에서 player_join, player_leave, error 추출
 */

import { z } from "zod";
import { getServerConfig } from "../config/servers.js";
import { analyzeLogEvents } from "../logs/analyzer.js";

export type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
};

const logRecentEventsSchema = z.object({
  serverId: z.string().min(1, "serverId는 필수입니다"),
  lines: z.number().int().min(1).max(500).optional().default(100).describe("읽을 최대 줄 수"),
});

export const logRecentEventsSchemaExport = logRecentEventsSchema;

export async function handleLogRecentEvents(
  args: z.infer<typeof logRecentEventsSchema>
): Promise<ToolResult> {
  const config = getServerConfig(args.serverId);

  if (!config.logPath?.trim()) {
    throw new Error(`서버 ${args.serverId}에 logPath가 설정되지 않았습니다.`);
  }

  const events = analyzeLogEvents(config.logPath, config.type, args.lines);

  const summary = events
    .map((e) => `[${e.type}] ${e.playerName ?? ""} ${e.message.slice(0, 80)}`)
    .join("\n");
  const text =
    `Recent events (${events.length}):\n${summary || "(없음)"}\n\n` +
    `JSON:\n${JSON.stringify({ events, count: events.length }, null, 2)}`;

  return { content: [{ type: "text", text }] };
}
