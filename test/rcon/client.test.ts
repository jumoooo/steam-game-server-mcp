/**
 * rcon/client.ts 단위 테스트
 * sendRcon 에러 경로 검증 (rcon 미설정, passwordEnv 누락 등)
 *
 * 참고: 정상 연결 경로는 rcon-srcds가 createRequire로 로드되어
 * vi.mock이 적용되지 않음. 실제 RCON 서버 필요 시 통합 테스트로 검증.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../src/config/servers.js", () => ({
  getServerConfig: vi.fn(),
}));

import { sendRcon, RCON_TIMEOUT } from "../../src/rcon/client.js";
import { getServerConfig } from "../../src/config/servers.js";

const serverConfigWithRcon = {
  id: "rust-1",
  name: "Rust EU #1",
  type: "rust",
  host: "127.0.0.1",
  port: 28015,
  rcon: { enabled: true, port: 28016, passwordEnv: "TEST_RCON_PASSWORD" },
};

describe("rcon/client - sendRcon", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TEST_RCON_PASSWORD = "secret123";
  });

  afterEach(() => {
    delete process.env.TEST_RCON_PASSWORD;
  });

  it("rcon 미설정(rcon.enabled false) - 에러", async () => {
    vi.mocked(getServerConfig).mockReturnValue({
      ...serverConfigWithRcon,
      rcon: { enabled: false },
    } as never);

    await expect(sendRcon("rust-1", "status")).rejects.toThrow(
      "RCON not configured for this server."
    );
  });

  it("rcon.port 없음 - 에러", async () => {
    vi.mocked(getServerConfig).mockReturnValue({
      ...serverConfigWithRcon,
      rcon: { enabled: true, passwordEnv: "TEST_RCON_PASSWORD" },
    } as never);

    await expect(sendRcon("rust-1", "status")).rejects.toThrow(
      "RCON not configured for this server."
    );
  });

  it("passwordEnv 환경변수 없음 - 에러", async () => {
    delete process.env.TEST_RCON_PASSWORD;
    vi.mocked(getServerConfig).mockReturnValue(serverConfigWithRcon as never);

    await expect(sendRcon("rust-1", "status")).rejects.toThrow(
      "RCON not configured for this server."
    );
  });

  it("passwordEnv 환경변수 빈 문자열 - 에러", async () => {
    process.env.TEST_RCON_PASSWORD = "";
    vi.mocked(getServerConfig).mockReturnValue(serverConfigWithRcon as never);

    await expect(sendRcon("rust-1", "status")).rejects.toThrow(
      "RCON not configured for this server."
    );
  });
});

describe("rcon/client - RCON_TIMEOUT", () => {
  it("RCON_TIMEOUT 상수 5000", () => {
    expect(RCON_TIMEOUT).toBe(5_000);
  });
});
