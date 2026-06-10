import { prisma } from '../utils/prisma';
import { Concert, ConcertStatus } from '../generated/prisma';
import { CreateConcertInput, UpdateConcertInput } from '../dtos/concert.dto';

export async function findConcertById(id: string): Promise<Concert | null> {
  return prisma.concert.findUnique({ where: { id } });
}

export async function findConcertWithZones(id: string) {
  return prisma.concert.findUnique({
    where: { id },
    include: {
      zones: {
        orderBy: { name: 'asc' },
      },
    },
  });
}

export async function findAllConcerts(status?: ConcertStatus): Promise<Concert[]> {
  return prisma.concert.findMany({
    where: status ? { status } : undefined,
    orderBy: { saleStartAt: 'asc' },
  });
}

export async function createConcert(input: CreateConcertInput): Promise<Concert> {
  return prisma.concert.create({
    data: {
      title: input.title,
      artist: input.artist,
      venue: input.venue,
      concertDate: new Date(input.concertDate),
      saleStartAt: new Date(input.saleStartAt),
    },
  });
}

export async function updateConcert(id: string, input: UpdateConcertInput): Promise<Concert> {
  return prisma.concert.update({
    where: { id },
    data: {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.artist !== undefined && { artist: input.artist }),
      ...(input.venue !== undefined && { venue: input.venue }),
      ...(input.concertDate !== undefined && { concertDate: new Date(input.concertDate) }),
      ...(input.saleStartAt !== undefined && { saleStartAt: new Date(input.saleStartAt) }),
    },
  });
}

export async function deleteConcert(id: string): Promise<void> {
  await prisma.concert.delete({ where: { id } });
}

export async function updateScheduledToOnSale(now: Date): Promise<number> {
  const result = await prisma.concert.updateMany({
    where: {
      status: ConcertStatus.SCHEDULED,
      saleStartAt: { lte: now },
    },
    data: { status: ConcertStatus.ON_SALE },
  });
  return result.count;
}
