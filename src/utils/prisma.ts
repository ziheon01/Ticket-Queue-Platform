import { PrismaClient } from '../generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString, max: Number(process.env.DB_POOL_MAX ?? 10) });

export const prisma = new PrismaClient({ adapter });
