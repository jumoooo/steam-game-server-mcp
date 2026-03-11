/**
 * Steam Web API 엔드포인트 URL 정의
 * Base: https://api.steampowered.com
 */

const BASE_URL = process.env.STEAM_API_BASE_URL ?? "https://api.steampowered.com";

export function getApiUrl(
  interfaceName: string,
  method: string,
  version: number,
  params: Record<string, string | number | boolean> = {}
): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    searchParams.set(key, String(value));
  });
  const query = searchParams.toString();
  return `${BASE_URL}/${interfaceName}/${method}/v${version}${query ? `?${query}` : ""}`;
}

// ISteamUser
export const ResolveVanityURL = (key: string, vanityurl: string) =>
  getApiUrl("ISteamUser", "ResolveVanityURL", 1, { key, vanityurl });

export const GetPlayerSummaries = (key: string, steamids: string) =>
  getApiUrl("ISteamUser", "GetPlayerSummaries", 2, { key, steamids });

export const GetPlayerBans = (key: string, steamids: string) =>
  getApiUrl("ISteamUser", "GetPlayerBans", 1, { key, steamids });

export const GetFriendList = (key: string, steamid: string, relationship = "friend") =>
  getApiUrl("ISteamUser", "GetFriendList", 1, { key, steamid, relationship });

// IPlayerService
export const GetOwnedGames = (
  key: string,
  steamid: string,
  options?: { include_appinfo?: boolean; include_played_free_games?: boolean }
) =>
  getApiUrl("IPlayerService", "GetOwnedGames", 1, {
    key,
    steamid,
    include_appinfo: options?.include_appinfo ?? true,
    include_played_free_games: options?.include_played_free_games ?? false,
  });

export const GetRecentlyPlayedGames = (key: string, steamid: string, count?: number) =>
  getApiUrl("IPlayerService", "GetRecentlyPlayedGames", 1, {
    key,
    steamid,
    ...(count != null && { count }),
  });

// ISteamUserStats
export const GetNumberOfCurrentPlayers = (appid: number) =>
  getApiUrl("ISteamUserStats", "GetNumberOfCurrentPlayers", 1, { appid });

// ISteamApps
export const GetServersAtAddress = (addr: string) =>
  getApiUrl("ISteamApps", "GetServersAtAddress", 1, { addr });

// ISteamNews
export const GetNewsForApp = (appid: number, count = 5, maxlength = 300) =>
  getApiUrl("ISteamNews", "GetNewsForApp", 2, { appid, count, maxlength });
