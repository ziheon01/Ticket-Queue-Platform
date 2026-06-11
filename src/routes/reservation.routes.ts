import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import {
  createReservationHandler,
  getMyReservationsHandler,
  getReservationDetailHandler,
  cancelReservationHandler,
  extendReservationHandler,
} from '../controllers/reservation.controller';

const router = Router();

router.post('/', requireAuth, createReservationHandler);
router.get('/', requireAuth, getMyReservationsHandler);
router.get('/:id', requireAuth, getReservationDetailHandler);
router.delete('/:id', requireAuth, cancelReservationHandler);
router.post('/:id/extend', requireAuth, extendReservationHandler);

export default router;
