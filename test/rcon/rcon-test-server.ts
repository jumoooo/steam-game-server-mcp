#!/usr/bin/env npx tsx
/**
 * 로컬 RCON 테스트 서버
 * Rust/CS2 없이 RCON 프로토콜만 구현한 mock 서버
 *
 * 사용법:
 *   npx tsx test/rcon/rcon-test-server.ts
 *   # 터미널에 표시된 비밀번호를 .env SERVER_RCON_PASSWORD에 넣고
 *   # npm run rcon:test -- my-rust status 실행
 */

import { createServer } from "node:net";

const PORT = parseInt(process.env.RCON_TEST_PORT ?? "27017", 10);
const PASSWORD = "test123"; // 테스트용 고정 비밀번호

// Source RCON 패킷 타입
const SERVERDATA_AUTH = 0x03;
const SERVERDATA_AUTH_RESPONSE = 0x02;
const SERVERDATA_EXECCOMMAND = 0x02;
const SERVERDATA_RESPONSE_VALUE = 0x00;

function encodePacket(type: number, id: number, body: string): Buffer {
  const bodyBuf = Buffer.from(body + "\0\0", "ascii");
  const size = 10 + bodyBuf.length;
  const buf = Buffer.alloc(4 + size);
  buf.writeInt32LE(size, 0);
  buf.writeInt32LE(id, 4);
  buf.writeInt32LE(type, 8);
  bodyBuf.copy(buf, 12);
  return buf;
}

function decodePacket(buf: Buffer): { id: number; type: number; body: string } {
  const id = buf.readInt32LE(4);
  const type = buf.readInt32LE(8);
  const body = buf.toString("ascii", 12, buf.length - 2).replace(/\0+$/, "");
  return { id, type, body };
}

const server = createServer((socket) => {
  let buffer = Buffer.alloc(0);
  let authenticated = false;

  socket.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);

    while (buffer.length >= 4) {
      const size = buffer.readInt32LE(0);
      const packetLen = 4 + size;
      if (buffer.length < packetLen) break;

      const packet = buffer.subarray(0, packetLen);
      buffer = buffer.subarray(packetLen);

      const { id, type, body } = decodePacket(packet);

      if (type === SERVERDATA_AUTH) {
        if (body === PASSWORD) {
          authenticated = true;
          socket.write(encodePacket(SERVERDATA_AUTH_RESPONSE, id, ""));
        } else {
          socket.write(encodePacket(SERVERDATA_AUTH_RESPONSE, -1, ""));
        }
      } else if (type === SERVERDATA_EXECCOMMAND && authenticated) {
        // mock 응답
        const response =
          body === "status"
            ? "hostname: RCON Test Server\nplayers: 0\nmap: test"
            : body === "players"
              ? "0 players"
              : `Executed: ${body}`;
        socket.write(encodePacket(SERVERDATA_RESPONSE_VALUE, id, response));
      }
    }
  });

  socket.on("error", () => {});
});

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n포트 ${PORT}이(가) 이미 사용 중입니다.`);
    console.error("이전 RCON 테스트 서버가 실행 중일 수 있습니다. 해당 터미널을 종료하거나:");
    console.error(`  Windows: netstat -ano | findstr :${PORT}  → 해당 PID로 taskkill /PID <pid> /F`);
    console.error("  또는 다른 포트 사용: RCON_TEST_PORT=27018 npm run rcon:server\n");
  } else {
    console.error("서버 오류:", err.message);
  }
  process.exit(1);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`
========================================
  RCON 테스트 서버 실행 중
========================================
  주소: 127.0.0.1:${PORT}
  비밀번호: ${PASSWORD}

  servers.json 예시:
  {
    "servers": [{
      "id": "my-rust",
      "name": "테스트 서버",
      "type": "rust",
      "host": "127.0.0.1",
      "port": 28015,
      "rcon": {
        "enabled": true,
        "port": ${PORT},
        "passwordEnv": "SERVER_RCON_PASSWORD"
      }
    }]
  }

  .env (또는 MCP env):
  SERVER_RCON_PASSWORD=${PASSWORD}

  테스트:
  npm run rcon:test -- my-rust status
========================================
`);
});
