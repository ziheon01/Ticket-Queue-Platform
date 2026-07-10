# 🎫 Ticket Queue Platform

> **선착순 콘서트 티켓팅, 실제로 터지는 동시성 문제를 Redis로 해결한다.**
> Redis 원자적 연산 + WebSocket 실시간 대기열 + 토스페이먼츠 결제까지 이어지는 풀스택 티켓팅 플랫폼.

<p>
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-20-339933?logo=node.js&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white">
  <img alt="Express" src="https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white">
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white">
  <img alt="Redis" src="https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white">
  <img alt="Prisma" src="https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&logoColor=white">
  <img alt="Socket.io" src="https://img.shields.io/badge/Socket.io-4-010101?logo=socket.io&logoColor=white">
  <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black">
  <img alt="Vite" src="https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white">
  <img alt="TailwindCSS" src="https://img.shields.io/badge/TailwindCSS-3-06B6D4?logo=tailwindcss&logoColor=white">
  <img alt="Docker" src="https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white">
</p>

콘서트 티켓팅 환경에서 발생하는 동시성 문제(초과 판매, Race Condition)를 **Redis 원자적 연산(Lua Script)**으로 해결하고, **WebSocket**으로 대기 순번을 실시간 제공하며, **토스페이먼츠 Webhook**으로 결제를 확정하는 백엔드 + 프론트엔드 풀스택 프로젝트입니다.

---

## 목차

- [아키텍처 한눈에 보기](#아키텍처-한눈에-보기)
- [기술 스택](#기술-스택)
- [핵심 설계](#핵심-설계)
- [백엔드 주요 기능](#백엔드-주요-기능)
- [프론트엔드](#프론트엔드)
- [API 엔드포인트](#api-엔드포인트)
- [WebSocket 이벤트](#websocket-이벤트)
- [데이터 모델](#데이터-모델)
- [Redis 키 설계](#redis-키-설계)
- [프로젝트 구조](#프로젝트-구조)
- [시작하기](#시작하기)
- [테스트](#테스트)
- [주요 기술 결정](#주요-기술-결정)
- [트러블슈팅](#트러블슈팅)

---

## 아키텍처 한눈에 보기

```mermaid
sequenceDiagram
    participant U as 유저 (React)
    participant WS as Socket.io
    participant Q as Redis 대기열
    participant API as Express API
    participant R as Redis (재고/선점)
    participant BQ as BullMQ
    participant DB as PostgreSQL
    participant Toss as 토스페이먼츠

    U->>WS: queue:enter
    WS->>Q: ZADD queue:{concertId}:waiting
    BQ-->>Q: 5초마다 상위 대기자 admit
    Q-->>WS: queue:position (실시간 순번)
    WS-->>U: queue:admitted (입장 완료)

    U->>API: POST /reservations (구역+수량 선택)
    API->>R: Lua Script: 재고 DECRBY + lock SET NX
    R-->>API: 원자적 선점 성공
    API->>BQ: 5분 결제 타이머 등록
    API->>Toss: 결제창 호출

    Toss-->>API: POST /payments/webhook (DONE)
    API->>DB: Reservation CONFIRMED + Payment DONE
    API->>R: 선점 lock 해제

    Note over BQ,DB: 타이머 만료 시 → EXPIRED 처리 + 재고 복구 + 다음 대기자 입장
```

- **대기열**: Redis Sorted Set(`ZADD`/`ZRANK`)으로 진입 순서 관리, BullMQ Cron이 순차 입장 처리
- **선점**: Lua 스크립트로 재고 확인 + 차감 + lock 설정을 단일 원자 연산으로 처리 (Race Condition 방지)
- **결제 타이머**: BullMQ delayed job으로 TTL 역할 대체, 만료 시 자동 롤백
- **실시간**: Socket.io로 순번/타이머/입장 상태를 개인별로 push

---

## 기술 스택

### Backend

| 분류 | 기술 |
|------|------|
| Runtime | Node.js + TypeScript (strict) |
| Framework | Express 5 |
| DB | PostgreSQL 16 + Prisma 7 (Driver Adapter) |
| Cache / 대기열 | Redis 7 (ioredis) |
| Job Queue | BullMQ |
| 실시간 통신 | Socket.io |
| 유효성 검사 | Zod v4 |
| 인증 | JWT (Access Token 15분 + Refresh Token 7일) |
| 결제 | 토스페이먼츠 (테스트 모드, Webhook 연동) |
| 로깅 | Pino + pino-http |
| 테스트 | Jest + Supertest |
| 인프라 | Docker Compose |

### Frontend

| 분류 | 기술 |
|------|------|
| Framework | React 19 + TypeScript |
| Build | Vite 8 |
| 스타일 | Tailwind CSS v3 (dark mode: class) |
| 라우팅 | React Router v7 |
| UI 컴포넌트 | Radix UI (Dialog, Dropdown Menu) + shadcn 스타일 |
| 아이콘 | lucide-react |
| 실시간 통신 | socket.io-client |
| 결제 | @tosspayments/tosspayments-sdk |
| HTTP | axios (fetch 기반 커스텀 API 클라이언트) |

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
- Socket.io로 전체 대기자에게 개인별 순번 실시간 push (`ZRANGE` 1회 + `Map` 분배로 N+1 제거)

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
토스 측에서 자체적으로 `EXPIRED` Webhook을 보내는 경우도 있어, 어느 쪽이 먼저 도착하든
멱등성 체크(`status !== PENDING → return`)로 중복 처리를 막는다.

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

## 백엔드 주요 기능

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
- 결제 타이머 5분 (BullMQ delayed job), 1분 이하 시 1회 한정 5분 연장
- 토스페이먼츠 Webhook 결제 확정 (`DONE` / `CANCELLED` / `FAILED` / `EXPIRED` 전체 처리)
- 타이머 만료 → 선점 해제 + 재고 복구 + 다음 대기자 입장

### 예매 내역
- 목록 / 상세 조회 (공연, 구역, 결제 정보 포함)
- 취소 (PENDING 상태만, 즉시 재고 복구)

### 고객센터 게시판
- 문의 작성 / 목록 / 상세 조회 / 삭제 (답변 전, 본인만)
- 어드민: 전체 문의 조회, 답변 등록 / 수정

---

## 프론트엔드

React 19 + Vite로 구성된 SPA로, 백엔드 REST API + WebSocket을 실시간 연동합니다.

### 페이지 / 라우트

| 경로 | 페이지 | 설명 |
|------|--------|------|
| `/login` | LoginPage | 로그인 / 회원가입 탭 전환 |
| `/` | ConcertsPage | 공연 목록 (상태 필터) |
| `/concerts/:concertId` | ConcertDetailPage | 공연 상세, 구역별 잔여석 |
| `/queue/:concertId` | QueuePage | 실시간 대기열 (WebSocket) |
| `/reservation/:concertId` | ReservationPage | 구역/수량 선택 + 결제 타이머 |
| `/reservations` | ReservationsPage | 내 예매 내역 + 취소 |
| `/support` | SupportPage | 고객센터 문의 작성/조회 |
| `/admin` 🔒 | AdminPage | 공연/구역 관리, 판매 통계 |
| `/admin/support` 🔒 | AdminSupportPage | 전체 문의 관리, 답변 등록/수정 |

🔒 = `ADMIN` role 전용 (`AdminRoute` 가드), 그 외는 로그인 필요 (`ProtectedRoute` 가드)

### 주요 구현 포인트

- **전역 다크/라이트 테마**: `ThemeContext`가 `localStorage` + `document.documentElement.classList`를 동기화, 모든 페이지가 `useTheme()`로 일관되게 토글
- **실시간 대기열 훅** (`useQueue`): HTTP 대신 소켓 이벤트(`queue:enter`/`leave`/`reconnect`)로 대기열 진입 — `broadcastPositions`가 소켓 룸 단위로 전송되므로 룸 join이 필수적이라 REST 대신 소켓 사용
- **30초 재접속 유예**: `beforeunload`에 세션 정보를 `sessionStorage`에 저장해두고, 재진입 시 `queue:reconnect`로 기존 순번 복원
- **토스페이먼츠 SDK 연동**: `loadTossPayments` → `requestPayment` Promise 방식, PC는 iframe 결제창, 모바일은 `successUrl`/`failUrl` 리다이렉트로 폴백
- **결제 타이머 UI**: 남은 시간 진행률 바, 1분 이하일 때 pulse 애니메이션 + 연장 버튼 활성화
- **인증/권한 가드**: `ProtectedRoute`(로그인 여부), `AdminRoute`(JWT role) 라우터 레벨 가드로 페이지 진입 자체를 차단

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

<details>
<summary>Webhook 페이로드 예시 (토스페이먼츠 실제 envelope 구조)</summary>

```json
{
  "eventType": "PAYMENT_STATUS_CHANGED",
  "data": {
    "paymentKey": "tviva202607091311124OTl1",
    "orderId": "6c3bf0ae-488a-49d7-b741-ad1c7e3553ef",
    "orderName": "",
    "status": "DONE",
    "totalAmount": 100
  }
}
```

`data.status`는 `DONE` / `CANCELLED` / `FAILED` / `EXPIRED` 를 처리한다.
`orderId`는 곧 내부 `reservationId`로 매핑된다.

</details>

### 고객센터 `/api/posts` 🔒 USER · `/api/admin/posts` 🔒 ADMIN

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET / POST | `/api/posts` | 내 문의 목록 / 작성 |
| GET / DELETE | `/api/posts/:id` | 문의 상세 / 삭제 |
| GET | `/api/admin/posts` | 전체 문의 목록 |
| POST / PATCH | `/api/admin/posts/:id/reply` | 답변 등록 / 수정 |

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

```mermaid
erDiagram
    User ||--o{ RefreshToken : has
    User ||--o{ Reservation : makes
    User ||--o{ Post : writes
    User ||--o{ Reply : answers
    Concert ||--o{ ConcertZone : has
    ConcertZone ||--o{ Reservation : "preempted by"
    Reservation ||--|| Payment : has
    Post ||--o| Reply : "answered by"

    User {
        string id PK
        string email UK
        string password
        string nickname
        enum role "ADMIN | USER"
    }
    Concert {
        string id PK
        string title
        string artist
        string venue
        datetime saleStartAt
        enum status "SCHEDULED|ON_SALE|SOLD_OUT|ENDED"
    }
    ConcertZone {
        string id PK
        string concertId FK
        string name
        int price
        int totalQuantity
        int remainQuantity
    }
    Reservation {
        string id PK
        string userId FK
        string concertZoneId FK
        int quantity "1~4"
        int totalPrice
        enum status "PENDING|CONFIRMED|CANCELLED|EXPIRED"
        datetime extendedAt "nullable, 연장 1회 제한"
    }
    Payment {
        string id PK
        string reservationId FK
        string paymentKey "nullable"
        int amount
        enum status "READY|DONE|CANCELLED|FAILED"
        datetime paidAt "nullable"
    }
    Post {
        string id PK
        string userId FK
        string title
        string content
        enum status "PENDING|ANSWERED"
    }
    Reply {
        string id PK
        string postId FK
        string adminId FK
        string content
    }
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
src/                          # 백엔드
├── controllers/      HTTP 요청 핸들러 (입력 검증 + 응답, 비즈니스 로직 없음)
├── services/         비즈니스 로직 + 트랜잭션
├── repositories/     DB 쿼리 (Prisma) + Redis 명령 (Lua 스크립트 포함)
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
└── utils/            Prisma 싱글톤, Redis 클라이언트, JWT, bcrypt, Pino 로거, 응답 래퍼

client/src/                   # 프론트엔드
├── pages/            라우트별 페이지 컴포넌트
├── components/       Navbar, ProtectedRoute, AdminRoute, ui/ (Radix 기반)
├── hooks/            useQueue (대기열 실시간 상태 관리)
├── context/          ThemeContext (다크/라이트 전역 상태)
├── api/              fetch 기반 API 클라이언트 (Authorization 헤더 자동 주입)
└── lib/              공통 유틸 (cn 등)

tests/
└── integration/      Supertest 통합 테스트 (5 suites, 77 cases)

prisma/
└── schema.prisma

scripts/
└── test-queue.ts     대기열 동시 진입 부하 테스트 스크립트
```

---

## 시작하기

### 사전 요구사항

- Node.js 20+
- Docker Desktop

### 백엔드

**환경 변수** (`.env`)

```env
DATABASE_URL="postgresql://postgres:password@localhost:5434/ticket_queue"
REDIS_URL="redis://localhost:6380"
JWT_ACCESS_SECRET="your-access-secret"
JWT_REFRESH_SECRET="your-refresh-secret"
TOSS_SECRET_KEY="test_sk_..."   # 토스페이먼츠 테스트 시크릿 키
PORT=3001
```

```bash
# 1. 인프라 시작 (PostgreSQL 5434, Redis 6380 — 기본 포트 아님에 주의)
docker compose up -d

# 2. 의존성 설치
npm install

# 3. DB 마이그레이션 + Prisma 클라이언트 생성
npx prisma migrate dev
npx prisma generate

# 4. 개발 서버 시작 (http://localhost:3001)
npm run dev
```

### 프론트엔드

**환경 변수** (`client/.env`)

```env
VITE_API_URL="http://localhost:3001"
VITE_TOSS_CLIENT_KEY="test_ck_..."   # 토스페이먼츠 테스트 클라이언트 키
```

```bash
cd client
npm install
npm run dev   # http://localhost:5173
```

### 토스페이먼츠 Webhook 로컬 테스트

```bash
# ngrok으로 로컬 서버 터널링
ngrok http 3001

# 토스페이먼츠 대시보드에서 Webhook URL 설정
# https://{ngrok-url}/api/payments/webhook
```

---

## 테스트

```bash
# 전체 테스트 (5 suites, 77 cases)
npm test

# 단일 파일
npx jest tests/integration/reservation.test.ts

# 타입체크
npm run typecheck

# 대기열 동시 진입 부하 테스트 (10명 동시 진입, 순번 중복/ZCARD 검증)
CONCERT_ID=<id> npx ts-node scripts/test-queue.ts
```

> 테스트 실행 전 인프라(`docker compose up -d`)가 반드시 실행 중이어야 합니다.
> Jest는 공유 테스트 DB의 FK 충돌을 피하기 위해 `maxWorkers: 1`로 직렬 실행됩니다.

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
| 프론트 상태 관리 | Context API (전역: Theme만) | 페이지별 로컬 상태가 대부분이라 별도 상태 라이브러리 불필요 |
| 대기열 클라이언트 통신 | HTTP 대신 WebSocket 이벤트 | 서버 브로드캐스트가 소켓 룸 단위라 REST로는 룸 join 불가 |

---

## 트러블슈팅

실제로 마주쳤던 문제와 해결 과정 중 기록할 만한 것들.

<details>
<summary><b>Socket.io 이중 전송으로 인한 순번 표시 경쟁 조건</b></summary>

`socket.emit()`으로 개별 응답을 보내면서 동시에 `broadcastPositions()`로 전체 브로드캐스트도 하니, 두 응답이 도착하는 순서가 보장되지 않아 클라이언트에 순번이 튀는 현상이 발생했다. 개별 emit을 제거하고 `broadcastPositions` 단일 경로로 통일해 해결.
</details>

<details>
<summary><b>토스페이먼츠 Webhook 실제 payload가 예상과 다른 구조</b></summary>

`{ paymentKey, orderId, status }`처럼 최상위 필드로 오는 걸로 가정하고 DTO를 짰지만, 실제 토스 Webhook은 `{ eventType, data: { paymentKey, orderId, status, ... } }` 봉투 구조로 전송된다. `safeParse`가 `try/catch` 바깥에서 즉시 400을 반환해 에러 로그조차 안 남는 상태였다. DTO를 실제 envelope 구조로 맞추고, 파싱 실패 시점에도 `logger.warn`으로 원인을 남기도록 수정했다.
</details>

<details>
<summary><b>BullMQ job ID에 콜론(:) 사용 불가</b></summary>

`expiry:${reservationId}` 형태로 job ID를 만들었더니 BullMQ 내부적으로 충돌이 발생. 언더스코어 구분자(`expiry_${reservationId}`)로 변경.
</details>

<details>
<summary><b>JWT 같은 초에 발급된 토큰이 동일해지는 문제</b></summary>

Refresh Token 로테이션 테스트 중, 같은 초 안에 재발급된 토큰이 완전히 동일한 값으로 나오는 버그를 발견. JWT payload에 `jti`(JWT ID, UUID)를 추가해 매 발급마다 고유성을 보장하도록 해결.
</details>

<details>
<summary><b>Prisma <code>$transaction([...])</code> 배열 반환값 구조분해 누락</b></summary>

`prisma.$transaction([op1, op2])` 배열 인자 방식은 콜백 방식과 달리 `[result1, result2]` 배열을 그대로 반환한다. 첫 번째 결과가 필요한 곳에서 구조분해를 빠뜨려 배열이 그대로 API 응답에 담기는 버그가 있었고, `const [result] = await prisma.$transaction([...])` 형태로 수정.
</details>

---

## 라이선스

ISC
