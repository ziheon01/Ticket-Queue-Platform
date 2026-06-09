import { Router } from 'express';
import { registerHandler, loginHandler, logoutHandler, refreshHandler, meHandler } from '../controllers/auth.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

router.post('/register', registerHandler);
router.post('/login', loginHandler);
router.post('/logout', logoutHandler);
router.post('/refresh', refreshHandler);
router.get('/me', requireAuth, meHandler);

export default router;
