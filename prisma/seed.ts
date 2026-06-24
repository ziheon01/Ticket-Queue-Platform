import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcrypt';
import Redis from 'ioredis';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });
const redis = new Redis({ host: 'localhost', port: 6380 });

const DAY = 24 * 60 * 60 * 1000;

async function main() {
  // ── 1. Redis 초기화 ────────────────────────────────────────────
  const [stockKeys, queueKeys] = await Promise.all([
    redis.keys('zone:*:stock'),
    redis.keys('queue:*'),
  ]);
  const allKeys = [...stockKeys, ...queueKeys];
  if (allKeys.length > 0) await redis.del(...allKeys);
  console.log(`Redis 초기화: ${allKeys.length}개 키 삭제`);

  // ── 2. DB 초기화 (FK 순서) ─────────────────────────────────────
  await prisma.payment.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.concertZone.deleteMany();
  await prisma.concert.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
  console.log('DB 초기화 완료');

  // ── 3. 유저 생성 ───────────────────────────────────────────────
  const [adminPassword, userPassword] = await Promise.all([
    bcrypt.hash('admin1234!', 10),
    bcrypt.hash('user1234!', 10),
  ]);

  const [admin, user] = await Promise.all([
    prisma.user.create({
      data: { email: 'admin@ticket.com', password: adminPassword, nickname: '관리자', role: 'ADMIN' },
    }),
    prisma.user.create({
      data: { email: 'user@ticket.com', password: userPassword, nickname: '테스트유저', role: 'USER' },
    }),
  ]);

  console.log(`유저 생성: ${admin.email}, ${user.email}`);

  // ── 4. 콘서트 생성 ────────────────────────────────────────────

  // ON_SALE 3개
  const [iu, bts, blackpink] = await Promise.all([
    prisma.concert.create({
      data: {
        title: '2026 IU Concert',
        artist: 'IU (아이유)',
        venue: '잠실종합운동장',
        concertDate: new Date('2026-08-15'),
        saleStartAt: new Date(Date.now() - 1000),
        status: 'ON_SALE',
        zones: {
          create: [
            { name: 'VIP', price: 180000, totalQuantity: 50,  remainQuantity: 50  },
            { name: 'R',   price: 130000, totalQuantity: 200, remainQuantity: 200 },
            { name: 'S',   price: 90000,  totalQuantity: 300, remainQuantity: 300 },
          ],
        },
      },
      include: { zones: true },
    }),
    prisma.concert.create({
      data: {
        title: 'BTS World Tour',
        artist: 'BTS',
        venue: '고척스카이돔',
        concertDate: new Date('2026-09-20'),
        saleStartAt: new Date(Date.now() - 1000),
        status: 'ON_SALE',
        zones: {
          create: [
            { name: 'VIP', price: 220000, totalQuantity: 30,  remainQuantity: 30  },
            { name: 'R',   price: 160000, totalQuantity: 150, remainQuantity: 150 },
            { name: 'S',   price: 110000, totalQuantity: 250, remainQuantity: 250 },
          ],
        },
      },
      include: { zones: true },
    }),
    prisma.concert.create({
      data: {
        title: 'BLACKPINK BORN PINK',
        artist: 'BLACKPINK',
        venue: 'KSPO돔',
        concertDate: new Date('2026-10-05'),
        saleStartAt: new Date(Date.now() - 1000),
        status: 'ON_SALE',
        zones: {
          create: [
            { name: 'VIP', price: 200000, totalQuantity: 40,  remainQuantity: 40  },
            { name: 'R',   price: 150000, totalQuantity: 180, remainQuantity: 180 },
            { name: 'S',   price: 100000, totalQuantity: 280, remainQuantity: 280 },
          ],
        },
      },
      include: { zones: true },
    }),
  ]);

  // SCHEDULED 3개
  await Promise.all([
    prisma.concert.create({
      data: {
        title: 'aespa MY WORLD',
        artist: 'aespa',
        venue: '올림픽공원',
        concertDate: new Date('2026-11-10'),
        saleStartAt: new Date(Date.now() + 3 * DAY),
        status: 'SCHEDULED',
        zones: {
          create: [
            { name: 'VIP', price: 190000, totalQuantity: 60,  remainQuantity: 60  },
            { name: 'R',   price: 140000, totalQuantity: 220, remainQuantity: 220 },
            { name: 'S',   price: 95000,  totalQuantity: 350, remainQuantity: 350 },
          ],
        },
      },
    }),
    prisma.concert.create({
      data: {
        title: 'EXO Planet',
        artist: 'EXO',
        venue: '잠실실내체육관',
        concertDate: new Date('2026-12-01'),
        saleStartAt: new Date(Date.now() + 7 * DAY),
        status: 'SCHEDULED',
        zones: {
          create: [
            { name: 'VIP', price: 170000, totalQuantity: 45,  remainQuantity: 45  },
            { name: 'R',   price: 120000, totalQuantity: 170, remainQuantity: 170 },
            { name: 'S',   price: 85000,  totalQuantity: 260, remainQuantity: 260 },
          ],
        },
      },
    }),
    prisma.concert.create({
      data: {
        title: 'Coldplay Music of the Spheres',
        artist: 'Coldplay',
        venue: '잠실종합운동장',
        concertDate: new Date('2027-01-15'),
        saleStartAt: new Date(Date.now() + 30 * DAY),
        status: 'SCHEDULED',
        zones: {
          create: [
            { name: 'VIP', price: 250000, totalQuantity: 80,  remainQuantity: 80  },
            { name: 'R',   price: 190000, totalQuantity: 300, remainQuantity: 300 },
            { name: 'S',   price: 130000, totalQuantity: 500, remainQuantity: 500 },
          ],
        },
      },
    }),
  ]);

  // ENDED 2개
  await Promise.all([
    prisma.concert.create({
      data: {
        title: '2025 SHINee World',
        artist: 'SHINee',
        venue: '올림픽체조경기장',
        concertDate: new Date('2025-12-20'),
        saleStartAt: new Date('2025-11-01'),
        status: 'ENDED',
        zones: {
          create: [
            { name: 'VIP', price: 160000, totalQuantity: 50,  remainQuantity: 0 },
            { name: 'R',   price: 120000, totalQuantity: 200, remainQuantity: 0 },
            { name: 'S',   price: 80000,  totalQuantity: 300, remainQuantity: 0 },
          ],
        },
      },
    }),
    prisma.concert.create({
      data: {
        title: '2025 TWICE Ready To Be',
        artist: 'TWICE',
        venue: 'KSPO돔',
        concertDate: new Date('2025-11-15'),
        saleStartAt: new Date('2025-10-01'),
        status: 'ENDED',
        zones: {
          create: [
            { name: 'VIP', price: 175000, totalQuantity: 40,  remainQuantity: 0 },
            { name: 'R',   price: 135000, totalQuantity: 160, remainQuantity: 0 },
            { name: 'S',   price: 95000,  totalQuantity: 270, remainQuantity: 0 },
          ],
        },
      },
    }),
  ]);

  // ── 5. ON_SALE 구역 Redis 재고 초기화 ─────────────────────────
  const onSaleZones = [...iu.zones, ...bts.zones, ...blackpink.zones];
  await Promise.all(
    onSaleZones.map(z => redis.set(`zone:${z.id}:stock`, z.remainQuantity)),
  );

  // ── 완료 출력 ──────────────────────────────────────────────────
  console.log('\nSeed 완료:');
  console.log(`  어드민: ${admin.email} / admin1234!`);
  console.log(`  유저:   ${user.email} / user1234!`);
  console.log('\n  콘서트 목록:');

  for (const c of [iu, bts, blackpink]) {
    console.log(`  [ON_SALE] ${c.title}`);
    c.zones.forEach(z =>
      console.log(`    ${z.name}: ${z.price.toLocaleString()}원, ${z.remainQuantity}석  → Redis zone:${z.id}:stock`),
    );
  }
  console.log('  [SCHEDULED] aespa MY WORLD (3일 후 판매)');
  console.log('  [SCHEDULED] EXO Planet (7일 후 판매)');
  console.log('  [SCHEDULED] Coldplay Music of the Spheres (30일 후 판매)');
  console.log('  [ENDED] 2025 SHINee World');
  console.log('  [ENDED] 2025 TWICE Ready To Be');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await redis.quit();
  });
