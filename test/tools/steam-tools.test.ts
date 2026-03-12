/**
 * steam-tools.ts 핸들러 단위 테스트
 * vi.mock으로 steam-api/client 모킹
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  handleResolveVanityUrl,
  handleGetPlayerSummary,
  handleGetOwnedGames,
  handleGetRecentlyPlayed,
  handleGetCurrentPlayers,
  handleGetServersAtAddress,
  handleGetAppNews,
} from "../../src/tools/steam-tools.js";

vi.mock("../../src/steam-api/client.js", () => ({
  resolveVanityUrl: vi.fn(),
  getPlayerSummaries: vi.fn(),
  getOwnedGames: vi.fn(),
  getRecentlyPlayedGames: vi.fn(),
  getNumberOfCurrentPlayers: vi.fn(),
  getServersAtAddress: vi.fn(),
  getNewsForApp: vi.fn(),
}));

import * as steam from "../../src/steam-api/client.js";

describe("steam-tools - handleResolveVanityUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("정상 케이스 - vanityurl → steamid 반환", async () => {
    vi.mocked(steam.resolveVanityUrl).mockResolvedValue({
      steamid: "76561198000000000",
    });

    const result = await handleResolveVanityUrl({ vanityurl: "testuser" });

    expect(steam.resolveVanityUrl).toHaveBeenCalledWith("testuser");
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain("76561198000000000");
  });

  it("STEAM_API_KEY 누락 시 에러 메시지 검증", async () => {
    vi.mocked(steam.resolveVanityUrl).mockRejectedValue(
      new Error("STEAM_API_KEY 환경 변수를 확인하세요.")
    );

    await expect(
      handleResolveVanityUrl({ vanityurl: "testuser" })
    ).rejects.toThrow("STEAM_API_KEY 환경 변수를 확인하세요.");
  });

  it("해당 커스텀 URL 없음 - 에러 전파", async () => {
    vi.mocked(steam.resolveVanityUrl).mockRejectedValue(
      new Error("해당 커스텀 URL을 찾을 수 없습니다.")
    );

    await expect(
      handleResolveVanityUrl({ vanityurl: "nonexistent" })
    ).rejects.toThrow("해당 커스텀 URL을 찾을 수 없습니다.");
  });
});

describe("steam-tools - handleGetPlayerSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("정상 케이스 - players 반환", async () => {
    vi.mocked(steam.getPlayerSummaries).mockResolvedValue({
      players: [
        {
          steamid: "76561198000000000",
          personaname: "TestUser",
          profileurl: "https://steamcommunity.com/id/test/",
        },
      ],
    });

    const result = await handleGetPlayerSummary({
      steamids: "76561198000000000",
    });

    expect(steam.getPlayerSummaries).toHaveBeenCalledWith("76561198000000000");
    expect(result.content[0].text).toContain("TestUser");
    expect(result.content[0].text).toContain("76561198000000000");
  });

  it("STEAM_API_KEY 누락 시 에러 메시지 검증", async () => {
    vi.mocked(steam.getPlayerSummaries).mockRejectedValue(
      new Error("STEAM_API_KEY 환경 변수를 확인하세요.")
    );

    await expect(
      handleGetPlayerSummary({ steamids: "76561198000000000" })
    ).rejects.toThrow("STEAM_API_KEY 환경 변수를 확인하세요.");
  });

  it("빈 players - 빈 배열 반환", async () => {
    vi.mocked(steam.getPlayerSummaries).mockResolvedValue({ players: [] });

    const result = await handleGetPlayerSummary({
      steamids: "76561198000000000,76561198000000001",
    });

    expect(result.content[0].text).toContain("players");
  });
});

describe("steam-tools - handleGetOwnedGames", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("정상 케이스 - games, game_count 반환", async () => {
    vi.mocked(steam.getOwnedGames).mockResolvedValue({
      games: [{ appid: 730, name: "Counter-Strike 2", playtime_forever: 100 }],
      game_count: 1,
    });

    const result = await handleGetOwnedGames({
      steamid: "76561198000000000",
    });

    expect(steam.getOwnedGames).toHaveBeenCalledWith(
      "76561198000000000",
      expect.any(Object)
    );
    expect(result.content[0].text).toContain("Counter-Strike 2");
    expect(result.content[0].text).toContain("game_count");
  });

  it("STEAM_API_KEY 누락 시 에러 메시지 검증", async () => {
    vi.mocked(steam.getOwnedGames).mockRejectedValue(
      new Error("STEAM_API_KEY 환경 변수를 확인하세요.")
    );

    await expect(
      handleGetOwnedGames({ steamid: "76561198000000000" })
    ).rejects.toThrow("STEAM_API_KEY 환경 변수를 확인하세요.");
  });

  it("include_appinfo, include_played_free_games 옵션 전달", async () => {
    vi.mocked(steam.getOwnedGames).mockResolvedValue({
      games: [],
      game_count: 0,
    });

    await handleGetOwnedGames({
      steamid: "76561198000000000",
      include_appinfo: false,
      include_played_free_games: true,
    });

    expect(steam.getOwnedGames).toHaveBeenCalledWith("76561198000000000", {
      include_appinfo: false,
      include_played_free_games: true,
    });
  });
});

describe("steam-tools - handleGetRecentlyPlayed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("정상 케이스 - games 반환", async () => {
    vi.mocked(steam.getRecentlyPlayedGames).mockResolvedValue({
      games: [{ appid: 730, name: "Counter-Strike 2", playtime_2weeks: 50 }],
    });

    const result = await handleGetRecentlyPlayed({
      steamid: "76561198000000000",
    });

    expect(steam.getRecentlyPlayedGames).toHaveBeenCalledWith(
      "76561198000000000",
      undefined
    );
    expect(result.content[0].text).toContain("Counter-Strike 2");
  });

  it("STEAM_API_KEY 누락 시 에러 메시지 검증", async () => {
    vi.mocked(steam.getRecentlyPlayedGames).mockRejectedValue(
      new Error("STEAM_API_KEY 환경 변수를 확인하세요.")
    );

    await expect(
      handleGetRecentlyPlayed({ steamid: "76561198000000000" })
    ).rejects.toThrow("STEAM_API_KEY 환경 변수를 확인하세요.");
  });

  it("count 옵션 전달", async () => {
    vi.mocked(steam.getRecentlyPlayedGames).mockResolvedValue({ games: [] });

    await handleGetRecentlyPlayed({
      steamid: "76561198000000000",
      count: 10,
    });

    expect(steam.getRecentlyPlayedGames).toHaveBeenCalledWith(
      "76561198000000000",
      10
    );
  });
});

describe("steam-tools - handleGetCurrentPlayers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("정상 케이스 - player_count 반환", async () => {
    vi.mocked(steam.getNumberOfCurrentPlayers).mockResolvedValue({
      player_count: 123456,
    });

    const result = await handleGetCurrentPlayers({ appid: 730 });

    expect(steam.getNumberOfCurrentPlayers).toHaveBeenCalledWith(730);
    expect(result.content[0].text).toContain("730");
    expect(result.content[0].text).toContain("123456");
  });

  it("API 오류 시 에러 전파", async () => {
    vi.mocked(steam.getNumberOfCurrentPlayers).mockRejectedValue(
      new Error("Steam API 오류 (429): Too Many Requests")
    );

    await expect(
      handleGetCurrentPlayers({ appid: 730 })
    ).rejects.toThrow("Steam API 오류");
  });
});

describe("steam-tools - handleGetServersAtAddress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("정상 케이스 - servers 반환", async () => {
    vi.mocked(steam.getServersAtAddress).mockResolvedValue({
      servers: [
        {
          addr: "192.168.1.1:27015",
          gmsindex: 0,
          steamid: "123",
          appid: 730,
        },
      ],
    });

    const result = await handleGetServersAtAddress({
      addr: "192.168.1.1:27015",
    });

    expect(steam.getServersAtAddress).toHaveBeenCalledWith("192.168.1.1:27015");
    expect(result.content[0].text).toContain("servers");
    expect(result.content[0].text).toContain("192.168.1.1:27015");
  });

  it("IP만 전달 (포트 생략)", async () => {
    vi.mocked(steam.getServersAtAddress).mockResolvedValue({ servers: [] });

    await handleGetServersAtAddress({ addr: "192.168.1.1" });

    expect(steam.getServersAtAddress).toHaveBeenCalledWith("192.168.1.1");
  });

  it("API 오류 시 에러 전파", async () => {
    vi.mocked(steam.getServersAtAddress).mockRejectedValue(
      new Error("Steam API 오류 (500): Internal Server Error")
    );

    await expect(
      handleGetServersAtAddress({ addr: "192.168.1.1" })
    ).rejects.toThrow("Steam API 오류");
  });
});

describe("steam-tools - handleGetAppNews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("정상 케이스 - newsitems 반환", async () => {
    vi.mocked(steam.getNewsForApp).mockResolvedValue({
      newsitems: [
        {
          title: "Patch Notes",
          url: "https://example.com/news",
          contents: "Bug fixes",
          date: 1700000000,
        },
      ],
    });

    const result = await handleGetAppNews({ appid: 730 });

    expect(steam.getNewsForApp).toHaveBeenCalledWith(730, 5, 300);
    expect(result.content[0].text).toContain("Patch Notes");
    expect(result.content[0].text).toContain("newsitems");
  });

  it("count, maxlength 옵션 전달", async () => {
    vi.mocked(steam.getNewsForApp).mockResolvedValue({ newsitems: [] });

    await handleGetAppNews({
      appid: 730,
      count: 10,
      maxlength: 500,
    });

    expect(steam.getNewsForApp).toHaveBeenCalledWith(730, 10, 500);
  });

  it("API 오류 시 에러 전파", async () => {
    vi.mocked(steam.getNewsForApp).mockRejectedValue(
      new Error("Steam API 오류 (429): Too Many Requests")
    );

    await expect(handleGetAppNews({ appid: 730 })).rejects.toThrow(
      "Steam API 오류"
    );
  });
});
