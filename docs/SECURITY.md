# 보안 관련 문서

> STEAM_GAME_SERVER_MCP 프로젝트의 보안·취약점 현황 및 결정 사항

---

## npm audit 현황

| 날짜 | 취약점 수 | 상세 |
|------|----------|------|
| 2026-03 | 7개 | esbuild 5 moderate, fast-xml-parser 1 critical |

### 의존성별 취약점

| 패키지 | 심각도 | 원인 | 경로 |
|--------|--------|------|------|
| **esbuild** | moderate | 개발 서버 요청 취약점 | vitest → vite → esbuild |
| **fast-xml-parser** | critical | DoS, entity encoding bypass | gamedig |

### 해결 옵션

| 옵션 | 명령 | 영향 |
|------|------|------|
| `npm audit fix` | breaking 없이 수정 시도 | 현재 수정 불가 |
| `npm audit fix --force` | vitest 4.x, gamedig 5.2.0 | **breaking change** |

---

## 결정 사항 (2026-03)

- **현재**: `npm audit fix --force` **미적용**
- **이유**: vitest 4.x, gamedig 5.2.0 업그레이드 시 breaking change 가능성
- **리스크**: 
  - esbuild: 개발 서버(vitest) 사용 시에만 영향, 프로덕션 MCP 서버는 직접 영향 없음
  - fast-xml-parser: gamedig가 XML 파싱 시 사용, 외부 입력에 의존적이지 않음 (게임 서버 응답만 파싱)

### 권장

- 정기적으로 `npm audit` 실행
- vitest 4.x, gamedig 5.2.0+ 호환성 확인 후 `npm audit fix --force` 검토

---

## 환경 변수 보안

- **STEAM_API_KEY**: .env에 저장, Git에 커밋 금지
- **STEAM_MCP_ADMIN_TOKEN**: add_server, remove_server 시 필수
- **RCON 비밀번호**: servers.json의 passwordEnv로 지정, 환경 변수로만 주입
