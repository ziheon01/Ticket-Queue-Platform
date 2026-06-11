import { z } from 'zod';

export const CreateReservationDto = z.object({
  concertZoneId: z.string().min(1, '구역 ID를 입력해주세요'),
  quantity: z.number().int().min(1, '수량은 1장 이상이어야 합니다').max(4, '최대 4장까지 구매 가능합니다'),
});

export const TossWebhookDto = z.object({
  paymentKey: z.string(),
  orderId: z.string(),
  status: z.string(),
  totalAmount: z.number().optional(),
  amount: z.number().optional(),
});

export type CreateReservationInput = z.infer<typeof CreateReservationDto>;
export type TossWebhookBody = z.infer<typeof TossWebhookDto>;

export interface ReservationResponse {
  reservationId: string;
  totalPrice: number;
  remainSeconds: number;
  status: string;
}

export interface ReservationDetailResponse {
  id: string;
  status: string;
  quantity: number;
  totalPrice: number;
  extendedAt: Date | null;
  createdAt: Date;
  concertZone: {
    id: string;
    name: string;
    price: number;
    concert: {
      id: string;
      title: string;
      artist: string;
      venue: string;
      concertDate: Date;
    };
  };
  payment: {
    id: string;
    status: string;
    amount: number;
    paidAt: Date | null;
  } | null;
}
