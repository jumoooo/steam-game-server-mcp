# Steam & Game Server MCP

Steam 프로필, 게임 라이브러리, 동시 접속자, 게임 서버 상태를 조회·진단·관리하는 MCP(Model Context Protocol) 서버입니다.  
Cursor, Claude Desktop, VS Code, Windsurf 등 MCP 클라이언트에서 사용합니다.

---

## 1. 소개

| 구분        | 내용                                                           |
| ----------- | -------------------------------------------------------------- |
| 역할        | Steam Web API + 게임 서버(Query/RCON/로그) 통합                |
| Steam       | 프로필, 게임 라이브러리, 동시 접속자, 앱 뉴스 조회             |
| Game Server | gamedig 기반 서버 상태 조회, RCON(kick/ban/restart), 로그 파싱 |

---

## 2. 요구사항

- Node.js 18+
- MCP 클라이언트 (Cursor, Claude Desktop, VS Code, Windsurf 등)
- `STEAM_API_KEY` — [Steam API 키](https://steamcommunity.com/dev/apikey) 발급

> MCP 설정의 `env`에 환경변수를 넣는 것을 기준으로 합니다. `.env`는 로컬 개발 시에만 사용합니다.

---

## 3. MCP 설정

### 3.1 표준 설정 (npx)

```bash
# 사전 설치 없이 npx로 최신 버전 실행 (최초 1회 실행 시 패키지를 내려받습니다)
npx steam-game-server-mcp@latest --help
```

```json
{
  "mcpServers": {
    "steam-game-server": {
      "command": "npx",
      "args": ["steam-game-server-mcp@latest"],
      "env": {
        "STEAM_API_KEY": "your_key",
        "STEAM_ID": "your_steam_id",
        "STEAM_MCP_SERVERS_PATH": "C:/path/to/servers.json"
      }
    }
  }
}
```

- `STEAM_MCP_SERVERS_PATH`: 미설정 시 `./servers.json` 사용. 둘 다 없으면 Steam 도구만 동작

### 3.2 Cursor

1. `Settings` → `MCP` → `Add new MCP Server`
2. 위 JSON 입력 (또는 `command`를 `node`, `args`를 `["/path/to/dist/index.js"]`로 로컬 빌드 경로 지정)

### 3.3 env 키별 요약

| env 키                    | 필수 | 용도                                                                                     |
| ------------------------- | ---- | ---------------------------------------------------------------------------------------- |
| `STEAM_API_KEY`           | O    | Steam API 인증. Steam 도구 사용 시 필수                                                  |
| `STEAM_ID`                | X    | 기본 Steam ID. 없으면 도구 호출 시 `steamId` 인자 필요                                   |
| `STEAM_MCP_SERVERS_PATH`  | X    | servers.json 경로. Game Server 도구 사용 시 필요                                         |
| `SERVER_RCON_PASSWORD` 등 | X    | RCON 비밀번호. Admin 도구 사용 시, servers.json의 `passwordEnv`와 일치하는 이름으로 설정 |
| `STEAM_MCP_ADMIN_TOKEN`   | X    | add_server, remove_server 호출 시 필요. env + `adminToken` 파라미터 둘 다 일치해야 실행  |

### 3.4 사용 시나리오별 env 세트

| 시나리오                  | env                                       | 파일                          |
| ------------------------- | ----------------------------------------- | ----------------------------- |
| Steam 조회만              | `STEAM_API_KEY`, `STEAM_ID`(선택)         | -                             |
| Game Server 조회          | `STEAM_API_KEY`, `STEAM_MCP_SERVERS_PATH` | servers.json                  |
| Game Server + RCON Admin  | 위 + `SERVER_RCON_PASSWORD`               | servers.json (rcon 설정 포함) |
| add_server, remove_server | 위 + `STEAM_MCP_ADMIN_TOKEN`              | servers.json                  |

---

## 4. MCP 도구 (26개)

### Steam (7개)

| 도구                           | 설명                      |
| ------------------------------ | ------------------------- |
| `steam_resolve_vanity_url`     | 커스텀 URL → SteamID 변환 |
| `steam_get_player_summary`     | 프로필 요약               |
| `steam_get_owned_games`        | 보유 게임 목록            |
| `steam_get_recently_played`    | 최근 플레이 게임          |
| `steam_get_current_players`    | 앱별 동시 접속자 수       |
| `steam_get_servers_at_address` | IP로 게임 서버 조회       |
| `steam_get_app_news`           | 앱 뉴스/패치 노트         |

### Game Server (3개)

| 도구                  | 설명                             |
| --------------------- | -------------------------------- |
| `game_server_query`   | 서버 상태 (이름, 맵, 인원, ping) |
| `game_server_players` | 플레이어 목록                    |
| `game_server_rules`   | 서버 규칙(cvars)                 |

### Monitoring (6개)

| 도구              | 설명                |
| ----------------- | ------------------- |
| `server_overview` | 모든 서버 상태 조회 |
| `server_health`   | 단일 서버 진단      |
| `server_diagnose` | AI용 진단           |
| `server_compare`  | 서버 비교 + 추천    |
| `server_alert`    | 문제 서버 필터링    |
| `server_trend`    | 플레이어 수 추이    |

### Admin (4개) — RCON 필요

| 도구                          | 설명                |
| ----------------------------- | ------------------- |
| `server_admin_kick_player`    | 플레이어 추방       |
| `server_admin_ban_player`     | 플레이어 밴         |
| `server_admin_restart_server` | 서버 재시작         |
| `server_admin_rcon_command`   | whitelist RCON 명령 |

### Inventory (4개)

| 도구                    | 설명                            |
| ----------------------- | ------------------------------- |
| `add_server`            | servers.json에 서버 추가        |
| `remove_server`         | servers.json에서 서버 삭제      |
| `list_servers`          | 등록 서버 목록                  |
| `auto_discover_servers` | Steam Master Server로 후보 탐색 |

### Discovery (1개)

| 도구                     | 설명                                       |
| ------------------------ | ------------------------------------------ |
| `steam_discover_servers` | Steam Master Server Query로 게임 서버 검색 |

### Log (1개)

| 도구                | 설명                                                         |
| ------------------- | ------------------------------------------------------------ |
| `log_recent_events` | servers.json의 logPath(로컬 파일 경로)에서 player_join/leave, error 추출 |

---

## 5. 테스트

### 자동 테스트 (Vitest)

```bash
npm test
```

- config/servers, server-tools, inventory-tools, admin-tools, discovery-tools, log-tools, steam-tools, rcon/client — 총 76개

### 수동 테스트

- **Game Server 조회**: 공개 Minecraft 서버(Hypixel 등)를 servers.json에 등록 후 `game_server_query`, `server_overview` 호출
- **RCON**: `npm run rcon:server`로 mock 서버 실행 → `STEAM_MCP_SERVERS_PATH=./test/rcon/servers.rcon-test.json SERVER_RCON_PASSWORD=test123 npm run rcon:test -- my-rust status`

---

## 6. 주의사항 및 구현 제약

### 에러 조건

- **gamedig type**: `type`은 [GAMES_LIST](https://github.com/gamedig/node-gamedig/blob/master/GAMES_LIST.md)와 일치해야 함
- **RCON**: `rcon.enabled: true`인데 `passwordEnv`에 해당하는 env가 없으면 `"RCON not configured for this server."` 반환
- **STEAM_API_KEY**: 미설정 시 Steam 도구 전부 `"STEAM_API_KEY 환경 변수를 확인하세요."` 반환

### 구현 제약

| 항목 | 제약 |
|------|------|
| `log_recent_events` | `logPath`는 MCP 프로세스가 접근 가능한 **로컬 파일 경로**만 지원. 원격 URL/SSH 불가. 지원 게임: rust, counterstrike2/csgo/tf2 등 Source 엔진, minecraft |
| `server_trend` | `game_server_query` 호출 시 샘플이 누적됨. trend만 단독 호출하면 데이터 없을 수 있음 |
| `add_server`, `remove_server` | `adminToken` 파라미터에 `STEAM_MCP_ADMIN_TOKEN` env와 **동일한 값**을 넣어야 실행됨 |

---

## 7. 개발 셋업

```bash
npm install
npm run build
npm run dev   # 또는 npm start
```

로컬 실행 시 `.env`에 `STEAM_API_KEY`, `STEAM_ID`, RCON 비밀번호 등을 설정합니다.
