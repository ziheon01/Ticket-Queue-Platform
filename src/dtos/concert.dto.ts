import { z } from 'zod';

export const CreateConcertDto = z.object({
  title: z.string().min(1, '공연 제목을 입력해주세요'),
  artist: z.string().min(1, '아티스트명을 입력해주세요'),
  venue: z.string().min(1, '공연 장소를 입력해주세요'),
  concertDate: z.string().datetime({ message: '올바른 날짜 형식이 아닙니다' }),
  saleStartAt: z.string().datetime({ message: '올바른 날짜 형식이 아닙니다' }),
});

export const UpdateConcertDto = z.object({
  title: z.string().min(1).optional(),
  artist: z.string().min(1).optional(),
  venue: z.string().min(1).optional(),
  concertDate: z.string().datetime().optional(),
  saleStartAt: z.string().datetime().optional(),
});

export const CreateZoneDto = z.object({
  name: z.string().min(1, '구역명을 입력해주세요'),
  price: z.number().int().min(0, '가격은 0원 이상이어야 합니다'),
  totalQuantity: z.number().int().min(1, '수량은 1개 이상이어야 합니다'),
});

export const UpdateZoneDto = z.object({
  name: z.string().min(1).optional(),
  price: z.number().int().min(0).optional(),
  totalQuantity: z.number().int().min(1).optional(),
});

export const ConcertStatusQueryDto = z.object({
  status: z.enum(['SCHEDULED', 'ON_SALE', 'SOLD_OUT', 'ENDED']).optional(),
});

export type CreateConcertInput = z.infer<typeof CreateConcertDto>;
export type UpdateConcertInput = z.infer<typeof UpdateConcertDto>;
export type CreateZoneInput = z.infer<typeof CreateZoneDto>;
export type UpdateZoneInput = z.infer<typeof UpdateZoneDto>;
export type ConcertStatusQuery = z.infer<typeof ConcertStatusQueryDto>;
