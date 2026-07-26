import 'dotenv/config';
import axios from 'axios';
import Redis from 'ioredis';
import bcrypt from 'bcrypt';
import { prisma } from '../src/utils/prisma';

const BASE_URL = process.env.API_URL ?? 'http://localhost:3001';
const CONCERT_ID = process.env.CONCERT_ID;
const SCALES = (process.env.SCALES ?? '100,200').split(',').map((s) => Number(s.trim()));
const REPEAT = Number(process.env.REPEAT ?? 3);

if (!CONCERT_ID) {
  console.error('❌  CONCERT_ID 환경변수를 설정해주세요.');
  console.error('    예: CONCERT_ID=<id> npx ts-node scripts/test-queue.ts');
  process.exit(1);
}

const redis = new Redis({ host: 'localhost', port: 6380 });

// ── 유저 시드: test1..testN@test.com 자동 생성 (이미 있으면 skip) ────────────

async function ensureTestUsers(count: number): Promise<void> {
  const passwordHash = await bcrypt.hash('test1234!', 10);
  await Promise.all(
    Array.from({ length: count }, (_, i) => {
      const email = `test${i + 1}@test.com`;
      return prisma.user.upsert({
        where: { email },
        update: {},
        create: { email, password: passwordHash, nickname: `테스터${i + 1}`, role: 'USER' },
      });
    }),
  );
  console.log(`👥  test1~test${count}@test.com 시드 확인 완료`);
}

// ── 로그인 ────────────────────────────────────────────────────────────────────

async function login(email: string, password: string): Promise<string> {
  const res = await axios.post(`${BASE_URL}/api/auth/login`, { email, password });
  return res.data.data.accessToken as string;
}

// ── 대기열 진입 ────────────────────────────────────────────────────────────────

interface EnterResult {
  user: string;
  position: number;
  total: number;
  latencyMs: number;
  error?: string;
}

async function enterQueue(token: string, label: string): Promise<EnterResult> {
  const start = performance.now();
  try {
    const res = await axios.post(
      `${BASE_URL}/api/queue/${CONCERT_ID}/enter`,
      {},
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const latencyMs = performance.now() - start;
    const { position, total } = res.data.data;
    return { user: label, position, total, latencyMs };
  } catch (err) {
    const latencyMs = performance.now() - start;
    const msg = axios.isAxiosError(err)
      ? (err.response?.data?.message ?? err.message)
      : String(err);
    return { user: label, position: -1, total: -1, latencyMs, error: msg };
  }
}

// ── 응답 시간 통계 ────────────────────────────────────────────────────────────

interface LatencyStats {
  min: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.min(Math.max(idx, 0), sorted.length - 1)];
}

function computeLatencyStats(latencies: number[]): LatencyStats {
  const sorted = [...latencies].sort((a, b) => a - b);
  const avg = sorted.reduce((sum, v) => sum + v, 0) / sorted.length;
  return {
    min: sorted[0],
    avg,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    max: sorted[sorted.length - 1],
  };
}

function avgOf(nums: number[]): number {
  return nums.reduce((sum, v) => sum + v, 0) / nums.length;
}

// ── Redis 큐 상태 초기화 (반복 측정을 위한 클린 슬레이트) ────────────────────
// admitNextUser는 admittedCount === 0 일 때만 1명을 입장시키므로,
// 매 iteration 시작 전 waiting/admitted 키를 모두 지워 0명 상태에서 출발한다.

async function resetQueueState(concertId: string): Promise<void> {
  await redis.del(`queue:${concertId}:waiting`);

  const keys = await scanKeys(`queue:${concertId}:admitted:*`);
  if (keys.length > 0) await redis.del(...keys);
}

async function scanKeys(pattern: string): Promise<string[]> {
  const result: string[] = [];
  let cursor = '0';
  do {
    const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    result.push(...keys);
    cursor = nextCursor;
  } while (cursor !== '0');
  return result;
}

async function countAdmitted(concertId: string): Promise<number> {
  return (await scanKeys(`queue:${concertId}:admitted:*`)).length;
}

// ── 1회 반복 실행 ─────────────────────────────────────────────────────────────

interface IterationResult {
  scale: number;
  iteration: number;
  loginSuccess: number;
  enterSuccess: number;
  totalElapsedMs: number;
  hasDuplicates: boolean;
  expectedZcard: number;
  actualZcard: number;
  admittedDuringTest: number;
  zcardMatches: boolean;
  latency: LatencyStats;
}

async function runIteration(scale: number, iteration: number): Promise<IterationResult> {
  await resetQueueState(CONCERT_ID!);

  const users = Array.from({ length: scale }, (_, i) => ({
    email: `test${i + 1}@test.com`,
    password: 'test1234!',
    label: `test${i + 1}`,
  }));

  // 동시 로그인
  const loginResults = await Promise.allSettled(users.map((u) => login(u.email, u.password)));
  const tokens: { label: string; token: string }[] = [];
  for (let i = 0; i < loginResults.length; i++) {
    const r = loginResults[i];
    if (r.status === 'fulfilled') tokens.push({ label: users[i].label, token: r.value });
  }

  // 동시 대기열 진입 (Promise.all 구간만 "총 소요 시간"으로 측정)
  const enterStart = performance.now();
  const enterResults = await Promise.all(
    tokens.map(({ label, token }) => enterQueue(token, label)),
  );
  const totalElapsedMs = performance.now() - enterStart;

  const successRows = enterResults.filter((r) => !r.error);
  const positions = successRows.map((r) => r.position);
  const hasDuplicates = new Set(positions).size !== positions.length;

  // admitNextUser 워커가 이 iteration 도중 1명을 입장시켰을 수 있으므로
  // 실측 ZCARD와 비교할 기대값은 "성공 진입 수 - 도중에 입장 처리된 수"로 보정한다.
  const admittedDuringTest = await countAdmitted(CONCERT_ID!);
  const actualZcard = await redis.zcard(`queue:${CONCERT_ID}:waiting`);
  const expectedZcard = successRows.length - admittedDuringTest;

  return {
    scale,
    iteration,
    loginSuccess: tokens.length,
    enterSuccess: successRows.length,
    totalElapsedMs,
    hasDuplicates,
    expectedZcard,
    actualZcard,
    admittedDuringTest,
    zcardMatches: actualZcard === expectedZcard,
    latency: computeLatencyStats(enterResults.map((r) => r.latencyMs)),
  };
}

// ── 출력 ──────────────────────────────────────────────────────────────────────

function printIterationRow(r: IterationResult): void {
  const loginRate = ((r.loginSuccess / r.scale) * 100).toFixed(0);
  const enterRate = ((r.enterSuccess / r.scale) * 100).toFixed(0);
  console.log(
    `  [${r.scale}명 · Run ${r.iteration}/${REPEAT}] ` +
      `로그인 ${r.loginSuccess}/${r.scale}(${loginRate}%) | ` +
      `진입 ${r.enterSuccess}/${r.scale}(${enterRate}%) | ` +
      `총 소요 ${r.totalElapsedMs.toFixed(1)}ms | ` +
      `순번중복 ${r.hasDuplicates ? '⚠️있음' : '없음'} | ` +
      `ZCARD ${r.actualZcard}/${r.expectedZcard}${r.zcardMatches ? '(일치)' : '(⚠️불일치)'}` +
      (r.admittedDuringTest > 0 ? ` [입장처리 ${r.admittedDuringTest}건 발생]` : ''),
  );
  console.log(
    `      latency(ms) min=${r.latency.min.toFixed(1)} avg=${r.latency.avg.toFixed(1)} ` +
      `p50=${r.latency.p50.toFixed(1)} p95=${r.latency.p95.toFixed(1)} ` +
      `p99=${r.latency.p99.toFixed(1)} max=${r.latency.max.toFixed(1)}`,
  );
}

function printScaleSummary(scale: number, results: IterationResult[]): void {
  const loginRate = avgOf(results.map((r) => (r.loginSuccess / r.scale) * 100));
  const enterRate = avgOf(results.map((r) => (r.enterSuccess / r.scale) * 100));
  const totalElapsed = avgOf(results.map((r) => r.totalElapsedMs));
  const anyDuplicates = results.some((r) => r.hasDuplicates);
  const allZcardMatch = results.every((r) => r.zcardMatches);

  const min = avgOf(results.map((r) => r.latency.min));
  const avg = avgOf(results.map((r) => r.latency.avg));
  const p50 = avgOf(results.map((r) => r.latency.p50));
  const p95 = avgOf(results.map((r) => r.latency.p95));
  const p99 = avgOf(results.map((r) => r.latency.p99));
  const max = avgOf(results.map((r) => r.latency.max));

  console.log(`\n📊  [${scale}명] ${REPEAT}회 평균 요약`);
  console.log(`   로그인 성공률: ${loginRate.toFixed(1)}%  |  진입 성공률: ${enterRate.toFixed(1)}%`);
  console.log(`   총 소요 시간(평균): ${totalElapsed.toFixed(1)}ms`);
  console.log(`   순번 중복: ${anyDuplicates ? '⚠️  1회 이상 발생' : '전 회차 없음'}`);
  console.log(`   ZCARD 정합성: ${allZcardMatch ? '전 회차 일치' : '⚠️  불일치 회차 있음'}`);
  console.log(
    `   응답 시간(ms, 평균): min=${min.toFixed(1)} avg=${avg.toFixed(1)} p50=${p50.toFixed(1)} ` +
      `p95=${p95.toFixed(1)} p99=${p99.toFixed(1)} max=${max.toFixed(1)}`,
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🎫  대기열 동시 진입 부하 테스트 (CONCERT_ID: ${CONCERT_ID})`);
  console.log(`   규모: ${SCALES.join(', ')}명  |  각 규모별 ${REPEAT}회 반복\n`);

  await ensureTestUsers(Math.max(...SCALES));

  const allResults: IterationResult[] = [];

  for (const scale of SCALES) {
    console.log(`\n=== ${scale}명 동시 진입 테스트 ===`);
    const scaleResults: IterationResult[] = [];
    for (let i = 1; i <= REPEAT; i++) {
      const result = await runIteration(scale, i);
      printIterationRow(result);
      scaleResults.push(result);
      allResults.push(result);
    }
    printScaleSummary(scale, scaleResults);
  }

  console.log('\n✅  전체 테스트 완료\n');
  return allResults;
}

main()
  .catch((err) => {
    console.error('❌  예상치 못한 오류:', err);
    process.exit(1);
  })
  .finally(async () => {
    await redis.quit();
    await prisma.$disconnect();
  });
