/**
 * admin-tools.ts 핸들러 단위 테스트
 * vi.mock으로 rcon/client, config/servers, game-server/cache 모킹
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  handleKickPlayer,
  handleBanPlayer,
  handleRestartServer,
  handleRconCommand,
} from "../../src/tools/admin-tools.js";

vi.mock("../../src/rcon/client.js", () => ({
  sendRcon: vi.fn(),
}));

vi.mock("../../src/config/servers.js", () => ({
  getServerConfig: vi.fn(),
}));

vi.mock("../../src/game-server/cache.js", () => ({
  invalidateCache: vi.fn(),
}));

import { sendRcon } from "../../src/rcon/client.js";
import { getServerConfig } from "../../src/config/servers.js";
import { invalidateCache } from "../../src/game-server/cache.js";

const serverConfigWithRcon = {
  id: "test-1",
  name: "테스트 서버",
  type: "rust",
  host: "127.0.0.1",
  port: 28015,
  rcon: { enabled: true, port: 28016, passwordEnv: "RCON_PASSWORD" },
};

const serverConfigWithoutRcon = {
  id: "test-1",
  name: "테스트 서버",
  type: "rust",
  host: "127.0.0.1",
  port: 28015,
  rcon: { enabled: false },
};

describe("admin-tools - handleKickPlayer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("RCON 미설정 시 에러", async () => {
    vi.mocked(getServerConfig).mockReturnValue(serverConfigWithoutRcon as never);

    await expect(
      handleKickPlayer({ serverId: "test-1", playerName: "BadPlayer" })
    ).rejects.toThrow("RCON not configured for this server.");

    expect(sendRcon).not.toHaveBeenCalled();
  });

  it("정상 케이스 - kick 실행 완료", async () => {
    vi.mocked(getServerConfig).mockReturnValue(serverConfigWithRcon as never);
    vi.mocked(sendRcon).mockResolvedValue("Player kicked");

    const result = await handleKickPlayer({
      serverId: "test-1",
      playerName: "BadPlayer",
      reason: "테스트 킥",
    });

    expect(getServerConfig).toHaveBeenCalledWith("test-1");
    expect(sendRcon).toHaveBeenCalledWith(
      "test-1",
      'kick "BadPlayer" "테스트 킥"'
    );
    expect(invalidateCache).toHaveBeenCalledWith("test-1");
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain("Kick 실행 완료");
    expect(result.content[0].text).toContain("Player kicked");
  });

  it("reason 생략 시 기본 메시지 사용", async () => {
    vi.mocked(getServerConfig).mockReturnValue(serverConfigWithRcon as never);
    vi.mocked(sendRcon).mockResolvedValue("OK");

    await handleKickPlayer({ serverId: "test-1", playerName: "Player" });

    expect(sendRcon).toHaveBeenCalledWith(
      "test-1",
      'kick "Player" "Kicked by admin"'
    );
  });
});

describe("admin-tools - handleBanPlayer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("RCON 미설정 시 에러", async () => {
    vi.mocked(getServerConfig).mockReturnValue(serverConfigWithoutRcon as never);

    await expect(
      handleBanPlayer({
        serverId: "test-1",
        playerId: "76561198000000000",
        duration: "1h",
      })
    ).rejects.toThrow("RCON not configured for this server.");

    expect(sendRcon).not.toHaveBeenCalled();
  });

  it("정상 케이스 - 시간 제한 ban (Source 형식)", async () => {
    vi.mocked(getServerConfig).mockReturnValue({
      ...serverConfigWithRcon,
      type: "counterstrike2",
    } as never);
    vi.mocked(sendRcon).mockResolvedValue("Banned");

    const result = await handleBanPlayer({
      serverId: "test-1",
      playerId: "76561198000000000",
      duration: "1h",
      reason: "테스트 밴",
    });

    expect(sendRcon).toHaveBeenCalled();
    expect(invalidateCache).toHaveBeenCalledWith("test-1");
    expect(result.content[0].text).toContain("Ban 실행 완료");
  });

  it("정상 케이스 - permanent ban", async () => {
    vi.mocked(getServerConfig).mockReturnValue(serverConfigWithRcon as never);
    vi.mocked(sendRcon).mockResolvedValue("OK");

    await handleBanPlayer({
      serverId: "test-1",
      playerId: "76561198000000000",
      duration: "permanent",
    });

    expect(sendRcon).toHaveBeenCalledWith(
      "test-1",
      expect.stringContaining("banid")
    );
  });
});

describe("admin-tools - handleRestartServer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("RCON 미설정 시 에러", async () => {
    vi.mocked(getServerConfig).mockReturnValue(serverConfigWithoutRcon as never);

    await expect(
      handleRestartServer({ serverId: "test-1" })
    ).rejects.toThrow("RCON not configured for this server.");

    expect(sendRcon).not.toHaveBeenCalled();
  });

  it("정상 케이스 - restart 명령", async () => {
    vi.mocked(getServerConfig).mockReturnValue(serverConfigWithRcon as never);
    vi.mocked(sendRcon).mockResolvedValue("Restarting in 5 seconds");

    const result = await handleRestartServer({ serverId: "test-1" });

    expect(sendRcon).toHaveBeenCalledWith("test-1", "restart");
    expect(invalidateCache).toHaveBeenCalledWith("test-1");
    expect(result.content[0].text).toContain("Restart 명령 실행 완료");
  });

  it("delay 지정 시 restart {delay} 명령", async () => {
    vi.mocked(getServerConfig).mockReturnValue(serverConfigWithRcon as never);
    vi.mocked(sendRcon).mockResolvedValue("OK");

    await handleRestartServer({ serverId: "test-1", delay: 10 });

    expect(sendRcon).toHaveBeenCalledWith("test-1", "restart 10");
  });
});

describe("admin-tools - handleRconCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("허용되지 않은 RCON 명령 시 에러", async () => {
    await expect(
      handleRconCommand({
        serverId: "test-1",
        command: "exec rcon",
      })
    ).rejects.toThrow("허용되지 않은 RCON 명령입니다");

    expect(getServerConfig).not.toHaveBeenCalled();
    expect(sendRcon).not.toHaveBeenCalled();
  });

  it("RCON 미설정 시 에러", async () => {
    vi.mocked(getServerConfig).mockReturnValue(serverConfigWithoutRcon as never);

    await expect(
      handleRconCommand({
        serverId: "test-1",
        command: "status",
      })
    ).rejects.toThrow("RCON not configured for this server.");

    expect(sendRcon).not.toHaveBeenCalled();
  });

  it("정상 케이스 - 허용된 status 명령", async () => {
    vi.mocked(getServerConfig).mockReturnValue(serverConfigWithRcon as never);
    vi.mocked(sendRcon).mockResolvedValue("hostname: Test Server\nplayers: 5");

    const result = await handleRconCommand({
      serverId: "test-1",
      command: "status",
    });

    expect(getServerConfig).toHaveBeenCalledWith("test-1");
    expect(sendRcon).toHaveBeenCalledWith("test-1", "status");
    expect(invalidateCache).toHaveBeenCalledWith("test-1");
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain("hostname: Test Server");
  });

  it("허용된 say, players, time, restart, quit, changelevel 명령", async () => {
    vi.mocked(getServerConfig).mockReturnValue(serverConfigWithRcon as never);
    vi.mocked(sendRcon).mockResolvedValue("OK");

    const allowed = ["say hello", "players", "time", "restart", "quit", "changelevel de_dust2"];
    for (const cmd of allowed) {
      vi.clearAllMocks();
      vi.mocked(getServerConfig).mockReturnValue(serverConfigWithRcon as never);
      vi.mocked(sendRcon).mockResolvedValue("OK");

      const result = await handleRconCommand({ serverId: "test-1", command: cmd });
      expect(result.content[0].text).toBe("OK");
    }
  });
});
