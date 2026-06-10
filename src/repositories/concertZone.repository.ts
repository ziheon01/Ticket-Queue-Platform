import { prisma } from '../utils/prisma';
import { ConcertZone, ReservationStatus } from '../generated/prisma';
import { CreateZoneInput, UpdateZoneInput } from '../dtos/concert.dto';

export async function findZoneById(id: string): Promise<ConcertZone | null> {
  return prisma.concertZone.findUnique({ where: { id } });
}

export async function findZonesByConcertId(concertId: string): Promise<ConcertZone[]> {
  return prisma.concertZone.findMany({
    where: { concertId },
    orderBy: { name: 'asc' },
  });
}

export async function findZoneByName(concertId: string, name: string): Promise<ConcertZone | null> {
  return prisma.concertZone.findUnique({
    where: { concertId_name: { concertId, name } },
  });
}

export async function createZone(concertId: string, input: CreateZoneInput): Promise<ConcertZone> {
  return prisma.concertZone.create({
    data: {
      concertId,
      name: input.name,
      price: input.price,
      totalQuantity: input.totalQuantity,
      remainQuantity: input.totalQuantity,
    },
  });
}

export async function updateZone(id: string, input: UpdateZoneInput): Promise<ConcertZone> {
  return prisma.concertZone.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.price !== undefined && { price: input.price }),
      ...(input.totalQuantity !== undefined && {
        totalQuantity: input.totalQuantity,
        remainQuantity: input.totalQuantity,
      }),
    },
  });
}

export async function deleteZone(id: string): Promise<void> {
  await prisma.concertZone.delete({ where: { id } });
}

export interface ZoneStat {
  id: string;
  name: string;
  totalQuantity: number;
  remainQuantity: number;
  reservationCount: number;
}

export async function findZoneStats(concertId: string): Promise<ZoneStat[]> {
  const zones = await prisma.concertZone.findMany({
    where: { concertId },
    include: {
      reservations: {
        where: {
          status: { in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED] },
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  return zones.map((z) => ({
    id: z.id,
    name: z.name,
    totalQuantity: z.totalQuantity,
    remainQuantity: z.remainQuantity,
    reservationCount: z.reservations.length,
  }));
}
