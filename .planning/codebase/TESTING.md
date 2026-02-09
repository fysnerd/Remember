# Testing Patterns

**Analysis Date:** 2026-02-09

## Test Framework

**Runner:**
- Vitest 2.1.8
- Config: `backend/vitest.config.ts`

**Assertion Library:**
- Vitest's built-in `expect()`

**Run Commands:**
```bash
cd backend
npm run test              # Run all tests
npm run test -- --watch  # Watch mode (inferred from vitest)
npm run test -- --coverage  # Coverage report
```

## Test File Organization

**Location:**
- Backend: `tests/unit/` and `tests/integration/` directories
- iOS: No test files detected (integration testing likely via Expo)

**Naming:**
- `*.test.ts` - primary naming convention
- Located parallel to source code in separate `tests/` directory, not co-located

**Structure:**
```
backend/
├── tests/
│   ├── setup.ts              # Global setup, mocks
│   ├── unit/
│   │   ├── quiz.test.ts
│   │   ├── sm2.test.ts
│   │   ├── validation.test.ts
│   │   └── export.test.ts
│   └── integration/
│       └── auth.test.ts
└── src/
```

## Test Structure

**Suite Organization:**

Using Vitest `describe` and `it` blocks:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Auth API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Token Generation', () => {
    it('should generate valid JWT tokens', async () => {
      const jwt = await import('jsonwebtoken');
      const token = jwt.default.sign({ userId: 'test' }, 'secret');
      expect(token).toBe('mock_token');
    });
  });

  describe('Password Hashing', () => {
    it('should hash passwords securely', async () => {
      // test body
    });
  });
});
```

From `backend/tests/integration/auth.test.ts`:

**Patterns:**

1. **Setup before each test** - Clear mocks
   ```typescript
   beforeEach(() => {
     vi.clearAllMocks();
   });
   ```

2. **Assertion pattern** - `expect()` chains
   ```typescript
   expect(validateQuizQuestion(validQuiz)).toBe(true);
   expect(validateQuizQuestion(invalid)).toBe(false);
   expect(result).toHaveLength(1);
   expect(result[0].question).toBe('What is the capital of France?');
   expect(user).toBeDefined();
   expect(user?.email).toBe('test@example.com');
   ```

3. **Test descriptions** - Describe behavior, not implementation
   ```typescript
   it('should accept valid quiz question', () => { ... });
   it('should reject quiz without question', () => { ... });
   it('should filter out invalid questions', () => { ... });
   ```

## Mocking

**Framework:** Vitest `vi` module

**Patterns:**

1. **Module mocking** - Mock entire modules before importing
   ```typescript
   vi.mock('bcryptjs', () => ({
     default: {
       hash: vi.fn().mockResolvedValue('hashed_password'),
       compare: vi.fn().mockImplementation((password, hash) => {
         return Promise.resolve(password === 'correct_password');
       }),
     },
   }));
   ```

2. **Function mocking** - Mock imported functions
   ```typescript
   vi.mock('jsonwebtoken', () => ({
     default: {
       sign: vi.fn().mockReturnValue('mock_token'),
       verify: vi.fn().mockImplementation((token) => {
         if (token === 'valid_token') {
           return { userId: 'test-user-id' };
         }
         throw new Error('Invalid token');
       }),
     },
   }));
   ```

3. **Prisma mocking** - Mock database layer
   ```typescript
   vi.mock('../../src/config/database.js', () => ({
     prisma: {
       user: {
         findUnique: vi.fn().mockImplementation(({ where }) => {
           if (where.email === 'test@example.com') {
             return Promise.resolve(mockUser);
           }
           return Promise.resolve(null);
         }),
         create: vi.fn().mockResolvedValue(mockUser),
         update: vi.fn().mockResolvedValue(mockUser),
       },
     },
   }));
   ```

4. **Global spying** - Spy on console methods
   ```typescript
   // In tests/setup.ts
   vi.spyOn(console, 'log').mockImplementation(() => {});
   vi.spyOn(console, 'error').mockImplementation(() => {});
   ```

**What to Mock:**
- External libraries (bcryptjs, jsonwebtoken, axios)
- Database layer (Prisma client)
- Environment-dependent modules
- Console output (to reduce test noise)

**What NOT to Mock:**
- Internal business logic functions
- Validation helpers (test real implementations)
- Data transformation functions (test actual output)
- Custom error classes

## Fixtures and Factories

**Test Data:**

Mock user object defined once and reused:
```typescript
const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  passwordHash: 'hashed_password',
  name: 'Test User',
  emailVerified: true,
  plan: 'FREE',
  createdAt: new Date(),
  updatedAt: new Date(),
};
```

Test data hardcoded in test cases:
```typescript
const validQuiz = {
  question: 'What is 2 + 2?',
  options: ['A) 3', 'B) 4', 'C) 5', 'D) 6'],
  correctAnswer: 'B',
  explanation: 'Basic addition',
};
```

**Location:**
- Fixtures defined inside test files (co-located with tests)
- Constants and mocks at top of test files
- No separate fixtures directory

## Coverage

**Requirements:** Not enforced
- Config present: `coverage.provider: 'v8'` in `vitest.config.ts`
- Reporters configured: `['text', 'json', 'html']`
- Excludes: node_modules, dist, test files, type definitions

**View Coverage:**
```bash
npm run test -- --coverage
```

## Test Types

**Unit Tests:**
- Location: `tests/unit/`
- Scope: Single function or validation logic
- Examples:
  - `quiz.test.ts` - Tests `validateQuizQuestion()` and `parseQuizResponse()` in isolation
  - `validation.test.ts` - Tests validation helper functions
  - `sm2.test.ts` - Tests SM-2 algorithm implementation
  - `export.test.ts` - Tests export formatting logic

- Approach: Mock all external dependencies (database, APIs), test pure functions
  ```typescript
  describe('Quiz Validation', () => {
    describe('validateQuizQuestion', () => {
      it('should accept valid quiz question', () => {
        const validQuiz = { ... };
        expect(validateQuizQuestion(validQuiz)).toBe(true);
      });
    });
  });
  ```

**Integration Tests:**
- Location: `tests/integration/`
- Scope: API endpoint behavior with mocked dependencies
- Example: `auth.test.ts` - Tests auth flow (signup, password hashing, token generation)
- Approach: Mock Prisma + external services, test request → response flow
  ```typescript
  describe('Auth API', () => {
    describe('Token Generation', () => {
      it('should generate valid JWT tokens', async () => {
        const jwt = await import('jsonwebtoken');
        const token = jwt.default.sign({ userId: 'test' }, 'secret');
        expect(token).toBe('mock_token');
      });
    });
  });
  ```

**E2E Tests:**
- Not implemented
- Framework: None detected
- Would need Expo test runner or similar for iOS app

## Common Patterns

**Async Testing:**
```typescript
it('should hash passwords securely', async () => {
  const bcrypt = await import('bcryptjs');
  const hash = await bcrypt.default.hash('password', 10);
  expect(hash).toBe('hashed_password');
});
```

- Use `async/await` directly in test
- Vitest handles promise resolution automatically
- No special assertions needed (expect works on promises)

**Error Testing:**
```typescript
it('should reject quiz without question', () => {
  const invalid = {
    options: ['A) 3', 'B) 4'],
    correctAnswer: 'B',
    // missing question
  };
  expect(validateQuizQuestion(invalid)).toBe(false);
});

it('should reject invalid tokens', async () => {
  const jwt = await import('jsonwebtoken');
  expect(() => jwt.default.verify('invalid_token', 'secret')).toThrow();
});
```

- For sync errors: Use `expect().toThrow()`
- For validation errors: Return false from validator, test the boolean
- For async errors: Can await rejection or test error handling in catch block

**Testing Validators and Parsers:**
```typescript
describe('parseQuizResponse', () => {
  it('should parse valid JSON array', () => {
    const response = `[{ "question": "...", ... }]`;
    const result = parseQuizResponse(response);
    expect(result).toHaveLength(1);
    expect(result[0].question).toBe('What is the capital of France?');
  });

  it('should extract JSON from surrounding text', () => {
    const response = `Here are the quiz questions: [{ ... }] I hope these help!`;
    const result = parseQuizResponse(response);
    expect(result).toHaveLength(1);
  });

  it('should filter out invalid questions', () => {
    // Multiple questions, some invalid
    const result = parseQuizResponse(response);
    expect(result).toHaveLength(1); // Only valid ones
  });

  it('should return empty array for invalid JSON', () => {
    const response = 'This is not JSON at all';
    const result = parseQuizResponse(response);
    expect(result).toHaveLength(0);
  });
});
```

**Testing Type Guards:**
```typescript
function validateTag(tag: unknown): tag is string {
  return typeof tag === 'string' && tag.length > 0 && tag.length <= 50;
}

describe('Tag Validation', () => {
  it('should validate correct tags', () => {
    expect(validateTag('machine learning')).toBe(true);
    expect(validateTag('python')).toBe(true);
  });

  it('should reject invalid tags', () => {
    expect(validateTag('')).toBe(false);
    expect(validateTag(123)).toBe(false);
    expect(validateTag(null)).toBe(false);
    expect(validateTag('a'.repeat(51))).toBe(false);
  });
});
```

## Test Environment Setup

From `backend/tests/setup.ts`:

```typescript
// Mock environment variables for tests
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/remember_test';
process.env.JWT_SECRET = 'test-jwt-secret-key-at-least-32-characters-long';
// ... all required env vars

// Global setup
beforeAll(() => {
  // Any global setup
});

// Global teardown
afterAll(() => {
  // Any global cleanup
});

// Mock console to reduce noise in tests
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});
```

- All environment variables set up in global setup
- Console output mocked by default (cleaner test output)
- Runs before any test suite (`setupFiles: ['./tests/setup.ts']` in vitest.config.ts)

## Testing Best Practices Observed

1. **Test behavior, not implementation** - Focus on inputs/outputs
2. **Arrange, Act, Assert** - Setup test data, execute code, verify results
3. **One assertion per test** (mostly) - Or group related assertions
4. **Descriptive test names** - `it('should...')` format
5. **DRY for test data** - Reuse mock objects
6. **Mock external dependencies** - Keep tests fast and isolated
7. **Test edge cases** - Empty strings, null, invalid types
8. **Test error paths** - Not just happy path

---

*Testing analysis: 2026-02-09*
