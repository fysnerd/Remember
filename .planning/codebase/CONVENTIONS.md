# Coding Conventions

**Analysis Date:** 2026-02-09

## Naming Patterns

**Files:**
- Backend: `camelCase.ts` - Services, routes, middleware, workers, config all use camelCase
  - Examples: `quizGeneration.ts`, `youtubeSync.ts`, `errorHandler.ts`, `authStore.ts`
- iOS: `PascalCase.tsx` for components, `camelCase.ts` for hooks/stores/utilities
  - Examples: `QuestionCard.tsx`, `Button.tsx`, `useContent.ts`, `authStore.ts`

**Functions:**
- Backend: `camelCase` for all functions (async and sync)
  - Examples: `generateQuizFromTranscript()`, `processInstagramTranscript()`, `syncUserPlatforms()`
- iOS: `camelCase` for hooks and utilities, `PascalCase` for React components
  - Examples: `useContent()`, `useTriageMutation()`, `Button`, `QuestionCard`

**Variables:**
- `camelCase` throughout both codebases
- Descriptive names preferred: `isSelected`, `isLoading`, `selectedId` (not `sel`, `load`, `id`)

**Types:**
- Backend: `PascalCase` for interfaces and types
  - Examples: `QuizGenerationResult`, `GeneratedQuestion`, `AuthState`
- iOS: `PascalCase` for interfaces and types
  - Examples: `ButtonProps`, `Content`, `LoginResponse`, `Option`
- Enum values: `SCREAMING_SNAKE_CASE` (from Prisma/database)
  - Examples: `Platform.YOUTUBE`, `ContentStatus.READY`, `TranscriptSource.MANUAL`

## Code Style

**Formatting:**
- Both projects use **TypeScript strict mode enabled**
- Backend: `tsconfig.json` enforces strict types with `noImplicitAny`, `strictNullChecks`, `noUnusedLocals`, `noUnusedParameters`
- iOS: Expo extends base config with `strict: true`
- **No explicit formatter enforced** (no prettier/eslint config files detected) - rely on TypeScript checking

**Linting:**
- Backend: ESLint configured (`eslint` and `@typescript-eslint` in devDeps)
  - Run: `npm run lint` in backend
  - No `.eslintrc` file found - uses default config or inline via ESLint v9 flat config
- iOS: No linting setup detected
- TypeScript is primary enforcement mechanism

## Import Organization

**Order:**
1. Third-party imports (React, libraries)
2. Local imports (from `../`, `./`)
3. Type imports where appropriate

**Examples from codebase:**

Backend (`src/routes/auth.ts`):
```typescript
import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { config } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';
import { generateTokens, authenticateToken, JwtPayload } from '../middleware/auth.js';
```

iOS (`app/login.tsx`):
```typescript
import { useState } from 'react';
import { View, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, Input, Button, useToast } from '../components/ui';
import { useAuthStore } from '../stores/authStore';
import { colors, spacing } from '../theme';
```

**Path Aliases:**
- Backend: `@/*` resolves to `./src/*` (tsconfig.json)
  - Usage: `import { prisma } from '@/config/database'`
- iOS: `@/*` resolves to current directory (iOS root)
  - Usage: `import { colors } from '@/theme'` (means `./theme`)

## Error Handling

**Backend Patterns:**

1. **Custom AppError class** - `src/middleware/errorHandler.ts`
   - Extends `Error` with `statusCode`, `message`, `isOperational` properties
   - Used to differentiate operational errors from unexpected ones
   ```typescript
   throw new AppError(409, 'Email already registered');
   ```

2. **Error handler middleware** - catches all errors centrally
   - Checks error type (`AppError`, `PrismaClientKnownRequestError`, `JsonWebTokenError`, `TokenExpiredError`)
   - Returns appropriate HTTP status and sanitized error message
   - Production: hides error details; Development: exposes full message

3. **Try-catch in routes and services**
   - Catches errors and either throws AppError or lets middleware handle
   ```typescript
   try {
     const response = await api.post('/auth/login', { email, password });
   } catch (error: unknown) {
     const message = getErrorMessage(error, 'Email or password incorrect');
     set({ isLoading: false, error: message });
     throw new Error(message);
   }
   ```

**iOS Patterns:**

1. **Helper function for error extraction** - `ios/stores/authStore.ts`
   ```typescript
   function getErrorMessage(error: unknown, fallback: string): string {
     // Safely extract error from Axios response
     if (error && typeof error === 'object' && 'response' in error...) {
       return serverError || fallback;
     }
     return fallback;
   }
   ```

2. **Try-catch in mutations/async operations**
   - Errors caught and stored in state (e.g., `error: string | null`)
   - UI displays error via toast/alert

3. **Axios interceptor for 401 handling** - `ios/lib/api.ts`
   - Automatically retries failed requests after token refresh
   - Queues failed requests during token refresh to avoid race conditions
   ```typescript
   api.interceptors.response.use((response) => response, async (error) => {
     if (error.response?.status === 401 && !originalRequest._retry) {
       // Refresh token and retry
     }
   });
   ```

## Logging

**Backend Framework:** `console` (no dedicated logging library)

**Patterns:**
- Prefix logs with context identifier in brackets: `[Quiz]`, `[Auth]`, `[Worker]`, `[Instagram]`
- Log levels: `console.log()` for info, `console.error()` for errors
- Mocked in test setup (`tests/setup.ts`) to reduce noise

**Examples:**
```typescript
console.log(`[Quiz Worker] Processing ${pendingContent.length} items`);
console.error(`[Quiz] Error generating quiz for ${contentId}:`, error);
console.log(`[Auth] Triggered background sync for ${connections.length} platforms`);
```

**iOS Framework:** None (no logging setup)
- Could use native `console.log()` during development
- Errors tracked via state management (Zustand stores)

## Comments

**When to Comment:**
- JSDoc for exported functions and complex logic
- Explain WHY, not WHAT (code should be clear on WHAT)
- Prefix worker comments with context: `// Quiz validation helpers`, `// Backend content structure`

**JSDoc/TSDoc Usage:**
- Backend uses it selectively
  - Example from `src/services/quizGeneration.ts`:
  ```typescript
  /**
   * Chunk a long transcript into manageable pieces
   */
  function chunkTranscript(text: string, maxChars: number): string[] {
  ```

  ```typescript
  /**
   * Generate quiz questions from transcript using configured LLM
   */
  export async function generateQuizFromTranscript(
    transcript: string,
    contentTitle: string,
    contentType: 'video' | 'podcast'
  ): Promise<QuizGenerationResult> {
  ```

- iOS uses JSDoc for complex components
  - Example from `ios/components/quiz/QuestionCard.tsx`:
  ```typescript
  /**
   * Quiz question card with options
   */
  ```

**Inline Comments:**
- Used for non-obvious logic or workarounds
- Example: `// Clean option text - remove leading "A) ", "B) ", etc. if present`

## Function Design

**Size:** Prefer small, focused functions (50-100 lines typical)
- Services like `quizGeneration.ts` have larger functions (200+ lines) when necessary for complex workflows
- Break down into helper functions when possible

**Parameters:**
- Destructuring preferred for multiple parameters
  ```typescript
  export function useTriageMutation() {
    return useMutation({
      mutationFn: async ({
        contentIds,
        action,
      }: {
        contentIds: string[];
        action: 'learn' | 'archive';
      }) => {
  ```

- Use object for many related params
  ```typescript
  async function sendDailyReminder(params: {
    userId: string;
    userEmail: string;
    userName: string;
    dueCards: Card[];
  }): Promise<void> {
  ```

**Return Values:**
- Explicit return types required (TypeScript strict mode)
- Async functions return `Promise<T>`
- Multiple return values wrapped in object or dedicated type
  ```typescript
  interface QuizGenerationResult {
    questions: GeneratedQuestion[];
    isEducational: boolean;
    rejectionReason?: string;
  }
  ```

## Module Design

**Exports:**
- Named exports preferred for functions, types, constants
- Default export only for app entry points (`app/_layout.tsx`, `src/index.ts`)
- Backend route modules export router: `export const authRouter = Router()`

**Barrel Files:**
- Used in iOS UI components: `ios/components/ui/index.ts` re-exports all UI components
  ```typescript
  export { Text } from './Text';
  export { Button } from './Button';
  export { Card } from './Card';
  ```

- Used in iOS hooks: `ios/hooks/index.ts`

**Single Responsibility:**
- Services (`src/services/*.ts`) - business logic for one domain
  - Example: `quizGeneration.ts` handles quiz generation and memos
  - Example: `transcription.ts` handles YouTube transcription only
- Routes (`src/routes/*.ts`) - HTTP endpoint handlers for one domain
- Stores (`ios/stores/*.ts`) - Zustand state for one feature

## Type Safety Patterns

**Zod validation** - Backend uses for request validation
```typescript
const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().optional(),
});

const data = signupSchema.parse(req.body);
```

**Type guards** - Used for error handling and narrowing
```typescript
function validateQuizQuestion(q: unknown): q is QuizQuestion {
  if (typeof q !== 'object' || q === null) return false;
  const quiz = q as Record<string, unknown>;
  return (
    typeof quiz.question === 'string' &&
    quiz.question.length > 0 &&
    // ... more checks
  );
}
```

**Interface-based contracts** - All API responses typed
```typescript
interface BackendContent {
  id: string;
  platform: 'YOUTUBE' | 'SPOTIFY' | 'TIKTOK' | 'INSTAGRAM';
  title: string;
  // ...
}
```

---

*Convention analysis: 2026-02-09*
