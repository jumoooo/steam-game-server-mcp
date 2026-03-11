/**
 * Steam Web API 클라이언트
 * .env의 STEAM_API_KEY 사용
 */

import * as endpoints from "./endpoints.js";
import type { GameServer, OwnedGame, PlayerSummary } from "./types.js";

const API_KEY = process.env.STEAM_API_KEY;

function ensureApiKey(): string {
  if (!API_KEY?.trim()) {
    throw new Error("STEAM_API_KEY 환경 변수를 확인하세요.");
  }
  return API_KEY;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Steam API 오류 (${res.status}): ${text || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

/** 커스텀 URL → SteamID 변환 */
export async function resolveVanityUrl(vanityurl: string): Promise<{ steamid: string }> {
  const key = ensureApiKey();
  const url = endpoints.ResolveVanityURL(key, vanityurl);
  const data = await fetchJson<{ response: { steamid?: string; success: number; message?: string } }>(url);
  if (data.response.success !== 1 || !data.response.steamid) {
    throw new Error(data.response.message ?? "해당 커스텀 URL을 찾을 수 없습니다.");
  }
  return { steamid: data.response.steamid };
}

/** 프로필 요약 조회 */
export async function getPlayerSummaries(steamids: string): Promise<{ players: PlayerSummary[] }> {
  const key = ensureApiKey();
  const url = endpoints.GetPlayerSummaries(key, steamids);
  const data = await fetchJson<{ response: { players: PlayerSummary[] } }>(url);
  return { players: data.response.players ?? [] };
}

/** 보유 게임 목록 */
export async function getOwnedGames(
  steamid: string,
  options?: { include_appinfo?: boolean; include_played_free_games?: boolean }
): Promise<{ games: OwnedGame[]; game_count: number }> {
  const key = ensureApiKey();
  const url = endpoints.GetOwnedGames(key, steamid, options);
  const data = await fetchJson<{ response: { games?: OwnedGame[]; game_count: number } }>(url);
  return {
    games: data.response.games ?? [],
    game_count: data.response.game_count ?? 0,
  };
}

/** 최근 플레이 게임 */
export async function getRecentlyPlayedGames(
  steamid: string,
  count?: number
): Promise<{ games: OwnedGame[] }> {
  const key = ensureApiKey();
  const url = endpoints.GetRecentlyPlayedGames(key, steamid, count);
  const data = await fetchJson<{ response: { games?: OwnedGame[] } }>(url);
  return { games: data.response.games ?? [] };
}

/** 동시 접속자 수 */
export async function getNumberOfCurrentPlayers(appid: number): Promise<{ player_count: number }> {
  const url = endpoints.GetNumberOfCurrentPlayers(appid);
  const data = await fetchJson<{ response: { player_count: number } }>(url);
  return { player_count: data.response.player_count };
}

/** IP 주소로 서버 목록 조회 */
export async function getServersAtAddress(addr: string): Promise<{ servers: GameServer[] }> {
  const url = endpoints.GetServersAtAddress(addr);
  const data = await fetchJson<{ response: { servers?: GameServer[]; success?: boolean } }>(url);
  return { servers: data.response.servers ?? [] };
}

/** 앱 뉴스 */
export async function getNewsForApp(
  appid: number,
  count = 5,
  maxlength = 300
): Promise<{ newsitems: Array<{ title: string; url: string; contents: string; date: number }> }> {
  const url = endpoints.GetNewsForApp(appid, count, maxlength);
  const data = await fetchJson<{ appnews: { newsitems: Array<{ title: string; url: string; contents: string; date: number }> } }>(url);
  return { newsitems: data.appnews?.newsitems ?? [] };
}
