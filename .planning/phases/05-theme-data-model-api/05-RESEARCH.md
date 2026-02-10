# Phase 5: Theme Data Model & API - Research

**Researched:** 2026-02-10
**Domain:** Prisma schema design, explicit M:N relations, Express.js REST API, PostgreSQL
**Confidence:** HIGH

## Summary

Phase 5 introduces a Theme entity into the Ankora data model -- a user-owned grouping layer above the existing Tag system. The core challenge is modeling a many-to-many relationship between Content and Theme using explicit join tables (as decided), while ensuring performant queries for content counts and filtered listings. The existing codebase already follows well-established patterns (Prisma + Express + Zod + JWT auth), so this phase is a natural extension rather than a new paradigm.

The Prisma schema changes are straightforward: a `Theme` model with user ownership, a `ContentTheme` explicit join table, and a `ThemeTag` table linking themes to their constituent tag patterns (DATA-03). The API layer follows the exact same patterns already used in `content.ts` and `review.ts` -- Express Router, `authenticateToken` middleware, Zod validation, Prisma queries with `include` and `_count`. No new dependencies are needed beyond a simple slug generation utility.

**Primary recommendation:** Follow existing codebase patterns exactly. Use explicit join tables with composite `@@id` and `@@unique` constraints. Use `_count` on the join table relation for content counts. Generate slugs with a simple utility function (no library needed for this scale). Apply schema changes via `prisma db push` on VPS (matching existing workflow, no migrations directory exists).

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma | ^6.2.1 | ORM, schema, migrations | Already in use, handles explicit M:N natively |
| Express | ^4.21.2 | HTTP routing | Already in use, new Router for /api/themes |
| Zod | ^3.24.1 | Request validation | Already in use in review.ts and env.ts |
| @prisma/client | ^6.2.1 | Generated client | Already in use |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pino | ^10.3.0 | Structured logging | Already in use via logger.child() |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled slug | `slugify` npm package | Overkill for simple name-to-slug; a 5-line function suffices |
| Prisma implicit M:N | Explicit join table | Explicit was decided -- allows metadata on join, better performance control, required for ThemeTag |

**Installation:**
```bash
# No new packages needed -- all dependencies already exist
```

## Architecture Patterns

### Recommended Project Structure
```
backend/src/
├── routes/
│   └── themes.ts         # NEW: Theme CRUD + content association endpoints
├── prisma/
│   └── schema.prisma     # MODIFIED: Theme, ContentTheme, ThemeTag models added
└── index.ts              # MODIFIED: mount themeRouter at /api/themes
```

### Pattern 1: Explicit Many-to-Many Join Table
**What:** Instead of Prisma's implicit M:N (which creates a hidden `_ContentToTheme` table), use an explicit model for the join table with its own fields.
**When to use:** When you need metadata on the relation, performance control, or direct query access to the join table.
**Example:**
```typescript
// Source: https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/many-to-many-relations
model Theme {
  id          String         @id @default(cuid())
  userId      String
  user        User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  name        String
  slug        String
  color       String         @default("#6366F1")
  emoji       String         @default("📚")
  contentThemes ContentTheme[]
  themeTags     ThemeTag[]
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  @@unique([userId, slug])
  @@unique([userId, name])
  @@index([userId])
}

model ContentTheme {
  id          String   @id @default(cuid())
  contentId   String
  content     Content  @relation(fields: [contentId], references: [id], onDelete: Cascade)
  themeId     String
  theme       Theme    @relation(fields: [themeId], references: [id], onDelete: Cascade)
  assignedAt  DateTime @default(now())
  assignedBy  String   @default("system")  // "system" | "user" | "ai"

  @@unique([contentId, themeId])
  @@index([themeId])
  @@index([contentId])
}

model ThemeTag {
  id       String @id @default(cuid())
  themeId  String
  theme    Theme  @relation(fields: [themeId], references: [id], onDelete: Cascade)
  tagId    String
  tag      Tag    @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@unique([themeId, tagId])
  @@index([themeId])
  @@index([tagId])
}
```

### Pattern 2: Content Count via _count on Join Table
**What:** With explicit M:N, `_count` operates on the join table relation, not the target model directly.
**When to use:** Whenever you need "how many content items in this theme" without loading all content.
**Example:**
```typescript
// Get themes with content counts
const themes = await prisma.theme.findMany({
  where: { userId },
  include: {
    _count: {
      select: { contentThemes: true },
    },
  },
  orderBy: { name: 'asc' },
});

// Response shape: { id, name, slug, ..., _count: { contentThemes: 5 } }
// Transform to: { ...theme, contentCount: theme._count.contentThemes }
```

### Pattern 3: Router Registration (Following Existing Pattern)
**What:** New Express Router for themes, mounted in index.ts.
**When to use:** Every new API domain gets its own Router file.
**Example:**
```typescript
// src/routes/themes.ts
import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';

export const themeRouter = Router();
themeRouter.use(authenticateToken);

// src/index.ts
import { themeRouter } from './routes/themes.js';
app.use('/api/themes', themeRouter);
```

### Pattern 4: Slug Generation Utility
**What:** Simple function to convert theme name to URL-safe slug.
**When to use:** On theme creation and rename.
**Example:**
```typescript
// Inline utility -- no library needed for this scale
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents (French support)
    .replace(/[^a-z0-9\s-]/g, '')    // Remove special chars
    .replace(/\s+/g, '-')            // Spaces to dashes
    .replace(/-+/g, '-')             // Collapse multiple dashes
    .replace(/^-|-$/g, '');          // Trim leading/trailing dashes
}
// "Intelligence Artificielle" -> "intelligence-artificielle"
// "Psychologie & Mémoire" -> "psychologie-memoire"
```

### Pattern 5: Zod Validation (Following review.ts Pattern)
**What:** Use Zod schemas for request body validation, return 400 with details on failure.
**When to use:** Every POST/PUT/PATCH endpoint.
**Example:**
```typescript
const createThemeSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  emoji: z.string().max(4).optional(), // Emoji can be 1-4 chars (multi-codepoint)
});

// In route handler:
try {
  const data = createThemeSchema.parse(req.body);
  // ...
} catch (error) {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: 'Validation error', details: error.errors });
  }
  return next(error);
}
```

### Anti-Patterns to Avoid
- **Querying content through join table in loops:** Always use Prisma `include` or batch queries, never N+1 loops.
- **Implicit M:N for ContentTheme:** The decision is explicit join tables. Do NOT use `@relation("ContentThemes")` implicit syntax.
- **Global themes (no user scoping):** Tags are global, but themes MUST be per-user. Every query must filter by `userId`.
- **Skipping slug uniqueness per user:** Slugs must be unique per user (not globally). Use `@@unique([userId, slug])`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Slug generation | Complex slug library | Simple 5-line function | French accent stripping + basic ASCII is all that's needed |
| Request validation | Manual if/else checks | Zod schemas | Already in use, type-safe, auto-generates error messages |
| Pagination | Custom offset/limit logic | Copy pattern from content.ts | Exact same page/limit/total/totalPages pattern exists |
| Authentication | Custom auth check | `authenticateToken` middleware | Already handles JWT verification + user lookup |
| Logging | console.log | `logger.child({ route: 'themes' })` | Structured JSON logging already configured |

**Key insight:** This phase requires zero new patterns. Every pattern needed (auth, validation, pagination, logging, Prisma queries) already exists in the codebase. Copy and adapt.

## Common Pitfalls

### Pitfall 1: _count Targets Join Table, Not Content
**What goes wrong:** Writing `_count: { select: { contents: true } }` on Theme -- this won't work because Theme has no direct `contents` relation.
**Why it happens:** Developers think in terms of the logical relationship (Theme -> Content) rather than the Prisma model (Theme -> ContentTheme -> Content).
**How to avoid:** Always use `_count: { select: { contentThemes: true } }` and rename in the response.
**Warning signs:** TypeScript error "contents does not exist on type..."

### Pitfall 2: Missing User Scoping on Theme Queries
**What goes wrong:** Querying themes without `userId` filter, exposing other users' themes.
**Why it happens:** Tags in the current schema are global (`Tag` has no `userId`). Themes are per-user.
**How to avoid:** Every theme query MUST include `where: { userId: req.user!.id }`. Add it to Prisma queries AND route-level checks.
**Warning signs:** API returning themes from other users in tests.

### Pitfall 3: Slug Collision on Theme Rename
**What goes wrong:** User renames theme to a name that generates the same slug as another theme they own.
**Why it happens:** `@@unique([userId, slug])` constraint violation.
**How to avoid:** Check for existing slug before updating, return 409 Conflict. Or append a counter suffix.
**Warning signs:** Prisma P2002 unique constraint error.

### Pitfall 4: Cascading Deletes on Theme Deletion
**What goes wrong:** Deleting a theme also deletes content items.
**Why it happens:** Misconfigured `onDelete` behavior on relations.
**How to avoid:** `ContentTheme` should cascade delete (joining record removed when theme deleted), but `Content` must NOT cascade from ContentTheme. The `onDelete: Cascade` on ContentTheme.themeId ensures join records are removed, but ContentTheme.contentId's cascade is for when CONTENT is deleted (not theme).
**Warning signs:** Content disappears when theme is deleted.

### Pitfall 5: Schema Push Without Prisma Generate
**What goes wrong:** Prisma client types are stale after schema changes.
**Why it happens:** `prisma db push` updates the database but may not regenerate the client.
**How to avoid:** Always run `npx prisma generate` after schema changes (locally), and `prisma db push` then `npx prisma generate` on VPS.
**Warning signs:** TypeScript errors about missing models/fields.

### Pitfall 6: Forgetting to Add Theme Relations to Existing Models
**What goes wrong:** Content model doesn't have `contentThemes` relation field, Tag model doesn't have `themeTags` relation field.
**Why it happens:** Only adding the new models but forgetting to add back-relations on Content, Tag, and User.
**How to avoid:** Check that Content, Tag, and User models all have the new relation arrays added.
**Warning signs:** Prisma validation errors on `prisma generate`.

## Code Examples

Verified patterns adapted from existing codebase:

### Theme CRUD: Create Theme
```typescript
// Following pattern from content.ts POST routes
themeRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createThemeSchema.parse(req.body);
    const userId = req.user!.id;
    const slug = generateSlug(data.name);

    // Check theme cap (15-25 per user)
    const themeCount = await prisma.theme.count({ where: { userId } });
    if (themeCount >= 25) {
      return res.status(400).json({ error: 'Maximum 25 themes per user reached' });
    }

    // Check slug uniqueness for this user
    const existing = await prisma.theme.findUnique({
      where: { userId_slug: { userId, slug } },
    });
    if (existing) {
      return res.status(409).json({ error: 'A theme with a similar name already exists' });
    }

    const theme = await prisma.theme.create({
      data: {
        userId,
        name: data.name.trim(),
        slug,
        color: data.color || '#6366F1',
        emoji: data.emoji || '📚',
      },
    });

    return res.status(201).json(theme);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    return next(error);
  }
});
```

### Theme List with Content Counts (DATA-04)
```typescript
// GET /api/themes - Following pattern from content.ts GET /
themeRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const themes = await prisma.theme.findMany({
      where: { userId: req.user!.id },
      include: {
        _count: {
          select: { contentThemes: true },
        },
        themeTags: {
          include: { tag: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Transform _count for cleaner API response
    const result = themes.map(({ _count, themeTags, ...theme }) => ({
      ...theme,
      contentCount: _count.contentThemes,
      tags: themeTags.map(tt => ({ id: tt.tag.id, name: tt.tag.name })),
    }));

    return res.json({ themes: result });
  } catch (error) {
    return next(error);
  }
});
```

### Theme Detail with Paginated Content (DATA-05)
```typescript
// GET /api/themes/:id - Following pagination pattern from content.ts
themeRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = '1', limit = '20', platform } = req.query;
    const themeId = req.params.id;
    const userId = req.user!.id;

    // Verify theme ownership
    const theme = await prisma.theme.findFirst({
      where: { id: themeId, userId },
      include: {
        _count: { select: { contentThemes: true } },
        themeTags: { include: { tag: true } },
      },
    });

    if (!theme) {
      return res.status(404).json({ error: 'Theme not found' });
    }

    // Build content filter through join table
    const contentWhere: any = {
      contentThemes: { some: { themeId } },
      userId,
    };
    if (platform && typeof platform === 'string') {
      contentWhere.platform = platform;
    }

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);

    const [contents, total] = await Promise.all([
      prisma.content.findMany({
        where: contentWhere,
        orderBy: { capturedAt: 'desc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
        include: { tags: true },
      }),
      prisma.content.count({ where: contentWhere }),
    ]);

    const { _count, themeTags, ...themeData } = theme;
    return res.json({
      theme: {
        ...themeData,
        contentCount: _count.contentThemes,
        tags: themeTags.map(tt => ({ id: tt.tag.id, name: tt.tag.name })),
      },
      contents,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    return next(error);
  }
});
```

### Content API Including Themes (DATA-06)
```typescript
// Modify existing content.ts GET / to include themes
// In the prisma.content.findMany include block, add:
include: {
  tags: true,
  contentThemes: {
    include: {
      theme: {
        select: { id: true, name: true, slug: true, color: true, emoji: true },
      },
    },
  },
  _count: {
    select: { quizzes: true },
  },
}
// Then transform in response:
// content.themes = content.contentThemes.map(ct => ct.theme)
```

### Assign Content to Themes
```typescript
// POST /api/themes/:id/content - Add content items to a theme
themeRouter.post('/:id/content', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { contentIds } = req.body;
    const themeId = req.params.id;
    const userId = req.user!.id;

    // Verify theme ownership
    const theme = await prisma.theme.findFirst({
      where: { id: themeId, userId },
    });
    if (!theme) {
      return res.status(404).json({ error: 'Theme not found' });
    }

    // Verify content ownership
    const contents = await prisma.content.findMany({
      where: { id: { in: contentIds }, userId },
      select: { id: true },
    });

    // Create join records (skip duplicates with skipDuplicates)
    const result = await prisma.contentTheme.createMany({
      data: contents.map(c => ({
        contentId: c.id,
        themeId,
        assignedBy: 'user',
      })),
      skipDuplicates: true,
    });

    return res.json({
      message: `${result.count} content(s) added to theme`,
      added: result.count,
    });
  } catch (error) {
    return next(error);
  }
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Prisma implicit M:N | Explicit join tables with metadata | Prisma 2.x+ | Allows `assignedAt`, `assignedBy` fields; better query control |
| Tags as grouping | Themes as user-scoped layer above tags | This phase (new) | Tags remain global/auto-generated; themes are user-owned, AI-curated groupings |
| `db push` for schema sync | `prisma migrate` for production | Prisma 3+ | Project has both scripts; no migrations directory exists locally, likely using `db push` in practice |

**Important note about schema deployment:**
The project has `prisma migrate dev` and `prisma migrate deploy` scripts configured, but no `migrations/` directory exists. This means the project has been using `prisma db push` for schema changes. For this phase, continue with `db push` on VPS: `npx prisma db push && npx prisma generate && npm run build`.

## Open Questions

1. **Default color palette for themes**
   - What we know: Themes have a `color` field (hex string). AI will auto-create themes in Phase 6.
   - What's unclear: What specific colors should be the defaults/palette? Should there be a fixed set?
   - Recommendation: Define a palette of 10-15 visually distinct colors as constants. Use them as defaults for AI-generated themes. Let user override later (Phase 7).

2. **ThemeTag purpose and lifecycle**
   - What we know: DATA-03 requires "Themes are linked to tag patterns for deterministic classification." Phase 6 (classification worker) will use ThemeTag to know which tags belong to which theme.
   - What's unclear: Should ThemeTag be populated during Phase 5 or Phase 6?
   - Recommendation: Create the ThemeTag model in Phase 5 (schema), but don't populate it until Phase 6 (classification worker). Phase 5 API can expose ThemeTag read access but doesn't need write endpoints for it yet.

3. **Theme cap enforcement scope**
   - What we know: Cap at 15-25 per user to prevent proliferation (CLASS-05).
   - What's unclear: Should the cap be enforced at the API level (Phase 5) or only at the worker level (Phase 6)?
   - Recommendation: Enforce at API level in Phase 5 (prevent manual creation beyond cap) AND at worker level in Phase 6 (prevent AI from exceeding cap). Use a constant `MAX_THEMES_PER_USER = 25`.

## Sources

### Primary (HIGH confidence)
- [Prisma Many-to-Many Relations docs](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/many-to-many-relations) - Explicit M:N syntax, join table patterns
- [Prisma Relation Queries docs](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries) - `_count`, `include`, nested filters
- Existing codebase (`content.ts`, `review.ts`, `tagging.ts`, `schema.prisma`) - Established patterns for routes, auth, validation, Prisma usage

### Secondary (MEDIUM confidence)
- [Prisma Deploy Database Changes](https://www.prisma.io/docs/orm/prisma-client/deployment/deploy-database-changes-with-prisma-migrate) - `db push` vs `migrate deploy` guidance
- [Prisma Modeling Many-to-Many](https://www.prisma.io/docs/orm/more/help-and-troubleshooting/working-with-many-to-many-relations) - Querying patterns, filtering through join tables

### Tertiary (LOW confidence)
- N/A -- all findings verified with official docs or existing codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies, all patterns exist in codebase
- Architecture: HIGH - Direct extension of established patterns (content.ts, review.ts)
- Pitfalls: HIGH - Based on verified Prisma docs + real codebase analysis
- Schema design: HIGH - Prisma explicit M:N is well-documented and widely used

**Research date:** 2026-02-10
**Valid until:** 2026-03-10 (stable domain, Prisma 6.x unlikely to break these patterns)
