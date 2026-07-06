import 'dotenv/config';
import axios from 'axios';
import Redis from 'ioredis';

const BASE_URL = process.env.API_URL ?? 'http://localhost:3001';
const CONCERT_ID = process.env.CONCERT_ID;

if (!CONCERT_ID) {
  console.error('❌  CONCERT_ID 환경변수를 설정해주세요.');
  console.error('    예: CONCERT_ID=<id> npx ts-node scripts/test-queue.ts');
  process.exit(1);
}

const redis = new Redis({ host: 'localhost', port: 6380 });

const USERS = Array.from({ length: 10 }, (_, i) => ({
  email: `test${i + 1}@test.com`,
  password: 'test1234!',
}));

// ── Step 1: 10명 동시 로그인 ─────────────────────────────────────────────────

async function login(email: string, password: string): Promise<string> {
  const res = await axios.post(`${BASE_URL}/api/auth/login`, { email, password });
  return res.data.data.accessToken as string;
}

// ── Step 2: 10명 동시 대기열 진입 ────────────────────────────────────────────

interface EnterResult {
  user: string;
  position: number;
  total: number;
  error?: string;
}

async function enterQueue(token: string, label: string): Promise<EnterResult> {
  try {
    const res = await axios.post(
      `${BASE_URL}/api/queue/${CONCERT_ID}/enter`,
      {},
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const { position, total } = res.data.data;
    return { user: label, position, total };
  } catch (err) {
    const msg = axios.isAxiosError(err)
      ? (err.response?.data?.message ?? err.message)
      : String(err);
    return { user: label, position: -1, total: -1, error: msg };
  }
}

// ── 표 출력 ───────────────────────────────────────────────────────────────────

function printTable(rows: EnterResult[]) {
  const sorted = [...rows].sort((a, b) => a.position - b.position);
  const COL = { user: 12, pos: 8, total: 7 };

  const line = (c: string) =>
    `${c}${'─'.repeat(COL.user + 2)}${c}${'─'.repeat(COL.pos + 2)}${c}${'─'.repeat(COL.total + 2)}${c}`;

  const cell = (v: string | number, w: number) => {
    const s = String(v);
    const pad = w - s.length;
    return ` ${' '.repeat(Math.floor(pad / 2))}${s}${' '.repeat(Math.ceil(pad / 2))} `;
  };

  console.log(line('┌').replace(/─/g, '─'));
  console.log(`│${cell('유저', COL.user)}│${cell('순번', COL.pos)}│${cell('전체', COL.total)}│`);
  console.log(line('├'));
  for (const r of sorted) {
    const posStr = r.error ? 'ERR' : String(r.position);
    const totalStr = r.error ? r.error.slice(0, COL.total) : String(r.total);
    console.log(`│${cell(r.user, COL.user)}│${cell(posStr, COL.pos)}│${cell(totalStr, COL.total)}│`);
  }
  console.log(line('└'));
}

// ── Step 4: 대기열 상태 조회 ─────────────────────────────────────────────────

async function printStatus(token: string) {
  try {
    const res = await axios.get(`${BASE_URL}/api/queue/${CONCERT_ID}/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log('\n📋  GET /api/queue/:concertId/status (test1 기준)');
    console.log(JSON.stringify(res.data.data, null, 2));
  } catch (err) {
    console.warn('status 조회 실패:', axios.isAxiosError(err) ? err.response?.data : err);
  }
}

// ── Step 5: Redis ZCARD 확인 ─────────────────────────────────────────────────

async function printRedisCount() {
  const key = `queue:${CONCERT_ID}:waiting`;
  const count = await redis.zcard(key);
  console.log(`\n🔴  Redis ZCARD ${key} = ${count}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🎫  대기열 동시 진입 테스트 (CONCERT_ID: ${CONCERT_ID})\n`);

  // Step 1: 동시 로그인
  console.log('1️⃣   10명 동시 로그인 중...');
  const loginResults = await Promise.allSettled(USERS.map((u) => login(u.email, u.password)));

  const tokens: { label: string; token: string }[] = [];
  for (let i = 0; i < loginResults.length; i++) {
    const r = loginResults[i];
    if (r.status === 'fulfilled') {
      tokens.push({ label: `test${i + 1}`, token: r.value });
    } else {
      console.warn(`  ⚠️  test${i + 1} 로그인 실패:`, r.reason?.message ?? r.reason);
    }
  }
  console.log(`   ✅  ${tokens.length}/10명 로그인 성공\n`);

  // Step 2: 동시 대기열 진입
  console.log('2️⃣   10명 동시 대기열 진입 중...');
  const enterResults = await Promise.all(
    tokens.map(({ label, token }) => enterQueue(token, label)),
  );
  console.log('   ✅  완료\n');

  // Step 3: 결과 표 출력
  console.log('3️⃣   진입 결과:');
  printTable(enterResults);

  // Step 4: 상태 조회
  if (tokens.length > 0) {
    await printStatus(tokens[0].token);
  }

  // Step 5: Redis 확인
  await printRedisCount();

  console.log('\n✅  테스트 완료\n');
}

main()
  .catch((err) => {
    console.error('❌  예상치 못한 오류:', err);
    process.exit(1);
  })
  .finally(() => redis.quit());
