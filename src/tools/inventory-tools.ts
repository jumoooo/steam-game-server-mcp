/**
 * Inventory 도구 (명세 §15)
 * add_server, remove_server, list_servers - servers.json 관리
 */

import { z } from "zod";
import {
  loadServersConfig,
  writeServersConfig,
  ServerSchema,
  ServersConfigSchema,
  type ServerConfig,
  type ServersConfig,
} from "../config/servers.js";

export type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
};

/** adminToken 검증 (add/remove 공통) */
function validateAdminToken(adminToken: string): void {
  const envToken = process.env.STEAM_MCP_ADMIN_TOKEN;
  if (!envToken || envToken.length === 0) {
    throw new Error("STEAM_MCP_ADMIN_TOKEN 환경 변수를 확인하세요.");
  }
  if (adminToken !== envToken) {
    throw new Error("유효하지 않은 adminToken 입니다.");
  }
}

// --- add_server ---
export const addServerSchema = z
  .object({
    adminToken: z.string().min(1, "adminToken은 필수입니다"),
    id: z.string().min(1, "서버 ID는 필수입니다"),
    name: z.string().min(1, "서버 이름은 필수입니다"),
    type: z.string().min(1, "게임 타입은 필수입니다"),
    host: z.string().min(1, "호스트는 필수입니다"),
    port: z.number().int().min(1).max(65535),
    query: z
      .object({
        enabled: z.boolean().optional(),
      })
      .optional(),
    rcon: z
      .object({
        enabled: z.boolean().optional(),
        port: z.number().int().min(1).max(65535).optional(),
        passwordEnv: z.string().optional(),
      })
      .optional(),
    logPath: z.string().optional(),
  })
  .strict();

export async function handleAddServer(
  args: z.infer<typeof addServerSchema>
): Promise<ToolResult> {
  validateAdminToken(args.adminToken);

  const config = loadServersConfig();

  if (config.servers.some((s) => s.id === args.id)) {
    throw new Error(`이미 사용 중인 서버 ID입니다: ${args.id}`);
  }

  const serverEntry = {
    id: args.id,
    name: args.name,
    type: args.type,
    host: args.host,
    port: args.port,
    query: { enabled: args.query?.enabled ?? true },
    rcon: args.rcon
      ? {
          enabled: args.rcon.enabled ?? false,
          port: args.rcon.port,
          passwordEnv: args.rcon.passwordEnv,
        }
      : undefined,
    logPath: args.logPath,
  };

  const parsed = ServerSchema.safeParse(serverEntry);
  if (!parsed.success) {
    const details = parsed.error.errors
      .map((e) => `${e.path.join(".")}: ${e.message}`)
      .join("; ");
    throw new Error(`입력 값이 올바르지 않습니다: ${details}`);
  }

  const newConfig: ServersConfig = {
    servers: [...config.servers, parsed.data],
  };

  const configParsed = ServersConfigSchema.safeParse(newConfig);
  if (!configParsed.success) {
    const details = configParsed.error.errors
      .map((e) => `${e.path.join(".")}: ${e.message}`)
      .join("; ");
    throw new Error(`servers.json 형식이 올바르지 않습니다: ${details}`);
  }

  writeServersConfig(configParsed.data);

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          { added: parsed.data, message: "서버가 추가되었습니다." },
          null,
          2
        ),
      },
    ],
  };
}

// --- remove_server ---
export const removeServerSchema = z
  .object({
    adminToken: z.string().min(1, "adminToken은 필수입니다"),
    serverId: z.string().min(1, "serverId는 필수입니다"),
  })
  .strict();

export async function handleRemoveServer(
  args: z.infer<typeof removeServerSchema>
): Promise<ToolResult> {
  validateAdminToken(args.adminToken);

  const config = loadServersConfig();
  const idx = config.servers.findIndex((s) => s.id === args.serverId);

  if (idx === -1) {
    throw new Error(`등록되지 않은 서버 ID입니다: ${args.serverId}`);
  }

  const newServers = config.servers.filter((s) => s.id !== args.serverId);
  const newConfig: ServersConfig = { servers: newServers };

  const parsed = ServersConfigSchema.safeParse(newConfig);
  if (!parsed.success) {
    const details = parsed.error.errors
      .map((e) => `${e.path.join(".")}: ${e.message}`)
      .join("; ");
    throw new Error(`servers.json 형식이 올바르지 않습니다: ${details}`);
  }

  writeServersConfig(parsed.data);

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          { removed: args.serverId, message: "서버가 삭제되었습니다." },
          null,
          2
        ),
      },
    ],
  };
}

// --- list_servers ---
export const listServersSchema = z.object({}).strict();

// --- auto_discover_servers (명세 §15.1.4) ---
export const autoDiscoverServersSchema = z
  .object({
    gameType: z.string().optional().describe("gamedig 타입 (rust, counterstrike2 등)"),
    region: z.string().optional().describe("지역 (us, eu, asia, all)"),
    dryRun: z.boolean().optional().default(true).describe("true면 servers.json 미변경, 제안 목록만 반환"),
    maxHosts: z.number().int().min(1).max(100).optional().default(30),
  })
  .strict();

export async function handleAutoDiscoverServers(
  args: z.infer<typeof autoDiscoverServersSchema>
): Promise<ToolResult> {
  const { discoverServersViaSteam } = await import("../discovery/steam-query.js");
  const config = loadServersConfig();
  const existingAddrs = new Set(
    config.servers.map((s) => `${s.host}:${s.port}`)
  );

  const discovered = await discoverServersViaSteam({
    gameType: args.gameType,
    region: args.region,
    maxHosts: args.maxHosts,
  });

  const candidates = discovered
    .filter((addr) => !existingAddrs.has(addr))
    .map((addr) => {
      const [host, portStr] = addr.split(":");
      return { address: addr, host, port: parseInt(portStr ?? "0", 10), suggested: true };
    });

  const summary = `발견: ${discovered.length}개, 신규 후보: ${candidates.length}개 (이미 등록된 서버 제외)`;
  const preview = candidates.slice(0, 15).map((c) => `- ${c.address}`).join("\n");
  const more = candidates.length > 15 ? `\n... 외 ${candidates.length - 15}개` : "";

  const text =
    `${summary}\n\n제안 목록 (dryRun=${args.dryRun}):\n${preview}${more}\n\n` +
    `JSON:\n${JSON.stringify({ dryRun: args.dryRun, candidates, count: candidates.length }, null, 2)}`;

  return { content: [{ type: "text", text }] };
}

export async function handleListServers(): Promise<ToolResult> {
  const config = loadServersConfig();

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          { servers: config.servers, count: config.servers.length },
          null,
          2
        ),
      },
    ],
  };
}
