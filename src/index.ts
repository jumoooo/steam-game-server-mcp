#!/usr/bin/env node
/**
 * Steam & Game Server MCP 서버
 * .env의 STEAM_API_KEY, STEAM_ID 사용
 */

import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  handleResolveVanityUrl,
  handleGetPlayerSummary,
  handleGetOwnedGames,
  handleGetRecentlyPlayed,
  handleGetCurrentPlayers,
  handleGetServersAtAddress,
  handleGetAppNews,
} from "./tools/steam-tools.js";
import {
  handleGameServerQuery,
  handleGameServerPlayers,
  handleGameServerRules,
  handleServerOverview,
  handleServerHealth,
  handleServerDiagnose,
  handleServerCompare,
  handleServerAlert,
  handleServerTrend,
  gameServerQuerySchema,
  serverCompareSchema,
} from "./tools/server-tools.js";
import {
  handleKickPlayer,
  handleBanPlayer,
  handleRestartServer,
  handleRconCommand,
  kickPlayerSchema,
  banPlayerSchema,
  restartServerSchema,
  rconCommandSchema,
} from "./tools/admin-tools.js";
import {
  handleAddServer,
  handleRemoveServer,
  handleListServers,
  handleAutoDiscoverServers,
  addServerSchema,
  removeServerSchema,
  listServersSchema,
  autoDiscoverServersSchema,
} from "./tools/inventory-tools.js";
import {
  handleSteamDiscoverServers,
  steamDiscoverServersSchema,
} from "./tools/discovery-tools.js";
import {
  handleLogRecentEvents,
  logRecentEventsSchemaExport,
} from "./tools/log-tools.js";

const server = new McpServer(
  {
    name: "steam-game-server",
    version: "1.0.0",
  },
  {
    instructions: `Steam 프로필, 게임 라이브러리, 동시 접속자, 게임 서버 정보를 조회하는 MCP 서버입니다.
.env의 STEAM_API_KEY가 필요합니다. STEAM_ID는 기본값으로 사용됩니다.
게임 서버 조회/관리 도구는 servers.json에 등록된 서버만 대상으로 합니다.`,
  }
);

// steam_resolve_vanity_url: 커스텀 URL → SteamID
server.registerTool(
  "steam_resolve_vanity_url",
  {
    description: "Steam 커스텀 URL(예: /id/username)을 64비트 SteamID로 변환합니다.",
    inputSchema: {
      vanityurl: z.string().min(2).max(32).describe("커스텀 URL ID (예: gaben)"),
    },
  },
  async (args) => handleResolveVanityUrl(args as { vanityurl: string })
);

// steam_get_player_summary: 프로필 요약
server.registerTool(
  "steam_get_player_summary",
  {
    description: "Steam 사용자 프로필 요약(닉네임, 아바타, 상태 등)을 반환합니다.",
    inputSchema: {
      steamids: z
        .string()
        .describe("쉼표로 구분된 SteamID (최대 100개, 예: 76561197960287930,76561198161813998)"),
    },
  },
  async (args) => handleGetPlayerSummary(args as { steamids: string })
);

// steam_get_owned_games: 보유 게임
server.registerTool(
  "steam_get_owned_games",
  {
    description: "사용자가 보유한 게임 목록을 반환합니다.",
    inputSchema: {
      steamid: z.string().regex(/^\d{17}$/).describe("SteamID"),
      include_appinfo: z.boolean().optional().default(true).describe("게임명, 아이콘 등 포함"),
      include_played_free_games: z.boolean().optional().default(false).describe("무료 게임 포함"),
    },
  },
  async (args) =>
    handleGetOwnedGames(args as { steamid: string; include_appinfo?: boolean; include_played_free_games?: boolean })
);

// steam_get_recently_played: 최근 플레이
server.registerTool(
  "steam_get_recently_played",
  {
    description: "최근 플레이한 게임 목록을 반환합니다.",
    inputSchema: {
      steamid: z.string().regex(/^\d{17}$/).describe("SteamID"),
      count: z.number().int().min(1).max(100).optional().describe("반환 개수 (기본: 전체)"),
    },
  },
  async (args) => handleGetRecentlyPlayed(args as { steamid: string; count?: number })
);

// steam_get_current_players: 동시 접속자
server.registerTool(
  "steam_get_current_players",
  {
    description: "특정 앱의 실시간 동시 접속자 수를 반환합니다. (0: Steam 전체, 570: Dota2, 730: CS2, 440: TF2)",
    inputSchema: {
      appid: z.number().int().min(0).describe("Steam 앱 ID"),
    },
  },
  async (args) => handleGetCurrentPlayers(args as { appid: number })
);

// steam_get_servers_at_address: IP로 서버 조회
server.registerTool(
  "steam_get_servers_at_address",
  {
    description: "IP 또는 IP:포트로 해당 주소의 게임 서버 목록을 조회합니다.",
    inputSchema: {
      addr: z.string().describe("IP 또는 IP:queryport (예: 192.168.1.1:27015)"),
    },
  },
  async (args) => handleGetServersAtAddress(args as { addr: string })
);

// steam_get_app_news: 앱 뉴스
server.registerTool(
  "steam_get_app_news",
  {
    description: "앱 뉴스/패치 노트를 반환합니다.",
    inputSchema: {
      appid: z.number().int().min(0).describe("Steam 앱 ID"),
      count: z.number().int().min(1).max(20).optional().default(5).describe("반환 개수"),
      maxlength: z.number().int().min(0).optional().default(300).describe("내용 최대 길이"),
    },
  },
  async (args) =>
    handleGetAppNews(args as { appid: number; count?: number; maxlength?: number })
);

// --- Game Server 도구 ---
server.registerTool(
  "game_server_query",
  {
    description: "servers.json에 등록된 게임 서버의 상태(이름, 맵, 인원, ping)를 조회합니다.",
    inputSchema: { serverId: gameServerQuerySchema.shape.serverId },
  },
  async (args) => handleGameServerQuery(args as { serverId: string })
);

server.registerTool(
  "game_server_players",
  {
    description: "게임 서버의 플레이어 목록을 조회합니다.",
    inputSchema: { serverId: gameServerQuerySchema.shape.serverId },
  },
  async (args) => handleGameServerPlayers(args as { serverId: string })
);

server.registerTool(
  "game_server_rules",
  {
    description: "게임 서버의 규칙(cvars)을 조회합니다.",
    inputSchema: { serverId: gameServerQuerySchema.shape.serverId },
  },
  async (args) => handleGameServerRules(args as { serverId: string })
);

// --- Monitoring 도구 ---
server.registerTool(
  "server_overview",
  {
    description: "등록된 모든 게임 서버의 상태를 한 번에 조회합니다.",
    inputSchema: {},
  },
  async () => handleServerOverview()
);

server.registerTool(
  "server_health",
  {
    description: "단일 서버의 상태(HealthStatus)를 진단합니다.",
    inputSchema: { serverId: gameServerQuerySchema.shape.serverId },
  },
  async (args) => handleServerHealth(args as { serverId: string })
);

server.registerTool(
  "server_diagnose",
  {
    description: "AI용 서버 진단(원인 분석)을 수행합니다.",
    inputSchema: { serverId: gameServerQuerySchema.shape.serverId },
  },
  async (args) => handleServerDiagnose(args as { serverId: string })
);

server.registerTool(
  "server_compare",
  {
    description: "여러 서버를 비교하고 추천합니다. serverIds 생략 시 전체 서버 비교.",
    inputSchema: {
      serverIds: z.array(z.string()).optional().describe("비교할 서버 ID 목록 (생략 시 전체)"),
    },
  },
  async (args) => handleServerCompare(args as { serverIds?: string[] })
);

server.registerTool(
  "server_alert",
  {
    description: "문제가 감지된 서버만 필터링하여 반환합니다.",
    inputSchema: {},
  },
  async () => handleServerAlert()
);

server.registerTool(
  "server_trend",
  {
    description: "서버의 플레이어 수 추이(트렌드)를 반환합니다. game_server_query 호출 시 샘플이 누적됩니다.",
    inputSchema: { serverId: gameServerQuerySchema.shape.serverId },
  },
  async (args) => handleServerTrend(args as { serverId: string })
);

// --- Admin 도구 ---
server.registerTool(
  "server_admin_kick_player",
  {
    description: "플레이어를 서버에서 추방합니다.",
    inputSchema: {
      serverId: kickPlayerSchema.shape.serverId,
      playerName: kickPlayerSchema.shape.playerName,
      reason: kickPlayerSchema.shape.reason,
    },
  },
  async (args) => handleKickPlayer(args as { serverId: string; playerName: string; reason?: string })
);

server.registerTool(
  "server_admin_ban_player",
  {
    description: "플레이어를 서버에서 밴합니다. duration: 1h, 24h, 7d, permanent",
    inputSchema: {
      serverId: banPlayerSchema.shape.serverId,
      playerId: banPlayerSchema.shape.playerId,
      duration: banPlayerSchema.shape.duration,
      reason: banPlayerSchema.shape.reason,
    },
  },
  async (args) =>
    handleBanPlayer(args as { serverId: string; playerId: string; duration: string; reason?: string })
);

server.registerTool(
  "server_admin_restart_server",
  {
    description: "서버 재시작을 요청합니다.",
    inputSchema: {
      serverId: restartServerSchema.shape.serverId,
      delay: restartServerSchema.shape.delay,
    },
  },
  async (args) => handleRestartServer(args as { serverId: string; delay?: number })
);

server.registerTool(
  "server_admin_rcon_command",
  {
    description: "whitelist에 등록된 RCON 명령을 실행합니다. (status, say, players, time 등)",
    inputSchema: {
      serverId: rconCommandSchema.shape.serverId,
      command: rconCommandSchema.shape.command,
    },
  },
  async (args) => handleRconCommand(args as { serverId: string; command: string })
);

// --- Inventory 도구 (§15) ---
server.registerTool(
  "add_server",
  {
    description:
      "servers.json에 새 서버를 추가합니다. adminToken, id, name, type, host, port 필수. query/rcon 선택.",
    inputSchema: {
      adminToken: addServerSchema.shape.adminToken,
      id: addServerSchema.shape.id,
      name: addServerSchema.shape.name,
      type: addServerSchema.shape.type,
      host: addServerSchema.shape.host,
      port: addServerSchema.shape.port,
      query: addServerSchema.shape.query,
      rcon: addServerSchema.shape.rcon,
      logPath: addServerSchema.shape.logPath,
    },
  },
  async (args) => handleAddServer(args as z.infer<typeof addServerSchema>)
);

server.registerTool(
  "remove_server",
  {
    description: "servers.json에서 serverId로 서버를 삭제합니다. adminToken 필수.",
    inputSchema: {
      adminToken: removeServerSchema.shape.adminToken,
      serverId: removeServerSchema.shape.serverId,
    },
  },
  async (args) => handleRemoveServer(args as z.infer<typeof removeServerSchema>)
);

server.registerTool(
  "list_servers",
  {
    description: "등록된 전체 서버 목록을 반환합니다. 인증 불필요.",
    inputSchema: {},
  },
  async () => handleListServers()
);

server.registerTool(
  "steam_discover_servers",
  {
    description: "Steam Master Server Query로 게임 서버 목록을 검색합니다. gameType, region 선택.",
    inputSchema: {
      gameType: steamDiscoverServersSchema.shape.gameType,
      region: steamDiscoverServersSchema.shape.region,
      maxHosts: steamDiscoverServersSchema.shape.maxHosts,
    },
  },
  async (args) => handleSteamDiscoverServers(args as z.infer<typeof steamDiscoverServersSchema>)
);

server.registerTool(
  "auto_discover_servers",
  {
    description: "Steam Master Server로 서버 후보를 탐색합니다. dryRun=true면 servers.json 미변경, 제안만 반환.",
    inputSchema: {
      gameType: autoDiscoverServersSchema.shape.gameType,
      region: autoDiscoverServersSchema.shape.region,
      dryRun: autoDiscoverServersSchema.shape.dryRun,
      maxHosts: autoDiscoverServersSchema.shape.maxHosts,
    },
  },
  async (args) => handleAutoDiscoverServers(args as z.infer<typeof autoDiscoverServersSchema>)
);

server.registerTool(
  "log_recent_events",
  {
    description: "서버 로그에서 최근 이벤트(player_join, player_leave, error)를 추출합니다. servers.json의 logPath 필요.",
    inputSchema: {
      serverId: logRecentEventsSchemaExport.shape.serverId,
      lines: logRecentEventsSchemaExport.shape.lines,
    },
  },
  async (args) => handleLogRecentEvents(args as z.infer<typeof logRecentEventsSchemaExport>)
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Steam MCP 서버 오류:", err);
  process.exit(1);
});
