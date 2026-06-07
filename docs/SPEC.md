# SPEC.md — 콘서트 티켓 선착순 예매 플랫폼

최초 작성일: 2026-06-07
상태: 확정

---

## 1. 프로젝트 목적

Redis 대기열 기반의 선착순 티켓 예매 시스템을 구현한다. 고수요 콘서트 티켓팅 상황에서 발생하는 동시성 문제를 Redis의 원자적 연산으로 해결하고, WebSocket으로 실시간 대기 현황을 제공한다.

---

## 2. 사용자 역할

```
ADMIN (어드민)
→ 공연 등록/수정/삭제
→ 구역별 티켓 수량/가격 설정
→ 판매 시작 시간 설정
→ 판매 현황 조회

USER (일반 유저)
→ 공연 목록/상세 조회
→ 대기열 진입/이탈
→ 구역 선택 및 티켓 수량 선택 (최대 4장)
→ 결제 진행
→ 예매 내역 조회
```

인증은 RBAC 방식으로 단일 User 테이블에 `role` 컬럼으로 관리한다. JWT에 role을 포함해 어드민 전용 미들웨어로 접근을 제어한다.

---

## 3. MVP 범위

### In Scope

**인증**
- 회원가입 (이메일 + 비밀번호 + role)
- 로그인 / 로그아웃 (JWT Access Token + Refresh Token)
- Access Token 재발급
- 내 정보 조회

**공연 관리 (어드민)**
- 공연 등록 / 수정 / 삭제
- 구역 등록 / 수정 / 삭제 (구역명, 가격, 총 수량)
- 판매 시작 시간 설정
- 공연별 판매 현황 조회 (구역별 남은 수량, 예매자 수)

**공연 조회 (유저)**
- 공연 목록 조회 (판매 예정 / 판매 중 / 판매 종료)
- 공연 상세 조회 (구역별 수량/가격/잔여석)

**대기열 시스템**
- 대기열 진입 (판매 시작 시간 이후만 가능)
- 실시간 대기 순번 업데이트 (WebSocket)
- 대기열 자발적 이탈
- 브라우저 종료 감지 → 30초 유예 후 자동 이탈
- 30초 내 재접속 시 기존 순번 복원
- 순번 도달 시 입장 처리 (입장 가능 상태로 전환)

**티켓 선점 및 결제**
- 입장 후 구역 선택 + 수량 선택 (1~4장)
- Redis 원자적 선점 (SET NX + DECRBY)
- 선점 후 결제 타이머 5분 시작 (Redis TTL)
- 토스페이먼츠 결제 요청
- 결제 완료 Webhook 수신 → 예매 확정
- 타이머 만료 시 선점 해제 + 재고 복구 + 다음 대기자 입장

**예매 내역**
- 내 예매 목록 조회
- 예매 상세 조회 (공연 정보, 구역, 수량, 결제 금액)
- 예매 취소 (결제 완료 전만 가능)

### Out of Scope (MVP 이후)

- 좌석 지정 선택
- 소셜 로그인
- 티켓 양도/교환
- 공연 검색 / 필터
- 알림 (판매 시작 알림 등)
- 관리자 대시보드 UI

---

## 4. 핵심 플로우

### 티켓팅 플로우

```
판매 시작 시간 도달
→ 유저가 대기열 진입 버튼 클릭
→ Redis Sorted Set에 timestamp score로 등록
→ WebSocket으로 실시간 순번 수신
→ 순번 도달 → 입장 처리
→ 구역 선택 + 수량 선택
→ Redis SET NX로 선점 시도
  → 성공: 5분 결제 타이머 시작
  → 실패: 해당 구역 매진 안내
→ 토스페이먼츠 결제 요청
→ 결제 완료 Webhook 수신
→ DB 예매 확정 + Redis 선점 해제
```

### 대기열 이탈 플로우

```
브라우저 종료 감지 (WebSocket disconnect)
→ Redis TTL 30초 유예 키 생성
→ 30초 내 재접속: 기존 순번 복원
→ 30초 초과: 대기열에서 제거 + 순번 업데이트
```

### 결제 타이머 만료 플로우

```
5분 TTL 만료 (Redis Keyspace Notification)
→ BullMQ 만료 처리 워커 실행
→ DB 선점 상태 해제
→ 구역 재고 복구 (Redis INCRBY)
→ 다음 대기자 입장 처리
→ WebSocket으로 해당 유저에게 만료 알림
```

---

## 5. 데이터 모델 (초안)

```
User
- id
- email (unique)
- password (hashed)
- nickname
- role (enum: ADMIN | USER)
- createdAt / updatedAt

RefreshToken
- id
- userId (FK)
- token (hashed, unique)
- expiresAt
- createdAt

Concert
- id
- title
- artist
- venue
- concertDate (공연 날짜)
- saleStartAt (판매 시작 시간)
- status (enum: SCHEDULED | ON_SALE | SOLD_OUT | ENDED)
- createdAt / updatedAt

ConcertZone
- id
- concertId (FK)
- name (예: VIP, R, S)
- price
- totalQuantity
- remainQuantity
- createdAt / updatedAt

Reservation
- id
- userId (FK)
- concertZoneId (FK)
- quantity (1~4)
- totalPrice
- status (enum: PENDING | CONFIRMED | CANCELLED | EXPIRED)
- paymentKey (토스페이먼츠 결제 키, nullable)
- createdAt / updatedAt
```

---

## 6. Redis 키 설계

```
대기열
queue:{concertId}:waiting
→ Sorted Set, score = 진입 timestamp
→ 대기 중인 userId 목록

입장 가능 상태
queue:{concertId}:admitted:{userId}
→ String, TTL = 5분
→ 입장 후 결제 대기 상태

재연결 유예
queue:{concertId}:reconnect:{userId}
→ String, TTL = 30초
→ 브라우저 종료 후 유예 기간

구역 재고
zone:{concertZoneId}:stock
→ String (숫자)
→ 남은 재고 수량

선점 락
zone:{concertZoneId}:lock:{userId}
→ String, TTL = 5분
→ 결제 진행 중 선점 상태
```

---

## 7. API 엔드포인트 (초안)

### 인증
```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/refresh
GET    /api/auth/me
```

### 공연 (어드민)
```
POST   /api/admin/concerts
PATCH  /api/admin/concerts/:id
DELETE /api/admin/concerts/:id
POST   /api/admin/concerts/:id/zones
PATCH  /api/admin/zones/:id
DELETE /api/admin/zones/:id
GET    /api/admin/concerts/:id/stats
```

### 공연 (유저)
```
GET    /api/concerts
GET    /api/concerts/:id
```

### 대기열
```
POST   /api/queue/:concertId/enter
DELETE /api/queue/:concertId/leave
GET    /api/queue/:concertId/status
```

### 예매
```
POST   /api/reservations
GET    /api/reservations
GET    /api/reservations/:id
DELETE /api/reservations/:id
```

### 결제 Webhook
```
POST   /api/payments/webhook
```

### WebSocket 이벤트
```
클라이언트 → 서버
queue:enter        공연 대기열 진입
queue:leave        대기열 이탈
queue:reconnect    재연결 (유예 기간 내)

서버 → 클라이언트
queue:position     현재 순번 업데이트 { position, total }
queue:admitted     입장 처리 완료
queue:expired      결제 타이머 만료
queue:error        에러 알림
```

---

## 8. 기술 스택

- Node.js + TypeScript (strict)
- Express
- Prisma + PostgreSQL
- Redis (ioredis)
- BullMQ (대기열 워커, 만료 처리)
- Socket.io (WebSocket 실시간 통신)
- Zod (요청 검증)
- JWT Access Token (15분) + Refresh Token (7일)
- 토스페이먼츠 SDK (테스트 모드)
- Jest + Supertest (테스트)
- Swagger (API 문서)
- Docker Compose (PostgreSQL + Redis)

---

## 9. 확정된 설계 결정 사항

| 항목 | 결정 | 이유 |
|------|------|------|
| 인증 방식 | RBAC (role 컬럼) | 단일 인증 시스템, DearCarmate 경험 재활용 |
| 공연 구조 | Concert + ConcertZone 분리 | Redis 키를 구역 단위로 매핑 용이 |
| 대기열 단위 | 공연 단위 (입장 후 구역 선택) | 실제 티켓팅 표준 방식 |
| 결제 연동 | 토스페이먼츠 테스트 모드 | 실무 수준 Webhook 경험 |
| 실시간 통신 | WebSocket (Socket.io) | 양방향 통신, SSE보다 티켓팅에 적합 |
| 브라우저 종료 | 30초 유예 후 이탈 | UX 보호, Redis TTL 활용 |
| 최대 구매 수량 | 1인 최대 4장 | 실제 티켓팅 표준 |
| 날짜 기준 | 서버 UTC | 타임존 복잡도 제거 |

---

## 10. 미결 사항 (Unknowns)

- 동시 입장 처리 단위: 한 번에 몇 명씩 입장 처리할지 결정 필요 (예: 앞에서 10명씩 배치 입장)
- Redis Keyspace Notification: Docker Redis 설정에서 `notify-keyspace-events KEA` 활성화 필요 여부 확인
- ngrok 설정: 토스페이먼츠 Webhook 로컬 수신을 위한 터널 URL 설정 시점