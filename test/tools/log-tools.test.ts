/**
 * log-tools.ts 핸들러 단위 테스트
 * vi.mock으로 config/servers, logs/analyzer 모킹
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleLogRecentEvents } from "../../src/tools/log-tools.js";

vi.mock("../../src/config/servers.js", () => ({
  getServerConfig: vi.fn(),
}));

vi.mock("../../src/logs/analyzer.js", () => ({
  analyzeLogEvents: vi.fn(),
}));

import { getServerConfig } from "../../src/config/servers.js";
import { analyzeLogEvents } from "../../src/logs/analyzer.js";

const serverConfigWithLogPath = {
  id: "test-1",
  name: "테스트 서버",
  type: "rust",
  host: "127.0.0.1",
  port: 28015,
  logPath: "/var/log/rust/server.log",
};

const serverConfigWithoutLogPath = {
  id: "test-1",
  name: "테스트 서버",
  type: "rust",
  host: "127.0.0.1",
  port: 28015,
  logPath: undefined,
};

const serverConfigWithEmptyLogPath = {
  id: "test-1",
  name: "테스트 서버",
  type: "rust",
  host: "127.0.0.1",
  port: 28015,
  logPath: "   ",
};

const mockEvents = [
  {
    type: "player_join" as const,
    playerName: "Player1",
    message: "joined the server",
    timestamp: "2025-01-01T12:00:00Z",
  },
  {
    type: "player_leave" as const,
    playerName: "Player2",
    message: "left the server",
    timestamp: "2025-01-01T12:01:00Z",
  },
];

describe("log-tools - handleLogRecentEvents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("logPath 없음 - 에러", async () => {
    vi.mocked(getServerConfig).mockReturnValue(serverConfigWithoutLogPath as never);

    await expect(
      handleLogRecentEvents({ serverId: "test-1" })
    ).rejects.toThrow("logPath가 설정되지 않았습니다");

    expect(analyzeLogEvents).not.toHaveBeenCalled();
  });

  it("logPath 빈 문자열/공백 - 에러", async () => {
    vi.mocked(getServerConfig).mockReturnValue(serverConfigWithEmptyLogPath as never);

    await expect(
      handleLogRecentEvents({ serverId: "test-1" })
    ).rejects.toThrow("logPath가 설정되지 않았습니다");

    expect(analyzeLogEvents).not.toHaveBeenCalled();
  });

  it("정상 케이스 - 이벤트 반환", async () => {
    vi.mocked(getServerConfig).mockReturnValue(serverConfigWithLogPath as never);
    vi.mocked(analyzeLogEvents).mockReturnValue(mockEvents);

    const result = await handleLogRecentEvents({
      serverId: "test-1",
      lines: 100,
    });

    expect(getServerConfig).toHaveBeenCalledWith("test-1");
    expect(analyzeLogEvents).toHaveBeenCalledWith(
      "/var/log/rust/server.log",
      "rust",
      100
    );
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain("Recent events (2)");
    expect(result.content[0].text).toContain("player_join");
    expect(result.content[0].text).toContain("Player1");
    expect(result.content[0].text).toContain("player_leave");
    expect(result.content[0].text).toContain("Player2");
    expect(result.content[0].text).toContain('"count": 2');
  });

  it("이벤트 없음 - (없음) 표시", async () => {
    vi.mocked(getServerConfig).mockReturnValue(serverConfigWithLogPath as never);
    vi.mocked(analyzeLogEvents).mockReturnValue([]);

    const result = await handleLogRecentEvents({ serverId: "test-1" });

    expect(result.content[0].text).toContain("Recent events (0)");
    expect(result.content[0].text).toContain("(없음)");
    expect(result.content[0].text).toContain('"count": 0');
  });

  it("lines 명시 시 analyzeLogEvents에 전달", async () => {
    vi.mocked(getServerConfig).mockReturnValue(serverConfigWithLogPath as never);
    vi.mocked(analyzeLogEvents).mockReturnValue([]);

    await handleLogRecentEvents({ serverId: "test-1", lines: 100 });
    expect(analyzeLogEvents).toHaveBeenCalledWith(
      "/var/log/rust/server.log",
      "rust",
      100
    );

    vi.clearAllMocks();
    vi.mocked(getServerConfig).mockReturnValue(serverConfigWithLogPath as never);
    vi.mocked(analyzeLogEvents).mockReturnValue([]);

    await handleLogRecentEvents({ serverId: "test-1", lines: 50 });
    expect(analyzeLogEvents).toHaveBeenCalledWith(
      "/var/log/rust/server.log",
      "rust",
      50
    );
  });
});
