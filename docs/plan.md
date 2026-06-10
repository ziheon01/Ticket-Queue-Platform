# Plan: 대기열 시스템 구현

작성일: 2026-06-10
상태: 승인 대기

---

## Scope

### 신규 생성 파일

```
src/
├── dtos/
│   └── queue.dto.ts                    # Zod: 대기열 진입·상태 스키마
├── repositories/
│   └── queue.repository.ts             # Redis 대기열 CRUD (ZADD/ZREM/ZRANK 등)
├── services/
│   └── queue.service.ts                # 비즈니스 로직 (진입/이탈/입장 처리)
├── controllers/
│   └── queue.controller.ts             # REST 핸들러 (enter/leave/status)
├── routes/
│   └── queue.routes.ts                 # /api/queue/*
├── socket/
│   └── queue.socket.ts                 # Socket.io 이벤트 핸들러
└── queues/
    └── workers/
        └── queue.worker.ts             # 30초 이탈 타이머 + 입장 처리 워커

tests/integration/
└── queue.test.ts                       # REST + Socket.io 통합 테스트
```

### 수정 파일

- `src/index.ts` — Socket.io 서버 초기화, queue.routes 등록, socket 핸들러 등록, queue worker 시작

---

## Acceptance Criteria

| # | 시나리오 | 기대 결과 |
|---|---------|---------|
| 1 | POST /api/queue/:concertId/enter — 인증된 유저, ON_SALE 공연 | 200, `{ position, total }` |
| 2 | POST /api/queue/:concertId/enter — 이미 대기 중인 유저 | 409 Conflict |
| 3 | POST /api/queue/:concertId/enter — ON_SALE이 아닌 공연 | 400 Bad Request |
| 4 | POST /api/queue/:concertId/enter — 미인증 | 401 Unauthorized |
| 5 | DELETE /api/queue/:concertId/leave — 정상 이탈 | 200 |
| 6 | DELETE /api/queue/:concertId/leave — 대기 중이 아닌 유저 | 404 Not Found |
| 7 | GET /api/queue/:concertId/status — 대기 중인 유저 | 200, `{ position, total, status: 'WAITING' }` |
| 8 | GET /api/queue/:concertId/status — 입장 완료된 유저 | 200, `{ status: 'ADMITTED' }` |
| 9 | GET /api/queue/:concertId/status — 대기 중 아님 | 200, `{ status: 'NOT_IN_QUEUE' }` |
| 10 | Socket queue:enter → 입장 시 queue:position 브로드캐스트 | 해당 공연 전체 대기자에게 순번 업데이트 |
| 11 | Socket queue:leave → 이탈 시 queue:position 브로드캐스트 | 남은 대기자 순번 업데이트 |
| 12 | Socket disconnect → 30초 후 자동 이탈 | 대기열 제거 + 순번 업데이트 브로드캐스트 |
| 13 | Socket disconnect → 30초 내 queue:reconnect | 기존 순번 복원, queue:position 응답 |
| 14 | 대기열 1위 유저 입장 처리 (BullMQ 주기 체크) | queue:admitted 이벤트 수신, Redis admitted 키 생성 (TTL 5분) |

---

## Dependencies

- `requireAuth` 미들웨어 — **완료**
- Redis client (`src/utils/redis.ts`) — **완료**
- `Concert` 모델 + status 확인 — **완료**
- BullMQ — **완료** (설치됨)
- Socket.io — **설치됨** (index.ts에 초기화 필요)

---

## 설계 결정

### 입장(Admission) 처리 단위 — SPEC.md 미결 사항 해소

- **1명씩 입장**으로 결정
- BullMQ repeatable job (5초 간격): `queue:{concertId}:waiting` 상단 1명을 admitted 키 없을 때 입장 처리
- 입장 완료 시: waiting Sorted Set에서 제거 → admitted 키 생성 (TTL 5분) → `queue:admitted` 이벤트 전송
- admitted 키 만료 시: 다음 BullMQ 주기 체크에서 자동으로 다음 대기자 입장 (Keyspace Notification 불필요)

### 30초 유예 처리

- WebSocket disconnect 시: reconnect 키 SET (TTL 30초) + BullMQ delayed job 30초 후 등록
- BullMQ delayed job 실행 시: reconnect 키 존재 여부 확인 → 없으면 waiting Sorted Set에서 제거
- 30초 내 `queue:reconnect` 이벤트: reconnect 키 삭제 + 대기열 재진입 없이 기존 순번 그대로 반환

### Socket.io 방(room) 구조

- **공연 대기열 방**: `concert:{concertId}` — 순번 브로드캐스트 (`queue:position`)
- **유저 개별 방**: `socket.id` 기반 — 개인 메시지 (`queue:admitted`, `queue:error`)
- `queue:enter` 이벤트 또는 HTTP enter 성공 후 소켓 연결 시 `concert:{concertId}` 방에 join

### HTTP vs WebSocket 이중 인터페이스

- 대기열 진입: HTTP POST와 Socket `queue:enter` 둘 다 지원 (동일 서비스 로직 공유)
- 대기열 이탈: HTTP DELETE와 Socket `queue:leave` 둘 다 지원
- 상태 조회: HTTP GET만 (폴링 fallback 용)

### Redis 키 (SPEC.md 6번)

```
queue:{concertId}:waiting          → Sorted Set, score = 진입 timestamp
queue:{concertId}:admitted:{userId} → String "1", TTL 5분
queue:{concertId}:reconnect:{userId} → String "1", TTL 30초
```

### BullMQ 큐명

- `queue-admission` — repeatable job (5초), 입장 처리
- `queue-disconnect` — delayed job (30초), 유예 이탈 처리

---

## Unknowns

없음. (SPEC.md 입장 처리 단위 미결 → 1명씩으로 결정)

---

## Stop Conditions

1. Socket.io 서버 초기화 실패
2. BullMQ 워커 등록 실패
3. 동일한 테스트 실패를 2회 수정 후에도 해결 못 할 때

---

## 구현 순서 (TDD)

1. `src/dtos/queue.dto.ts` — Zod 스키마
2. `src/repositories/queue.repository.ts` — Redis CRUD
3. **테스트 파일 먼저 작성** (`tests/integration/queue.test.ts`) → 실패 확인
4. `src/services/queue.service.ts` — 비즈니스 로직
5. `src/controllers/queue.controller.ts` + `src/routes/queue.routes.ts`
6. `src/socket/queue.socket.ts` — Socket.io 핸들러
7. `src/queues/workers/queue.worker.ts` — BullMQ 워커 (admission + disconnect)
8. `src/index.ts` — Socket.io 초기화, 라우트·소켓·워커 등록
9. 테스트 통과 확인 → typecheck 통과 확인
