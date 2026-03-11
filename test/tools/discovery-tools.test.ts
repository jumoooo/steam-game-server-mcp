/**
 * discovery-tools.ts 핸들러 단위 테스트
 * vi.mock으로 discovery/steam-query 모킹
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleSteamDiscoverServers } from "../../src/tools/discovery-tools.js";

vi.mock("../../src/discovery/steam-query.js", () => ({
  discoverServersViaSteam: vi.fn(),
}));

import { discoverServersViaSteam } from "../../src/discovery/steam-query.js";

describe("discovery-tools - handleSteamDiscoverServers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("검색 결과 없음 - 빈 배열 메시지", async () => {
    vi.mocked(discoverServersViaSteam).mockResolvedValue([]);

    const result = await handleSteamDiscoverServers({});

    expect(discoverServersViaSteam).toHaveBeenCalledWith(
      expect.objectContaining({
        gameType: undefined,
        region: undefined,
      })
    );
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain("검색된 서버가 없습니다");
    expect(result.content[0].text).toContain("JSON:");
    expect(result.content[0].text).toContain("[]");
  });

  it("정상 케이스 - 서버 목록 반환", async () => {
    const servers = [
      "192.168.1.1:28015",
      "192.168.1.2:28015",
      "192.168.1.3:28015",
    ];
    vi.mocked(discoverServersViaSteam).mockResolvedValue(servers);

    const result = await handleSteamDiscoverServers({
      gameType: "rust",
      region: "asia",
      maxHosts: 20,
    });

    expect(discoverServersViaSteam).toHaveBeenCalledWith({
      gameType: "rust",
      region: "asia",
      maxHosts: 20,
    });
    expect(result.content[0].text).toContain("Discovered 3 servers");
    expect(result.content[0].text).toContain("192.168.1.1:28015");
    expect(result.content[0].text).toContain("192.168.1.2:28015");
    expect(result.content[0].text).toContain('"count": 3');
  });

  it("20개 초과 시 ... and N more 표시", async () => {
    const servers = Array.from({ length: 25 }, (_, i) => `192.168.1.${i + 1}:28015`);
    vi.mocked(discoverServersViaSteam).mockResolvedValue(servers);

    const result = await handleSteamDiscoverServers({ maxHosts: 50 });

    expect(result.content[0].text).toContain("... and 5 more");
    expect(result.content[0].text).toContain('"count": 25');
  });

  it("discoverServersViaSteam 에러 시 전파", async () => {
    vi.mocked(discoverServersViaSteam).mockRejectedValue(
      new Error("Steam Master Server 조회 실패: timeout")
    );

    await expect(handleSteamDiscoverServers({})).rejects.toThrow(
      "Steam Master Server 조회 실패"
    );
  });
});
