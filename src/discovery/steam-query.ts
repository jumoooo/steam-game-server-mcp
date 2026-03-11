/**
 * Steam Master Server Query - 서버 목록 검색 (명세 §13.2)
 * steam-server-query 패키지 사용
 */

import { queryMasterServer, REGIONS } from "steam-server-query";

/** gamedig type → Steam App ID 매핑 */
const GAME_TYPE_TO_APPID: Record<string, number> = {
  rust: 252490,
  counterstrike2: 730,
  cs2: 730,
  csgo: 730,
  tf2: 440,
  dayz: 221100,
  arkse: 346110,
  ark: 346110,
  conanexiles: 440900,
  left4dead2: 550,
  left4dead: 500,
};

/** region 문자열 → REGIONS */
const REGION_MAP: Record<string, number> = {
  us: REGIONS.US_EAST_COAST,
  us_east: REGIONS.US_EAST_COAST,
  us_west: REGIONS.US_WEST_COAST,
  eu: REGIONS.EUROPE,
  europe: REGIONS.EUROPE,
  asia: REGIONS.ASIA,
  au: REGIONS.AUSTRALIA,
  australia: REGIONS.AUSTRALIA,
  sa: REGIONS.SOUTH_AMERICA,
  all: REGIONS.ALL,
};

const MASTER_SERVER = "hl2master.steampowered.com:27011";
const DEFAULT_TIMEOUT = 5000;
const DEFAULT_MAX_HOSTS = 50;

export interface DiscoverOptions {
  gameType?: string;
  region?: string;
  maxHosts?: number;
}

/**
 * Steam Master Server Query로 게임 서버 목록 검색
 * @returns IP:port 형식 배열
 */
export async function discoverServersViaSteam(
  options: DiscoverOptions = {}
): Promise<string[]> {
  const { gameType, region = "all", maxHosts = DEFAULT_MAX_HOSTS } = options;

  const regionCode = REGION_MAP[region?.toLowerCase()] ?? REGIONS.ALL;
  const filter: Record<string, number | string> = {};

  if (gameType) {
    const appid = GAME_TYPE_TO_APPID[gameType.toLowerCase()];
    if (appid) {
      filter.appid = appid;
    }
    // appid가 없으면 필터 없이 전체 검색 (minecraft 등 Steam 외 게임은 빈 결과)
  }

  try {
    const hosts = await queryMasterServer(
      MASTER_SERVER,
      regionCode,
      filter,
      DEFAULT_TIMEOUT,
      maxHosts
    );
    return hosts;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Steam Master Server 조회 실패: ${msg}`);
  }
}
