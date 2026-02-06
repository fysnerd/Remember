import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authRouter } from './routes/auth.js';
import { oauthRouter } from './routes/oauth.js';
import { userRouter } from './routes/user.js';
import { contentRouter } from './routes/content.js';
import { reviewRouter } from './routes/review.js';
import { adminRouter } from './routes/admin.js';
import { subscriptionRouter } from './routes/subscription.js';
import { exportRouter } from './routes/export.js';
import { startScheduler } from './workers/scheduler.js';

const app = express();

// Security middleware
app.use(helmet({
  // Allow inline scripts for desktop auth page
  contentSecurityPolicy: false,
}));

// CORS - allow frontend and tunnel URLs
const allowedOrigins = [
  config.frontendUrl,
  'https://misc-saver-additionally-podcasts.trycloudflare.com',
];
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (same-origin, mobile apps, etc.)
    if (!origin) return callback(null, true);
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

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' },
});
app.use(limiter);

// Stripe webhook needs raw body - must be before express.json()
app.use('/api/subscription/webhook', express.raw({ type: 'application/json' }), (req, _res, next) => {
  (req as express.Request & { rawBody?: Buffer }).rawBody = req.body;
  next();
});

// Body parsing
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/oauth', oauthRouter);
app.use('/api/users', userRouter);
app.use('/api/content', contentRouter);
app.use('/api/reviews', reviewRouter);
app.use('/api/admin', adminRouter);
app.use('/api/subscription', subscriptionRouter);
app.use('/api/export', exportRouter);

// Error handling
app.use(errorHandler);

// Start server
app.listen(config.port, () => {
  console.log(`Remember API running on http://localhost:${config.port}`);
  console.log(`Environment: ${config.nodeEnv}`);

  // Start background job scheduler
  if (config.nodeEnv !== 'test') {
    startScheduler();
  }
});

export default app;
