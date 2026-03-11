/**
 * Steam Web API 응답 타입 정의
 */

// 프로필 요약
export interface PlayerSummary {
  steamid: string;
  communityvisibilitystate: number;
  profilestate?: number;
  personaname: string;
  profileurl: string;
  avatar: string;
  avatarmedium: string;
  avatarfull: string;
  personastate: number;
  realname?: string;
  timecreated?: number;
  loccountrycode?: string;
  gameextrainfo?: string;
  gameid?: string;
}

// 보유 게임
export interface OwnedGame {
  appid: number;
  name: string;
  playtime_forever: number;
  img_icon_url: string;
  playtime_2weeks?: number;
}

// 서버 정보
export interface GameServer {
  addr: string;
  gameport: number;
  steamid: string;
  name: string;
  appid: number;
  gamedir: string;
  version: string;
  product: string;
  region: number;
  players: number;
  max_players: number;
  bots: number;
  map: string;
  secure: boolean;
  dedicated: boolean;
  os: string;
  gametype: string;
}
