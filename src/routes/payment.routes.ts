import { Router } from 'express';
import { tossWebhookHandler } from '../controllers/payment.controller';

const router = Router();

router.post('/webhook', tossWebhookHandler);

export default router;
