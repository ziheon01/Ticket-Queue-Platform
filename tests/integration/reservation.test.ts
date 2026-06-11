import request from 'supertest';
import app from '../../src/index';
import { prisma } from '../../src/utils/prisma';
import { redis } from '../../src/utils/redis';
import { stockKey, lockKey } from '../../src/repositories/reservation.repository';
import { admittedKey } from '../../src/repositories/queue.repository';

const USER_EMAIL = 'res_user@test.com';
const USER2_EMAIL = 'res_user2@test.com';
const ADMIN_EMAIL = 'res_admin@test.com';
const PASSWORD = 'password123';

let userToken: string;
let userId: string;
let user2Token: string;
let adminToken: string;
let concertId: string;
let zoneId: string;
let zonePrice: number;

// ──────────────────────────────────────────
// Setup / Teardown
// ──────────────────────────────────────────

beforeAll(async () => {
  await prisma.payment.deleteMany({});
  await prisma.reservation.deleteMany({});
  await prisma.concertZone.deleteMany({});
  await prisma.concert.deleteMany({});
  await prisma.refreshToken.deleteMany({});
  await prisma.user.deleteMany({
    where: { email: { in: [USER_EMAIL, USER2_EMAIL, ADMIN_EMAIL] } },
  });

  // 어드민 생성
  await request(app).post('/api/auth/register').send({
    email: ADMIN_EMAIL,
    password: PASSWORD,
    nickname: 'resadmin',
    role: 'ADMIN',
  });
  const adminLogin = await request(app).post('/api/auth/login').send({
    email: ADMIN_EMAIL,
    password: PASSWORD,
  });
  adminToken = adminLogin.body.data.accessToken;

  // 유저1 생성
  await request(app).post('/api/auth/register').send({
    email: USER_EMAIL,
    password: PASSWORD,
    nickname: 'resuser1',
  });
  const user1Login = await request(app).post('/api/auth/login').send({
    email: USER_EMAIL,
    password: PASSWORD,
  });
  userToken = user1Login.body.data.accessToken;
  userId = user1Login.body.data.user.id;

  // 유저2 생성
  await request(app).post('/api/auth/register').send({
    email: USER2_EMAIL,
    password: PASSWORD,
    nickname: 'resuser2',
  });
  const user2Login = await request(app).post('/api/auth/login').send({
    email: USER2_EMAIL,
    password: PASSWORD,
  });
  user2Token = user2Login.body.data.accessToken;

  // ON_SALE 공연 + 구역 생성
  const saleStartAt = new Date(Date.now() - 60_000).toISOString(); // 1분 전 판매 시작
  const concertRes = await request(app)
    .post('/api/admin/concerts')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      title: '테스트 콘서트',
      artist: '테스트 아티스트',
      venue: '올림픽 공원',
      concertDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      saleStartAt,
    });
  concertId = concertRes.body.data.id;

  // 수동으로 ON_SALE 상태 전환
  await prisma.concert.update({ where: { id: concertId }, data: { status: 'ON_SALE' } });

  zonePrice = 50000;
  const zoneRes = await request(app)
    .post(`/api/admin/concerts/${concertId}/zones`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'VIP', price: zonePrice, totalQuantity: 10 });
  zoneId = zoneRes.body.data.id;
});

afterAll(async () => {
  await prisma.payment.deleteMany({});
  await prisma.reservation.deleteMany({});
  await prisma.concertZone.deleteMany({});
  await prisma.concert.deleteMany({});
  await prisma.refreshToken.deleteMany({});
  await prisma.user.deleteMany({
    where: { email: { in: [USER_EMAIL, USER2_EMAIL, ADMIN_EMAIL] } },
  });
  // Redis 정리
  const keys = await redis.keys(`zone:*`);
  const queueKeys = await redis.keys(`queue:*`);
  if (keys.length > 0) await redis.del(...keys);
  if (queueKeys.length > 0) await redis.del(...queueKeys);
});

afterEach(async () => {
  // 각 테스트 후 예매/결제 초기화
  await prisma.payment.deleteMany({});
  await prisma.reservation.deleteMany({});
  // Redis lock 정리
  const keys = await redis.keys(`zone:${zoneId}:lock:*`);
  if (keys.length > 0) await redis.del(...keys);
  // stock 초기화 (10개)
  await redis.set(stockKey(zoneId), '10');
});

// ──────────────────────────────────────────
// Helper: admitted 키 설정
// ──────────────────────────────────────────

async function setAdmitted(uId: string): Promise<void> {
  await redis.set(admittedKey(concertId, uId), '1', 'EX', 300);
}

// ──────────────────────────────────────────
// AC1: 정상 선점
// ──────────────────────────────────────────

describe('POST /api/reservations', () => {
  it('AC1: 입장된 유저 + 유효한 구역/수량 → 201, reservationId/totalPrice/remainSeconds', async () => {
    await setAdmitted(userId);

    const res = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ concertZoneId: zoneId, quantity: 2 });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      reservationId: expect.any(String),
      totalPrice: zonePrice * 2,
      remainSeconds: 300,
    });
  });

  it('AC2: 미입장 유저 → 403 Forbidden', async () => {
    const res = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ concertZoneId: zoneId, quantity: 1 });

    expect(res.status).toBe(403);
  });

  it('AC3: 수량 0 → 400 Bad Request', async () => {
    await setAdmitted(userId);
    const res = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ concertZoneId: zoneId, quantity: 0 });
    expect(res.status).toBe(400);
  });

  it('AC3: 수량 5 → 400 Bad Request', async () => {
    await setAdmitted(userId);
    const res = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ concertZoneId: zoneId, quantity: 5 });
    expect(res.status).toBe(400);
  });

  it('AC4: 재고 부족 → 409 Conflict', async () => {
    await redis.set(stockKey(zoneId), '1'); // 재고 1개
    await setAdmitted(userId);

    const res = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ concertZoneId: zoneId, quantity: 2 }); // 2장 요청

    expect(res.status).toBe(409);

    // 재고가 복구되지 않고 그대로여야 함
    const stock = await redis.get(stockKey(zoneId));
    expect(stock).toBe('1');
  });

  it('AC5: 이미 선점 중인 유저 → 409 Conflict', async () => {
    await setAdmitted(userId);
    // 미리 lock 키 세팅
    await redis.set(lockKey(zoneId, userId), 'existing-reservation', 'EX', 300);

    const res = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ concertZoneId: zoneId, quantity: 1 });

    expect(res.status).toBe(409);
  });
});

// ──────────────────────────────────────────
// AC6~8: 예매 조회
// ──────────────────────────────────────────

describe('GET /api/reservations', () => {
  it('AC6: 내 예매 목록 조회', async () => {
    await setAdmitted(userId);
    await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ concertZoneId: zoneId, quantity: 1 });

    const res = await request(app)
      .get('/api/reservations')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });
});

describe('GET /api/reservations/:id', () => {
  it('AC7: 본인 예매 상세 조회 → 200 + 공연/구역/결제 포함', async () => {
    await setAdmitted(userId);
    const createRes = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ concertZoneId: zoneId, quantity: 1 });
    const reservationId = createRes.body.data.reservationId;

    const res = await request(app)
      .get(`/api/reservations/${reservationId}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: reservationId,
      status: 'PENDING',
      concertZone: {
        concert: { title: '테스트 콘서트' },
      },
    });
  });

  it('AC8: 타인 예매 조회 → 403 Forbidden', async () => {
    await setAdmitted(userId);
    const createRes = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ concertZoneId: zoneId, quantity: 1 });
    const reservationId = createRes.body.data.reservationId;

    const res = await request(app)
      .get(`/api/reservations/${reservationId}`)
      .set('Authorization', `Bearer ${user2Token}`);

    expect(res.status).toBe(403);
  });
});

// ──────────────────────────────────────────
// AC9~10: 예매 취소
// ──────────────────────────────────────────

describe('DELETE /api/reservations/:id', () => {
  it('AC9: PENDING 예매 취소 → 200, 재고 복구됨', async () => {
    await redis.set(stockKey(zoneId), '10');
    await setAdmitted(userId);
    const createRes = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ concertZoneId: zoneId, quantity: 2 });
    const reservationId = createRes.body.data.reservationId;

    const stockAfterCreate = await redis.get(stockKey(zoneId));
    expect(stockAfterCreate).toBe('8'); // 10 - 2

    const res = await request(app)
      .delete(`/api/reservations/${reservationId}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);

    const stockAfterCancel = await redis.get(stockKey(zoneId));
    expect(stockAfterCancel).toBe('10'); // 복구됨

    const reservation = await prisma.reservation.findUnique({ where: { id: reservationId } });
    expect(reservation?.status).toBe('CANCELLED');
  });

  it('AC10: CONFIRMED 예매 취소 시도 → 400 Bad Request', async () => {
    // DB에 직접 CONFIRMED 예매 생성
    const reservation = await prisma.reservation.create({
      data: {
        userId,
        concertZoneId: zoneId,
        quantity: 1,
        totalPrice: zonePrice,
        status: 'CONFIRMED',
      },
    });

    const res = await request(app)
      .delete(`/api/reservations/${reservation.id}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(400);
  });
});

// ──────────────────────────────────────────
// AC11~13: 결제 시간 연장
// ──────────────────────────────────────────

describe('POST /api/reservations/:id/extend', () => {
  it('AC11: TTL 60초 이하 & 연장 이력 없음 → 200, remainSeconds: 300', async () => {
    await setAdmitted(userId);
    const createRes = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ concertZoneId: zoneId, quantity: 1 });
    const reservationId = createRes.body.data.reservationId;

    // lock TTL을 55초로 줄임 (1분 이하)
    await redis.expire(lockKey(zoneId, userId), 55);

    const res = await request(app)
      .post(`/api/reservations/${reservationId}/extend`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.remainSeconds).toBe(300);

    const newTtl = await redis.ttl(lockKey(zoneId, userId));
    expect(newTtl).toBeGreaterThan(299);
  });

  it('AC12: 이미 연장한 경우 → 409 Conflict', async () => {
    const reservation = await prisma.reservation.create({
      data: {
        userId,
        concertZoneId: zoneId,
        quantity: 1,
        totalPrice: zonePrice,
        status: 'PENDING',
        extendedAt: new Date(),
      },
    });
    await redis.set(lockKey(zoneId, userId), reservation.id, 'EX', 50);

    const res = await request(app)
      .post(`/api/reservations/${reservation.id}/extend`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(409);
  });

  it('AC13: TTL 60초 초과 → 400 Bad Request', async () => {
    await setAdmitted(userId);
    const createRes = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ concertZoneId: zoneId, quantity: 1 });
    const reservationId = createRes.body.data.reservationId;
    // lock TTL은 300초 (연장 불가 시간)

    const res = await request(app)
      .post(`/api/reservations/${reservationId}/extend`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(400);
  });
});

// ──────────────────────────────────────────
// AC14: Webhook 처리
// ──────────────────────────────────────────

describe('POST /api/payments/webhook', () => {
  it('AC14: status DONE → 200, Reservation CONFIRMED + lock 해제', async () => {
    await setAdmitted(userId);
    const createRes = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ concertZoneId: zoneId, quantity: 1 });
    const reservationId = createRes.body.data.reservationId;

    const res = await request(app)
      .post('/api/payments/webhook')
      .send({
        paymentKey: 'toss_test_paymentkey_123',
        orderId: reservationId,
        status: 'DONE',
        totalAmount: zonePrice,
      });

    expect(res.status).toBe(200);

    const reservation = await prisma.reservation.findUnique({ where: { id: reservationId } });
    expect(reservation?.status).toBe('CONFIRMED');

    const payment = await prisma.payment.findUnique({ where: { reservationId } });
    expect(payment?.status).toBe('DONE');
    expect(payment?.paymentKey).toBe('toss_test_paymentkey_123');

    // lock 해제됨
    const lockExists = await redis.exists(lockKey(zoneId, userId));
    expect(lockExists).toBe(0);
  });
});
