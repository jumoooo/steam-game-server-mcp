/**
 * config/servers.ts 단위 테스트
 * vi.mock으로 fs 모킹 - servers.json 없음/잘못된 형식/정상 케이스
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  loadServersConfig,
  getServerConfig,
  getQueryableServers,
  writeServersConfig,
  type ServersConfig,
} from "../../src/config/servers.js";

const validServersJson = {
  servers: [
    {
      id: "test-1",
      name: "테스트 서버",
      type: "rust",
      host: "127.0.0.1",
      port: 28015,
      query: { enabled: true },
    },
    {
      id: "test-2",
      name: "쿼리 비활성 서버",
      type: "rust",
      host: "127.0.0.2",
      port: 28016,
      query: { enabled: false },
    },
  ],
};

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
  writeFileSync: vi.fn(),
  renameSync: vi.fn(),
  unlinkSync: vi.fn(),
}));

import { readFileSync, existsSync, writeFileSync, renameSync, unlinkSync } from "node:fs";

describe("config/servers - loadServersConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("servers.json 없음 - existsSync false 시 에러", () => {
    vi.mocked(existsSync).mockReturnValue(false);

    expect(() => loadServersConfig()).toThrow("servers.json을 찾을 수 없습니다.");
    expect(readFileSync).not.toHaveBeenCalled();
  });

  it("잘못된 JSON 형식 - 파싱 실패 시 에러", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue("{ invalid json }");

    expect(() => loadServersConfig()).toThrow("servers.json 형식이 올바르지 않습니다: JSON 파싱 실패");
  });

  it("잘못된 스키마 - 필수 필드 누락 시 에러", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ servers: [{ id: "x" }] }));

    expect(() => loadServersConfig()).toThrow("servers.json 형식이 올바르지 않습니다:");
  });

  it("정상 케이스 - 유효한 servers.json 로드", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify(validServersJson));

    const config = loadServersConfig();
    expect(config.servers).toHaveLength(2);
    expect(config.servers[0].id).toBe("test-1");
    expect(config.servers[0].query?.enabled).toBe(true);
  });
});

describe("config/servers - getServerConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify(validServersJson));
  });

  it("등록된 serverId로 서버 설정 조회", () => {
    const server = getServerConfig("test-1");
    expect(server.id).toBe("test-1");
    expect(server.name).toBe("테스트 서버");
    expect(server.host).toBe("127.0.0.1");
  });

  it("등록되지 않은 serverId 시 에러", () => {
    expect(() => getServerConfig("unknown-id")).toThrow("등록되지 않은 서버 ID입니다.");
  });
});

describe("config/servers - getQueryableServers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify(validServersJson));
  });

  it("query.enabled가 true인 서버만 반환", () => {
    const servers = getQueryableServers();
    expect(servers).toHaveLength(1);
    expect(servers[0].id).toBe("test-1");
    expect(servers[0].query?.enabled).toBe(true);
  });
});

describe("config/servers - writeServersConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("정상 쓰기 - writeFileSync, renameSync 성공", () => {
    const config: ServersConfig = validServersJson as ServersConfig;
    writeServersConfig(config);

    expect(writeFileSync).toHaveBeenCalled();
    expect(renameSync).toHaveBeenCalled();
    expect(unlinkSync).not.toHaveBeenCalled();
  });

  it("writeFileSync 실패 시 에러 - 기존 파일 유지", () => {
    vi.mocked(writeFileSync).mockImplementation(() => {
      throw new Error("디스크 공간 부족");
    });

    const config: ServersConfig = validServersJson as ServersConfig;
    expect(() => writeServersConfig(config)).toThrow(
      "servers.json을 임시 파일에 저장하는 데 실패했습니다"
    );
    expect(renameSync).not.toHaveBeenCalled();
  });

  it("renameSync 실패 시 에러 - tmp 정리 시도", () => {
    vi.mocked(writeFileSync).mockImplementation(() => {});
    vi.mocked(renameSync).mockImplementation(() => {
      throw new Error("권한 없음");
    });

    const config: ServersConfig = validServersJson as ServersConfig;
    expect(() => writeServersConfig(config)).toThrow("servers.json 업데이트에 실패했습니다");
    expect(unlinkSync).toHaveBeenCalled();
  });
});
