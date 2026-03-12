# Steam & Game Server MCP 개발 후기

> Cursor, Claude Desktop에서 Steam 프로필·게임 서버를 조회·관리하는 MCP 서버를 만들었습니다.

---

## 1. 📦 프로젝트 소개

**Steam & Game Server MCP**는 MCP(Model Context Protocol) 서버입니다.  
Steam Web API와 게임 서버(Query/RCON/로그)를 하나로 묶어서, Cursor·Claude Desktop·VS Code·Windsurf 같은 MCP 클라이언트에서 바로 사용할 수 있게 합니다.

| 구분 | 내용 |
|------|------|
| **Steam** | 프로필, 보유 게임, 동시 접속자, 앱 뉴스 조회 |
| **Game Server** | gamedig 기반 서버 상태 조회, RCON(kick/ban/restart), 로그 파싱 |
| **기술 스택** | TypeScript, Node.js 18+, MCP SDK, gamedig, rcon-srcds, steam-server-query, Zod |

- **npm 패키지**: `steam-game-server-mcp` (v1.0.1)
- **저장소**: [jumoooo/steam-game-server-mcp](https://github.com/jumoooo/steam-game-server-mcp)
- **설치 없이 실행**: `npx steam-game-server-mcp@latest`

---

## 2. 🤔 왜 만들었는가 (문제)

### 해결하려던 문제

1. **AI 도구와 Steam/게임 서버 연동 부족**  
   Cursor나 Claude Desktop에서 Steam 프로필, 게임 라이브러리, 서버 상태를 바로 조회할 수 있는 도구가 거의 없었습니다.

2. **여러 API·프로토콜의 분산**  
   Steam Web API, gamedig(서버 쿼리), RCON, Steam Master Server Query 등이 각각 따로 있어서, 하나의 흐름으로 쓰기 어려웠습니다.

3. **서버 관리의 수동 작업**  
   kick, ban, restart 같은 작업을 하려면 직접 RCON 클라이언트를 쓰거나 별도 스크립트를 만들어야 했습니다.

### MCP로 해결한 점

- AI가 **자연어로 요청**하면 MCP 도구가 Steam/게임 서버 API를 호출
- **26개 도구**를 하나의 서버에 모아서 사용
- `servers.json`으로 서버 목록을 관리하고, RCON·로그까지 같은 설정으로 사용

---

## 3. 🏗️ 전체 구조

### 디렉터리 구조

```
src/
├── config/          # servers.json 로더, Zod 스키마 검증
├── steam-api/       # Steam Web API 클라이언트 (endpoints, types)
├── game-server/     # query, cache, dedup, trend, normalize
├── rcon/            # RCON 클라이언트 (Source 프로토콜)
├── discovery/       # Steam Master Server Query
├── logs/            # tail, parsers(rust/source/minecraft), analyzer
├── tools/           # 6개 도구 모듈 (steam, server, admin, inventory, discovery, log)
└── index.ts         # MCP 서버 진입점, 26개 도구 등록
```

### 의존성

| 패키지 | 용도 |
|--------|------|
| `@modelcontextprotocol/sdk` | MCP 서버, 도구 등록 |
| `gamedig` | 게임 서버 쿼리 (A2S) |
| `rcon-srcds` | RCON (Rust, CS2, Minecraft 등) |
| `steam-server-query` | Steam Master Server Query |
| `zod` | 입력 스키마 검증 |

### 데이터 흐름

```
MCP 클라이언트 (Cursor 등)
    ↓ stdio
index.ts (McpServer)
    ↓
tools/*.ts (handle*)
    ↓
steam-api / game-server / rcon / discovery / logs
    ↓
외부 API·서버
```

---

## 4. ⚡ 핵심 기능

### 4.1 Steam 도구 (7개)

| 도구 | 설명 |
|------|------|
| `steam_resolve_vanity_url` | 커스텀 URL → SteamID 변환 |
| `steam_get_player_summary` | 프로필 요약 |
| `steam_get_owned_games` | 보유 게임 목록 |
| `steam_get_recently_played` | 최근 플레이 게임 |
| `steam_get_current_players` | 앱별 동시 접속자 수 |
| `steam_get_servers_at_address` | IP로 게임 서버 조회 |
| `steam_get_app_news` | 앱 뉴스/패치 노트 |

### 4.2 Game Server + Monitoring (9개)

- **기본 쿼리**: `game_server_query`, `game_server_players`, `game_server_rules`
- **모니터링**: `server_overview`, `server_health`, `server_diagnose`, `server_compare`, `server_alert`, `server_trend`

**구현 포인트**

- **캐시**: TTL 30초, `game-server/cache.ts`
- **Dedup**: 동시 쿼리 시 `pendingQueries` Map으로 중복 호출 방지
- **Trend**: `game_server_query` 호출 시 최대 20개 샘플 누적, `increasing`/`decreasing`/`stable` 계산

### 4.3 Admin (4개) — RCON

| 도구 | 설명 |
|------|------|
| `server_admin_kick_player` | 플레이어 추방 |
| `server_admin_ban_player` | 플레이어 밴 (1h, 24h, 7d, permanent) |
| `server_admin_restart_server` | 서버 재시작 |
| `server_admin_rcon_command` | whitelist RCON 명령 (status, say, players 등) |

- RCON 비밀번호는 `servers.json`의 `passwordEnv`로 env 변수 참조
- `rcon-srcds` 패키지로 Source RCON 프로토콜 사용

### 4.4 Discovery + Inventory + Log

| 도구 | 설명 |
|------|------|
| `steam_discover_servers` | Steam Master Server Query로 서버 검색 |
| `auto_discover_servers` | 후보 탐색, dryRun 시 servers.json 미변경 |
| `add_server` / `remove_server` | servers.json 관리 (adminToken 필요) |
| `list_servers` | 등록 서버 목록 |
| `log_recent_events` | 로그에서 player_join/leave, error 추출 |

**로그 파서**: rust, source(cs2/csgo/tf2/l4d2), minecraft 지원

---

## 5. 🔧 구현 과정

### 5.1 Phase 1: Steam + 기본 Game Server

- Steam Web API 클라이언트 (`steam-api/client.ts`, `endpoints.ts`)
- gamedig 기반 쿼리 (`game-server/query.ts`, `normalize.ts`)
- servers.json 로더 (`config/servers.ts`) — Zod 검증, 원자적 쓰기(temp + rename)

### 5.2 Phase 2: RCON + Admin

- `rcon/client.ts` — `rcon-srcds` 래핑, 타임아웃 5초
- Admin 도구: kick, ban, restart, rcon_command
- RCON 명령 whitelist로 제한

### 5.3 Phase 3: Monitoring + Discovery + Log

- **server_trend**: `trend.ts`에서 Map<serverId, TrendSample[]>, 최대 20샘플
- **steam_discover_servers**: `steam-server-query`로 Master Server Query, gameType→AppID 매핑
- **log_recent_events**: `tail.ts` + 게임별 파서(rust, source, minecraft) → Event[]

### 5.4 설계 결정

| 항목 | 결정 |
|------|------|
| servers.json 쓰기 | temp 파일 작성 후 rename으로 원자성 확보 |
| RCON 비밀번호 | env 변수 참조 (`passwordEnv`), 코드에 직접 저장 안 함 |
| add/remove_server | `STEAM_MCP_ADMIN_TOKEN` env + `adminToken` 파라미터 둘 다 검증 |
| 에러 메시지 | 사용자용 한글 메시지, 스택 트레이스 노출 안 함 |

---

## 6. 🧪 테스트

### 자동 테스트 (Vitest)

```bash
npm test
```

| 테스트 파일 | 테스트 수 | 내용 |
|-------------|----------|------|
| config/servers.test.ts | 10 | loadServersConfig, getServerConfig, writeServersConfig |
| tools/server-tools.test.ts | 10 | game_server_query, Overview, Trend, Health, Alert |
| tools/inventory-tools.test.ts | 9 | add, remove, list, auto_discover |
| tools/admin-tools.test.ts | 13 | kick, ban, restart, rcon_command |
| tools/discovery-tools.test.ts | 4 | steam_discover_servers |
| tools/log-tools.test.ts | 5 | log_recent_events |
| rcon/client.test.ts | 5 | sendRcon 에러 경로 (rcon 미설정, passwordEnv 누락) |

**총 56개 테스트 통과**

### 수동 테스트

1. **공개 서버**: servers.json에 Minecraft 서버(Hypixel 등) 등록 후 `game_server_query`, `server_overview` 호출
2. **RCON**: `npm run rcon:server`로 mock 서버 실행 → `npm run rcon:test`로 `status` 명령 검증

---

## 7. 💡 배운 점

### 기술적

1. **MCP SDK**  
   `registerTool`로 도구를 등록하고, Zod 스키마로 입력 검증. stdio 기반이라 별도 HTTP 서버 없이 동작.

2. **gamedig**  
   게임별로 다른 쿼리 프로토콜을 추상화. `type`은 [GAMES_LIST](https://github.com/gamedig/node-gamedig/blob/master/GAMES_LIST.md)와 일치해야 함.

3. **RCON**  
   Source RCON 프로토콜. `rcon-srcds`가 CJS라 `createRequire`로 ESM에서 사용.

4. **Steam Master Server Query**  
   `hl2master.steampowered.com:27011`에 연결해 AppID·region 필터로 서버 목록 조회. Minecraft 등 Steam 외 게임은 결과 없음.

### 설계

1. **원자적 쓰기**  
   servers.json 수정 시 temp 파일 → rename으로, 실패해도 기존 파일 유지.

2. **캐시 + Dedup**  
   동시에 같은 서버를 여러 번 쿼리해도 실제 요청은 한 번만 수행.

3. **에러 메시지**  
   명세에 맞춰 한글 메시지로 통일하고, 내부 스택 트레이스는 노출하지 않음.

---

## 🎯 마무리

- **26개 MCP 도구**로 Steam + 게임 서버 조회·관리 통합
- **56개 Vitest 테스트**로 핵심 로직 검증
- **npx**로 설치 없이 바로 사용 가능

Cursor나 Claude Desktop에서 Steam 프로필·게임 서버를 다루고 싶다면 한 번 써보면 좋을 것 같습니다.

---

*작성일: 2026-03*
