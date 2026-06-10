import { Router } from 'express';
import { listConcertsHandler, getConcertDetailHandler } from '../controllers/concert.controller';

const router = Router();

router.get('/', listConcertsHandler);
router.get('/:id', getConcertDetailHandler);

export default router;
