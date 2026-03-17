# TypeScript Best Practices

Guidelines for this project. Stack: **Bun + Express + TypeScript 5**, ES Modules, no linter configured.

---

## Types and Interfaces

### Prefer `interface` for object shapes, `type` for unions and aliases

```ts
// Good — object shape describing a domain entity
interface ChessPlayerStats {
  username: string;
  rating: number;
  platform: Platform;
}

// Good — union / alias
type Platform = "chessdotcom" | "lichess";
type OptionalRating = number | null;
```

### Never use `any`; use `unknown` when the type is truly unknown

```ts
// Bad
function parseResponse(data: any) { ... }

// Good
function parseResponse(data: unknown) {
  if (typeof data !== "object" || data === null) throw new Error("...");
  ...
}
```

### Avoid type assertions (`as`) unless unavoidable

When you must assert, add a comment explaining why:

```ts
// Justified: Express res.locals is typed as Record<string, any>
const stats = res.locals.stats as ChessPlayerStats;
```

### Avoid non-null assertions (`!`) — handle null/undefined explicitly

```ts
// Bad
const rating = player.stats!.rating;

// Good
if (!player.stats) throw new Error("stats missing");
const rating = player.stats.rating;
```

---

## Strict Mode

`strict: false` is currently set in `tsconfig.json`. Until strict mode is enabled:

- Always **annotate function parameters and return types explicitly**
- Never rely on implicit `any` inferred from missing annotations
- Treat all external API responses as `unknown` and validate/narrow before use

When adding new code, **write it as if `strict: true` were on** — this makes enabling it later a non-event.

---

## Functions

### Annotate parameters and return types

```ts
// Bad — return type is implicit
function buildCard(stats: ChessPlayerStats) {
  return `<svg>...</svg>`;
}

// Good
function buildCard(stats: ChessPlayerStats): string {
  return `<svg>...</svg>`;
}
```

### Prefer named functions over anonymous arrow functions for top-level exports

```ts
// Prefer
export function renderStatsCard(stats: ChessPlayerStats): string { ... }

// Avoid at module level
export const renderStatsCard = (stats: ChessPlayerStats): string => { ... };
```

Arrow functions are fine for callbacks and short inline expressions.

---

## Null and Undefined

- Use `undefined` as the absence-of-value sentinel; reserve `null` for cases where `null` is explicitly part of an external API contract
- Use optional chaining (`?.`) and nullish coalescing (`??`) instead of manual null checks

```ts
const flag = player.country?.code ?? "unknown";
```

---

## Error Handling

Follow the project pattern of augmenting `Error` objects with HTTP status:

```ts
function notFound(msg: string): never {
  throw Object.assign(new Error(msg), { status: 404 });
}
```

- Always rethrow with context; do not silently swallow errors
- Controller catch blocks should pass errors to `next(err)` for Express error middleware

---

## Modules and Imports

- Use **named exports** for everything except a module's primary default export
- Use `.js` extensions on local imports (required for Bun/Node ESM):

```ts
import { buildCard } from "./render/stats.js";
```

- Group imports in this order, separated by blank lines:
  1. Node built-ins (`node:path`, `node:fs`)
  2. Third-party packages (`express`, `pino`)
  3. Internal imports (`./services/cache.service.js`)

---

## Enums

Avoid TypeScript `enum`; use `const` objects with `as const` or union string types instead:

```ts
// Avoid
enum Platform { ChessDotCom, Lichess }

// Prefer
const PLATFORMS = ["chessdotcom", "lichess"] as const;
type Platform = (typeof PLATFORMS)[number];
```

---

## Generics

- Name generic parameters meaningfully when the context is non-obvious: `TData`, `TResult` over single-letter `T` in complex signatures
- Constrain generics when possible:

```ts
function getValue<T extends Record<string, unknown>>(obj: T, key: keyof T): T[keyof T] { ... }
```

---

## File and Naming Conventions

| Entity              | Convention          | Example                      |
|---------------------|---------------------|------------------------------|
| Files               | `kebab-case`        | `cache.service.ts`           |
| Interfaces/Types    | `PascalCase`        | `ChessPlayerStats`           |
| Functions/variables | `camelCase`         | `renderStatsCard`            |
| Constants           | `SCREAMING_SNAKE`   | `DEFAULT_CACHE_TTL`          |
| Type parameters     | `PascalCase`        | `TData`                      |

---

## Async / Await

- Always use `async/await`; avoid raw `.then()/.catch()` chains
- Wrap top-level `await` calls in `try/catch` in request handlers
- Type `Promise` return values explicitly:

```ts
async function fetchPlayerStats(username: string): Promise<ChessPlayerStats> { ... }
```

---

## Observability

The project uses OpenTelemetry spans. When adding new logic:

```ts
import { trace } from "@opentelemetry/api";

const span = trace.getActiveSpan();
span?.addEvent("cache.miss", { username });
```

Do not add `console.log` — use the `pino` logger from `src/logger.ts` instead:

```ts
import logger from "../logger.js";
logger.info({ username }, "fetching player stats");
```
