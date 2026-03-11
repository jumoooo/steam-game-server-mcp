# Steam & Game Server MCP 상세 설계 명세서 v2

> AI Game Server Operations MCP - Steam API + Game Server Query + Monitoring + Admin + Diagnostics 통합 설계

**문서 버전**: 2.0  
**최종 수정**: 2026-03  
**상태**: Production-ready design

---

## 목차

1. [프로젝트 정체성](#1-프로젝트-정체성)
2. [기술 스택](#2-기술-스택)
3. [프로젝트 구조](#3-프로젝트-구조)
4. [서버 설정 (servers.json)](#4-서버-설정-serversjson)
5. [데이터 모델](#5-데이터-모델)
6. [캐시 및 Dedup](#6-캐시-및-dedup)
7. [도구(Tools) 상세 명세](#7-도구tools-상세-명세)
8. [Tool Response 형식](#8-tool-response-형식)
9. [RCON 설계](#9-rcon-설계)
10. [에러 처리](#10-에러-처리)
11. [환경 변수](#11-환경-변수)
12. [구현 순서](#12-구현-순서)
13. [Phase 2 확장](#13-phase-2-확장)
14. [통합 가이드](#14-통합-가이드)
15. [Inventory & Discovery (Phase 2)](#15-inventory--discovery-phase-2)

---

## 1. 프로젝트 정체성

### 1.1 포지션

| 구분 | 내용 |
|------|------|
| **프로젝트명** | Steam & Game Server MCP |
| **정체** | AI Game Server Operations MCP |
| **역할** | Steam API + Game Server Query + Monitoring + Admin + Diagnostics |

단순 Steam API wrapper가 아니라 **AI가 게임 서버 상태를 분석하고 관리하는 운영 도구**입니다.

### 1.2 구성 요소

| 영역 | 설명 |
|------|------|
| **Steam API** | 프로필, 게임 라이브러리, 동시 접속자, 앱 뉴스 |
| **Game Server Query** | gamedig 기반 서버 상태 조회 |
| **Server Health** | ping, load, latency 분석 |
| **Server Admin** | RCON (kick, ban, restart, rcon_command) |
| **Logs** | 서버 로그 파싱 (Phase 3) |
| **AI Diagnosis** | server_diagnose, server_alert, server_compare |

### 1.3 설계 원칙

- **Normalization**: 게임별 다른 응답을 통일된 ServerState로 변환
- **Cache + Dedup**: 동시 호출 시 gamedig 중복 실행 방지
- **RCON Safety**: 위험 명령은 전용 도구, 안전 명령은 whitelist
- **Timeout**: gamedig, RCON 모두 Promise.race로 hang 방지

---

## 2. 기술 스택

### 2.1 런타임 및 언어

| 항목 | 값 |
|------|-----|
| **런타임** | Node.js 18+ (LTS 권장) |
| **언어** | TypeScript (strict 모드) |
| **모듈** | ESM (type: "module") |

### 2.2 핵심 의존성

| 패키지 | 용도 |
|--------|------|
| `@modelcontextprotocol/sdk` | MCP 서버 |
| `zod` | 스키마 검증 |
| `dotenv` | 환경 변수 |
| `gamedig` | 게임 서버 쿼리 |
| `rcon-srcds` | RCON 클라이언트 |

### 2.3 package.json 의존성

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "dotenv": "^16.0.0",
    "gamedig": "^5.0.0",
    "rcon-srcds": "^2.1.0",
    "steam-server-query": "^1.1.3",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0"
  }
}
```

### 2.4 TypeScript 설정

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## 3. 프로젝트 구조

### 3.1 디렉터리 구조

```
steam_mcp/
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
├── servers.json
│
├── src/
│   ├── index.ts                    # MCP 서버 진입점
│   │
│   ├── steam-api/                  # Steam Web API (기존)
│   │   ├── client.ts
│   │   ├── endpoints.ts
│   │   └── types.ts
│   │
│   ├── game-server/                # 게임 서버 쿼리
│   │   ├── query.ts                # gamedig 호출 + timeout
│   │   ├── cache.ts                # TTL 30초
│   │   ├── dedup.ts                # pendingQueries Map
│   │   ├── normalize.ts            # 통일된 ServerState 변환
│   │   └── types.ts
│   │
│   ├── rcon/
│   │   └── client.ts               # RCON + timeout 5초
│   │
│   ├── logs/                       # Phase 3
│   │   ├── parsers/
│   │   │   ├── rust.ts
│   │   │   ├── source.ts
│   │   │   └── minecraft.ts
│   │   ├── tail.ts
│   │   └── analyzer.ts
│   │
│   ├── config/
│   │   └── servers.ts              # servers.json 로더 + Zod 검증
│   │
│   └── tools/
│       ├── steam-tools.ts          # Steam 7개 도구
│       ├── server-tools.ts         # game_server_*, overview, health, diagnose, compare, alert
│       ├── admin-tools.ts          # kick, ban, restart, rcon_command
│       └── health-tools.ts         # server_health, server_diagnose
│
├── mcps/
│   └── steam-game-server/
│       ├── SERVER_METADATA.json
│       └── INSTRUCTIONS.md
│
└── docs/
    ├── README.md
    ├── STEAM_GAME_SERVER_MCP_SPEC.md      # 레거시
    └── STEAM_GAME_SERVER_MCP_SPEC_V2.md  # 본 문서
```

### 3.2 모듈별 역할

| 모듈 | 역할 |
|------|------|
| `steam-api` | Steam Web API 호출 |
| `game-server/query` | gamedig.query + timeout 래핑 |
| `game-server/cache` | `Map<serverId, {data, ts}>` TTL 30초 |
| `game-server/dedup` | `Map<serverId, Promise<ServerState>>` 동시 호출 방지 |
| `game-server/normalize` | gamedig raw → ServerState 변환 |
| `rcon/client` | RCON 연결 + 명령 실행 + timeout |
| `config/servers` | servers.json 로드 + Zod 검증 |

---

## 4. 서버 설정 (servers.json)

### 4.1 파일 경로

| 우선순위 | 경로 |
|----------|------|
| 1 | `STEAM_MCP_SERVERS_PATH` 환경변수 |
| 2 | `./servers.json` (프로젝트 루트) |

### 4.2 스키마

```json
{
  "servers": [
    {
      "id": "rust-eu-1",
      "name": "Rust EU #1",
      "type": "rust",
      "host": "1.2.3.4",
      "port": 28015,
      "query": {
        "enabled": true
      },
      "rcon": {
        "enabled": true,
        "port": 28016,
        "passwordEnv": "SERVER_RCON_PASSWORD"
      },
      "logPath": "/path/to/server.log"
    }
  ]
}
```

### 4.3 필드 상세

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `id` | string | O | 서버 ID (고유 식별자) |
| `name` | string | O | 표시용 이름 |
| `type` | string | O | gamedig 게임 타입 ID |
| `host` | string | O | IP 또는 호스트명 |
| `port` | number | O | 쿼리 포트 |
| `query.enabled` | boolean | X | 기본 true. false면 query 비활성화 |
| `rcon.enabled` | boolean | X | 기본 false |
| `rcon.port` | number | X | rcon.enabled가 true일 때 필수 |
| `rcon.passwordEnv` | string | X | .env 변수명. 비밀번호는 JSON에 넣지 않음 |
| `logPath` | string | X | 로그 파일 경로 (Phase 3, 로컬만) |

### 4.4 gamedig type

`type` 필드는 gamedig의 GameDig Type ID와 일치해야 합니다.

**주요 타입 예시** (gamedig GAMES_LIST.md 참조):

| type | 게임 |
|------|------|
| rust | Rust |
| counterstrike2 | Counter-Strike 2 |
| csgo | Counter-Strike: Global Offensive |
| minecraft | Minecraft |
| tf2 | Team Fortress 2 |
| dayz | DayZ |
| arkse | Ark: Survival Evolved |
| conanexiles | Conan Exiles |

**검증**: `type`은 `z.string()`으로 허용. 잘못된 type은 gamedig 호출 시 런타임 에러 처리.  
전체 목록: https://github.com/gamedig/node-gamedig/blob/master/GAMES_LIST.md

### 4.5 Zod 스키마 (config/servers.ts)

```typescript
const ServerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.string().min(1),
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  query: z.object({
    enabled: z.boolean().optional().default(true),
  }).optional(),
  rcon: z.object({
    enabled: z.boolean().optional().default(false),
    port: z.number().int().min(1).max(65535),
    passwordEnv: z.string().min(1),
  }).optional(),
  logPath: z.string().optional(),
});

const ServersConfigSchema = z.object({
  servers: z.array(ServerSchema),
});
```

### 4.6 passwordEnv 처리

- `rcon.passwordEnv` 값에 해당하는 이름의 환경변수(예: `"SERVER_RCON_PASSWORD"`)를 `process.env.SERVER_RCON_PASSWORD`처럼 조회
- 환경변수가 없거나 빈 문자열이면 해당 서버의 RCON 도구 비활성화
- 에러 메시지: "RCON not configured for this server. Check passwordEnv."

---

## 5. 데이터 모델

### 5.1 Normalized ServerState

모든 게임 서버의 응답을 통일된 형태로 변환합니다.

```typescript
interface ServerState {
  id: string;
  name: string;
  map: string;
  players: number;
  maxPlayers: number;
  ping: number;
  game: string;
  latencyCategory: LatencyCategory;
  playerList?: ServerPlayer[];
  rules?: Record<string, string>;
  queriedAt: string;  // ISO 8601 timestamp
}

interface ServerPlayer {
  name: string;
  score?: number;
  time?: number;
}

type LatencyCategory = "GOOD" | "NORMAL" | "HIGH" | "CRITICAL";
```

### 5.2 latencyCategory 기준

| ping | latencyCategory |
|------|-----------------|
| 0 ~ 100 | GOOD |
| 100 ~ 200 | NORMAL |
| 200 ~ 300 | HIGH |
| 300+ | CRITICAL |
| -1 (timeout/offline) | CRITICAL |

### 5.3 normalize 함수

```typescript
function normalize(raw: GamedigResult, serverId: string): ServerState {
  const ping = raw.ping ?? -1;
  return {
    id: serverId,
    name: raw.name ?? "Unknown",
    map: raw.map ?? "Unknown",
    players: raw.players?.length ?? 0,
    maxPlayers: raw.maxplayers ?? 0,
    ping,
    game: raw.raw?.game ?? raw.type ?? "unknown",
    latencyCategory: getLatencyCategory(ping),
    playerList: raw.players?.map(p => ({ name: p.name, score: p.score, time: p.time })),
    rules: raw.raw,
    queriedAt: new Date().toISOString(),
  };
}

function getLatencyCategory(ping: number): LatencyCategory {
  if (ping < 0) return "CRITICAL";
  if (ping <= 100) return "GOOD";
  if (ping <= 200) return "NORMAL";
  if (ping <= 300) return "HIGH";
  return "CRITICAL";
}
```

### 5.4 HealthStatus

```typescript
type HealthStatus = "GOOD" | "WARNING" | "HIGH_LOAD" | "CRITICAL";

function evaluateHealth(state: ServerState): { status: HealthStatus; reason?: string } {
  if (state.ping === -1) return { status: "CRITICAL", reason: "Server offline or timeout" };
  if (state.ping > 300) return { status: "WARNING", reason: "High ping" };
  if (state.players / state.maxPlayers > 0.95) return { status: "HIGH_LOAD", reason: "Server nearly full" };
  return { status: "GOOD" };
}
```

### 5.5 AlertType

```typescript
function detectAlert(server: ServerState): string | null {
  if (server.ping === -1) return "OFFLINE";
  if (server.ping > 300) return "HIGH_PING";
  if (server.players / server.maxPlayers > 0.95) return "HIGH_LOAD";
  return null;
}
```

---

## 6. 캐시 및 Dedup

### 6.1 상수

| 상수 | 값 | 단위 | 설명 |
|------|-----|------|------|
| CACHE_TTL | 30_000 | ms | 30초. 5초=과다, 60초+=stale |
| QUERY_TIMEOUT | 5_000 | ms | gamedig Promise.race |
| RCON_TIMEOUT | 5_000 | ms | RCON Promise.race |

### 6.2 Cache 구조

```typescript
const cache = new Map<string, { data: ServerState; ts: number }>();

function getCached(serverId: string): ServerState | null {
  const cached = cache.get(serverId);
  if (!cached) return null;
  if (Date.now() - cached.ts >= CACHE_TTL) {
    cache.delete(serverId);
    return null;
  }
  return cached.data;
}

function setCache(serverId: string, data: ServerState): void {
  cache.set(serverId, { data, ts: Date.now() });
}

function invalidateCache(serverId: string): void {
  cache.delete(serverId);
}
```

### 6.3 Dedup 패턴

```typescript
const pendingQueries = new Map<string, Promise<ServerState>>();

async function queryWithDedup(serverId: string): Promise<ServerState> {
  const cached = getCached(serverId);
  if (cached) return cached;

  const existing = pendingQueries.get(serverId);
  if (existing) return existing;

  const promise = queryServer(serverId)
    .then(result => {
      setCache(serverId, result);
      pendingQueries.delete(serverId);
      return result;
    })
    .catch(err => {
      pendingQueries.delete(serverId);
      throw err;
    });

  pendingQueries.set(serverId, promise);
  return promise;
}
```

### 6.4 Query Timeout

```typescript
function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Query timeout")), ms)
  );
}

async function queryServer(serverId: string): Promise<ServerState> {
  const config = getServerConfig(serverId);
  const raw = await Promise.race([
    Gamedig.query({ type: config.type, host: config.host, port: config.port }),
    timeout(QUERY_TIMEOUT),
  ]);
  return normalize(raw, serverId);
}
```

### 6.5 캐시 무효화

- `server_admin_kick_player`, `server_admin_ban_player`, `server_admin_restart_server`, `server_admin_rcon_command` 실행 후 해당 `serverId`에 대해 `invalidateCache(serverId)` 호출

---

## 7. 도구(Tools) 상세 명세

### 7.1 전체 목록 (총 16개)

| 영역 | 도구 | 설명 |
|------|------|------|
| Steam | steam_resolve_vanity_url | 커스텀 URL → SteamID |
| Steam | steam_get_player_summary | 프로필 요약 |
| Steam | steam_get_owned_games | 보유 게임 |
| Steam | steam_get_recently_played | 최근 플레이 |
| Steam | steam_get_current_players | 동시 접속자 |
| Steam | steam_get_servers_at_address | IP로 서버 조회 |
| Steam | steam_get_app_news | 앱 뉴스 |
| Game Server | game_server_query | 서버 상태 (name, map, players, ping) |
| Game Server | game_server_players | 플레이어 목록 |
| Game Server | game_server_rules | 서버 규칙 (cvars) |
| Monitoring | server_overview | 모든 서버 상태 한번에 |
| Monitoring | server_health | 단일 서버 상태 진단 |
| Monitoring | server_diagnose | AI용 진단 (원인 분석) |
| Monitoring | server_compare | 서버 비교 + 추천 |
| Monitoring | server_alert | 문제 서버만 필터링 |
| Admin | server_admin_kick_player | 플레이어 추방 |
| Admin | server_admin_ban_player | 플레이어 밴 |
| Admin | server_admin_restart_server | 서버 재시작 |
| Admin | server_admin_rcon_command | whitelist 명령 실행 |
| Logs | log_recent_events | 최근 로그 이벤트 (Phase 3) |

### 7.2 Steam 도구 (기존 7개)

| 도구 | 입력 | 출력 |
|------|------|------|
| steam_resolve_vanity_url | vanityurl | steamid |
| steam_get_player_summary | steamids | players[] |
| steam_get_owned_games | steamid, include_appinfo?, include_played_free_games? | games[], game_count |
| steam_get_recently_played | steamid, count? | games[] |
| steam_get_current_players | appid | player_count |
| steam_get_servers_at_address | addr | servers[] |
| steam_get_app_news | appid, count?, maxlength? | newsitems[] |

### 7.3 Game Server 도구

| 도구 | 입력 | 출력 |
|------|------|------|
| game_server_query | serverId | ServerState (name, map, players, maxPlayers, ping, latencyCategory) |
| game_server_players | serverId | playerList[] |
| game_server_rules | serverId | rules[] |

**입력**: `serverId`는 servers.json의 `id` 필드. servers.json에 등록된 서버만 조회 가능.

### 7.4 Monitoring 도구

| 도구 | 입력 | 출력 |
|------|------|------|
| server_overview | (없음) | ServerState[] (모든 서버) |
| server_health | serverId | ServerState + HealthStatus + reason |
| server_diagnose | serverId | ServerState + HealthStatus + analysis[] |
| server_compare | serverIds? | ServerState[] + recommendation |
| server_alert | (없음) | { serverId, alertType }[] |

**server_overview**: `Promise.all(servers.map(s => queryWithDedup(s.id)))`

**server_alert**: server_overview 결과에서 `detectAlert`가 null이 아닌 서버만 반환

### 7.5 Admin 도구

| 도구 | 입력 | 권한 |
|------|------|------|
| server_admin_kick_player | serverId, playerName, reason? | safe |
| server_admin_ban_player | serverId, playerId, duration, reason? | moderate |
| server_admin_restart_server | serverId, delay? | dangerous |
| server_admin_rcon_command | serverId, command | whitelist |

**server_admin_rcon_command whitelist**: status, say, players, time 등. ALLOWED_RCON_COMMANDS 배열로 관리.

### 7.6 Log 도구 (Phase 3)

| 도구 | 입력 | 출력 |
|------|------|------|
| log_recent_events | serverId, lines? | Event[] (player_join, player_leave, error) |

**logPath**: servers.json의 해당 서버 `logPath` 필드. 로컬 파일 경로만 지원 (Phase 3 v1).

---

## 8. Tool Response 형식

### 8.1 권장 구조

AI 가독성과 구조화 데이터를 모두 제공합니다.

```
Server Rust EU #1
Players: 12/32 | Map: procedural | Ping: 42ms
Health: GOOD | Latency: GOOD

JSON:
{"id":"rust-eu-1","name":"Rust EU #1","players":12,"maxPlayers":32,"ping":42,"health":"GOOD","latencyCategory":"GOOD"}
```

### 8.2 MCP content 형식

```typescript
return {
  content: [
    {
      type: "text",
      text: formatTextResponse(state) + "\n\nJSON:\n" + JSON.stringify(state, null, 2),
    },
  ],
};
```

MCP SDK가 `structuredContent`를 지원하지 않으면 content 내 text에 JSON 블록을 포함합니다.

### 8.3 server_diagnose 응답 예

```
Server Diagnosis: Rust EU #1

Ping: 230ms (HIGH)
Player load: 30/32 (HIGH)

Possible issues:
- Network latency
- Server overload

JSON:
{"status":"WARNING","reason":"High ping","ping":230,"players":30,"maxPlayers":32,...}
```

---

## 9. RCON 설계

### 9.1 Hybrid 방식

| 구분 | 방식 | 도구 |
|------|------|------|
| 위험 명령 | 전용 도구 |
입력 검증 | kick_player, ban_player, restart_server |
| 안전 명령 | generic + whitelist | rcon_command |

### 9.2 ALLOWED_RCON_COMMANDS

```typescript
const ALLOWED_RCON_COMMANDS = [
  "status",
  "say",
  "players",
  "time",
  // 게임별 추가 가능
] as const;

function isAllowedCommand(cmd: string): boolean {
  const base = cmd.split(/\s+/)[0]?.toLowerCase();
  return ALLOWED_RCON_COMMANDS.includes(base);
}
```

### 9.3 RCON Timeout

```typescript
async function sendRcon(serverId: string, command: string): Promise<string> {
  const client = await getRconClient(serverId);
  return Promise.race([
    client.send(command),
    timeout(RCON_TIMEOUT),
  ]);
}
```

### 9.4 ban_player duration 형식

- `"1h"`, `"24h"`, `"7d"`, `"permanent"` 등
- 게임별로 다를 수 있음. Source: `minutes`, Rust: `duration` 문자열

---

## 10. 에러 처리

### 10.1 에러 유형별 처리

| 상황 | 처리 | 사용자 메시지 |
|------|------|---------------|
| API 키 누락 | 즉시 실패 | "STEAM_API_KEY 환경 변수를 확인하세요." |
| servers.json 없음 | 즉시 실패 | "servers.json을 찾을 수 없습니다." |
| servers.json 검증 실패 | 즉시 실패 | "servers.json 형식이 올바르지 않습니다: {상세}" |
| 잘못된 serverId | 검증 실패 | "등록되지 않은 서버 ID입니다." |
| Query timeout | ping -1, OFFLINE | "서버 응답 시간 초과" |
| RCON timeout | 에러 반환 | "RCON 연결 시간 초과" |
| RCON 비밀번호 없음 | 에러 반환 | "RCON not configured for this server." |
| gamedig 잘못된 type | 런타임 에러 | "게임 서버 쿼리 실패: {gamedig 에러}" |

### 10.2 한글 메시지

에러 메시지는 한글로 사용자 친화적으로 제공합니다.

---

## 11. 환경 변수

| 변수 | 필수 | 설명 |
|------|------|------|
| STEAM_API_KEY | O | Steam Web API 키 (https://steamcommunity.com/dev/apikey) |
| STEAM_ID | X | 기본 Steam ID |
| STEAM_MCP_SERVERS_PATH | X | servers.json 경로 (기본: ./servers.json) |
| SERVER_RCON_PASSWORD 등 | X | servers.json의 rcon.passwordEnv에 지정된 변수명 |

### .env.example

```env
# Steam Web API 키 (필수)
STEAM_API_KEY=your_api_key_here

# 기본 Steam ID (선택)
STEAM_ID=your_steam_id_here

# servers.json 경로 (선택)
# STEAM_MCP_SERVERS_PATH=./servers.json

# RCON 비밀번호 (각 서버의 passwordEnv에 지정)
# SERVER_RCON_PASSWORD=your_rcon_password
```

---

## 12. 구현 순서

### 12.1 14단계 순서

1. **servers.json loader** - config/servers.ts, 파일 읽기
2. **schema validation** - Zod로 로드 시점 검증
3. **gamedig query** - query.ts, timeout 래핑
4. **normalize** - normalize.ts, ServerState 변환
5. **cache** - cache.ts, TTL 30초
6. **dedup** - dedup.ts, pendingQueries Map
7. **game_server_query, game_server_players, game_server_rules** - server-tools.ts
8. **server_overview** - 모든 서버 조회
9. **server_health** - evaluateHealth
10. **server_diagnose** - health + analysis
11. **server_compare** - 여러 서버 비교 + recommendation
12. **server_alert** - detectAlert
13. **RCON** - rcon/client.ts, kick, ban, restart, rcon_command
14. **log_recent_events** - Phase 3

### 12.2 의존성

```
1,2 → 3,4,5,6 (병렬 가능)
3,4,5,6 → 7
7 → 8
8 → 9,10,11,12 (병렬 가능)
13 (RCON은 7 이후 독립)
14 (Phase 3)
```

---

## 13. Phase 2 확장

### 13.1 server_trend

- **구조**: `Map<serverId, Array<{ts: number, players: number}>>`
- **최대 샘플**: 20개
- **로직**: `if (history.length > 20) history.shift()`
- **출력**: "Players last 10 minutes: 12 → 18 → 25 → 31, Trend: increasing"

### 13.2 steam_discover_servers

- **기능**: Steam Master Server Query로 자동 서버 목록 검색
- **입력**: gameType (optional), region (optional)
- **출력**: 서버 목록 (IP:port)
- **참고**: Steam Master Server API 또는 별도 라이브러리 필요

---

## 14. 통합 가이드

### 14.1 Cursor MCP 설정

**npx 방식 (권장)** — npm publish 후 사용

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

**로컬 실행**

```json
{
  "mcpServers": {
    "steam-game-server": {
      "command": "node",
      "args": ["path/to/steam_mcp/dist/index.js"],
      "env": { "STEAM_API_KEY": "your_key", "STEAM_ID": "your_steam_id" }
    }
  }
}
```

### 14.2 설치 및 실행

```bash
npm install
cp .env.example .env
# .env 편집: STEAM_API_KEY, RCON 비밀번호 등
# servers.json 생성 및 편집
npm run build
npm start
```

### 14.3 README 권장 내용

- 설치 3~4단계로 완료
- servers.json 예시
- 각 도구별 설명 간략
- 문제 해결 (API 키, RCON 연결 등)

---

## 15. Inventory & Discovery (Phase 2)

게임 서버 MCP의 `Inventory` 계층은 **서버 목록의 진실 소스(single source of truth)** 를 책임지며, `Monitoring`/`Operations` 계층이 의존하는 서버 메타데이터를 일관되게 제공·관리한다.  
본 섹션은 `add_server`, `remove_server`, `list_servers` 와 향후 `auto_discover_servers`(Phase 2)를 포함한 설계·명세를 정의한다.

---

### 15.1 기능 범위 정의 (Scope)

#### 15.1.1 `add_server`

- **기능 요약**
  - `servers.json`에 새로운 서버 엔트리를 추가한다.
  - ID 중복, 필수 필드 누락, 지원하지 않는 `gamedig` type 등은 모두 **사전에 검증**하고, 실패 시 사용자 친화적인 에러 메시지를 반환한다.
- **주요 동작**
  - `loadServersConfig()` 호출로 현재 설정 로드
  - ID 중복 검사 (이미 존재하는 `serverId` 방지)
  - 입력 + 기본값을 합성해 `ServerSchema`로 검증
  - 전체 `ServersConfigSchema`로 재검증 후 **원자적 파일 쓰기(temporary + rename)**
  - 성공 시: 추가된 서버 정보(또는 전체 목록 요약)를 반환

#### 15.1.2 `remove_server`

- **기능 요약**
  - `servers.json`에서 특정 `serverId`에 해당하는 서버를 제거한다.
- **주요 동작**
  - `loadServersConfig()` 호출
  - `serverId` 존재 여부 확인
  - 존재하지 않을 경우 명시적인 에러 반환(예: `"등록되지 않은 서버 ID입니다."`)
  - 존재할 경우 해당 엔트리 제거 후 `ServersConfigSchema` 재검증
  - 원자적 파일 쓰기 후 성공 응답

#### 15.1.3 `list_servers`

- **기능 요약**
  - 현재 `servers.json`에 등록된 모든 서버 목록을 반환한다.
  - **기본 버전에서는 필터/페이징 없이 전체 반환**, 향후 확장을 고려한 inputSchema 설계.
- **주요 동작**
  - `loadServersConfig()` 호출
  - (Phase 1) 필터 없이 전체 서버 목록을 반환
  - (Phase 2 이후) 필터링/페이징 옵션 추가 가능

#### 15.1.4 `auto_discover_servers` (Phase 2)

- **기능 요약**
  - 네트워크 스캔, Steam API, 사전 정의된 seed 설정 등을 사용해 **잠재적인 게임 서버 후보를 자동 탐색**하고, 이를 `servers.json`에 합치는 고급 기능.
- **Phase 2 방향성**
  - 읽기 전용 모드 + "제안 목록" 모드:
    - 1단계: 현재 `servers.json` + 외부 소스에서 발견한 서버 후보를 머지한 **제안(preview)** 목록을 생성
    - 2단계: 사용자가 선택/확정한 서버만 실제 `add_server` 경로를 통해 반영
  - 향후 확장:
    - 특정 IP 대역/포트 범위 스캔
    - Steam 서버 브라우저 API 기반 검색
    - 이미 등록된 서버와의 중복/충돌 감지

---

### 15.2 저장소 & 로더 설계

#### 15.2.1 저장소 구조

- **루트 구성**
  - `servers.json` (프로젝트 루트)
  - `src/config/servers.ts`
- **불변 조건**
  - `servers.json`은 **Inventory의 단일 진실 소스**
  - `src/config/servers.ts`는 `servers.json`을 읽고, Zod 스키마(`ServersConfigSchema`)를 통해 **타입 세이프한 런타임 구성 객체**로 변환하는 역할만 수행한다.

#### 15.2.2 로딩 흐름 (loadServersConfig)

1. **파일 읽기**
   - `servers.json` 파일을 UTF-8 텍스트로 읽는다.
2. **JSON 파싱**
   - `JSON.parse` 실행
   - 파싱 실패 시: "`servers.json` 파싱 실패"류의 사용자용 에러 메시지 반환
3. **Zod 검증**
   - `ServersConfigSchema.parse(raw)` 호출
   - 실패 시:
     - 명세에 정의된 `"servers.json 형식이 올바르지 않습니다: {상세}"` 패턴으로 에러 메시지 생성
4. **정상 반환**
   - 타입이 보장된 `ServersConfig` 객체를 상위 계층에 반환

#### 15.2.3 수정 & 저장 흐름 (add/remove 공통)

- 공통 패턴:  
  `loadServersConfig()` → 메모리 상에서 수정 → `ServersConfigSchema` 재검증 → **원자적 파일 쓰기**

**단계별 상세**

1. `loadServersConfig()`로 현재 설정 로드
2. 메모리 상에서 `servers` 배열을 복사/수정
   - `add_server`: 새 서버 엔트리 push
   - `remove_server`: `filter` 또는 `splice`로 제거
3. 새 `config` 객체를 `ServersConfigSchema`로 검증
4. **파일 쓰기 전략 (Atomic Write)**
   - `servers.tmp.json`에 먼저 전체 내용을 `JSON.stringify(config, null, 2)`로 기록
   - 파일 flush/sync 후, OS의 `rename`(또는 이에 준하는 동작)으로 `servers.json`에 덮어쓰기
   - 이 과정에서 장애 발생 시:
     - 가능한 한 기존 `servers.json`은 그대로 유지
     - `servers.tmp.json` 잔여물은 추후 진단용으로 남거나, 재시도 시 클린업

> 설계 메모 (English):  
> Using a temp-then-rename pattern ensures that `servers.json` is never left in a partially written state, which is critical because all monitoring/operations tools depend on a consistent inventory.

---

### 15.3 Zod 스키마 설계 (inputSchema & 재사용)

#### 15.3.1 공통 스키마 재사용

- **전제**
  - `ServerSchema` (단일 서버 엔트리)
  - `ServersConfigSchema` (`{ servers: ServerSchema[] }` 구조 등)
- **원칙**
  - Inventory 도구(`add_server`, `remove_server`, `list_servers`, `auto_discover_servers`)는 **가능한 한 `ServerSchema`/`ServersConfigSchema`를 직접 재사용**하고, 별도의 파편화된 타입을 만들지 않는다.
  - Zod 레벨에서:
    - `ServerSchema`는 "완전한 서버 엔트리" 정의
    - 각 MCP 도구의 `inputSchema`는 `ServerSchema`를 부분 참조하거나, `pick`, `partial`, `extend` 등을 활용해 요구되는 입력을 정의

#### 15.3.2 `add_server` inputSchema

- **기본 형태** (현재 §4 ServerSchema와 호환)

```ts
// Pseudo-Zod spec (설계용)
const addServerInputSchema = z.object({
  adminToken: z.string().min(1), // 권한 제어용 (아래 15.4 참조)

  id: z.string().min(1),               // 필수, 고유 ID
  name: z.string().min(1),             // 필수, 표시용 이름
  type: z.string().min(1),             // 필수, gamedig type (rust, minecraft, counterstrike2 등)
  host: z.string().min(1),             // 필수, IP 또는 hostname
  port: z.number().int().min(1).max(65535), // 필수

  // 선택 필드 (ServerSchema optional)
  query: z.object({ enabled: z.boolean().optional() }).optional(),
  rcon: z.object({
    enabled: z.boolean().optional(),
    port: z.number().int().min(1).max(65535).optional(),
    passwordEnv: z.string().optional(),
  }).optional(),
  logPath: z.string().optional(),
}).strict();
```

- **필수 vs 옵션 & 기본값 처리**
  - `id`, `name`, `type`, `host`, `port`는 **필수**
  - 나머지 필드는 optional. `query.enabled` 기본 true, `rcon.enabled` 기본 false는 내부에서 채움.
- **ID 중복 처리 방식**
  - `loadServersConfig()` 후:
    - `config.servers.some(server => server.id === input.id)`이면:
      - Zod 검증 이전에 **명시적인 비즈니스 에러**로 처리
      - 에러 메시지 예: `"이미 사용 중인 서버 ID입니다: {id}"`
  - Zod 스키마에서 중복 검사는 하지 않고, **도메인 로직에서 처리**

#### 15.3.3 `remove_server` inputSchema

- **단일 키 기반 설계**

```ts
const removeServerInputSchema = z.object({
  adminToken: z.string().min(1), // 권한 제어

  serverId: z.string().min(1),   // 제거 대상 ID
}).strict();
```

- **특징**
  - 필요한 정보는 `serverId` 하나뿐이므로 스키마를 단순하게 유지
  - 존재하지 않는 `serverId`에 대한 에러는 **비즈니스 로직에서 처리** (15.5 참조)

#### 15.3.4 `list_servers` inputSchema

- **현재 버전 (Phase 1)**

```ts
const listServersInputSchema = z.object({}).strict();
```

- **향후 확장 메모**
  - 필터/페이징을 추가할 여지를 남기기 위해, 문서상 "예약된 확장 포인트"로 언급
  - 현재 명세에서는 **입력 없이 전체 목록 반환**을 기본으로 함

#### 15.3.5 `auto_discover_servers` inputSchema (Phase 2 설계 관점)

- **Phase 2에서 목표**
  - 스캔 대상 범위/소스를 제어 가능한 입력으로 받고, 결과를 **제안 목록** 형태로 반환
- **예시 설계**

```ts
const autoDiscoverServersInputSchema = z.object({
  adminToken: z.string().min(1), // 강력한 권한 제어 필수

  strategy: z.enum(["local_scan", "steam_query", "mixed"]).default("mixed"),
  ipRanges: z.array(z.string()).optional(),     // 예: ["192.168.0.0/24"]
  ports: z.array(z.number().int().positive()).optional(), // 예: [27015, 2456]
  appIds: z.array(z.number().int().positive()).optional(), // Steam API 기반

  dryRun: z.boolean().default(true), // true면 servers.json 미변경, 제안만 반환
}).strict();
```

- **동작 원칙**
  - `dryRun: true`인 경우: `servers.json`은 변경하지 않고, 후보 서버 목록 + 중복/충돌 정보를 반환
  - `dryRun: false` + 향후 정책: 사용자가 명시적으로 승인한 서버에 한해 `add_server` 로직 호출

---

### 15.4 권한 / 보안 (Authorization & Security)

#### 15.4.1 adminToken 기반 최소 권한 제어

- **환경 변수**
  - `STEAM_MCP_ADMIN_TOKEN` (서버 프로세스 환경 변수)
- **동작 방식**
  - Inventory에 **쓰기(write)** 를 수행하는 모든 도구는 `adminToken` 입력 필드를 요구
  - 도구 핸들러에서:
    - `process.env.STEAM_MCP_ADMIN_TOKEN`이 설정되어 있지 않으면:
      - `"STEAM_MCP_ADMIN_TOKEN 환경 변수를 확인하세요."` 에러 반환
    - 입력으로 받은 `adminToken`과 환경 변수 값을 비교
      - 일치하지 않으면: `"유효하지 않은 adminToken 입니다."` 인증 실패 에러 반환
- **보안 원칙**
  - adminToken은 로그나 에러 메시지에 **절대 노출 금지**
  - 인증 실패 시에도 내부 값/길이/패턴 등은 유추 불가능한 일반 메시지만 제공

#### 15.4.2 도구별 adminToken 필요 여부

| 도구 | adminToken |
|------|------------|
| `add_server` | 필수 |
| `remove_server` | 필수 |
| `auto_discover_servers` (Phase 2) | 필수 |
| `list_servers` | 불필요 (읽기 전용) |

- `list_servers`는 기본적으로 인증 없이 호출 가능. 향후 private 환경에서 `adminToken` 필수화 가능.

---

### 15.5 에러 모델 (Error Model)

#### 15.5.1 공통: servers.json 파싱/검증 실패

- **파싱 실패 (JSON 구문 오류 등)**
  - 메시지: `"servers.json을 파싱하는 데 실패했습니다. 파일 형식을 확인하세요."`
- **Zod 검증 실패 (`ServersConfigSchema`)**
  - 메시지: `"servers.json 형식이 올바르지 않습니다: {상세}"`

#### 15.5.2 `add_server` 전용 에러

| 상황 | 메시지 |
|------|--------|
| ID 중복 | `"이미 사용 중인 서버 ID입니다: {id}"` |
| gamedig type 미지원 | `"지원하지 않는 서버 type입니다: {type}"` |
| 필수 필드 누락/타입 오류 | `"입력 값이 올바르지 않습니다: {상세}"` |

#### 15.5.3 `remove_server` 전용 에러

| 상황 | 메시지 |
|------|--------|
| 존재하지 않는 serverId | `"등록되지 않은 서버 ID입니다."` 또는 `"등록되지 않은 서버 ID입니다: {serverId}"` |

#### 15.5.4 파일 쓰기/원자적 저장 관련 에러

| 상황 | 메시지 |
|------|--------|
| temp 파일 쓰기 실패 | `"servers.json을 임시 파일에 저장하는 데 실패했습니다. 디스크 공간과 권한을 확인하세요."` |
| rename 실패 | `"servers.json 업데이트에 실패했습니다. 파일 시스템 권한 또는 잠금 상태를 확인하세요."` |

- 공통 원칙: 내부 스택 트레이스/경로는 로그로만 남기고, 사용자에게는 한 줄짜리 메시지만 전달

---

### 15.6 레이어 관점 요약 (Monitoring / Inventory / Operations)

#### 15.6.1 3계층 구조

| 레이어 | 책임 | 도구 예 |
|--------|------|---------|
| **Inventory** | 서버 메타데이터 정의·추가·삭제·목록 조회 | `add_server`, `remove_server`, `list_servers`, (Phase 2) `auto_discover_servers` |
| **Monitoring** | 상태 조회, 성능 지표, 헬스 체크 | `game_server_query`, `server_overview`, `server_health`, `server_diagnose`, `server_compare`, `server_alert` |
| **Operations** | RCON 등 서버 운영 명령 | `server_admin_kick_player`, `server_admin_ban_player`, `server_admin_restart_server`, `server_admin_rcon_command` |

#### 15.6.2 계층 간 관계

- **단방향 의존성**
  - Inventory → (없음)
  - Monitoring → Inventory (read-only)
  - Operations → Inventory (read-only)
- **장점**
  - 서버 추가/삭제/수정은 Inventory에만 집중
  - Monitoring/Operations는 Inventory가 제공하는 안정된 스키마에 의존

---

### 15.7 README / INSTRUCTIONS용 소개 블록 (예시)

다음 블록은 `README` 또는 `INSTRUCTIONS`에 그대로 포함할 수 있는 사용자용 설명 예시이다.

```md
## 🎛 Inventory 계층 (servers.json 관리)

Inventory 계층은 게임 서버 MCP의 **서버 목록(servers.json)** 을 관리하는 레이어입니다.  
여기서 정의된 서버 정보는 Monitoring / Operations 모든 도구의 기반이 됩니다.

### 제공 도구

- `add_server` 🆕  
  - 새로운 게임 서버를 `servers.json`에 추가합니다.
  - `id`, `name`, `type`, `host`, `port` 등 필수 정보를 받고, 나머지는 기본값/옵션으로 처리합니다.
  - **adminToken 필요:** `STEAM_MCP_ADMIN_TOKEN` 환경 변수와 일치해야 합니다.

- `remove_server` 🗑  
  - 지정한 `serverId`에 해당하는 서버를 `servers.json`에서 삭제합니다.
  - **adminToken 필요**

- `list_servers` 📄  
  - 현재 등록된 모든 서버 목록을 조회합니다.
  - 기본적으로는 인증 없이 사용 가능한 읽기 전용 도구입니다.

- `auto_discover_servers` 🔍 (Phase 2 예정)  
  - 네트워크 스캔, Steam API 등을 사용해 잠재적인 게임 서버를 자동으로 찾아줍니다.
  - 기본적으로는 `dry-run` 모드로 동작합니다.
  - **adminToken 필요**

### 동작 방식

- 모든 변경 작업은 다음 패턴을 따릅니다.
  1. `servers.json` 로드 및 Zod 스키마 검증
  2. 메모리에서 서버 목록 수정 (추가/삭제)
  3. 전체 구성을 다시 Zod로 검증
  4. 임시 파일(`servers.tmp.json`)에 저장 후, 원자적 rename으로 `servers.json` 교체

### 권한 / 보안

- 쓰기 작업(`add_server`, `remove_server`, `auto_discover_servers`)은 모두 `adminToken`이 필요합니다.
- `adminToken`은 환경 변수 `STEAM_MCP_ADMIN_TOKEN`과 값이 일치해야 합니다.
- 읽기 전용 `list_servers`는 기본적으로 인증 없이 사용할 수 있습니다.
```

---

## 참고 문서

- [Steam Web API](https://steamwebapi.azurewebsites.net/)
- [Steam API 키](https://steamcommunity.com/dev/apikey)
- [gamedig 문서](https://github.com/gamedig/node-gamedig)
- [gamedig GAMES_LIST](https://github.com/gamedig/node-gamedig/blob/master/GAMES_LIST.md)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)

---

*문서 버전: 2.1 | 최종 수정: 2026-03 | §15 Inventory & Discovery 추가*
