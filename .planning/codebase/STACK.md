# Technology Stack

**Analysis Date:** 2026-02-09

## Languages

**Primary:**
- TypeScript 5.7+ - Backend (Node.js), iOS (React Native), and frontend (React)

**Secondary:**
- JavaScript - Build tools (Vite), configuration files

## Runtime

**Environment:**
- Node.js v22 - Backend runtime (production on Hetzner VPS)
- Expo SDK 54 - iOS app development and distribution

**Package Manager:**
- npm - All Node-based projects
- Lockfile: npm-shrinkwrap.json or package-lock.json (present)

## Frameworks

**Backend:**
- Express.js 4.21 - REST API server
- Prisma 6.2 - ORM for PostgreSQL database

**iOS (Expo):**
- React Native 0.81 - Mobile UI framework
- expo-router 6.0 - File-based routing and navigation
- TanStack React Query 5.90 - Server state management and data fetching
- Zustand 5.0 - Client state management
- expo-secure-store 15.0 - Encrypted JWT token storage

**Frontend Web (React):**
- React 19 - UI framework
- Vite 6 - Build tool and dev server
- React Router DOM 7.1 - Client-side routing
- Zustand 5.0 - State management
- TanStack React Query 5.64 - Data fetching

**Development & Build:**
- Vitest 2.1 - Unit testing framework (backend)
- ESLint 9.18 - Code linting
- TypeScript 5.7 - Type checking
- tsx 4.19 - TypeScript execution (dev scripts)

## Key Dependencies

**Backend - Authentication:**
- jsonwebtoken 9.0 - JWT token signing/verification
- bcryptjs 2.4 - Password hashing
- passport 0.7 - Authentication middleware
- passport-google-oauth20 2.0 - Google OAuth provider
- passport-spotify 2.0 - Spotify OAuth provider

**Backend - Content Processing:**
- axios 1.13 - HTTP client for API calls
- rss-parser 3.13 - RSS feed parsing for podcast discovery
- youtube-transcript 1.2 - YouTube transcript extraction (fallback)
- youtube-captions-scraper 2.0 - YouTube captions scraping (fallback)
- youtubei.js 16.0 - YouTube API wrapper
- playwright 1.58 - Browser automation for Instagram/TikTok scraping
- p-limit 7.3 - Concurrency limiting for sync jobs

**Backend - Job Scheduling & Background:**
- node-cron 4.2 - Cron job scheduling (multiple workers: YouTube, Spotify, TikTok, Instagram, transcription)
- ioredis 5.4 - Redis client for caching (optional, production use)

**Backend - LLM & AI:**
- openai 6.16 - OpenAI API client (GPT-4 Turbo for quiz generation)
- Mistral API (fetch-based) - Alternative LLM provider for quiz generation
- Anthropic API (fetch-based) - Alternative LLM provider (Claude 3 Haiku)
- Groq (OpenAI-compatible) - Free Whisper transcription

**Backend - Payments:**
- stripe 17.5 - Stripe payments and subscription management

**Backend - Utilities:**
- dotenv 16.4 - Environment variable management
- cors 2.8 - Cross-Origin Resource Sharing middleware
- helmet 8.0 - HTTP security headers
- express-rate-limit 7.5 - API rate limiting
- zod 3.24 - Runtime validation and schema parsing
- archiver 7.0 - File archiving for data export

**iOS - UI & Navigation:**
- expo-router (Expo SDK 54) - File-based routing
- expo-vector-icons 15.0 - Icon library (integration with Expo Vector Icons)
- expo-haptics 15.0 - Haptic feedback
- react-native-markdown-display 7.0 - Markdown rendering
- react-native-gesture-handler 2.28 - Touch gesture handling
- react-native-reanimated 4.1 - Animations and reanimated gesture handler
- react-native-safe-area-context 5.6 - Safe area insets
- react-native-screens 4.16 - Screen management

**iOS - Storage & Security:**
- expo-secure-store 15.0 - Encrypted key-value storage for JWT tokens
- expo-file-system 19.0 - File system access
- react-native-view-shot 4.0 - Screenshot/render view to image
- @preeternal/react-native-cookie-manager 6.3 - Cookie management for OAuth flows

**iOS - Web Integration:**
- expo-web-browser 15.0 - Web authentication (OAuth flows)
- react-native-webview 13.15 - Embedded webview component

**iOS - Build & Deployment:**
- expo-updates 29.0 - OTA (Over-The-Air) updates
- expo-dev-client 6.0 - Custom development client for Expo Go alternatives
- expo-constants 18.0 - App configuration access

**Frontend Web - Styling:**
- Tailwind CSS 3.4 - Utility-first CSS framework
- autoprefixer 10.4 - CSS vendor prefix automation
- PostCSS 8.5 - CSS transformations

**Frontend Web - Icons:**
- lucide-react 0.473 - Icon library for React

**Frontend Web - Utilities:**
- clsx 2.1 - Conditional class name utility

## Configuration

**Environment:**
- `.env` file (backend) - Backend secrets and API keys
- `.env` file (iOS) - Runtime via expo-constants
- Configuration loaded via Zod schema validation (`backend/src/config/env.ts`)

**Key Environment Variables:**
```
# Server
PORT, NODE_ENV

# Database
DATABASE_URL (PostgreSQL/Supabase), DIRECT_URL (direct connection)

# Redis (optional)
REDIS_URL (defaults to redis://localhost:6379)

# JWT
JWT_SECRET, JWT_EXPIRES_IN, JWT_REFRESH_SECRET, JWT_REFRESH_EXPIRES_IN

# OAuth Providers
YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_CALLBACK_URL
SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_CALLBACK_URL

# LLM (configurable via LLM_PROVIDER enum)
LLM_PROVIDER (openai|mistral|anthropic)
OPENAI_API_KEY, MISTRAL_API_KEY, ANTHROPIC_API_KEY

# Transcription
GROQ_API_KEY (Whisper via Groq - free), OPENAI_API_KEY (fallback)

# Podcast Discovery
PODCAST_INDEX_API_KEY, PODCAST_INDEX_API_SECRET
LISTEN_NOTES_API_KEY (alternative)

# Email (Resend)
RESEND_API_KEY, EMAIL_FROM

# Stripe (Payments)
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_MONTHLY, STRIPE_PRICE_YEARLY

# Frontend
FRONTEND_URL
```

**Build Configuration:**
- `backend/tsconfig.json` - Strict TypeScript, path aliases `@/*`
- `ios/tsconfig.json` - Expo base tsconfig with path aliases
- `frontend/tsconfig.json` - Strict TypeScript, no special paths
- `ios/eas.json` - EAS Build profiles (development, preview, production)
- `ios/app.json` - Expo app configuration, deep links (`ankora://`), iOS bundle ID (`com.fysnerd.ankora`)
- `backend/vitest.config.ts` - Test runner configuration, v8 coverage, node environment

## Platform Requirements

**Development:**
- Node.js v22+
- npm 10+
- Expo CLI (for iOS app development)
- EAS CLI (for building production iOS app)
- TypeScript compiler
- Optional: Redis (for caching, defaults to in-memory)

**Production - Backend (Hetzner VPS):**
- Node.js v22
- PostgreSQL 14+ (via Supabase)
- PM2 (cluster mode process manager)
- Caddy (reverse proxy, HTTPS via Let's Encrypt)
- Redis (optional, for performance)

**Production - iOS:**
- iOS 12+ (via TestFlight distribution)
- Expo Go or custom dev client for development

**Production - Web:**
- Modern browser (React 19, ES2022 target)
- No special requirements

---

*Stack analysis: 2026-02-09*
