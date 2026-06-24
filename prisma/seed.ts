import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcrypt';
import Redis from 'ioredis';

const redis = new Redis({ host: 'localhost', port: 6380 });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const adminPassword = await bcrypt.hash('admin1234!', 10);
  const userPassword = await bcrypt.hash('user1234!', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@ticket.com' },
    update: {},
    create: {
      email: 'admin@ticket.com',
      password: adminPassword,
      nickname: '관리자',
      role: 'ADMIN',
    },
  });

  const user = await prisma.user.upsert({
    where: { email: 'user@ticket.com' },
    update: {},
    create: {
      email: 'user@ticket.com',
      password: userPassword,
      nickname: '테스트유저',
      role: 'USER',
    },
  });

  const concert = await prisma.concert.create({
    data: {
      title: '2026 IU Concert',
      artist: 'IU (아이유)',
      venue: '잠실종합운동장',
      concertDate: new Date('2026-08-15'),
      saleStartAt: new Date(Date.now() - 1000), // 1초 전 → 즉시 ON_SALE
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
  });

  // Redis 재고 초기화
  await Promise.all(
    concert.zones.map(z =>
      redis.set(`zone:${z.id}:stock`, z.remainQuantity),
    ),
  );

  console.log('Seed 완료:');
  console.log(`  어드민: ${admin.email} / admin1234!`);
  console.log(`  유저:   ${user.email} / user1234!`);
  console.log(`  콘서트: ${concert.title} (${concert.status})`);
  concert.zones.forEach(z =>
    console.log(`    구역 ${z.name}: ${z.price.toLocaleString()}원, ${z.totalQuantity}석  (Redis zone:${z.id}:stock = ${z.remainQuantity})`),
  );
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
