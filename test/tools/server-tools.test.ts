/**
 * server-tools.ts 핸들러 단위 테스트
 * vi.mock으로 game-server/dedup, config/servers, game-server/trend 모킹
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  handleGameServerQuery,
  handleServerOverview,
  handleServerTrend,
  handleServerHealth,
  handleServerAlert,
} from "../../src/tools/server-tools.js";
import type { ServerState } from "../../src/game-server/types.js";

const mockServerState: ServerState = {
  id: "test-1",
  name: "테스트 서버",
  map: "Procedural Map",
  players: 10,
  maxPlayers: 100,
  ping: 45,
  game: "Rust",
  latencyCategory: "GOOD",
  queriedAt: new Date().toISOString(),
};

vi.mock("../../src/game-server/dedup.js", () => ({
  queryWithDedup: vi.fn(),
}));

vi.mock("../../src/config/servers.js", () => ({
  getServerConfig: vi.fn(),
  getQueryableServers: vi.fn(),
}));

vi.mock("../../src/game-server/trend.js", () => ({
  formatTrendOutput: vi.fn(),
  getTrendHistory: vi.fn(),
}));

import { queryWithDedup } from "../../src/game-server/dedup.js";
import { getServerConfig, getQueryableServers } from "../../src/config/servers.js";
import { formatTrendOutput, getTrendHistory } from "../../src/game-server/trend.js";

describe("server-tools - handleGameServerQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerConfig).mockReturnValue({
      id: "test-1",
      name: "테스트",
      type: "rust",
      host: "127.0.0.1",
      port: 28015,
    } as never);
    vi.mocked(queryWithDedup).mockResolvedValue(mockServerState);
  });

  it("정상 케이스 - 서버 상태 반환", async () => {
    const result = await handleGameServerQuery({ serverId: "test-1" });

    expect(getServerConfig).toHaveBeenCalledWith("test-1");
    expect(queryWithDedup).toHaveBeenCalledWith("test-1");
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain("테스트 서버");
    expect(result.content[0].text).toContain("10/100");
    expect(result.content[0].text).toContain("JSON:");
  });

  it("등록되지 않은 serverId - getServerConfig 에러", async () => {
    vi.mocked(getServerConfig).mockImplementation(() => {
      throw new Error("등록되지 않은 서버 ID입니다.");
    });

    await expect(handleGameServerQuery({ serverId: "unknown" })).rejects.toThrow(
      "등록되지 않은 서버 ID입니다"
    );
    expect(queryWithDedup).not.toHaveBeenCalled();
  });
});

describe("server-tools - handleServerOverview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("등록된 서버 없음 - 빈 목록 메시지", async () => {
    vi.mocked(getQueryableServers).mockReturnValue([]);

    const result = await handleServerOverview();

    expect(result.content[0].text).toContain("등록된 쿼리 가능 서버가 없습니다");
    expect(queryWithDedup).not.toHaveBeenCalled();
  });

  it("정상 케이스 - 서버 목록 조회", async () => {
    vi.mocked(getQueryableServers).mockReturnValue([
      { id: "test-1", name: "서버1", type: "rust", host: "127.0.0.1", port: 28015 },
    ] as never[]);
    vi.mocked(queryWithDedup).mockResolvedValue(mockServerState);

    const result = await handleServerOverview();

    expect(result.content[0].text).toContain("Overview:");
    expect(result.content[0].text).toContain("테스트 서버");
    expect(result.content[0].text).toContain("10/100");
  });
});

describe("server-tools - handleServerTrend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerConfig).mockReturnValue({} as never);
    vi.mocked(queryWithDedup).mockResolvedValue(mockServerState);
    vi.mocked(getTrendHistory).mockReturnValue([
      { ts: Date.now() - 60000, players: 8 },
      { ts: Date.now(), players: 10 },
    ]);
    vi.mocked(formatTrendOutput).mockReturnValue(
      "Players last 10 minutes: 8 → 10, Trend: increasing"
    );
  });

  it("정상 케이스 - 트렌드 출력", async () => {
    const result = await handleServerTrend({ serverId: "test-1" });

    expect(getServerConfig).toHaveBeenCalledWith("test-1");
    expect(result.content[0].text).toContain("Trend:");
    expect(result.content[0].text).toContain("increasing");
    expect(result.content[0].text).toContain("JSON:");
  });

  it("등록되지 않은 serverId - getServerConfig 에러", async () => {
    vi.mocked(getServerConfig).mockImplementation(() => {
      throw new Error("등록되지 않은 서버 ID입니다.");
    });

    await expect(handleServerTrend({ serverId: "unknown" })).rejects.toThrow(
      "등록되지 않은 서버 ID입니다"
    );
  });
});

describe("server-tools - handleServerHealth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerConfig).mockReturnValue({} as never);
    vi.mocked(queryWithDedup).mockResolvedValue(mockServerState);
  });

  it("정상 케이스 - Health GOOD", async () => {
    const result = await handleServerHealth({ serverId: "test-1" });

    expect(result.content[0].text).toContain("Health:");
    expect(result.content[0].text).toContain("GOOD");
  });

  it("서버 오프라인 - Health CRITICAL", async () => {
    vi.mocked(queryWithDedup).mockResolvedValue({
      ...mockServerState,
      ping: -1,
    });

    const result = await handleServerHealth({ serverId: "test-1" });

    expect(result.content[0].text).toContain("CRITICAL");
  });
});

describe("server-tools - handleServerAlert", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("등록된 서버 없음 - 빈 메시지", async () => {
    vi.mocked(getQueryableServers).mockReturnValue([]);

    const result = await handleServerAlert();

    expect(result.content[0].text).toContain("등록된 서버가 없습니다");
  });

  it("정상 케이스 - 문제 없음", async () => {
    vi.mocked(getQueryableServers).mockReturnValue([
      { id: "test-1", name: "서버1", type: "rust", host: "127.0.0.1", port: 28015 },
    ] as never[]);
    vi.mocked(queryWithDedup).mockResolvedValue(mockServerState);

    const result = await handleServerAlert();

    expect(result.content[0].text).toContain("문제가 감지된 서버가 없습니다");
  });
});
