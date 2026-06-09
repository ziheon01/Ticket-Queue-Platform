# Plan: 인증 기능 구현

작성일: 2026-06-09
상태: 승인 대기

---

## Scope

### 신규 생성 파일

```
src/
├── utils/
│   ├── prisma.ts          # Prisma 싱글톤 (PrismaPg Driver Adapter)
│   ├── jwt.ts             # Access/Refresh Token 발급·검증 (jti 포함)
│   ├── bcrypt.ts          # 비밀번호 해싱·비교
│   └── response.ts        # 공통 API 응답 래퍼
├── dtos/
│   └── auth.dto.ts        # Zod v4 기반 register/login 스키마
├── repositories/
│   ├── user.repository.ts
│   └── refreshToken.repository.ts
├── services/
│   └── auth.service.ts    # 비즈니스 로직: register, login, logout, refresh, me
├── controllers/
│   └── auth.controller.ts # 라우팅 + 입력 검증만
├── middlewares/
│   ├── auth.middleware.ts  # JWT 검증 + RBAC (requireAuth, requireAdmin)
│   └── error.middleware.ts # 전역 에러 핸들러
└── routes/
    └── auth.routes.ts

tests/
└── integration/
    └── auth.test.ts        # Supertest 통합 테스트
```

### 수정 파일

- `src/index.ts` — Express 앱 설정 완성 (helmet, cors, 라우터 등록, 에러 핸들러)

### 설치 필요 패키지

- `@prisma/adapter-pg` + `pg` + `@types/pg` — Prisma 7 필수 (현재 미설치)

---

## Acceptance Criteria

| # | 시나리오 | 기대 결과 |
|---|---------|---------|
| 1 | POST /api/auth/register — 정상 입력 | 201, `{ id, email, nickname, role }` (password 제외) |
| 2 | POST /api/auth/register — 이미 존재하는 이메일 | 409 Conflict |
| 3 | POST /api/auth/register — 유효하지 않은 입력 (이메일 형식, 비밀번호 길이 등) | 400 Bad Request |
| 4 | POST /api/auth/login — 정상 입력 | 200, `{ accessToken, refreshToken, user }` |
| 5 | POST /api/auth/login — 없는 이메일 / 틀린 비밀번호 | 401 Unauthorized |
| 6 | POST /api/auth/logout — 유효한 refreshToken | 200, DB에서 해당 토큰 삭제 |
| 7 | POST /api/auth/refresh — 유효한 refreshToken | 200, 새 accessToken + 새 refreshToken (로테이션), 구 토큰 DB 삭제 |
| 8 | POST /api/auth/refresh — 만료되거나 DB에 없는 refreshToken | 401 Unauthorized |
| 9 | GET /api/auth/me — 유효한 accessToken | 200, `{ id, email, nickname, role }` |
| 10 | GET /api/auth/me — 토큰 없음 / 만료 / 위조 | 401 Unauthorized |

---

## Dependencies

- Prisma 스키마 확정: `User`, `RefreshToken` 모델 — **완료**
- `@prisma/adapter-pg`: Prisma 7 필수, **미설치** → Plan 승인 후 첫 작업으로 설치
- `prisma.config.ts` `datasource.url` 설정 완료 — **완료**
- `schema.prisma` datasource에 `url` 라인 없음 (중복 방지) — **확인 완료**
- `.env` 파일에 `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` 환경 변수 필요

---

## Unknowns

없음. 명세가 확정되어 있고, 유사 프로젝트(DearCarmate) 경험 기반이므로 미결 사항 없음.

---

## Stop Conditions

다음 상황에서 즉시 멈추고 사용자에게 보고한다:

1. `@prisma/adapter-pg` 설치 또는 Prisma 클라이언트 초기화 실패 시
2. `.env` 파일이 없어서 `DATABASE_URL` 등 환경 변수를 확인할 수 없을 때
3. 동일한 테스트 실패를 2회 수정 시도 후에도 해결 못 할 때

---

## 주의할 함정 (CLAUDE.md 발췌)

- **Prisma 7**: `new PrismaClient()` 직접 사용 불가 — `PrismaPg` Driver Adapter 싱글톤 필수
- **JWT jti**: 발급 시 반드시 `jti` 포함 — 같은 초 토큰 동일 버그 방지
- **Zod v4**: `z.string({ error: '...' })` 사용 (`required_error` 제거됨)

---

## 구현 순서 (TDD)

1. 패키지 설치: `@prisma/adapter-pg`, `pg`, `@types/pg`
2. `src/utils/prisma.ts` — Prisma 싱글톤 구현 및 연결 확인
3. `src/utils/` — `jwt.ts`, `bcrypt.ts`, `response.ts`
4. **테스트 파일 먼저 작성** (`tests/integration/auth.test.ts`) → 실패 확인
5. `src/dtos/auth.dto.ts` — Zod 스키마
6. `src/repositories/` — user, refreshToken
7. `src/services/auth.service.ts`
8. `src/controllers/auth.controller.ts` + `src/routes/auth.routes.ts`
9. `src/middlewares/` — auth, error
10. `src/index.ts` 완성
11. 테스트 통과 확인 → typecheck 통과 확인
