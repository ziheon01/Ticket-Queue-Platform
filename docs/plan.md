# Plan: 공연 관리 기능 구현

작성일: 2026-06-10
상태: 승인 대기

---

## Scope

### 신규 생성 파일

```
src/
├── utils/
│   └── redis.ts                      # ioredis 싱글톤
├── dtos/
│   └── concert.dto.ts                # Zod v4: concert/zone 생성·수정 스키마
├── repositories/
│   ├── concert.repository.ts
│   └── concertZone.repository.ts
├── services/
│   └── concert.service.ts            # 비즈니스 로직 (어드민 + 유저 + Cron)
├── controllers/
│   ├── adminConcert.controller.ts    # 어드민 공연/구역 CRUD + 판매 현황
│   └── concert.controller.ts        # 유저 공연 목록/상세
├── routes/
│   ├── admin.routes.ts               # /api/admin/* — requireAdmin 미들웨어 적용
│   └── concert.routes.ts             # /api/concerts/*
└── queues/
    ├── concertStatus.queue.ts        # BullMQ 큐 정의 + 1분 반복 job 등록
    └── workers/
        └── concertStatus.worker.ts  # saleStartAt 체크 → ON_SALE 전환 워커

tests/
└── integration/
    └── concert.test.ts               # Supertest 통합 테스트
```

### 수정 파일

- `src/index.ts` — admin.routes, concert.routes 등록 + concertStatus 워커 시작

---

## Acceptance Criteria

| # | 시나리오 | 기대 결과 |
|---|---------|---------|
| 1 | POST /api/admin/concerts — ADMIN 정상 입력 | 201, `{ id, title, artist, venue, concertDate, saleStartAt, status }` |
| 2 | POST /api/admin/concerts — USER role 접근 | 403 Forbidden |
| 3 | POST /api/admin/concerts — 유효하지 않은 입력 (필수 필드 누락 등) | 400 Bad Request |
| 4 | PATCH /api/admin/concerts/:id — 정상 수정 | 200, 수정된 공연 정보 |
| 5 | PATCH /api/admin/concerts/:id — 존재하지 않는 공연 | 404 Not Found |
| 6 | DELETE /api/admin/concerts/:id — 정상 삭제 | 200 |
| 7 | DELETE /api/admin/concerts/:id — 존재하지 않는 공연 | 404 Not Found |
| 8 | POST /api/admin/concerts/:id/zones — 정상 등록 | 201, zone 정보 + Redis `zone:{id}:stock` 초기화 확인 |
| 9 | PATCH /api/admin/zones/:id — 정상 수정 | 200, 수정된 구역 정보 |
| 10 | DELETE /api/admin/zones/:id — 정상 삭제 | 200 |
| 11 | GET /api/admin/concerts/:id/stats — 판매 현황 조회 | 200, `{ zones: [{ id, name, totalQuantity, remainQuantity, reservationCount }] }` |
| 12 | GET /api/concerts — 공연 목록 조회 (status 쿼리 파라미터 선택) | 200, concerts 배열 |
| 13 | GET /api/concerts/:id — 공연 상세 조회 | 200, `{ concert, zones[] }` |
| 14 | GET /api/concerts/:id — 존재하지 않는 공연 | 404 Not Found |
| 15 | Cron 워커 실행 | `saleStartAt <= now AND status = SCHEDULED` 인 공연 → `ON_SALE`로 일괄 업데이트 |

---

## Dependencies

- `requireAuth`, `requireAdmin` 미들웨어 — **완료** (auth 기능에서 구현)
- Prisma 스키마 `Concert`, `ConcertZone` 모델 — **완료**
- `zone:{concertZoneId}:stock` Redis 키 — ConcertZone 등록 시 `SET zone:{id}:stock {totalQuantity}` 초기화
- Redis client (`ioredis`) — 신규 싱글톤 생성 필요
- BullMQ — 이미 설치됨, concertStatus 반복 큐 신규 생성 필요

---

## 설계 결정

### 구역 등록 시 Redis stock 초기화
- `POST /api/admin/concerts/:id/zones` 성공 시 `zone:{id}:stock` 키를 `totalQuantity` 값으로 SET
- 구역 수정(`PATCH /api/admin/zones/:id`)에서 `totalQuantity` 변경 시 Redis stock도 동기화
- 구역 삭제 시 Redis 키도 함께 DEL

### Concert status Cron
- BullMQ repeatable job, 60초 간격으로 실행
- 워커에서 Prisma로 `saleStartAt <= now AND status = SCHEDULED` 조건 일괄 업데이트
- `index.ts` 에서 앱 시작 시 워커 등록

### 판매 현황 (stats)
- `reservationCount`: 해당 구역의 `status = CONFIRMED | PENDING` 예매 건수
- `remainQuantity`: DB 값 (Redis는 실시간 재고용, stats는 DB 기준)

### 공연 목록 필터
- `GET /api/concerts?status=ON_SALE` 형태로 선택적 필터 지원
- status 미입력 시 전체 반환

---

## Unknowns

없음.

---

## Stop Conditions

1. Redis 연결 실패 시 (ioredis 초기화 오류)
2. BullMQ 워커 등록 실패 시
3. 동일한 테스트 실패를 2회 수정 후에도 해결 못 할 때

---

## 구현 순서 (TDD)

1. `src/utils/redis.ts` — ioredis 싱글톤
2. `src/dtos/concert.dto.ts` — Zod 스키마
3. **테스트 파일 먼저 작성** (`tests/integration/concert.test.ts`) → 실패 확인
4. `src/repositories/concert.repository.ts` + `concertZone.repository.ts`
5. `src/services/concert.service.ts`
6. `src/controllers/adminConcert.controller.ts` + `concert.controller.ts`
7. `src/routes/admin.routes.ts` + `concert.routes.ts`
8. `src/queues/concertStatus.queue.ts` + `workers/concertStatus.worker.ts`
9. `src/index.ts` — 라우트 등록 + 워커 시작
10. 테스트 통과 확인 → typecheck 통과 확인
