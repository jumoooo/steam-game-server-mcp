/**
 * inventory-tools.ts 핸들러 단위 테스트
 * vi.mock으로 config/servers, discovery/steam-query 모킹
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  handleAddServer,
  handleRemoveServer,
  handleListServers,
  handleAutoDiscoverServers,
} from "../../src/tools/inventory-tools.js";
import type { ServersConfig } from "../../src/config/servers.js";

const ADMIN_TOKEN = "test-admin-token-123";

// loadServersConfig, writeServersConfig만 모킹, ServerSchema/ServersConfigSchema는 실제 사용
vi.mock("../../src/config/servers.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/config/servers.js")>();
  return {
    ...actual,
    loadServersConfig: vi.fn(),
    writeServersConfig: vi.fn(),
  };
});

vi.mock("../../src/discovery/steam-query.js", () => ({
  discoverServersViaSteam: vi.fn(),
}));

import {
  loadServersConfig,
  writeServersConfig,
} from "../../src/config/servers.js";
import { discoverServersViaSteam } from "../../src/discovery/steam-query.js";

describe("inventory-tools - handleAddServer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STEAM_MCP_ADMIN_TOKEN = ADMIN_TOKEN;
    vi.mocked(loadServersConfig).mockReturnValue({ servers: [] } as ServersConfig);
  });

  afterEach(() => {
    delete process.env.STEAM_MCP_ADMIN_TOKEN;
  });

  it("정상 케이스 - 서버 추가 성공", async () => {
    const result = await handleAddServer({
      adminToken: ADMIN_TOKEN,
      id: "new-server",
      name: "신규 서버",
      type: "rust",
      host: "127.0.0.1",
      port: 28015,
    });

    expect(writeServersConfig).toHaveBeenCalled();
    expect(result.content[0].text).toContain("서버가 추가되었습니다");
    expect(result.content[0].text).toContain("new-server");
  });

  it("adminToken 누락/불일치 - STEAM_MCP_ADMIN_TOKEN 미설정", async () => {
    delete process.env.STEAM_MCP_ADMIN_TOKEN;

    await expect(
      handleAddServer({
        adminToken: "wrong",
        id: "new-server",
        name: "신규",
        type: "rust",
        host: "127.0.0.1",
        port: 28015,
      })
    ).rejects.toThrow("STEAM_MCP_ADMIN_TOKEN 환경 변수를 확인하세요");
  });

  it("adminToken 불일치 - 유효하지 않은 토큰", async () => {
    await expect(
      handleAddServer({
        adminToken: "wrong-token",
        id: "new-server",
        name: "신규",
        type: "rust",
        host: "127.0.0.1",
        port: 28015,
      })
    ).rejects.toThrow("유효하지 않은 adminToken 입니다");
  });

  it("중복 serverId - 이미 사용 중", async () => {
    vi.mocked(loadServersConfig).mockReturnValue({
      servers: [{ id: "existing-id", name: "기존", type: "rust", host: "1.1.1.1", port: 28015 }],
    } as ServersConfig);

    await expect(
      handleAddServer({
        adminToken: ADMIN_TOKEN,
        id: "existing-id",
        name: "중복",
        type: "rust",
        host: "127.0.0.1",
        port: 28015,
      })
    ).rejects.toThrow("이미 사용 중인 서버 ID입니다");
  });
});

describe("inventory-tools - handleRemoveServer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STEAM_MCP_ADMIN_TOKEN = ADMIN_TOKEN;
    vi.mocked(loadServersConfig).mockReturnValue({
      servers: [{ id: "to-remove", name: "삭제대상", type: "rust", host: "1.1.1.1", port: 28015 }],
    } as ServersConfig);
  });

  afterEach(() => {
    delete process.env.STEAM_MCP_ADMIN_TOKEN;
  });

  it("정상 케이스 - 서버 삭제 성공", async () => {
    const result = await handleRemoveServer({
      adminToken: ADMIN_TOKEN,
      serverId: "to-remove",
    });

    expect(writeServersConfig).toHaveBeenCalled();
    expect(result.content[0].text).toContain("서버가 삭제되었습니다");
    expect(result.content[0].text).toContain("to-remove");
  });

  it("등록되지 않은 serverId - 에러", async () => {
    await expect(
      handleRemoveServer({
        adminToken: ADMIN_TOKEN,
        serverId: "unknown-id",
      })
    ).rejects.toThrow("등록되지 않은 서버 ID입니다");
    expect(writeServersConfig).not.toHaveBeenCalled();
  });
});

describe("inventory-tools - handleListServers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadServersConfig).mockReturnValue({
      servers: [
        { id: "s1", name: "서버1", type: "rust", host: "127.0.0.1", port: 28015 },
        { id: "s2", name: "서버2", type: "rust", host: "127.0.0.2", port: 28016 },
      ],
    } as ServersConfig);
  });

  it("정상 케이스 - 서버 목록 반환", async () => {
    const result = await handleListServers();

    expect(loadServersConfig).toHaveBeenCalled();
    expect(result.content[0].text).toContain("서버1");
    expect(result.content[0].text).toContain("서버2");
    expect(result.content[0].text).toContain("count");
    expect(result.content[0].text).toContain("2");
  });
});

describe("inventory-tools - handleAutoDiscoverServers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadServersConfig).mockReturnValue({
      servers: [{ id: "existing", name: "기존", type: "rust", host: "1.1.1.1", port: 28015 }],
    } as ServersConfig);
    vi.mocked(discoverServersViaSteam).mockResolvedValue([
      "1.1.1.1:28015",
      "2.2.2.2:28016",
    ]);
  });

  it("정상 케이스 - 발견된 서버 후보 반환 (dryRun)", async () => {
    const result = await handleAutoDiscoverServers({
      gameType: "rust",
      dryRun: true,
    });

    expect(discoverServersViaSteam).toHaveBeenCalledWith(
      expect.objectContaining({ gameType: "rust" })
    );
    expect(result.content[0].text).toContain("발견:");
    expect(result.content[0].text).toContain("신규 후보");
    expect(result.content[0].text).toContain("2.2.2.2:28016");
    expect(result.content[0].text).toContain("dryRun");
  });

  it("discoverServersViaSteam 에러 - 전파", async () => {
    vi.mocked(discoverServersViaSteam).mockRejectedValue(
      new Error("Steam Master Server 조회 실패: timeout")
    );

    await expect(
      handleAutoDiscoverServers({ gameType: "rust" })
    ).rejects.toThrow("Steam Master Server");
  });
});
