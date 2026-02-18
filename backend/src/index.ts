import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config/env.js';
import { logger } from './config/logger.js';
import { httpLogger } from './middleware/httpLogger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authRouter } from './routes/auth.js';
import { oauthRouter } from './routes/oauth.js';
import { userRouter } from './routes/user.js';
import { contentRouter } from './routes/content.js';
import { themeRouter } from './routes/themes.js';
import { reviewRouter } from './routes/review.js';
import { adminRouter as adminApiRouter } from './routes/admin.js';
import { setupAdminJS } from './admin/index.js';
import { subscriptionRouter } from './routes/subscription.js';
import { exportRouter } from './routes/export.js';
import { notificationRouter } from './routes/notifications.js';
import { homeRouter } from './routes/home.js';
import { onboardingRouter } from './routes/onboarding.js';
import { startScheduler } from './workers/scheduler.js';

const app = express();

// Security middleware
app.use(helmet({
  // Allow inline scripts for desktop auth page
  contentSecurityPolicy: false,
}));

// CORS - allow frontend and tunnel URLs (skip for /admin — same-origin)
const allowedOrigins = [
  config.frontendUrl,
  'https://api.ankora.study',
  'https://misc-saver-additionally-podcasts.trycloudflare.com',
];
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (same-origin, mobile apps, form submits with origin:"null")
    if (!origin || origin === 'null') return callback(null, true);
    if (allowedOrigins.some(allowed => origin.startsWith(allowed.replace(/\/$/, '')))) {
      return callback(null, true);
    }
    // In dev, allow any origin
    if (config.nodeEnv === 'development') {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// Trust proxy (Caddy reverse proxy sends X-Forwarded-For)
app.set('trust proxy', 1);

// AdminJS panel (mount BEFORE rate limiter - ADM-05)
const { admin, adminRouter: adminPanelRouter } = setupAdminJS();
app.use(admin.options.rootPath, adminPanelRouter);

// Rate limiting (scoped to /api only, excludes /admin)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // limit each IP to 500 requests per 15 min window
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api', limiter);

// Stripe webhook needs raw body - must be before express.json()
app.use('/api/subscription/webhook', express.raw({ type: 'application/json' }), (req, _res, next) => {
  (req as express.Request & { rawBody?: Buffer }).rawBody = req.body;
  next();
});

// Body parsing
app.use(express.json());

// HTTP request logging (after body parsing, before routes)
app.use(httpLogger);

// Health check (with DB connectivity)
app.get('/health', async (_req, res) => {
  try {
    const { prisma } = await import('./config/database.js');
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'ok', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(503).json({ status: 'degraded', db: 'error', timestamp: new Date().toISOString() });
  }
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/oauth', oauthRouter);
app.use('/api/users', userRouter);
app.use('/api/content', contentRouter);
app.use('/api/themes', themeRouter);
app.use('/api/reviews', reviewRouter);
app.use('/api/admin', adminApiRouter);
app.use('/api/subscription', subscriptionRouter);
app.use('/api/export', exportRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api/home', homeRouter);
app.use('/api/onboarding', onboardingRouter);

// Error handling
app.use(errorHandler);

// Start server
app.listen(config.port, () => {
  logger.info({ port: config.port }, 'Ankora API started');
  logger.info({ env: config.nodeEnv }, 'Environment loaded');

  // Start background job scheduler
  if (config.nodeEnv !== 'test') {
    startScheduler();
  }
});

export default app;
