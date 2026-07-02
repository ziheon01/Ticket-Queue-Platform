# Plan: 고객센터 게시판 백엔드 구현

작성일: 2026-07-02
상태: 승인 대기

---

## Scope

### 신규 생성 파일

```
src/
├── dtos/
│   └── post.dto.ts                     # Zod: 문의 작성·답변 스키마 + 응답 타입
├── repositories/
│   └── post.repository.ts              # DB CRUD (Post, Reply)
├── services/
│   └── post.service.ts                 # 비즈니스 로직 (작성/조회/삭제/답변 등록·수정)
├── controllers/
│   ├── post.controller.ts              # 유저 REST 핸들러 (create/list/detail/delete)
│   └── adminPost.controller.ts         # 어드민 REST 핸들러 (list/reply create/reply update)
└── routes/
    ├── post.routes.ts                  # /api/posts/*
    └── adminPost.routes.ts             # /api/admin/posts/*

tests/integration/
└── post.test.ts                        # REST 통합 테스트 (AC1~AC17)
```

### 수정 파일

- `prisma/schema.prisma` — Post, Reply 모델 추가
- `src/index.ts` — post·adminPost 라우트 등록

---

## Acceptance Criteria

| # | 시나리오 | 기대 결과 |
|---|---------|---------|
| 1 | POST /api/posts — 인증된 유저, 유효한 title+content | 201, `{ id, title, content, status: 'PENDING', createdAt }` |
| 2 | POST /api/posts — 미인증 | 401 Unauthorized |
| 3 | POST /api/posts — title 누락 | 400 Bad Request |
| 4 | GET /api/posts — 인증된 유저 | 200, 본인 문의 배열 (다른 유저 문의 미포함) |
| 5 | GET /api/posts/:id — 본인 PENDING 문의 | 200, post + reply: null |
| 6 | GET /api/posts/:id — 본인 ANSWERED 문의 | 200, post + reply 객체 포함 |
| 7 | GET /api/posts/:id — 타인 문의 | 403 Forbidden |
| 8 | GET /api/posts/:id — 존재하지 않는 id | 404 Not Found |
| 9 | DELETE /api/posts/:id — 본인 PENDING 문의 | 200, 삭제 완료 |
| 10 | DELETE /api/posts/:id — 본인 ANSWERED 문의 | 400 Bad Request |
| 11 | DELETE /api/posts/:id — 타인 문의 | 403 Forbidden |
| 12 | GET /api/admin/posts — 어드민 | 200, 전체 유저 문의 배열 (userId·닉네임 포함) |
| 13 | GET /api/admin/posts — 일반 유저 | 403 Forbidden |
| 14 | POST /api/admin/posts/:id/reply — 어드민, PENDING 문의 | 201, reply 생성 + post status → ANSWERED |
| 15 | POST /api/admin/posts/:id/reply — 이미 reply 존재 | 409 Conflict |
| 16 | PATCH /api/admin/posts/:id/reply — 어드민, reply 있음 | 200, reply 내용 수정 |
| 17 | PATCH /api/admin/posts/:id/reply — reply 없음 | 404 Not Found |

---

## Dependencies

- `requireAuth` 미들웨어 — **완료** (`src/middlewares/auth.middleware.ts`)
- `requireAdmin` 미들웨어 — **완료** (동일 파일, `req.user?.role !== 'ADMIN'` 체크)
- Prisma 싱글톤 클라이언트 — **완료** (`src/utils/prisma.ts`)
- 공통 응답 래퍼 (`ok`, `created`) — **완료** (`src/utils/response.ts`)
- `AppError` — **완료** (`src/utils/errors.ts`)
- Zod v4 — **완료** (설치됨, `z.string({ error: '...' })` 방식 사용)

---

## 설계 결정

### 데이터 모델 관계

```
User  1──N  Post  1──0..1  Reply
                    └── adminId (FK → User)
```

- Reply는 Post와 1:1 unique 관계 (`postId` unique 제약)
- Reply.adminId는 ADMIN role을 가진 User를 참조 (FK → User)
- Post 삭제 시 Reply도 cascade delete (`onDelete: Cascade`)

### 어드민 라우트 인증 체이닝

```typescript
// requireAdmin은 requireAuth 이후에만 동작 (req.user 전제)
router.get('/', requireAuth, requireAdmin, getAllPostsHandler)
router.post('/:id/reply', requireAuth, requireAdmin, createReplyHandler)
router.patch('/:id/reply', requireAuth, requireAdmin, updateReplyHandler)
```

기존 `admin.routes.ts` 패턴과 동일.

### Reply 등록: Prisma 트랜잭션 원자화

Reply 생성 + Post.status → ANSWERED 두 연산을 단일 트랜잭션으로 처리:

```typescript
await prisma.$transaction([
  prisma.reply.create({ data: { postId, adminId, content } }),
  prisma.post.update({ where: { id: postId }, data: { status: 'ANSWERED' } }),
])
```

### 삭제 조건 검증 순서

존재 확인(404) → 소유권(403) → 상태(400) 순서로 검증.

### 응답 DTO 설계

```typescript
// 유저: 목록 (reply 미포함)
interface PostSummaryResponse {
  id: string
  title: string
  status: 'PENDING' | 'ANSWERED'
  createdAt: string
}

// 유저: 상세 (reply 포함)
interface PostDetailResponse {
  id: string
  title: string
  content: string
  status: 'PENDING' | 'ANSWERED'
  createdAt: string
  reply: { id: string; content: string; createdAt: string } | null
}

// 어드민: 목록 (userId·nickname 추가)
interface AdminPostSummaryResponse extends PostSummaryResponse {
  userId: string
  userNickname: string
}
```

### 페이지네이션

MVP 기준 미적용. 전체 목록 단순 반환 (createdAt DESC 정렬).

---

## Unknowns

없음. 기존 패턴으로 충분히 구현 가능.

---

## Stop Conditions

1. Prisma 마이그레이션 충돌 발생 시 → 즉시 중단, 사용자에게 보고
2. 동일한 테스트 실패를 2회 수정 후에도 해결 못 할 때
3. 타입체크 오류를 2회 수정 후에도 해결 못 할 때

---

## 구현 순서 (TDD)

1. `prisma/schema.prisma` — Post, Reply 모델 추가
2. `npx prisma migrate dev --name add-post-reply`
3. `npx prisma generate`
4. `src/dtos/post.dto.ts` — Zod 스키마 + 응답 타입 정의
5. `src/repositories/post.repository.ts` — DB CRUD 함수
6. **테스트 파일 먼저 작성** (`tests/integration/post.test.ts`) → 실패 확인
7. `src/services/post.service.ts` — 비즈니스 로직 (소유권·상태 검증 포함)
8. `src/controllers/post.controller.ts` + `src/controllers/adminPost.controller.ts`
9. `src/routes/post.routes.ts` + `src/routes/adminPost.routes.ts`
10. `src/index.ts` — 라우트 등록
11. 테스트 통과 확인 → typecheck 통과 확인
