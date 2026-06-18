# Ticket Queue Platform

> Redis 대기열 기반 콘서트 티켓 선착순 예매 플랫폼

콘서트 티켓팅 환경에서 발생하는 동시성 문제를 Redis 원자적 연산으로 해결하고,  
WebSocket으로 대기 순번을 실시간 제공하는 백엔드 API 서버입니다.

---

## 목차

- [기술 스택](#기술-스택)
- [핵심 설계](#핵심-설계)
- [주요 기능](#주요-기능)
- [API 엔드포인트](#api-엔드포인트)
- [WebSocket 이벤트](#websocket-이벤트)
- [데이터 모델](#데이터-모델)
- [Redis 키 설계](#redis-키-설계)
- [프로젝트 구조](#프로젝트-구조)
- [시작하기](#시작하기)

---

## 기술 스택

| 분류 | 기술 |
|------|------|
| Runtime | Node.js + TypeScript (strict) |
| Framework | Express 5 |
| DB | PostgreSQL 16 + Prisma 7 |
| Cache / 대기열 | Redis 7 (ioredis) |
| Job Queue | BullMQ |
| 실시간 통신 | Socket.io |
| 유효성 검사 | Zod v4 |
| 인증 | JWT (Access Token 15분 + Refresh Token 7일) |
| 결제 | 토스페이먼츠 (테스트 모드) |
| 테스트 | Jest + Supertest |
| 인프라 | Docker Compose |

---

## 핵심 설계

### 1. Redis 대기열 (Sorted Set)

```
진입 → Redis ZADD queue:{concertId}:waiting score=timestamp
순번 → ZRANK (0-based)
입장 → 상위 1명 pop → admitted 키 생성 (TTL 5분)
```

- **공연 단위** 대기열로 입장 후 구역 선택 (실제 티켓팅 방식)
- BullMQ Cron으로 5초마다 상단 대기자 입장 처리
- Socket.io로 전체 대기자에게 개인별 순번 실시간 push (`ZRANGE` 1회 + `Map` 분배)

### 2. Lua 스크립트 원자적 선점

```lua
-- 재고 확인 + 차감 + lock 설정을 단일 원자 연산으로
local stock = tonumber(redis.call('GET', KEYS[1]))
if stock == nil or stock < tonumber(ARGV[1]) then return -1 end  -- 재고 부족
if redis.call('EXISTS', KEYS[2]) == 1 then return -2 end        -- 이미 선점 중
redis.call('DECRBY', KEYS[1], ARGV[1])
redis.call('SET', KEYS[2], ARGV[3], 'EX', ARGV[2])
return 1  -- 선점 성공
```

두 연산을 분리하면 Race Condition 발생 가능 → Lua로 원자화.  
`releaseStock` (INCRBY + DEL) 도 동일하게 Lua 원자화.

### 3. 결제 타이머 (BullMQ delayed job)

```
선점 성공 → BullMQ delayed job 등록 (5분)
              Redis lock TTL = 300초 (동기화)
연장 시   → 기존 job 제거 + 새 job 등록 + Redis EXPIRE 재설정
완료/취소  → job 제거 + Redis lock DEL
만료 시   → DB EXPIRED + 재고 복구 + 다음 대기자 입장 + WebSocket 알림
```

Redis Keyspace Notification 없이 BullMQ delayed job이 TTL 역할 대체.

### 4. DB + Redis 이중 재고 관리

| 시점 | Redis stock | DB remainQuantity |
|------|-------------|-------------------|
| 구역 등록 | SET totalQuantity | = totalQuantity |
| 선점 (PENDING) | DECRBY quantity | 변경 없음 |
| 결제 확정 (CONFIRMED) | 변경 없음 (차감 유지) | DECREMENT quantity |
| 취소 / 만료 | INCRBY quantity | 변경 없음 |
| 구역 수정 (totalQuantity) | INCRBY delta | DB 업데이트 |

- Redis: 실시간 선점 가능 재고
- DB: 결제 완료된 확정 재고 (공연 조회 잔여석 표시)

### 5. 브라우저 종료 유예

```
WebSocket disconnect
→ Redis reconnect 키 생성 (TTL 30초)
→ BullMQ delayed job 30초

30초 내 재접속: reconnect 키 삭제 → 기존 순번 복원
30초 초과: 대기열 제거 + 전체 순번 업데이트
```

---

## 주요 기능

### 인증
- 회원가입 / 로그인 / 로그아웃
- JWT Access Token (15분) + Refresh Token (7일, 로테이션)
- RBAC: `ADMIN` / `USER` role 분리

### 공연 관리 (어드민)
- 공연 등록 / 수정 / 삭제
- 구역(Zone) 등록 / 수정 / 삭제 (구역명, 가격, 수량)
- 공연 상태 자동 전환: `SCHEDULED → ON_SALE → ENDED` (Cron 배치, 매분)
- 판매 현황 조회 (구역별 잔여석, 예매자 수)

### 공연 조회 (유저)
- 목록 조회 (상태 필터: 판매 예정 / 판매 중 / 종료)
- 상세 조회 (구역별 가격, 잔여석)

### 대기열 시스템
- 판매 시작 시간 이후만 진입 가능
- WebSocket 실시간 순번 수신 (`queue:position`)
- 자발적 이탈 / 브라우저 종료 감지 (30초 유예)
- 30초 내 재접속 시 기존 순번 복원
- 순번 도달 시 `queue:admitted` 이벤트

### 티켓 선점 및 결제
- 입장 후 구역 + 수량(1~4장) 선택
- Lua 스크립트 원자적 선점 (Race Condition 방지)
- 결제 타이머 5분 (BullMQ delayed job)
- 타이머 1분 이하 시 1회 한정 5분 연장
- 토스페이먼츠 Webhook 결제 확정
- 타이머 만료 → 선점 해제 + 재고 복구 + 다음 대기자 입장

### 예매 내역
- 목록 / 상세 조회 (공연, 구역, 결제 정보 포함)
- 취소 (PENDING 상태만, 즉시 재고 복구)

---

## API 엔드포인트

### 인증 `/api/auth`

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/register` | 회원가입 |
| POST | `/login` | 로그인 |
| POST | `/logout` | 로그아웃 |
| POST | `/refresh` | Access Token 재발급 |
| GET | `/me` | 내 정보 조회 |

### 공연 어드민 `/api/admin` 🔒 ADMIN

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/concerts` | 공연 등록 |
| PATCH | `/concerts/:id` | 공연 수정 |
| DELETE | `/concerts/:id` | 공연 삭제 |
| POST | `/concerts/:id/zones` | 구역 등록 |
| PATCH | `/zones/:id` | 구역 수정 |
| DELETE | `/zones/:id` | 구역 삭제 |
| GET | `/concerts/:id/stats` | 판매 현황 조회 |

### 공연 조회 `/api/concerts`

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/` | 공연 목록 (`?status=ON_SALE` 필터) |
| GET | `/:id` | 공연 상세 (구역 포함) |

### 대기열 `/api/queue` 🔒 USER

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/:concertId/enter` | 대기열 진입 |
| DELETE | `/:concertId/leave` | 대기열 이탈 |
| GET | `/:concertId/status` | 대기 현황 조회 |

### 예매 `/api/reservations` 🔒 USER

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/` | 예매 생성 (구역 선점) |
| GET | `/` | 내 예매 목록 |
| GET | `/:id` | 예매 상세 |
| DELETE | `/:id` | 예매 취소 |
| POST | `/:id/extend` | 결제 시간 연장 (1회 한정) |

### 결제 Webhook `/api/payments`

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/webhook` | 토스페이먼츠 결제 결과 수신 |

---

## WebSocket 이벤트

### 클라이언트 → 서버

| 이벤트 | 페이로드 | 설명 |
|--------|----------|------|
| `queue:enter` | `{ concertId }` | 대기열 진입 |
| `queue:leave` | `{ concertId }` | 대기열 이탈 |
| `queue:reconnect` | `{ concertId }` | 재연결 (30초 유예 내) |

### 서버 → 클라이언트

| 이벤트 | 페이로드 | 설명 |
|--------|----------|------|
| `queue:position` | `{ position, total }` | 현재 순번 업데이트 |
| `queue:admitted` | — | 입장 처리 완료 |
| `queue:extended` | `{ remainSeconds }` | 결제 시간 연장 완료 |
| `queue:expired` | — | 결제 타이머 만료 |
| `queue:error` | `{ message }` | 에러 알림 |

**인증**: `socket.handshake.auth.token`에 Access Token 전달

---

## 데이터 모델

```
User
├── id, email (unique), password (hashed), nickname
├── role: ADMIN | USER
└── createdAt / updatedAt

RefreshToken
├── userId (FK), token (hashed, unique), expiresAt
└── createdAt

Concert
├── title, artist, venue, concertDate, saleStartAt
├── status: SCHEDULED | ON_SALE | SOLD_OUT | ENDED
└── createdAt / updatedAt

ConcertZone
├── concertId (FK), name, price, totalQuantity
├── remainQuantity  ← DB 최종 확정값 (CONFIRMED 기준)
└── createdAt / updatedAt

Reservation
├── userId (FK), concertZoneId (FK), quantity (1~4), totalPrice
├── status: PENDING | CONFIRMED | CANCELLED | EXPIRED
├── extendedAt (nullable, 연장 1회 제한 체크)
└── createdAt / updatedAt

Payment
├── reservationId (FK, unique), paymentKey (nullable), amount
├── status: READY | DONE | CANCELLED | FAILED
├── paidAt (nullable)
└── createdAt / updatedAt
```

---

## Redis 키 설계

```
대기열
  queue:{concertId}:waiting              Sorted Set  score=timestamp
  queue:{concertId}:admitted:{userId}    String      TTL=5분
  queue:{concertId}:reconnect:{userId}   String      TTL=30초

재고 / 선점
  zone:{concertZoneId}:stock             String (정수)  실시간 가용 재고
  zone:{concertZoneId}:lock:{userId}     String         TTL=5분 (결제 진행 중)
```

---

## 프로젝트 구조

```
src/
├── controllers/      HTTP 요청 핸들러 (입력 검증 + 응답, 비즈니스 로직 없음)
├── services/         비즈니스 로직 + 트랜잭션
├── repositories/     DB 쿼리 (Prisma) + Redis 명령
├── dtos/             Zod 스키마 + 응답 타입 + Mapper
├── middlewares/      인증(requireAuth), 어드민(requireAdmin), 에러 핸들러
├── routes/           Express 라우터
├── socket/           Socket.io 이벤트 핸들러
├── queues/
│   ├── workers/
│   │   ├── concertStatus.worker.ts   공연 상태 Cron (SCHEDULED→ON_SALE)
│   │   ├── queue.worker.ts           대기열 입장 Cron + 연결 해제 job
│   │   └── reservation.worker.ts     선점 만료 BullMQ delayed job
│   └── concertStatus.queue.ts
└── utils/            Prisma 싱글톤, Redis 클라이언트, JWT, bcrypt, 응답 래퍼

tests/
└── integration/      Supertest 통합 테스트 (4 suites, 58 cases)

prisma/
└── schema.prisma
```

---

## 시작하기

### 사전 요구사항

- Node.js 20+
- Docker Desktop

### 환경 변수

```bash
cp .env.example .env
```

```env
DATABASE_URL="postgresql://postgres:password@localhost:5434/ticket_queue"
REDIS_URL="redis://localhost:6380"
JWT_ACCESS_SECRET="your-access-secret"
JWT_REFRESH_SECRET="your-refresh-secret"
TOSS_SECRET_KEY="test_sk_..."   # 토스페이먼츠 테스트 시크릿 키
PORT=3001
```

### 실행

```bash
# 1. 인프라 시작 (PostgreSQL 5434, Redis 6380)
docker compose up -d

# 2. 의존성 설치
npm install

# 3. DB 마이그레이션 + Prisma 클라이언트 생성
npx prisma migrate dev
npx prisma generate

# 4. 개발 서버 시작
npm run dev
```

### 테스트

```bash
# 전체 테스트
npm test

# 단일 파일
npx jest tests/integration/reservation.test.ts

# 타입체크
npm run typecheck
```

> 테스트 실행 전 인프라(`docker compose up -d`)가 반드시 실행 중이어야 합니다.

### 토스페이먼츠 Webhook 로컬 테스트

```bash
# ngrok으로 로컬 서버 터널링
ngrok http 3001

# 토스페이먼츠 대시보드에서 Webhook URL 설정
# https://{ngrok-url}/api/payments/webhook
```

---

## 주요 기술 결정

| 항목 | 결정 | 이유 |
|------|------|------|
| 대기열 단위 | 공연 단위 (입장 후 구역 선택) | 실제 티켓팅 표준 방식 |
| 선점 원자성 | Lua 스크립트 | DECRBY + SET NX 분리 시 Race Condition |
| 결제 타이머 | BullMQ delayed job | Redis Keyspace Notification 설정 불필요 |
| 재고 이중 관리 | Redis (실시간) + DB (확정) | Redis 장애 시 DB 기준 복구 가능 |
| 브라우저 종료 | 30초 유예 TTL | UX 보호, 재접속 시 순번 복원 |
| 최대 구매 수량 | 1인 4장 | 실제 티켓팅 표준 |
| 날짜 기준 | UTC | 타임존 복잡도 제거 |
