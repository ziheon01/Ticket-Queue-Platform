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
→ 전체 문의 목록 조회 및 답변 등록/수정

USER (일반 유저)
→ 공연 목록/상세 조회
→ 대기열 진입/이탈
→ 구역 선택 및 티켓 수량 선택 (최대 4장)
→ 결제 진행
→ 예매 내역 조회
→ 문의 작성/조회/삭제
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
- 결제 시간 연장: 1분 이하 남았을 때 1회에 한해 5분 연장 가능 (Redis EXPIRE)
- 토스페이먼츠 결제 요청
- 결제 완료 Webhook 수신 → 예매 확정
- 타이머 만료 시 선점 해제 + 재고 복구 + 다음 대기자 입장

**예매 내역**
- 내 예매 목록 조회
- 예매 상세 조회 (공연 정보, 구역, 수량, 결제 금액)
- 예매 취소 (결제 완료 전만 가능)

**고객센터 게시판**
- 문의 작성 (제목 + 내용)
- 내 문의 목록 조회
- 내 문의 상세 조회 (답변 포함)
- 문의 삭제 (답변 전, 본인만)
- 어드민: 전체 문의 목록 조회, 답변 등록/수정

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

### 결제 시간 연장 플로우

```
결제 타이머 1분 이하 남음
→ WebSocket으로 "결제 시간 연장" 팝업 알림
→ 유저가 연장 요청 (POST /api/reservations/:id/extend)
→ 연장 가능 여부 확인 (이미 연장한 경우 거부)
→ Redis EXPIRE로 TTL 5분 재설정
→ reservation.extendedAt 기록 (연장 이력)
→ WebSocket으로 연장된 타이머 전송
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
  → Cron 배치로 자동 업데이트 (매 분 saleStartAt 체크)
- createdAt / updatedAt

ConcertZone
- id
- concertId (FK)
- name (예: VIP, R, S)
- price
- totalQuantity
- remainQuantity   ← DB 최종 확정값 (Redis와 이중 관리)
- createdAt / updatedAt

Reservation
- id
- userId (FK)
- concertZoneId (FK)
- quantity (1~4)
- totalPrice
- status (enum: PENDING | CONFIRMED | CANCELLED | EXPIRED)
- extendedAt (결제 시간 연장 시각, nullable — 연장 1회 제한 체크용)
- createdAt / updatedAt

Payment
- id
- reservationId (FK, unique)
- paymentKey (토스페이먼츠 결제 키)
- amount
- status (enum: READY | DONE | CANCELLED | FAILED)
- paidAt (nullable)
- createdAt / updatedAt

Post (문의글)
- id
- userId (FK)
- title
- content
- status (enum: PENDING | ANSWERED)
- createdAt / updatedAt

Reply (답변)
- id
- postId (FK, unique)
- adminId (FK)
- content
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
→ 남은 재고 수량 (Redis 실시간값, DB와 이중 관리)

선점 락
zone:{concertZoneId}:lock:{userId}
→ String, TTL = 5분 (연장 시 EXPIRE로 재설정)
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
POST   /api/reservations                  예매 생성 (구역 선점)
GET    /api/reservations                  내 예매 목록
GET    /api/reservations/:id              예매 상세
DELETE /api/reservations/:id              예매 취소
POST   /api/reservations/:id/extend       결제 시간 연장 (1회 한정)
```

### 결제 Webhook
```
POST   /api/payments/webhook              토스페이먼츠 결제 결과 수신
```

### 고객센터 (유저)
```
GET    /api/posts              내 문의 목록
POST   /api/posts              문의 작성
GET    /api/posts/:id          문의 상세 (답변 포함)
DELETE /api/posts/:id          문의 삭제 (PENDING 상태, 본인만)
```

### 고객센터 (어드민)
```
GET    /api/admin/posts              전체 문의 목록
POST   /api/admin/posts/:id/reply    답변 등록
PATCH  /api/admin/posts/:id/reply    답변 수정
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
queue:timer        결제 타이머 현황 { remainSeconds, extendable }
queue:extended     결제 시간 연장 완료 { remainSeconds }
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
| Concert status | Cron 배치 자동 업데이트 | 판매 시작 시간 자동 전환, 어드민 실수 방지 |
| Reservation/Payment | 테이블 분리 | 결제 이력 관리, 부분 취소 확장 고려 |
| 재고 관리 | DB + Redis 이중 관리 | Redis 실시간 차감, DB 최종 확정 |
| 결제 시간 연장 | 1분 이하일 때 1회 한정 5분 연장 | UX 보호, Redis EXPIRE 활용 |

---

## 10. 미결 사항 (Unknowns)

- 동시 입장 처리 단위: 한 번에 몇 명씩 입장 처리할지 결정 필요 (예: 앞에서 10명씩 배치 입장)
- Redis Keyspace Notification: Docker Redis 설정에서 `notify-keyspace-events KEA` 활성화 필요 여부 확인
- ngrok 설정: 토스페이먼츠 Webhook 로컬 수신을 위한 터널 URL 설정 시점

---

## 11. 고객센터 게시판 (신규)

### 기능 범위

**유저**
- 문의 작성 (제목 + 내용)
- 내 문의 목록 조회
- 내 문의 상세 조회 (답변 포함)
- 문의 삭제 (답변 전, 본인만)

**어드민**
- 전체 문의 목록 조회
- 문의 상세 조회
- 답변 등록
- 답변 수정
- 문의 상태: PENDING(대기중) / ANSWERED(답변완료)

### MVP 제외
- 파일 첨부
- 댓글 다중 답변 (1:1 단일 답변만)
- 알림 (답변 완료 시 푸시 알림)
- 카테고리 분류

### 네비게이션 변경
- "티켓팅" 메뉴 제거
- "고객센터" → /support 연결
- 최종 네비게이션: 공연 / 마이페이지 / 고객센터