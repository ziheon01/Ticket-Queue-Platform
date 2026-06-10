import { createServer } from 'http';
import type { AddressInfo } from 'net';
import request from 'supertest';
import { io as ioc, Socket } from 'socket.io-client';
import app from '../../src/index';
import { initSocket } from '../../src/utils/socket';
import { registerQueueSocket } from '../../src/socket/queue.socket';
import { prisma } from '../../src/utils/prisma';
import { redis } from '../../src/utils/redis';

const USER_EMAIL = 'queue_user@test.com';
const USER2_EMAIL = 'queue_user2@test.com';
const PASSWORD = 'password123';

let userToken: string;
let userId: string;
let user2Token: string;
let concertId: string;
let serverPort: number;

function connectSocket(token: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = ioc(`http://localhost:${serverPort}`, {
      auth: { token },
      transports: ['websocket'],
    });
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

function waitForEvent<T>(socket: Socket, event: string): Promise<T> {
  return new Promise((resolve) => {
    socket.once(event, resolve);
  });
}

// ──────────────────────────────────────────
// Setup / Teardown
// ──────────────────────────────────────────

beforeAll(async () => {
  // 테스트 데이터 정리
  await prisma.reservation.deleteMany({});
  await prisma.concertZone.deleteMany({});
  await prisma.concert.deleteMany({});
  await prisma.refreshToken.deleteMany({});
  await prisma.user.deleteMany({ where: { email: { in: [USER_EMAIL, USER2_EMAIL] } } });

  // 유저 생성 + 로그인
  await request(app).post('/api/auth/register').send({
    email: USER_EMAIL,
    password: PASSWORD,
    nickname: 'queueuser1',
  });
  const loginRes = await request(app).post('/api/auth/login').send({
    email: USER_EMAIL,
    password: PASSWORD,
  });
  userToken = loginRes.body.data.accessToken;
  userId = loginRes.body.data.user?.id;

  await request(app).post('/api/auth/register').send({
    email: USER2_EMAIL,
    password: PASSWORD,
    nickname: 'queueuser2',
  });
  const loginRes2 = await request(app).post('/api/auth/login').send({
    email: USER2_EMAIL,
    password: PASSWORD,
  });
  user2Token = loginRes2.body.data.accessToken;

  // ADMIN 생성 후 공연 등록
  await prisma.user.upsert({
    where: { email: 'queue_admin@test.com' },
    update: {},
    create: { email: 'queue_admin@test.com', password: 'x', nickname: 'qa', role: 'ADMIN' },
  });
  const adminLoginRes = await request(app).post('/api/auth/login').send({
    email: 'queue_admin@test.com',
    password: 'x',
  });

  // 로그인 실패 시 직접 DB로 공연 생성
  const concert = await prisma.concert.create({
    data: {
      title: '대기열 테스트 콘서트',
      artist: '테스트 아티스트',
      venue: '테스트 홀',
      concertDate: new Date('2026-12-01T18:00:00.000Z'),
      saleStartAt: new Date('2026-06-01T10:00:00.000Z'),
      status: 'ON_SALE',
    },
  });
  concertId = concert.id;

  // Socket.io 테스트용 서버 시작
  const httpServer = createServer(app);
  const ioServer = initSocket(httpServer);
  registerQueueSocket(ioServer);
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  serverPort = (httpServer.address() as AddressInfo).port;

  // userId 취득 (AC8용)
  const dbUser = await prisma.user.findUnique({ where: { email: USER_EMAIL } });
  userId = dbUser!.id;
});

afterAll(async () => {
  // Redis 대기열 키 정리
  const keys = await redis.keys(`queue:${concertId}:*`);
  if (keys.length > 0) await redis.del(...keys);

  await prisma.reservation.deleteMany({});
  await prisma.concertZone.deleteMany({});
  await prisma.concert.deleteMany({});
  await prisma.refreshToken.deleteMany({});
  await prisma.user.deleteMany({
    where: { email: { in: [USER_EMAIL, USER2_EMAIL, 'queue_admin@test.com'] } },
  });
  await prisma.$disconnect();
  await redis.quit();
});

beforeEach(async () => {
  // 각 테스트 전 대기열 초기화
  const keys = await redis.keys(`queue:${concertId}:*`);
  if (keys.length > 0) await redis.del(...keys);
});

// ──────────────────────────────────────────
// REST — POST /api/queue/:concertId/enter
// ──────────────────────────────────────────

describe('POST /api/queue/:concertId/enter', () => {
  it('AC1: 인증된 유저, ON_SALE 공연 → 200, { position, total }', async () => {
    const res = await request(app)
      .post(`/api/queue/${concertId}/enter`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({ position: 1, total: 1 });
  });

  it('AC2: 이미 대기 중인 유저 → 409', async () => {
    await request(app)
      .post(`/api/queue/${concertId}/enter`)
      .set('Authorization', `Bearer ${userToken}`);

    const res = await request(app)
      .post(`/api/queue/${concertId}/enter`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(409);
  });

  it('AC3: ON_SALE이 아닌 공연 → 400', async () => {
    const scheduledConcert = await prisma.concert.create({
      data: {
        title: '예정 콘서트',
        artist: '아티스트',
        venue: '홀',
        concertDate: new Date('2027-01-01T18:00:00.000Z'),
        saleStartAt: new Date('2027-01-01T10:00:00.000Z'),
        status: 'SCHEDULED',
      },
    });

    const res = await request(app)
      .post(`/api/queue/${scheduledConcert.id}/enter`)
      .set('Authorization', `Bearer ${userToken}`);

    await prisma.concert.delete({ where: { id: scheduledConcert.id } });
    expect(res.status).toBe(400);
  });

  it('AC4: 미인증 → 401', async () => {
    const res = await request(app).post(`/api/queue/${concertId}/enter`);
    expect(res.status).toBe(401);
  });
});

// ──────────────────────────────────────────
// REST — DELETE /api/queue/:concertId/leave
// ──────────────────────────────────────────

describe('DELETE /api/queue/:concertId/leave', () => {
  it('AC5: 정상 이탈 → 200', async () => {
    await request(app)
      .post(`/api/queue/${concertId}/enter`)
      .set('Authorization', `Bearer ${userToken}`);

    const res = await request(app)
      .delete(`/api/queue/${concertId}/leave`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
  });

  it('AC6: 대기 중이 아닌 유저 → 404', async () => {
    const res = await request(app)
      .delete(`/api/queue/${concertId}/leave`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(404);
  });
});

// ──────────────────────────────────────────
// REST — GET /api/queue/:concertId/status
// ──────────────────────────────────────────

describe('GET /api/queue/:concertId/status', () => {
  it('AC7: 대기 중인 유저 → status=WAITING, position, total', async () => {
    await request(app)
      .post(`/api/queue/${concertId}/enter`)
      .set('Authorization', `Bearer ${userToken}`);

    const res = await request(app)
      .get(`/api/queue/${concertId}/status`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'WAITING', position: 1, total: 1 });
  });

  it('AC8: 입장 완료된 유저 → status=ADMITTED', async () => {
    // admitted 키 직접 설정
    await redis.set(`queue:${concertId}:admitted:${userId}`, '1', 'EX', 300);

    const res = await request(app)
      .get(`/api/queue/${concertId}/status`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'ADMITTED' });
  });

  it('AC9: 대기 중 아님 → status=NOT_IN_QUEUE', async () => {
    const res = await request(app)
      .get(`/api/queue/${concertId}/status`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'NOT_IN_QUEUE' });
  });
});

// ──────────────────────────────────────────
// WebSocket
// ──────────────────────────────────────────

describe('WebSocket 대기열 이벤트', () => {
  it('AC10: queue:enter → 본인과 동일 공연 대기자에게 queue:position 브로드캐스트', async () => {
    const client1 = await connectSocket(userToken);
    const client2 = await connectSocket(user2Token);

    // user2가 먼저 진입
    const pos2Promise = waitForEvent<{ position: number; total: number }>(client2, 'queue:position');
    client2.emit('queue:enter', { concertId });
    const pos2 = await pos2Promise;
    expect(pos2).toMatchObject({ position: 1, total: 1 });

    // user1 진입 → user2에게도 업데이트
    const posUpdate2Promise = waitForEvent<{ position: number; total: number }>(
      client2,
      'queue:position',
    );
    const pos1Promise = waitForEvent<{ position: number; total: number }>(client1, 'queue:position');
    client1.emit('queue:enter', { concertId });

    const pos1 = await pos1Promise;
    const posUpdate2 = await posUpdate2Promise;

    expect(pos1.total).toBe(2);
    expect(posUpdate2.total).toBe(2);

    client1.disconnect();
    client2.disconnect();
  });

  it('AC11: queue:leave → 남은 대기자에게 queue:position 브로드캐스트', async () => {
    const client1 = await connectSocket(userToken);
    const client2 = await connectSocket(user2Token);

    // 두 유저 진입
    await new Promise<void>((resolve) => {
      client1.emit('queue:enter', { concertId });
      client1.once('queue:position', () => resolve());
    });
    await new Promise<void>((resolve) => {
      client2.emit('queue:enter', { concertId });
      client2.once('queue:position', () => resolve());
    });

    // user1 이탈 → user2 순번 업데이트
    const posUpdate2Promise = waitForEvent<{ position: number; total: number }>(
      client2,
      'queue:position',
    );
    client1.emit('queue:leave', { concertId });
    const posUpdate2 = await posUpdate2Promise;

    expect(posUpdate2).toMatchObject({ position: 1, total: 1 });

    client1.disconnect();
    client2.disconnect();
  });

  it('AC13: disconnect 후 30초 내 queue:reconnect → 기존 순번 복원', async () => {
    const client = await connectSocket(userToken);

    // 진입
    await new Promise<void>((resolve) => {
      client.emit('queue:enter', { concertId });
      client.once('queue:position', () => resolve());
    });

    // 연결 끊기 (서버 측에 reconnect 키 생성됨)
    client.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 100));

    // 30초 내 재접속
    const newClient = await connectSocket(userToken);
    const posPromise = waitForEvent<{ position: number; total: number }>(
      newClient,
      'queue:position',
    );
    newClient.emit('queue:reconnect', { concertId });
    const pos = await posPromise;

    expect(pos.position).toBe(1);
    newClient.disconnect();
  });

  it('AC14: 대기열 1위 유저 입장 처리 → queue:admitted 수신', async () => {
    const client = await connectSocket(userToken);

    // 진입
    await new Promise<void>((resolve) => {
      client.emit('queue:enter', { concertId });
      client.once('queue:position', () => resolve());
    });

    const admittedPromise = waitForEvent<void>(client, 'queue:admitted');

    // 서비스 레이어 직접 호출로 입장 처리 트리거
    const { admitNextUser } = await import('../../src/services/queue.service');
    await admitNextUser(concertId);

    await admittedPromise;
    client.disconnect();
  });
});
