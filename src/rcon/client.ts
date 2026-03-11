/**
 * RCON 클라이언트 - Source RCON 프로토콜 (명세 §9)
 * rcon-srcds 사용 (Rust, CS2, Minecraft 지원)
 */

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const RconClass = require("rcon-srcds").default as new (opts: {
  host: string;
  port: number;
  timeout?: number;
}) => {
  authenticate(password: string): Promise<boolean>;
  execute(command: string): Promise<string | boolean>;
  disconnect(): Promise<void>;
};
import { getServerConfig } from "../config/servers.js";

/** RCON 타임아웃 (ms) */
export const RCON_TIMEOUT = 5_000;

function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error("RCON 연결 시간 초과")), ms)
  );
}

/** RCON 비밀번호 조회 (passwordEnv → process.env) */
function getRconPassword(serverId: string): string {
  const config = getServerConfig(serverId);
  const rcon = config.rcon;
  if (!rcon?.enabled || !rcon.passwordEnv) {
    throw new Error("RCON not configured for this server.");
  }
  const password = process.env[rcon.passwordEnv];
  if (!password || password.trim() === "") {
    throw new Error("RCON not configured for this server.");
  }
  return password;
}

/** RCON 연결 및 명령 실행 */
export async function sendRcon(serverId: string, command: string): Promise<string> {
  const config = getServerConfig(serverId);
  const rcon = config.rcon;
  if (!rcon?.enabled || !rcon.port) {
    throw new Error("RCON not configured for this server.");
  }

  const password = getRconPassword(serverId);
  const client = new RconClass({
    host: config.host,
    port: rcon.port,
    timeout: RCON_TIMEOUT,
  });

  const run = async (): Promise<string> => {
    await client.authenticate(password);
    const result = await client.execute(command);
    await client.disconnect();
    return typeof result === "string" ? result : String(result);
  };

  return Promise.race([run(), timeout(RCON_TIMEOUT)]);
}
