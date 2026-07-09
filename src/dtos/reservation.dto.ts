import { z } from 'zod';

export const CreateReservationDto = z.object({
  concertZoneId: z.string().min(1, '구역 ID를 입력해주세요'),
  quantity: z.number().int().min(1, '수량은 1장 이상이어야 합니다').max(4, '최대 4장까지 구매 가능합니다'),
});

const TossWebhookDataDto = z.object({
  paymentKey: z.string(),
  orderId: z.string(),
  status: z.string(),
  totalAmount: z.number().optional(),
  amount: z.number().optional(),
});

// 토스페이먼츠 Webhook 실제 페이로드는 { eventType, data: {...} } 봉투 구조로 온다.
export const TossWebhookDto = z.object({
  eventType: z.string(),
  data: TossWebhookDataDto,
});

export type CreateReservationInput = z.infer<typeof CreateReservationDto>;
export type TossWebhookBody = z.infer<typeof TossWebhookDataDto>;

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

type ReservationDetailInput = {
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
};

export function toReservationDetailResponse(r: ReservationDetailInput): ReservationDetailResponse {
  return {
    id: r.id,
    status: r.status,
    quantity: r.quantity,
    totalPrice: r.totalPrice,
    extendedAt: r.extendedAt,
    createdAt: r.createdAt,
    concertZone: {
      id: r.concertZone.id,
      name: r.concertZone.name,
      price: r.concertZone.price,
      concert: {
        id: r.concertZone.concert.id,
        title: r.concertZone.concert.title,
        artist: r.concertZone.concert.artist,
        venue: r.concertZone.concert.venue,
        concertDate: r.concertZone.concert.concertDate,
      },
    },
    payment: r.payment
      ? {
          id: r.payment.id,
          status: r.payment.status,
          amount: r.payment.amount,
          paidAt: r.payment.paidAt,
        }
      : null,
  };
}
