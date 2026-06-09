import request from 'supertest';
import app from '../../src/index';
import { prisma } from '../../src/utils/prisma';

const TEST_EMAIL = 'auth_test@test.com';
const TEST_PASSWORD = 'password123';
const TEST_NICKNAME = 'testuser';

beforeAll(async () => {
  await prisma.refreshToken.deleteMany({});
  await prisma.user.deleteMany({ where: { email: { contains: '@test.com' } } });
});

afterAll(async () => {
  await prisma.refreshToken.deleteMany({});
  await prisma.user.deleteMany({ where: { email: { contains: '@test.com' } } });
  await prisma.$disconnect();
});

// ──────────────────────────────────────────
// POST /api/auth/register
// ──────────────────────────────────────────
describe('POST /api/auth/register', () => {
  it('AC1: 정상 입력 시 201과 유저 정보 반환 (password 제외)', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      nickname: TEST_NICKNAME,
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      email: TEST_EMAIL,
      nickname: TEST_NICKNAME,
      role: 'USER',
    });
    expect(res.body.data.password).toBeUndefined();
    expect(res.body.data.id).toBeDefined();
  });

  it('AC2: 이미 존재하는 이메일이면 409 반환', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      nickname: 'another',
    });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('AC3: 이메일 형식이 아니면 400 반환', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'not-an-email',
      password: TEST_PASSWORD,
      nickname: TEST_NICKNAME,
    });
    expect(res.status).toBe(400);
  });

  it('AC3: 비밀번호가 8자 미만이면 400 반환', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'new@test.com',
      password: 'short',
      nickname: TEST_NICKNAME,
    });
    expect(res.status).toBe(400);
  });
});

// ──────────────────────────────────────────
// POST /api/auth/login
// ──────────────────────────────────────────
describe('POST /api/auth/login', () => {
  it('AC4: 정상 입력 시 200과 accessToken, refreshToken 반환', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    expect(res.body.data.user.email).toBe(TEST_EMAIL);
  });

  it('AC5: 존재하지 않는 이메일이면 401 반환', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'nobody@test.com',
      password: TEST_PASSWORD,
    });
    expect(res.status).toBe(401);
  });

  it('AC5: 비밀번호가 틀리면 401 반환', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: TEST_EMAIL,
      password: 'wrongpassword',
    });
    expect(res.status).toBe(401);
  });
});

// ──────────────────────────────────────────
// 토큰 기반 플로우 (logout / refresh / me)
// ──────────────────────────────────────────
describe('Auth token flows', () => {
  let accessToken: string;
  let refreshToken: string;

  beforeAll(async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });
    accessToken = res.body.data.accessToken;
    refreshToken = res.body.data.refreshToken;
  });

  it('AC9: 유효한 accessToken으로 GET /api/auth/me 호출 시 200 반환', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(TEST_EMAIL);
    expect(res.body.data.password).toBeUndefined();
  });

  it('AC10: 토큰 없이 GET /api/auth/me 호출 시 401 반환', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('AC10: 위조된 accessToken으로 GET /api/auth/me 호출 시 401 반환', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer fake.token.here');
    expect(res.status).toBe(401);
  });

  it('AC7: 유효한 refreshToken으로 POST /api/auth/refresh 호출 시 새 토큰 반환 (로테이션)', async () => {
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    expect(res.body.data.refreshToken).not.toBe(refreshToken);

    refreshToken = res.body.data.refreshToken;
    accessToken = res.body.data.accessToken;
  });

  it('AC8: 유효하지 않은 refreshToken으로 POST /api/auth/refresh 호출 시 401 반환', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'invalid.refresh.token' });
    expect(res.status).toBe(401);
  });

  it('AC6: 유효한 refreshToken으로 POST /api/auth/logout 호출 시 200 반환', async () => {
    const res = await request(app).post('/api/auth/logout').send({ refreshToken });
    expect(res.status).toBe(200);
  });

  it('AC8: 로그아웃된 refreshToken으로 refresh 시 401 반환', async () => {
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken });
    expect(res.status).toBe(401);
  });
});
