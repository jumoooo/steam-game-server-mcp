#!/usr/bin/env npx tsx
/**
 * RCON 수동 테스트 스크립트
 *
 * [로컬 테스트 서버 사용] Rust 없이 테스트:
 *   1. 터미널1: npm run rcon:server  (테스트 서버 실행)
 *   2. 터미널2: STEAM_MCP_SERVERS_PATH=./test/rcon/servers.rcon-test.json SERVER_RCON_PASSWORD=test123 npm run rcon:test -- my-rust status
 *
 * [실제 서버 사용]:
 *   - servers.json에 서버 등록, .env 또는 MCP env에 SERVER_RCON_PASSWORD 설정
 *   - npm run rcon:test -- <serverId> <command>
 */

import "dotenv/config";
import { sendRcon } from "../../src/rcon/client.js";

const serverId = process.argv[2];
const command = process.argv[3];

if (!serverId || !command) {
  console.error("사용법: npx tsx test/rcon/manual-test.ts <serverId> <command>");
  console.error("예: npx tsx test/rcon/manual-test.ts my-rust status");
  process.exit(1);
}

sendRcon(serverId, command)
  .then((result) => {
    console.log("--- RCON 응답 ---");
    console.log(result);
    console.log("--- 끝 ---");
  })
  .catch((err) => {
    console.error("RCON 오류:", err.message);
    process.exit(1);
  });
