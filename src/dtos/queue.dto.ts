export type QueueStatus = 'WAITING' | 'ADMITTED' | 'NOT_IN_QUEUE';

export interface QueuePositionResult {
  position: number;
  total: number;
}

export interface QueueStatusResult {
  status: QueueStatus;
  position?: number;
  total?: number;
}
