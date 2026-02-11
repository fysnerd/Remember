import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  // Server
  PORT: z.string().default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Database
  DATABASE_URL: z.string(),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  // Google OAuth (user signup)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().url().optional(),

  // YouTube OAuth
  YOUTUBE_CLIENT_ID: z.string().optional(),
  YOUTUBE_CLIENT_SECRET: z.string().optional(),
  YOUTUBE_CALLBACK_URL: z.string().url().optional(),

  // Spotify OAuth
  SPOTIFY_CLIENT_ID: z.string().optional(),
  SPOTIFY_CLIENT_SECRET: z.string().optional(),
  SPOTIFY_CALLBACK_URL: z.string().url().optional(),

  // Frontend
  FRONTEND_URL: z.string().url(),

  // LLM Provider - choose one: openai, mistral, anthropic
  LLM_PROVIDER: z.enum(['openai', 'mistral', 'anthropic']).default('openai'),

  // OpenAI (Whisper + GPT-4)
  OPENAI_API_KEY: z.string().optional(),

  // Mistral API
  MISTRAL_API_KEY: z.string().optional(),

  // Anthropic (Claude)
  ANTHROPIC_API_KEY: z.string().optional(),

  // Groq (free Whisper transcription)
  GROQ_API_KEY: z.string().optional(),

  // Listen Notes (RSS feed lookup for podcasts)
  LISTEN_NOTES_API_KEY: z.string().optional(),

  // Podcast Index (RSS feed lookup - free, open source)
  PODCAST_INDEX_API_KEY: z.string().optional(),
  PODCAST_INDEX_API_SECRET: z.string().optional(),

  // Email (Resend)
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().default('noreply@remember.app'),

  // Stripe
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_MONTHLY: z.string().optional(),
  STRIPE_PRICE_YEARLY: z.string().optional(),

  // Admin panel
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(8).optional(),

  // yt-dlp proxy (e.g. socks5://127.0.0.1:40000 for Cloudflare WARP)
  YTDLP_PROXY: z.string().optional(),
});

// Parse and validate
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const env = parsed.data;

export const config = {
  port: parseInt(env.PORT, 10),
  nodeEnv: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',

  database: {
    url: env.DATABASE_URL,
  },

  redis: {
    url: env.REDIS_URL,
  },

  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
    refreshSecret: env.JWT_REFRESH_SECRET,
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
  },

  google: {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    callbackUrl: env.GOOGLE_CALLBACK_URL,
  },

  youtube: {
    clientId: env.YOUTUBE_CLIENT_ID,
    clientSecret: env.YOUTUBE_CLIENT_SECRET,
    callbackUrl: env.YOUTUBE_CALLBACK_URL,
  },

  spotify: {
    clientId: env.SPOTIFY_CLIENT_ID,
    clientSecret: env.SPOTIFY_CLIENT_SECRET,
    callbackUrl: env.SPOTIFY_CALLBACK_URL,
  },

  frontendUrl: env.FRONTEND_URL,

  // LLM configuration
  llm: {
    provider: env.LLM_PROVIDER,
    openaiApiKey: env.OPENAI_API_KEY,
    mistralApiKey: env.MISTRAL_API_KEY,
    anthropicApiKey: env.ANTHROPIC_API_KEY,
  },

  // Keep backward compatibility
  openai: {
    apiKey: env.OPENAI_API_KEY,
  },

  groq: {
    apiKey: env.GROQ_API_KEY,
  },

  listenNotes: {
    apiKey: env.LISTEN_NOTES_API_KEY,
  },

  podcastIndex: {
    apiKey: env.PODCAST_INDEX_API_KEY,
    apiSecret: env.PODCAST_INDEX_API_SECRET,
  },

  email: {
    resendApiKey: env.RESEND_API_KEY,
    from: env.EMAIL_FROM,
  },

  stripe: {
    secretKey: env.STRIPE_SECRET_KEY,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET,
    priceMonthly: env.STRIPE_PRICE_MONTHLY,
    priceYearly: env.STRIPE_PRICE_YEARLY,
  },

  admin: {
    email: env.ADMIN_EMAIL || '',
    password: env.ADMIN_PASSWORD || '',
  },

  ytdlp: {
    proxy: env.YTDLP_PROXY || '',
  },
} as const;
