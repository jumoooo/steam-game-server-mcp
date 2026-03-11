/**
 * servers.json 로더 및 Zod 스키마 검증
 * STEAM_MCP_SERVERS_PATH 또는 ./servers.json 경로 사용
 */

import { readFileSync, existsSync, writeFileSync, renameSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

/** 서버 단일 스키마 (Inventory 도구에서 재사용) */
export const ServerSchema = z.object({
  id: z.string().min(1, "서버 ID는 필수입니다"),
  name: z.string().min(1, "서버 이름은 필수입니다"),
  type: z.string().min(1, "게임 타입은 필수입니다"),
  host: z.string().min(1, "호스트는 필수입니다"),
  port: z.number().int().min(1).max(65535),
  query: z
    .object({
      enabled: z.boolean().optional().default(true),
    })
    .optional(),
  rcon: z
    .object({
      enabled: z.boolean().optional().default(false),
      port: z.number().int().min(1).max(65535).optional(),
      passwordEnv: z.string().optional(),
    })
    .optional()
    .refine(
      (r) => {
        if (!r || !r.enabled) return true;
        return r.port != null && r.passwordEnv != null && r.passwordEnv.length > 0;
      },
      { message: "rcon.enabled가 true일 때 port와 passwordEnv가 필요합니다" }
    ),
  logPath: z.string().optional(),
});

/** 전체 설정 스키마 (Inventory 도구에서 재사용) */
export const ServersConfigSchema = z.object({
  servers: z.array(ServerSchema),
});

export type ServerConfig = z.infer<typeof ServerSchema>;
export type ServersConfig = z.infer<typeof ServersConfigSchema>;

/** servers.json 파일 경로 반환 (환경변수 우선) */
function getServersPath(): string {
  const envPath = process.env.STEAM_MCP_SERVERS_PATH;
  if (envPath) return resolve(envPath);
  return resolve(process.cwd(), "servers.json");
}

/** servers.json 로드 및 검증 */
export function loadServersConfig(): ServersConfig {
  const path = getServersPath();
  if (!existsSync(path)) {
    throw new Error("servers.json을 찾을 수 없습니다.");
  }
  const raw = readFileSync(path, "utf-8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("servers.json 형식이 올바르지 않습니다: JSON 파싱 실패");
  }
  const result = ServersConfigSchema.safeParse(parsed);
  if (!result.success) {
    const details = result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
    throw new Error(`servers.json 형식이 올바르지 않습니다: ${details}`);
  }
  return result.data;
}

/** serverId로 서버 설정 조회 */
export function getServerConfig(serverId: string): ServerConfig {
  const config = loadServersConfig();
  const server = config.servers.find((s) => s.id === serverId);
  if (!server) {
    throw new Error("등록되지 않은 서버 ID입니다.");
  }
  return server;
}

/** query가 활성화된 서버 목록 */
export function getQueryableServers(): ServerConfig[] {
  const config = loadServersConfig();
  return config.servers.filter((s) => s.query?.enabled !== false);
}

/**
 * servers.json 원자적 쓰기 (temp 파일 + rename)
 * 명세 §15.2.3: 장애 시 기존 servers.json 유지
 */
export function writeServersConfig(config: ServersConfig): void {
  const path = getServersPath();
  const tmpPath = path.replace(/\.json$/, ".tmp.json");

  try {
    const content = JSON.stringify(config, null, 2);
    writeFileSync(tmpPath, content, "utf-8");
  } catch {
    throw new Error(
      "servers.json을 임시 파일에 저장하는 데 실패했습니다. 디스크 공간과 권한을 확인하세요."
    );
  }

  try {
    renameSync(tmpPath, path);
  } catch {
    try {
      unlinkSync(tmpPath);
    } catch {
      /* tmp 정리 실패 무시 */
    }
    throw new Error(
      "servers.json 업데이트에 실패했습니다. 파일 시스템 권한 또는 잠금 상태를 확인하세요."
    );
  }
}
