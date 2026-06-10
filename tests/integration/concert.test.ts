import request from 'supertest';
import app from '../../src/index';
import { prisma } from '../../src/utils/prisma';
import { redis } from '../../src/utils/redis';

const ADMIN_EMAIL = 'concert_admin@test.com';
const USER_EMAIL = 'concert_user@test.com';
const PASSWORD = 'password123';

let adminToken: string;
let userToken: string;
let concertId: string;
let zoneId: string;

// ──────────────────────────────────────────
// Setup / Teardown
// ──────────────────────────────────────────

beforeAll(async () => {
  await prisma.reservation.deleteMany({});
  await prisma.concertZone.deleteMany({});
  await prisma.concert.deleteMany({});
  await prisma.refreshToken.deleteMany({});
  await prisma.user.deleteMany({ where: { email: { in: [ADMIN_EMAIL, USER_EMAIL] } } });

  // ADMIN 유저 생성 + 로그인
  await request(app).post('/api/auth/register').send({
    email: ADMIN_EMAIL,
    password: PASSWORD,
    nickname: 'adminuser',
    role: 'ADMIN',
  });
  const adminLogin = await request(app).post('/api/auth/login').send({
    email: ADMIN_EMAIL,
    password: PASSWORD,
  });
  adminToken = adminLogin.body.data.accessToken;

  // 일반 USER 생성 + 로그인
  await request(app).post('/api/auth/register').send({
    email: USER_EMAIL,
    password: PASSWORD,
    nickname: 'normaluser',
  });
  const userLogin = await request(app).post('/api/auth/login').send({
    email: USER_EMAIL,
    password: PASSWORD,
  });
  userToken = userLogin.body.data.accessToken;
});

afterAll(async () => {
  await prisma.reservation.deleteMany({});
  await prisma.concertZone.deleteMany({});
  await prisma.concert.deleteMany({});
  await prisma.refreshToken.deleteMany({});
  await prisma.user.deleteMany({ where: { email: { in: [ADMIN_EMAIL, USER_EMAIL] } } });
  await prisma.$disconnect();
  await redis.quit();
});

// ──────────────────────────────────────────
// POST /api/admin/concerts
// ──────────────────────────────────────────
describe('POST /api/admin/concerts', () => {
  it('AC1: ADMIN 정상 입력 시 201과 공연 정보 반환', async () => {
    const res = await request(app)
      .post('/api/admin/concerts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: '테스트 콘서트',
        artist: '테스트 아티스트',
        venue: '올림픽 공원',
        concertDate: '2026-12-01T18:00:00.000Z',
        saleStartAt: '2026-11-01T10:00:00.000Z',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      title: '테스트 콘서트',
      artist: '테스트 아티스트',
      status: 'SCHEDULED',
    });
    expect(res.body.data.id).toBeDefined();
    concertId = res.body.data.id;
  });

  it('AC2: USER role 접근 시 403 반환', async () => {
    const res = await request(app)
      .post('/api/admin/concerts')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        title: '테스트',
        artist: '아티스트',
        venue: '장소',
        concertDate: '2026-12-01T18:00:00.000Z',
        saleStartAt: '2026-11-01T10:00:00.000Z',
      });

    expect(res.status).toBe(403);
  });

  it('AC3: 필수 필드 누락 시 400 반환', async () => {
    const res = await request(app)
      .post('/api/admin/concerts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: '제목만' });

    expect(res.status).toBe(400);
  });
});

// ──────────────────────────────────────────
// PATCH /api/admin/concerts/:id
// ──────────────────────────────────────────
describe('PATCH /api/admin/concerts/:id', () => {
  it('AC4: 정상 수정 시 200과 수정된 정보 반환', async () => {
    const res = await request(app)
      .patch(`/api/admin/concerts/${concertId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: '수정된 콘서트' });

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('수정된 콘서트');
  });

  it('AC5: 존재하지 않는 공연 수정 시 404 반환', async () => {
    const res = await request(app)
      .patch('/api/admin/concerts/nonexistent-id')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: '수정' });

    expect(res.status).toBe(404);
  });
});

// ──────────────────────────────────────────
// POST /api/admin/concerts/:id/zones
// ──────────────────────────────────────────
describe('POST /api/admin/concerts/:id/zones', () => {
  it('AC8: 구역 등록 시 201, zone 정보 반환 + Redis stock 초기화', async () => {
    const res = await request(app)
      .post(`/api/admin/concerts/${concertId}/zones`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'VIP',
        price: 150000,
        totalQuantity: 100,
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      name: 'VIP',
      price: 150000,
      totalQuantity: 100,
      remainQuantity: 100,
    });
    zoneId = res.body.data.id;

    // Redis stock 초기화 확인
    const stock = await redis.get(`zone:${zoneId}:stock`);
    expect(stock).toBe('100');
  });

  it('AC8: 같은 공연에 동일 구역명 중복 등록 시 409 반환', async () => {
    const res = await request(app)
      .post(`/api/admin/concerts/${concertId}/zones`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'VIP',
        price: 200000,
        totalQuantity: 50,
      });

    expect(res.status).toBe(409);
  });
});

// ──────────────────────────────────────────
// PATCH /api/admin/zones/:id
// ──────────────────────────────────────────
describe('PATCH /api/admin/zones/:id', () => {
  it('AC9: 구역 수정 시 200과 수정된 구역 정보 반환', async () => {
    const res = await request(app)
      .patch(`/api/admin/zones/${zoneId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ price: 200000, totalQuantity: 120 });

    expect(res.status).toBe(200);
    expect(res.body.data.price).toBe(200000);
    expect(res.body.data.totalQuantity).toBe(120);

    // totalQuantity 변경 시 Redis stock도 동기화
    const stock = await redis.get(`zone:${zoneId}:stock`);
    expect(stock).toBe('120');
  });
});

// ──────────────────────────────────────────
// GET /api/admin/concerts/:id/stats
// ──────────────────────────────────────────
describe('GET /api/admin/concerts/:id/stats', () => {
  it('AC11: 판매 현황 조회 시 200과 구역별 현황 반환', async () => {
    const res = await request(app)
      .get(`/api/admin/concerts/${concertId}/stats`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.zones)).toBe(true);
    expect(res.body.data.zones[0]).toMatchObject({
      id: zoneId,
      name: 'VIP',
      totalQuantity: 120,
      remainQuantity: 120,
      reservationCount: 0,
    });
  });
});

// ──────────────────────────────────────────
// GET /api/concerts
// ──────────────────────────────────────────
describe('GET /api/concerts', () => {
  it('AC12: 공연 목록 조회 시 200과 배열 반환 (인증 불필요)', async () => {
    const res = await request(app).get('/api/concerts');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('AC12: status 필터로 조회 시 해당 status만 반환', async () => {
    const res = await request(app).get('/api/concerts?status=SCHEDULED');

    expect(res.status).toBe(200);
    res.body.data.forEach((c: { status: string }) => {
      expect(c.status).toBe('SCHEDULED');
    });
  });
});

// ──────────────────────────────────────────
// GET /api/concerts/:id
// ──────────────────────────────────────────
describe('GET /api/concerts/:id', () => {
  it('AC13: 공연 상세 조회 시 200과 공연 + 구역 정보 반환', async () => {
    const res = await request(app).get(`/api/concerts/${concertId}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(concertId);
    expect(Array.isArray(res.body.data.zones)).toBe(true);
    expect(res.body.data.zones.length).toBeGreaterThan(0);
  });

  it('AC14: 존재하지 않는 공연 조회 시 404 반환', async () => {
    const res = await request(app).get('/api/concerts/nonexistent-id');
    expect(res.status).toBe(404);
  });
});

// ──────────────────────────────────────────
// DELETE /api/admin/zones/:id
// ──────────────────────────────────────────
describe('DELETE /api/admin/zones/:id', () => {
  it('AC10: 구역 삭제 시 200 반환 + Redis stock 키 삭제', async () => {
    const res = await request(app)
      .delete(`/api/admin/zones/${zoneId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);

    // Redis 키도 삭제됐는지 확인
    const stock = await redis.get(`zone:${zoneId}:stock`);
    expect(stock).toBeNull();
  });
});

// ──────────────────────────────────────────
// DELETE /api/admin/concerts/:id
// ──────────────────────────────────────────
describe('DELETE /api/admin/concerts/:id', () => {
  it('AC6: 존재하는 공연 삭제 시 200 반환', async () => {
    const res = await request(app)
      .delete(`/api/admin/concerts/${concertId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
  });

  it('AC7: 존재하지 않는 공연 삭제 시 404 반환', async () => {
    const res = await request(app)
      .delete('/api/admin/concerts/nonexistent-id')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });
});
