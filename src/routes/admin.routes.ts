import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middlewares/auth.middleware';
import {
  createConcertHandler,
  updateConcertHandler,
  deleteConcertHandler,
  getConcertStatsHandler,
  createZoneHandler,
  updateZoneHandler,
  deleteZoneHandler,
} from '../controllers/adminConcert.controller';

const router = Router();

router.use(requireAuth, requireAdmin);

router.post('/concerts', createConcertHandler);
router.patch('/concerts/:id', updateConcertHandler);
router.delete('/concerts/:id', deleteConcertHandler);
router.get('/concerts/:id/stats', getConcertStatsHandler);

router.post('/concerts/:id/zones', createZoneHandler);
router.patch('/zones/:id', updateZoneHandler);
router.delete('/zones/:id', deleteZoneHandler);

export default router;
