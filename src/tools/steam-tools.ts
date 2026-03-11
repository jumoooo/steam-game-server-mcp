/**
 * Steam API 기반 MCP 도구 핸들러
 */

import { z } from "zod";
import * as steam from "../steam-api/client.js";

// 입력 스키마 (타입 추론용)
export const vanityUrlSchema = z.object({ vanityurl: z.string().min(2).max(32) });
export const steamIdsSchema = z.object({
  steamids: z.string().regex(/^[\d,]+$/, "쉼표로 구분된 SteamID (17자리 숫자)"),
});
export const steamIdSchema = z.object({
  steamid: z.string().regex(/^\d{17}$/, "17자리 SteamID"),
});
export const appIdSchema = z.object({ appid: z.number().int().min(0) });
export const addrSchema = z.object({
  addr: z.string().regex(/^[\d.]+(:\d{1,5})?$/, "IP 또는 IP:포트 (예: 192.168.1.1:27015)"),
});

export type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
};

/** 커스텀 URL → SteamID */
export async function handleResolveVanityUrl(
  args: z.infer<typeof vanityUrlSchema>
): Promise<ToolResult> {
  const { steamid } = await steam.resolveVanityUrl(args.vanityurl);
  return { content: [{ type: "text", text: JSON.stringify({ steamid }, null, 2) }] };
}

/** 프로필 요약 */
export async function handleGetPlayerSummary(
  args: z.infer<typeof steamIdsSchema>
): Promise<ToolResult> {
  const { players } = await steam.getPlayerSummaries(args.steamids);
  return { content: [{ type: "text", text: JSON.stringify({ players }, null, 2) }] };
}

/** 보유 게임 */
export async function handleGetOwnedGames(
  args: z.infer<typeof steamIdSchema> & { include_appinfo?: boolean; include_played_free_games?: boolean }
): Promise<ToolResult> {
  const { steamid, include_appinfo, include_played_free_games } = args;
  const { games, game_count } = await steam.getOwnedGames(steamid, {
    include_appinfo,
    include_played_free_games,
  });
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({ game_count, games }, null, 2),
      },
    ],
  };
}

/** 최근 플레이 */
export async function handleGetRecentlyPlayed(
  args: z.infer<typeof steamIdSchema> & { count?: number }
): Promise<ToolResult> {
  const { games } = await steam.getRecentlyPlayedGames(args.steamid, args.count);
  return { content: [{ type: "text", text: JSON.stringify({ games }, null, 2) }] };
}

/** 동시 접속자 수 */
export async function handleGetCurrentPlayers(
  args: z.infer<typeof appIdSchema>
): Promise<ToolResult> {
  const { player_count } = await steam.getNumberOfCurrentPlayers(args.appid);
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({ appid: args.appid, player_count }, null, 2),
      },
    ],
  };
}

/** IP로 서버 조회 */
export async function handleGetServersAtAddress(
  args: z.infer<typeof addrSchema>
): Promise<ToolResult> {
  const { servers } = await steam.getServersAtAddress(args.addr);
  return { content: [{ type: "text", text: JSON.stringify({ servers }, null, 2) }] };
}

/** 앱 뉴스 */
export async function handleGetAppNews(
  args: z.infer<typeof appIdSchema> & { count?: number; maxlength?: number }
): Promise<ToolResult> {
  const { newsitems } = await steam.getNewsForApp(
    args.appid,
    args.count ?? 5,
    args.maxlength ?? 300
  );
  return { content: [{ type: "text", text: JSON.stringify({ newsitems }, null, 2) }] };
}
