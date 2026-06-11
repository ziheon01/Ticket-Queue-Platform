# Plan: 티켓 선점 및 결제 시스템 구현

작성일: 2026-06-11
상태: 승인 대기

---

## Scope

### 신규 생성 파일

```
src/
├── dtos/
│   └── reservation.dto.ts              # Zod: 예매 생성·취소·연장 스키마 + 응답 타입
├── repositories/
│   └── reservation.repository.ts       # DB CRUD (Reservation, Payment) + Redis 재고/선점 CRUD
├── services/
│   └── reservation.service.ts          # 비즈니스 로직 (선점/결제확정/취소/연장/만료)
├── controllers/
│   ├── reservation.controller.ts       # REST 핸들러 (create/list/detail/cancel/extend)
│   └── payment.controller.ts           # Webhook 핸들러 (토스페이먼츠 결과 수신)
├── routes/
│   ├── reservation.routes.ts           # /api/reservations/*
│   └── payment.routes.ts              # /api/payments/*
└── queues/
    └── workers/
        └── reservation.worker.ts       # 선점 만료 타이머 워커 (BullMQ delayed job)

tests/integration/
└── reservation.test.ts                 # REST 통합 테스트
```

### 수정 파일

- `src/index.ts` — reservation·payment 라우트 등록, reservation worker 시작

---

## Acceptance Criteria

| # | 시나리오 | 기대 결과 |
|---|---------|---------|
| 1 | POST /api/reservations — 입장된 유저, 유효한 구역/수량 | 201, `{ reservationId, totalPrice, remainSeconds: 300 }` |
| 2 | POST /api/reservations — 미입장 유저 (admitted 키 없음) | 403 Forbidden |
| 3 | POST /api/reservations — 수량 범위 초과 (0 또는 5 이상) | 400 Bad Request |
| 4 | POST /api/reservations — 재고 부족 (stock < quantity) | 409 Conflict |
| 5 | POST /api/reservations — 이미 선점 중인 유저 (lock 키 존재) | 409 Conflict |
| 6 | GET /api/reservations — 내 예매 목록 조회 | 200, 예매 배열 |
| 7 | GET /api/reservations/:id — 본인 예매 상세 | 200, 예매 상세 (공연·구역·결제 포함) |
| 8 | GET /api/reservations/:id — 타인 예매 조회 | 403 Forbidden |
| 9 | DELETE /api/reservations/:id — PENDING 예매 취소 | 200, 선점 해제 + 재고 복구 |
| 10 | DELETE /api/reservations/:id — CONFIRMED 예매 취소 시도 | 400 Bad Request |
| 11 | POST /api/reservations/:id/extend — TTL 60초 이하 & 연장 이력 없음 | 200, `{ remainSeconds: 300 }` |
| 12 | POST /api/reservations/:id/extend — 이미 연장한 경우 (extendedAt 존재) | 409 Conflict |
| 13 | POST /api/reservations/:id/extend — TTL 60초 초과 (아직 여유 있음) | 400 Bad Request |
| 14 | POST /api/payments/webhook — status: DONE | 200, Reservation CONFIRMED + Payment DONE + Redis lock 해제 |
| 15 | BullMQ 만료 워커 — PENDING 예매 5분 경과 | Reservation EXPIRED + 재고 복구 + 다음 대기자 입장 처리 |

---

## Dependencies

- `requireAuth` 미들웨어 — **완료**
- Redis client (`src/utils/redis.ts`) — **완료**
- `ConcertZone` 모델 (price, remainQuantity) — **완료**
- Queue service (다음 대기자 입장 처리 연동) — **완료** (`src/services/queue.service.ts`)
- BullMQ — **완료** (설치됨)
- Socket.io (`src/utils/socket.ts`) — **완료**

---

## 설계 결정

### Redis 원자적 선점 (Lua 스크립트)

SPEC: `SET NX + DECRBY` 조합으로 원자적 처리.

실제 구현은 두 연산이 분리되면 Race Condition 발생 가능 → **Lua 스크립트**로 원자화:

```lua
-- 인자: KEYS[1]=stock키, KEYS[2]=lock키, ARGV[1]=quantity, ARGV[2]=ttl(초), ARGV[3]=reservationId
local stock = tonumber(redis.call('GET', KEYS[1]))
if stock == nil or stock < tonumber(ARGV[1]) then
  return -1  -- 재고 부족
end
if redis.call('EXISTS', KEYS[2]) == 1 then
  return -2  -- 이미 선점 중
end
redis.call('DECRBY', KEYS[1], ARGV[1])
redis.call('SET', KEYS[2], ARGV[3], 'EX', ARGV[2])
return 1  -- 선점 성공
```

반환값: `1`=성공, `-1`=재고부족(409), `-2`=이미선점(409)

### 결제 타이머 (BullMQ delayed job)

- 큐명: `reservation-expiry`
- 예매 생성 시: `{ reservationId, concertZoneId, userId, concertId }` 페이로드 + 5분 delay
- 연장 시: 기존 job ID(`expiry:${reservationId}`)로 job 제거 → 새 delayed job 등록 (5분 delay)
- 워커 처리:
  1. DB에서 reservation 조회 → status가 PENDING이 아니면 skip
  2. Reservation status → EXPIRED, Payment status → FAILED
  3. Redis stock INCRBY quantity 복구
  4. Redis lock 삭제
  5. Queue service의 다음 대기자 입장 처리 호출
  6. Socket.io `queue:expired` 이벤트 전송 (해당 유저)

Keyspace Notification 불필요 — BullMQ delayed job이 TTL 역할 대체.

### Redis lock 키와 BullMQ job의 TTL 동기화

- 선점 생성: Redis lock TTL=300초, BullMQ delay=300,000ms (일치)
- 연장: Redis EXPIRE 300초 재설정 + BullMQ job 교체 (둘 다 갱신)
- 취소/Webhook 완료: Redis lock DEL + BullMQ job 제거

### 토스페이먼츠 Webhook 처리

테스트 모드 기준:
1. `POST /api/payments/webhook` — Body: `{ paymentKey, orderId, status, amount, ... }`
2. `orderId`를 `reservationId`로 사용 (예매 생성 시 `orderId = reservationId` 세팅)
3. `status === "DONE"`: Payment DONE + Reservation CONFIRMED + Redis lock 해제 + BullMQ job 취소
4. `status === "CANCELLED"` | `"FAILED"`: Payment FAILED/CANCELLED + Reservation CANCELLED + 재고 복구

Webhook 시그니처 검증: 테스트 모드는 생략 (TODO: 운영 시 `토스페이먼츠-Signature` 헤더 검증 필요)

### 재고 초기화 (Redis sync)

공연 관리에서 이미 `zone:{zoneId}:stock`을 초기화하는 로직이 있는지 확인 필요.
없으면 예매 생성 시 stock 키 첫 접근 전 `SETNX zone:{zoneId}:stock {remainQuantity}` 로 초기화.

### Redis 키 (SPEC.md 6번)

```
구역 재고:    zone:{concertZoneId}:stock       String (숫자), DB remainQuantity와 이중 관리
선점 락:      zone:{concertZoneId}:lock:{userId}  String (reservationId), TTL 5분
```

### BullMQ 큐명

- `reservation-expiry` — delayed job (5분), 선점 만료 처리

### 예매 취소 처리

- PENDING 상태만 취소 가능 (CONFIRMED는 거부)
- Redis lock DEL + stock INCRBY 복구
- Reservation status → CANCELLED, Payment status → CANCELLED
- BullMQ job 제거

---

## Unknowns

- 토스페이먼츠 SDK(`@tosspayments/payment-sdk`) API 인터페이스 — 설치된 버전 기준으로 확인 후 진행
- 공연 관리 워커에서 zone stock 초기화 여부 — `src/services/concert.service.ts` 확인 필요

---

## Stop Conditions

1. Lua 스크립트 원자성 검증 실패를 2회 수정 후에도 해결 못 할 때
2. 토스페이먼츠 Webhook 연동 구조가 SDK와 맞지 않아 설계 변경 필요할 때
3. 동일한 테스트 실패를 2회 수정 후에도 해결 못 할 때

---

## 구현 순서 (TDD)

1. 기존 코드 조사: concert service의 stock 초기화 여부, socket util 인터페이스 확인
2. `src/dtos/reservation.dto.ts` — Zod 스키마 + 응답 타입
3. `src/repositories/reservation.repository.ts` — DB CRUD + Redis Lua 선점/해제
4. **테스트 파일 먼저 작성** (`tests/integration/reservation.test.ts`) → 실패 확인
5. `src/services/reservation.service.ts` — 비즈니스 로직
6. `src/controllers/reservation.controller.ts` + `src/controllers/payment.controller.ts`
7. `src/routes/reservation.routes.ts` + `src/routes/payment.routes.ts`
8. `src/queues/workers/reservation.worker.ts` — BullMQ delayed job 워커
9. `src/index.ts` — 라우트 등록, 워커 시작
10. 테스트 통과 확인 → typecheck 통과 확인
