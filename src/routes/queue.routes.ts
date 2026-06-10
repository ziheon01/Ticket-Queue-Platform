import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import {
  enterQueueHandler,
  leaveQueueHandler,
  getQueueStatusHandler,
} from '../controllers/queue.controller';

const router = Router({ mergeParams: true });

router.post('/:concertId/enter', requireAuth, enterQueueHandler);
router.delete('/:concertId/leave', requireAuth, leaveQueueHandler);
router.get('/:concertId/status', requireAuth, getQueueStatusHandler);

export default router;
