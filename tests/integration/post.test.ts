import request from 'supertest';
import app from '../../src/index';
import { prisma } from '../../src/utils/prisma';

const USER_EMAIL = 'post_user@test.com';
const USER2_EMAIL = 'post_user2@test.com';
const ADMIN_EMAIL = 'post_admin@test.com';
const PASSWORD = 'password123';

let userToken: string;
let user2Token: string;
let adminToken: string;
let adminId: string;

// ──────────────────────────────────────────
// Setup / Teardown
// ──────────────────────────────────────────

beforeAll(async () => {
  await prisma.reply.deleteMany({});
  await prisma.post.deleteMany({});
  await prisma.refreshToken.deleteMany({});
  await prisma.user.deleteMany({
    where: { email: { in: [USER_EMAIL, USER2_EMAIL, ADMIN_EMAIL] } },
  });

  // 어드민 생성
  await request(app).post('/api/auth/register').send({
    email: ADMIN_EMAIL,
    password: PASSWORD,
    nickname: 'postadmin',
    role: 'ADMIN',
  });
  const adminLogin = await request(app).post('/api/auth/login').send({
    email: ADMIN_EMAIL,
    password: PASSWORD,
  });
  adminToken = adminLogin.body.data.accessToken;
  adminId = adminLogin.body.data.user.id;

  // 유저1 생성
  await request(app).post('/api/auth/register').send({
    email: USER_EMAIL,
    password: PASSWORD,
    nickname: 'postuser1',
  });
  const user1Login = await request(app).post('/api/auth/login').send({
    email: USER_EMAIL,
    password: PASSWORD,
  });
  userToken = user1Login.body.data.accessToken;

  // 유저2 생성
  await request(app).post('/api/auth/register').send({
    email: USER2_EMAIL,
    password: PASSWORD,
    nickname: 'postuser2',
  });
  const user2Login = await request(app).post('/api/auth/login').send({
    email: USER2_EMAIL,
    password: PASSWORD,
  });
  user2Token = user2Login.body.data.accessToken;
});

afterAll(async () => {
  await prisma.reply.deleteMany({});
  await prisma.post.deleteMany({});
  await prisma.refreshToken.deleteMany({});
  await prisma.user.deleteMany({
    where: { email: { in: [USER_EMAIL, USER2_EMAIL, ADMIN_EMAIL] } },
  });
});

afterEach(async () => {
  await prisma.reply.deleteMany({});
  await prisma.post.deleteMany({});
});

// ──────────────────────────────────────────
// 유저: POST /api/posts
// ──────────────────────────────────────────

describe('POST /api/posts', () => {
  it('AC1: 인증된 유저 + 유효한 title+content → 201, post 반환', async () => {
    const res = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ title: '문의 제목', content: '문의 내용입니다' });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      title: '문의 제목',
      content: '문의 내용입니다',
      status: 'PENDING',
    });
    expect(res.body.data.id).toBeDefined();
  });

  it('AC2: 미인증 → 401', async () => {
    const res = await request(app)
      .post('/api/posts')
      .send({ title: '문의 제목', content: '내용' });

    expect(res.status).toBe(401);
  });

  it('AC3: title 누락 → 400', async () => {
    const res = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ content: '내용만 있고 제목 없음' });

    expect(res.status).toBe(400);
  });
});

// ──────────────────────────────────────────
// 유저: GET /api/posts
// ──────────────────────────────────────────

describe('GET /api/posts', () => {
  it('AC4: 본인 문의만 반환 (다른 유저 문의 미포함)', async () => {
    // 유저1 문의 2개, 유저2 문의 1개 생성
    await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ title: '유저1 첫 문의', content: '내용1' });
    await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ title: '유저1 두번째 문의', content: '내용2' });
    await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${user2Token}`)
      .send({ title: '유저2 문의', content: '내용3' });

    const res = await request(app)
      .get('/api/posts')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    res.body.data.forEach((p: { title: string }) => {
      expect(p.title).toContain('유저1');
    });
  });
});

// ──────────────────────────────────────────
// 유저: GET /api/posts/:id
// ──────────────────────────────────────────

describe('GET /api/posts/:id', () => {
  it('AC5: 본인 PENDING 문의 → 200, reply: null', async () => {
    const createRes = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ title: '상세 조회 문의', content: '상세 내용' });
    const postId = createRes.body.data.id;

    const res = await request(app)
      .get(`/api/posts/${postId}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.reply).toBeNull();
    expect(res.body.data.content).toBe('상세 내용');
  });

  it('AC6: 본인 ANSWERED 문의 → 200, reply 포함', async () => {
    const createRes = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ title: '답변된 문의', content: '내용' });
    const postId = createRes.body.data.id;

    // 어드민 답변 등록
    await request(app)
      .post(`/api/admin/posts/${postId}/reply`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ content: '관리자 답변입니다' });

    const res = await request(app)
      .get(`/api/posts/${postId}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ANSWERED');
    expect(res.body.data.reply).toMatchObject({ content: '관리자 답변입니다' });
  });

  it('AC7: 타인 문의 → 403', async () => {
    const createRes = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${user2Token}`)
      .send({ title: '유저2 문의', content: '내용' });
    const postId = createRes.body.data.id;

    const res = await request(app)
      .get(`/api/posts/${postId}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(403);
  });

  it('AC8: 존재하지 않는 id → 404', async () => {
    const res = await request(app)
      .get('/api/posts/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(404);
  });
});

// ──────────────────────────────────────────
// 유저: DELETE /api/posts/:id
// ──────────────────────────────────────────

describe('DELETE /api/posts/:id', () => {
  it('AC9: 본인 PENDING 문의 → 200, 삭제 완료', async () => {
    const createRes = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ title: '삭제할 문의', content: '내용' });
    const postId = createRes.body.data.id;

    const res = await request(app)
      .delete(`/api/posts/${postId}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);

    const deleted = await prisma.post.findUnique({ where: { id: postId } });
    expect(deleted).toBeNull();
  });

  it('AC10: 본인 ANSWERED 문의 삭제 시도 → 400', async () => {
    const createRes = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ title: '답변된 문의', content: '내용' });
    const postId = createRes.body.data.id;

    await request(app)
      .post(`/api/admin/posts/${postId}/reply`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ content: '답변' });

    const res = await request(app)
      .delete(`/api/posts/${postId}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(400);
  });

  it('AC11: 타인 문의 삭제 시도 → 403', async () => {
    const createRes = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${user2Token}`)
      .send({ title: '유저2 문의', content: '내용' });
    const postId = createRes.body.data.id;

    const res = await request(app)
      .delete(`/api/posts/${postId}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(403);
  });
});

// ──────────────────────────────────────────
// 어드민: GET /api/admin/posts
// ──────────────────────────────────────────

describe('GET /api/admin/posts', () => {
  it('AC12: 어드민 → 200, 전체 유저 문의 반환 (userId, userNickname 포함)', async () => {
    await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ title: '유저1 문의', content: '내용1' });
    await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${user2Token}`)
      .send({ title: '유저2 문의', content: '내용2' });

    const res = await request(app)
      .get('/api/admin/posts')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    expect(res.body.data[0]).toHaveProperty('userId');
    expect(res.body.data[0]).toHaveProperty('userNickname');
  });

  it('AC13: 일반 유저 → 403', async () => {
    const res = await request(app)
      .get('/api/admin/posts')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(403);
  });
});

// ──────────────────────────────────────────
// 어드민: POST /api/admin/posts/:id/reply
// ──────────────────────────────────────────

describe('POST /api/admin/posts/:id/reply', () => {
  it('AC14: 어드민 + PENDING 문의 → 201, reply 생성 + post status ANSWERED', async () => {
    const createRes = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ title: '답변 대기 문의', content: '내용' });
    const postId = createRes.body.data.id;

    const res = await request(app)
      .post(`/api/admin/posts/${postId}/reply`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ content: '관리자 답변입니다' });

    expect(res.status).toBe(201);
    expect(res.body.data.content).toBe('관리자 답변입니다');

    const post = await prisma.post.findUnique({ where: { id: postId } });
    expect(post?.status).toBe('ANSWERED');
  });

  it('AC15: 이미 reply 존재 → 409', async () => {
    const createRes = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ title: '이미 답변된 문의', content: '내용' });
    const postId = createRes.body.data.id;

    await request(app)
      .post(`/api/admin/posts/${postId}/reply`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ content: '첫 번째 답변' });

    const res = await request(app)
      .post(`/api/admin/posts/${postId}/reply`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ content: '두 번째 답변 시도' });

    expect(res.status).toBe(409);
  });
});

// ──────────────────────────────────────────
// 어드민: PATCH /api/admin/posts/:id/reply
// ──────────────────────────────────────────

describe('PATCH /api/admin/posts/:id/reply', () => {
  it('AC16: 어드민 + reply 있음 → 200, 내용 수정', async () => {
    const createRes = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ title: '수정할 답변 문의', content: '내용' });
    const postId = createRes.body.data.id;

    await request(app)
      .post(`/api/admin/posts/${postId}/reply`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ content: '원래 답변' });

    const res = await request(app)
      .patch(`/api/admin/posts/${postId}/reply`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ content: '수정된 답변' });

    expect(res.status).toBe(200);
    expect(res.body.data.content).toBe('수정된 답변');
  });

  it('AC17: reply 없음 → 404', async () => {
    const createRes = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ title: '답변 없는 문의', content: '내용' });
    const postId = createRes.body.data.id;

    const res = await request(app)
      .patch(`/api/admin/posts/${postId}/reply`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ content: '수정 시도' });

    expect(res.status).toBe(404);
  });
});
