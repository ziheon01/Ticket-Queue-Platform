import { Concert, ConcertStatus } from '../generated/prisma';
import { CreateConcertInput, UpdateConcertInput, CreateZoneInput, UpdateZoneInput } from '../dtos/concert.dto';
import {
  findConcertById,
  findConcertWithZones,
  findAllConcerts,
  createConcert,
  updateConcert,
  deleteConcert,
  updateScheduledToOnSale,
} from '../repositories/concert.repository';
import {
  findZoneById,
  findZoneByName,
  findZoneStats,
  createZone,
  updateZone,
  deleteZone,
  ZoneStat,
} from '../repositories/concertZone.repository';
import { redis } from '../utils/redis';
import { AppError } from '../utils/errors';

// ──────────────────────────────────────────
// Concert
// ──────────────────────────────────────────

export async function adminCreateConcert(input: CreateConcertInput): Promise<Concert> {
  return createConcert(input);
}

export async function adminUpdateConcert(id: string, input: UpdateConcertInput): Promise<Concert> {
  const existing = await findConcertById(id);
  if (!existing) throw new AppError(404, '공연을 찾을 수 없습니다');
  return updateConcert(id, input);
}

export async function adminDeleteConcert(id: string): Promise<void> {
  const existing = await findConcertById(id);
  if (!existing) throw new AppError(404, '공연을 찾을 수 없습니다');
  await deleteConcert(id);
}

export async function getConcertStats(id: string): Promise<{ zones: ZoneStat[] }> {
  const existing = await findConcertById(id);
  if (!existing) throw new AppError(404, '공연을 찾을 수 없습니다');
  const zones = await findZoneStats(id);
  return { zones };
}

// ──────────────────────────────────────────
// ConcertZone
// ──────────────────────────────────────────

export async function adminCreateZone(concertId: string, input: CreateZoneInput) {
  const concert = await findConcertById(concertId);
  if (!concert) throw new AppError(404, '공연을 찾을 수 없습니다');

  const duplicate = await findZoneByName(concertId, input.name);
  if (duplicate) throw new AppError(409, '이미 존재하는 구역명입니다');

  const zone = await createZone(concertId, input);

  // Redis stock 초기화
  await redis.set(`zone:${zone.id}:stock`, String(input.totalQuantity));

  return zone;
}

export async function adminUpdateZone(id: string, input: UpdateZoneInput) {
  const existing = await findZoneById(id);
  if (!existing) throw new AppError(404, '구역을 찾을 수 없습니다');

  const zone = await updateZone(id, input);

  // totalQuantity 변경 시 Redis stock 동기화
  if (input.totalQuantity !== undefined) {
    await redis.set(`zone:${id}:stock`, String(input.totalQuantity));
  }

  return zone;
}

export async function adminDeleteZone(id: string): Promise<void> {
  const existing = await findZoneById(id);
  if (!existing) throw new AppError(404, '구역을 찾을 수 없습니다');

  await deleteZone(id);
  await redis.del(`zone:${id}:stock`);
}

// ──────────────────────────────────────────
// 유저용 공연 조회
// ──────────────────────────────────────────

export async function listConcerts(status?: ConcertStatus): Promise<Concert[]> {
  return findAllConcerts(status);
}

export async function getConcertDetail(id: string) {
  const concert = await findConcertWithZones(id);
  if (!concert) throw new AppError(404, '공연을 찾을 수 없습니다');
  return concert;
}

// ──────────────────────────────────────────
// Cron: SCHEDULED → ON_SALE
// ──────────────────────────────────────────

export async function tickConcertStatus(): Promise<number> {
  return updateScheduledToOnSale(new Date());
}
