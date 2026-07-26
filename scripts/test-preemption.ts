import 'dotenv/config';
import axios from 'axios';
import Redis from 'ioredis';
import bcrypt from 'bcrypt';
import { prisma } from '../src/utils/prisma';

const BASE_URL = process.env.API_URL ?? 'http://localhost:3001';
const USER_COUNT = Number(process.env.USER_COUNT ?? 200);
const STOCK = Number(process.env.STOCK ?? 100);
const REPEAT = Number(process.env.REPEAT ?? 3);
const POLL_INTERVAL_MS = 2;

const TEST_CONCERT_TITLE = 'Lua 선점 부하테스트 콘서트';
const TEST_ZONE_NAME = 'PREEMPT_TEST';

const redis = new Redis({ host: 'localhost', port: 6380 });

// ── Redis 키 헬퍼 (repositories/*.ts와 동일한 포맷) ──────────────────────────

const stockKey = (zoneId: string) => `zone:${zoneId}:stock`;
const lockKey = (zoneId: string, userId: string) => `zone:${zoneId}:lock:${userId}`;
const waitingKey = (concertId: string) => `queue:${concertId}:waiting`;
const admittedKey = (concertId: string, userId: string) => `queue:${concertId}:admitted:${userId}`;

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

// ── 유저 시드: test1..testN@test.com 자동 생성 (test-queue.ts와 동일 패턴) ──

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

// ── 재고 STOCK개짜리 테스트 전용 콘서트/구역 생성 (한 번만, 이후 재사용) ────

async function ensureTestConcertZone(): Promise<{ concertId: string; zoneId: string }> {
  const existing = await prisma.concert.findFirst({
    where: { title: TEST_CONCERT_TITLE },
    include: { zones: true },
  });

  const concert =
    existing ??
    (await prisma.concert.create({
      data: {
        title: TEST_CONCERT_TITLE,
        artist: '부하테스트',
        venue: '테스트 아레나',
        concertDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        saleStartAt: new Date(Date.now() - 1000),
        status: 'ON_SALE',
        zones: {
          create: [{ name: TEST_ZONE_NAME, price: 10000, totalQuantity: STOCK, remainQuantity: STOCK }],
        },
      },
      include: { zones: true },
    }));

  const zone = concert.zones.find((z) => z.name === TEST_ZONE_NAME);
  if (!zone) throw new Error('테스트 구역 생성에 실패했습니다');

  return { concertId: concert.id, zoneId: zone.id };
}

// ── 로그인 / 대기열 진입 (실제 API, 1회만 수행) ──────────────────────────────

interface UserSession {
  label: string;
  userId: string;
  token: string;
}

async function login(email: string, password: string): Promise<{ token: string; userId: string }> {
  const res = await axios.post(`${BASE_URL}/api/auth/login`, { email, password });
  return { token: res.data.data.accessToken as string, userId: res.data.data.user.id as string };
}

async function enterQueue(concertId: string, token: string): Promise<void> {
  try {
    await axios.post(`${BASE_URL}/api/queue/${concertId}/enter`, {}, { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    // 이미 대기열/입장 상태인 경우 무시 (재실행 시 idempotent)
  }
}

// ── 선점 요청 (POST /api/reservations) ───────────────────────────────────────

interface ReservationResult {
  user: string;
  success: boolean;
  latencyMs: number;
  errorReason?: '재고부족(-1)' | '중복선점(-2)' | '기타';
}

async function createReservationRequest(
  token: string,
  label: string,
  zoneId: string,
): Promise<ReservationResult> {
  const start = performance.now();
  try {
    await axios.post(
      `${BASE_URL}/api/reservations`,
      { concertZoneId: zoneId, quantity: 1 },
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return { user: label, success: true, latencyMs: performance.now() - start };
  } catch (err) {
    const latencyMs = performance.now() - start;
    const msg = axios.isAxiosError(err)
      ? ((err.response?.data?.message as string | undefined) ?? err.message)
      : String(err);

    let errorReason: ReservationResult['errorReason'] = '기타';
    if (msg.includes('재고가 부족')) errorReason = '재고부족(-1)';
    else if (msg.includes('이미 진행 중인 예매')) errorReason = '중복선점(-2)';

    return { user: label, success: false, latencyMs, errorReason };
  }
}

// ── 응답 시간 통계 ────────────────────────────────────────────────────────────

interface LatencyStats {
  min: number;
  avg: number;
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
  return {
    min: sorted[0],
    avg: sorted.reduce((sum, v) => sum + v, 0) / sorted.length,
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    max: sorted[sorted.length - 1],
  };
}

function avgOf(nums: number[]): number {
  return nums.reduce((sum, v) => sum + v, 0) / nums.length;
}

// ── 재고 실시간 폴링 (부하 구간 동안 stock 키 값을 계속 관찰) ────────────────
// Redis는 단일 스레드로 명령을 직렬 처리하므로 Lua 스크립트 내부에서
// 재고가 음수로 진입하는 것은 구조적으로 불가능하다. 이 폴링은 그 보장을
// 실측으로 보조 확인하는 용도(외부 관찰이 race를 증명하진 않음).
async function pollStock(zoneId: string, stopFlag: { stop: boolean }, samples: number[]): Promise<void> {
  while (!stopFlag.stop) {
    const raw = await redis.get(stockKey(zoneId));
    if (raw !== null) samples.push(Number(raw));
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

// ── 회차별 상태 초기화 ────────────────────────────────────────────────────────

async function resetIterationState(
  concertId: string,
  zoneId: string,
  userIds: string[],
): Promise<void> {
  await redis.set(stockKey(zoneId), STOCK);

  const staleLockKeys = await scanKeys(`zone:${zoneId}:lock:*`);
  if (staleLockKeys.length > 0) await redis.del(...staleLockKeys);

  await redis.del(waitingKey(concertId));

  const pipeline = redis.pipeline();
  for (const uid of userIds) {
    pipeline.set(admittedKey(concertId, uid), '1', 'EX', 300);
  }
  await pipeline.exec();
}

// ── 1회 반복 실행 ─────────────────────────────────────────────────────────────

interface IterationResult {
  iteration: number;
  successCount: number;
  failCount: number;
  unexpectedFailureCount: number;
  hasDoublePreemption: boolean;
  minObservedStock: number;
  wentNegative: boolean;
  finalStock: number;
  stockConsistent: boolean; // finalStock === STOCK - successCount
  totalElapsedMs: number;
  latency: LatencyStats;
}

async function runIteration(
  iteration: number,
  concertId: string,
  zoneId: string,
  sessions: UserSession[],
): Promise<IterationResult> {
  await resetIterationState(
    concertId,
    zoneId,
    sessions.map((s) => s.userId),
  );

  const stopFlag = { stop: false };
  const stockSamples: number[] = [STOCK];
  const pollerPromise = pollStock(zoneId, stopFlag, stockSamples);

  const start = performance.now();
  const results = await Promise.all(
    sessions.map((s) => createReservationRequest(s.token, s.label, zoneId)),
  );
  const totalElapsedMs = performance.now() - start;

  stopFlag.stop = true;
  await pollerPromise;

  const successRows = results.filter((r) => r.success);
  const failRows = results.filter((r) => !r.success);
  const unexpectedFailureCount = failRows.filter((r) => r.errorReason === '기타').length;

  const successUserSet = new Set(successRows.map((r) => r.user));
  const hasDoublePreemption = successUserSet.size !== successRows.length;

  const minObservedStock = Math.min(...stockSamples);
  const finalStock = Number(await redis.get(stockKey(zoneId)));

  return {
    iteration,
    successCount: successRows.length,
    failCount: failRows.length,
    unexpectedFailureCount,
    hasDoublePreemption,
    minObservedStock,
    wentNegative: minObservedStock < 0,
    finalStock,
    stockConsistent: finalStock === STOCK - successRows.length,
    totalElapsedMs,
    latency: computeLatencyStats(results.map((r) => r.latencyMs)),
  };
}

// ── 출력 ──────────────────────────────────────────────────────────────────────

function printIterationRow(r: IterationResult): void {
  console.log(
    `  [Run ${r.iteration}/${REPEAT}] 성공 ${r.successCount}/${STOCK} | ` +
      `실패 ${r.failCount}(기타사유 ${r.unexpectedFailureCount}건) | ` +
      `이중선점 ${r.hasDoublePreemption ? '⚠️있음' : '없음'} | ` +
      `재고최솟값 ${r.minObservedStock}${r.wentNegative ? '⚠️음수진입' : ''} | ` +
      `최종재고 ${r.finalStock}${r.stockConsistent ? '(정합)' : '⚠️(불일치)'} | ` +
      `총 소요 ${r.totalElapsedMs.toFixed(1)}ms`,
  );
  console.log(
    `      latency(ms) min=${r.latency.min.toFixed(1)} avg=${r.latency.avg.toFixed(1)} ` +
      `p95=${r.latency.p95.toFixed(1)} p99=${r.latency.p99.toFixed(1)} max=${r.latency.max.toFixed(1)}`,
  );
}

function printSummary(results: IterationResult[]): void {
  const avgSuccess = avgOf(results.map((r) => r.successCount));
  const avgFail = avgOf(results.map((r) => r.failCount));
  const anyUnexpected = results.some((r) => r.unexpectedFailureCount > 0);
  const anyDouble = results.some((r) => r.hasDoublePreemption);
  const anyNegative = results.some((r) => r.wentNegative);
  const allConsistent = results.every((r) => r.stockConsistent);
  const totalElapsed = avgOf(results.map((r) => r.totalElapsedMs));

  const min = avgOf(results.map((r) => r.latency.min));
  const avg = avgOf(results.map((r) => r.latency.avg));
  const p95 = avgOf(results.map((r) => r.latency.p95));
  const p99 = avgOf(results.map((r) => r.latency.p99));
  const max = avgOf(results.map((r) => r.latency.max));

  console.log(`\n📊  ${REPEAT}회 평균 요약 (유저 ${USER_COUNT}명 / 재고 ${STOCK}개)`);
  console.log(`   성공 평균: ${avgSuccess.toFixed(1)}건  |  실패 평균: ${avgFail.toFixed(1)}건`);
  console.log(`   기타 사유 실패: ${anyUnexpected ? '⚠️  1건 이상 발생' : '전 회차 없음'}`);
  console.log(`   이중 선점: ${anyDouble ? '⚠️  1회 이상 발생' : '전 회차 없음'}`);
  console.log(`   재고 음수 진입: ${anyNegative ? '⚠️  1회 이상 발생' : '전 회차 없음'}`);
  console.log(`   최종 재고 정합성: ${allConsistent ? '전 회차 (재고 - 성공수 = 최종재고) 일치' : '⚠️  불일치 회차 있음'}`);
  console.log(`   총 소요 시간(평균): ${totalElapsed.toFixed(1)}ms`);
  console.log(
    `   응답 시간(ms, 평균): min=${min.toFixed(1)} avg=${avg.toFixed(1)} ` +
      `p95=${p95.toFixed(1)} p99=${p99.toFixed(1)} max=${max.toFixed(1)}`,
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🔒  Redis Lua 원자적 선점 부하 테스트`);
  console.log(`   유저 ${USER_COUNT}명 동시 요청 vs 재고 ${STOCK}개  |  ${REPEAT}회 반복\n`);

  await ensureTestUsers(USER_COUNT);
  const { concertId, zoneId } = await ensureTestConcertZone();
  console.log(`🎫  테스트 콘서트: ${concertId}`);
  console.log(`🎟️   테스트 구역(재고 ${STOCK}): ${zoneId}\n`);

  const users = Array.from({ length: USER_COUNT }, (_, i) => ({
    email: `test${i + 1}@test.com`,
    password: 'test1234!',
    label: `test${i + 1}`,
  }));

  // 1) 로그인 (1회)
  console.log('1️⃣   로그인 중...');
  const loginResults = await Promise.allSettled(users.map((u) => login(u.email, u.password)));
  const sessions: UserSession[] = [];
  for (let i = 0; i < loginResults.length; i++) {
    const r = loginResults[i];
    if (r.status === 'fulfilled') {
      sessions.push({ label: users[i].label, userId: r.value.userId, token: r.value.token });
    } else {
      console.warn(`  ⚠️  ${users[i].label} 로그인 실패:`, r.reason?.message ?? r.reason);
    }
  }
  console.log(`   ✅  ${sessions.length}/${USER_COUNT}명 로그인 성공\n`);

  // 2) 대기열 진입 (1회, 실제 API)
  console.log('2️⃣   대기열 진입 중...');
  await redis.del(waitingKey(concertId));
  await Promise.all(sessions.map((s) => enterQueue(concertId, s.token)));
  console.log('   ✅  완료\n');

  console.log(
    '   ※ admission(입장 처리)은 실제로는 5초당 1명씩만 처리되는 별도 워커라 ' +
      `${USER_COUNT}명을 동시 입장시키는 이 테스트의 목적(Lua 선점 원자성 검증)과 무관합니다.\n` +
      '     회차마다 admitted 키를 배치로 직접 설정해 "전원 결제 화면 진입 완료" 상태를 재현합니다.\n',
  );

  // 3) N회 반복: admit 배치 처리 → 동시 선점 요청
  const results: IterationResult[] = [];
  for (let i = 1; i <= REPEAT; i++) {
    const result = await runIteration(i, concertId, zoneId, sessions);
    printIterationRow(result);
    results.push(result);
  }

  printSummary(results);
  console.log('\n✅  전체 테스트 완료\n');
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
