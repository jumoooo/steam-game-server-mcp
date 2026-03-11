/**
 * Discovery 도구 (명세 §13.2)
 * steam_discover_servers - Steam Master Server Query
 */

import { z } from "zod";
import { discoverServersViaSteam } from "../discovery/steam-query.js";

export type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
};

const steamDiscoverSchema = z.object({
  gameType: z.string().optional().describe("gamedig 타입 (rust, counterstrike2, tf2 등)"),
  region: z.string().optional().describe("지역 (us, eu, asia, all 등)"),
  maxHosts: z.number().int().min(1).max(200).optional().default(50).describe("최대 반환 개수"),
});

export const steamDiscoverServersSchema = steamDiscoverSchema;

export async function handleSteamDiscoverServers(
  args: z.infer<typeof steamDiscoverSchema>
): Promise<ToolResult> {
  const servers = await discoverServersViaSteam({
    gameType: args.gameType,
    region: args.region,
    maxHosts: args.maxHosts,
  });

  const text =
    servers.length === 0
      ? "검색된 서버가 없습니다.\n\nJSON:\n[]"
      : `Discovered ${servers.length} servers:\n${servers.slice(0, 20).map((s) => `- ${s}`).join("\n")}` +
        (servers.length > 20 ? `\n... and ${servers.length - 20} more` : "") +
        `\n\nJSON:\n${JSON.stringify({ servers, count: servers.length }, null, 2)}`;

  return { content: [{ type: "text", text }] };
}
