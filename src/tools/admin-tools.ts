/**
 * RCON Admin 도구 (명세 §7.5, §9)
 */

import { z } from "zod";
import { sendRcon } from "../rcon/client.js";
import { getServerConfig } from "../config/servers.js";
import { invalidateCache } from "../game-server/cache.js";

export type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
};

/** whitelist 명령만 rcon_command로 허용 (명세 §9.2) */
const ALLOWED_RCON_COMMANDS = [
  "status",
  "say",
  "players",
  "time",
  "restart",
  "quit",
  "changelevel",
] as const;

function isAllowedCommand(cmd: string): boolean {
  const base = cmd.split(/\s+/)[0]?.toLowerCase() ?? "";
  return ALLOWED_RCON_COMMANDS.includes(base as (typeof ALLOWED_RCON_COMMANDS)[number]);
}

const serverIdSchema = z.string().min(1, "serverId는 필수입니다");

/** duration "1h" → Source banid 분 단위 (대략) */
function durationToMinutes(duration: string): number {
  const d = duration.toLowerCase();
  if (d === "permanent" || d === "perm") return 0; // 0 = permanent in some games
  const h = d.match(/(\d+)h/);
  if (h) return parseInt(h[1], 10) * 60;
  const day = d.match(/(\d+)d/);
  if (day) return parseInt(day[1], 10) * 24 * 60;
  const min = d.match(/(\d+)m/);
  if (min) return parseInt(min[1], 10);
  return 60; // 기본 1시간
}

// --- server_admin_kick_player ---
export const kickPlayerSchema = z.object({
  serverId: serverIdSchema,
  playerName: z.string().min(1, "playerName은 필수입니다"),
  reason: z.string().optional(),
});

export async function handleKickPlayer(
  args: z.infer<typeof kickPlayerSchema>
): Promise<ToolResult> {
  const config = getServerConfig(args.serverId);
  if (!config.rcon?.enabled) {
    throw new Error("RCON not configured for this server.");
  }
  const reason = args.reason ?? "Kicked by admin";
  const cmd = `kick "${args.playerName.replace(/"/g, '\\"')}" "${reason.replace(/"/g, '\\"')}"`;
  const result = await sendRcon(args.serverId, cmd);
  invalidateCache(args.serverId);
  return { content: [{ type: "text", text: `Kick 실행 완료.\n${result}` }] };
}

// --- server_admin_ban_player ---
export const banPlayerSchema = z.object({
  serverId: serverIdSchema,
  playerId: z.string().min(1, "playerId(SteamID 등)는 필수입니다"),
  duration: z.string().min(1, "duration은 필수 (예: 1h, 24h, 7d, permanent)"),
  reason: z.string().optional(),
});

export async function handleBanPlayer(
  args: z.infer<typeof banPlayerSchema>
): Promise<ToolResult> {
  const config = getServerConfig(args.serverId);
  if (!config.rcon?.enabled) {
    throw new Error("RCON not configured for this server.");
  }
  const reason = args.reason ?? "Banned by admin";
  const duration = args.duration.toLowerCase();
  let cmd: string;
  if (duration === "permanent" || duration === "perm") {
    cmd = `banid "${args.playerId}" "${reason.replace(/"/g, '\\"')}"`;
  } else {
    const mins = durationToMinutes(args.duration);
    if (config.type === "rust") {
      cmd = `banidex "${args.playerId}" "${args.duration}" "${reason.replace(/"/g, '\\"')}"`;
    } else {
      cmd = `banid ${mins} "${args.playerId}" "${reason.replace(/"/g, '\\"')}"`;
    }
  }
  const result = await sendRcon(args.serverId, cmd);
  invalidateCache(args.serverId);
  return { content: [{ type: "text", text: `Ban 실행 완료.\n${result}` }] };
}

// --- server_admin_restart_server ---
export const restartServerSchema = z.object({
  serverId: serverIdSchema,
  delay: z.number().int().min(0).optional(),
});

export async function handleRestartServer(
  args: z.infer<typeof restartServerSchema>
): Promise<ToolResult> {
  const config = getServerConfig(args.serverId);
  if (!config.rcon?.enabled) {
    throw new Error("RCON not configured for this server.");
  }
  const cmd = args.delay != null ? `restart ${args.delay}` : "restart";
  const result = await sendRcon(args.serverId, cmd);
  invalidateCache(args.serverId);
  return { content: [{ type: "text", text: `Restart 명령 실행 완료.\n${result}` }] };
}

// --- server_admin_rcon_command ---
export const rconCommandSchema = z.object({
  serverId: serverIdSchema,
  command: z.string().min(1, "command는 필수입니다"),
});

export async function handleRconCommand(
  args: z.infer<typeof rconCommandSchema>
): Promise<ToolResult> {
  if (!isAllowedCommand(args.command)) {
    throw new Error(
      `허용되지 않은 RCON 명령입니다. 허용 목록: ${ALLOWED_RCON_COMMANDS.join(", ")}`
    );
  }
  const config = getServerConfig(args.serverId);
  if (!config.rcon?.enabled) {
    throw new Error("RCON not configured for this server.");
  }
  const result = await sendRcon(args.serverId, args.command);
  invalidateCache(args.serverId);
  return { content: [{ type: "text", text: result }] };
}
