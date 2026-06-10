# CLAUDE.md

이 파일은 Claude Code가 이 레포에서 작업할 때 따르는 지침이다. 모든 세션 시작 시 자동으로 읽는다.

## 프로젝트 개요

콘서트 티켓 선착순 예매 플랫폼. Redis 대기열 기반의 동시성 제어, WebSocket 실시간 업데이트, 토스페이먼츠 결제 연동을 제공하는 백엔드 API 서비스.

자세한 내용은 @README.md, 사용 가능한 npm 명령은 @package.json 참고.

## 하네스 파일 (반드시 먼저 읽는다)

세션 시작 시 다음 파일들을 순서대로 확인한다. 이 파일들이 현재 작업 상태의 진실의 원천이다.

- @docs/SPEC.md — 합의된 기능 스펙
- @docs/plan.md — 현재 진행 중인 작업의 계획 (Scope, Acceptance Criteria, Dependencies, Unknowns, Stop Conditions)
- @docs/progress.txt — 마지막 작업 지점과 다음 할 일
- @docs/features.json — 불변 요구사항 목록 (수정/삭제 금지, 완료 시 `passes: true`만 변경)

IMPORTANT: 이 파일들에 없는 작업은 임의로 시작하지 않는다. 필요하면 먼저 plan.md 갱신부터 제안한다.

## 자주 쓰는 명령

Claude가 코드만으로 추론할 수 없는 명령만 적는다.

```bash
# 인프라 실행 (PostgreSQL + Redis)
docker compose up -d

# 개발 서버 (핫 리로드)
npm run dev

# 타입 체크
npm run typecheck

# 린트
npm run lint

# 테스트 (단일 파일 우선)
npx jest tests/path/to/file.test.ts

# 전체 테스트
npm test

# DB 마이그레이션
npx prisma migrate dev

# 클라이언트 재생성
npx prisma generate

# Prisma Studio
npx prisma studio
```

## 인프라

Docker Compose로 두 서비스를 실행하며, **기본 포트와 다른 포트**를 사용한다. (TIL 플랫폼과 충돌 방지)

| 서비스 | 컨테이너 포트 | 호스트 포트 |
|--------|-------------|-----------|
| PostgreSQL | 5432 | **5434** |
| Redis | 6379 | **6380** |

## 데이터베이스

Prisma 클라이언트 출력 경로가 기본값이 아닌 `src/generated/prisma`임에 주의. 스키마 변경 후 반드시 `npx prisma generate` 실행.

## 아키텍처

```
src/
├── controllers/   # 라우팅 + 입력 검증 (비즈니스 로직 없음)
├── services/      # 비즈니스 로직 + 트랜잭션
├── repositories/  # DB 접근 + 쿼리
├── queues/        # BullMQ 큐 정의 + 워커
├── socket/        # Socket.io 이벤트 핸들러
├── dtos/          # 입출력 타입 정의 (Zod 스키마)
├── middlewares/   # 인증, 에러 핸들링, 입력 검증
└── utils/         # JWT, bcrypt, Redis 클라이언트, 응답 래퍼
```

- **HTTP API** (Express) — REST 엔드포인트
- **대기열** (BullMQ + Redis) — 선착순 대기열 관리, 워커가 순서대로 처리
- **실시간** (Socket.io) — 대기열 순번 실시간 푸시
- **결제** (TossPayments SDK) — Webhook 기반 결제 확인
- **인증** (JWT) — Access Token + Refresh Token

## Plan → Work → Review 워크플로

모든 기능은 이 사이클을 따른다.

### Plan 단계
- 새 기능은 먼저 `docs/plan.md`에 다음을 명시한 뒤 사용자 승인을 받고 시작한다
  - Scope: 건드릴 파일과 영역
  - Acceptance Criteria: 검증 가능한 완료 기준
  - Dependencies: 의존하는 기존 코드/스키마
  - Unknowns: 확실하지 않은 부분 (지어내지 않는다)
  - Stop Conditions: 멈추고 인간에게 묻는 시점
- 작은 변경(diff를 한 문장으로 설명 가능)은 plan.md를 생략하고 바로 진행한다

### Work 단계
- IMPORTANT: 검증 가능한 기능은 **TDD를 기본으로 한다**. 실패하는 테스트 → 최소 구현 → 리팩토링
- 인프라 세팅/보일러플레이트는 TDD 예외. 실행 가능한 검증 스크립트로 대체한다
- 한 번에 거대한 변경을 쏟지 않는다. 검토 가능한 단위로 점진적으로 진행한다
- 작업 종료 시 `docs/progress.txt`에 무엇을 했고 다음에 무엇을 할지 한두 줄 기록한다

### Review 단계
- 구현 직후 자기 코드를 그대로 리뷰하지 않는다. 가능하면 서브에이전트로 위임하거나 별도 세션에서 리뷰한다
- 리뷰 체크리스트: 완료 기준 충족, 엣지 케이스(null/동시성/Race Condition), 보안, 성능(N+1), 아키텍처 준수
- 문제 발견 시 수정은 **최대 2회까지 자동 시도**한다. 2회 후에도 해결되지 않으면 즉시 중단하여 사용자에게 보고한다

## 코드 스타일

- ES 모듈(import/export) 사용, CommonJS(require) 금지
- `any` 사용 금지. 타입이 불투명하면 인터페이스를 정의한다
- Controller는 라우팅과 입력 검증만. 비즈니스 로직 금지
- Service에서 트랜잭션을 관리한다
- API 응답은 항상 공통 Response Wrapper로 감싼다
- DB 엔티티를 클라이언트에 그대로 노출하지 않는다. 응답은 DTO/Mapper를 거친다
- Redis 키 네이밍: `도메인:id:용도` 형식 (예: `queue:concert_id:waiting`)
- Socket.io 이벤트명: snake_case (예: `queue_position_updated`)
- BullMQ 큐명: kebab-case (예: `ticket-payment-queue`)

## 검증 및 종료 규칙

- IMPORTANT: 일련의 코드 변경을 마치면 반드시 타입체크와 관련 테스트를 실행한다
- 성능을 위해 전체 테스트가 아닌 단일 테스트를 우선 실행한다
- 에러는 억누르지 말고 근본 원인을 해결한다
- 테스트가 깨진 상태로 "완료"를 선언하지 않는다
- 통과시키려고 테스트를 삭제하거나 약화시키지 않는다. `docs/features.json`은 수정·삭제 금지

## 컨텍스트 관리

- Plan → Work → Review 단계 전환 시, 또는 관련 없는 작업으로 넘어갈 때 `/clear`를 제안한다
- 같은 이슈를 두 번 고쳐도 안 되면 누적 세션을 이어가지 말고 새 세션을 권한다
- 파일을 많이 읽는 조사 작업은 서브에이전트에 위임한다
- 세션 종료 전 반드시 `docs/progress.txt`를 갱신한다

## 저장소 에티켓

- 브랜치 네이밍: `feat/기능명`, `fix/이슈명`
- 커밋 메시지: 한국어로 작성한다
- 커밋 메시지: 무엇을·왜 바꿨는지 드러나게 작성한다
- 커밋 단위는 의미 있게 쪼갠다 (학습 히스토리 목적)

## 개발 환경 특이사항

- 로컬은 WSL(Ubuntu) 기반
- Prisma 클라이언트 출력 경로가 기본값이 아닌 `src/generated/prisma/`임에 주의
- 토스페이먼츠 Webhook 로컬 테스트 시 ngrok 터널링 필요 (`ngrok http 3001`)
- PostgreSQL 5434, Redis 6380 (기본 포트 아님)

## 주의할 함정

- Prisma 7은 `new PrismaClient()` 직접 사용 불가.
  `PrismaPg` Driver Adapter를 통한 싱글톤으로 초기화해야 한다
```typescript
  import { PrismaPg } from '@prisma/adapter-pg';
  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });
```
- JWT 발급 시 `jti`(JWT ID) 필드를 반드시 포함해야 한다.
  없으면 같은 초에 발급된 토큰이 동일해져 Refresh Token 로테이션 버그 발생
- Jest 병렬 실행 시 공유 테스트 DB에서 FK 충돌 발생.
  `maxWorkers: 1`로 직렬화 필요 (jest.config.js에 이미 설정됨)
- Zod v4에서 `z.string({ required_error: '...' })` 제거됨.
  `z.string({ error: '...' })` 방식 사용
- `prisma.config.ts`에 `datasource.url` 설정 시
  `schema.prisma`에서 `url = env("DATABASE_URL")` 라인 제거 필요 (중복 오류)
- ts-jest 29 + Jest 30 조합에서 Jest 전역 타입 자동 탐색 실패.
  `tsconfig.test.json`에 `"types": ["jest", "node"]` 명시 필요
- BullMQ와 ioredis를 함께 쓸 때 타입 충돌 발생.
  BullMQ의 `connection` 파라미터에 ioredis 인스턴스를 직접 넘기지 말고
  `{ host, port }` 옵션 객체로 전달할 것
- Socket.io에서 `socket.emit` + `broadcastPositions` 이중 전송 시 경쟁 조건 발생.
  개별 응답과 브로드캐스트를 분리하지 말고 `broadcastPositions` 단일화로 처리할 것