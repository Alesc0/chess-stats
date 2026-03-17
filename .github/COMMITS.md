# Commit Guidelines

## Format

```
<type>(<scope>): <short summary>

[optional body]

[optional footer(s)]
```

### Rules

- **Header** must not exceed 72 characters
- **Type** and **scope** are lowercase
- **Summary** is written in the imperative mood, present tense ("add", not "added" or "adds")
- **No period** at the end of the summary line
- Leave a **blank line** between the header, body, and footer
- Wrap body lines at **80 characters**

---

## Types

| Type       | When to use                                                         |
|------------|---------------------------------------------------------------------|
| `feat`     | A new feature visible to the end user                               |
| `fix`      | A bug fix                                                           |
| `refactor` | Code change that neither fixes a bug nor adds a feature             |
| `perf`     | Performance improvement                                             |
| `style`    | Formatting, whitespace, missing semicolons — no logic change        |
| `test`     | Adding or correcting tests                                          |
| `docs`     | Documentation only changes (README, comments, JSDoc)                |
| `chore`    | Build process, dependency updates, tooling, CI changes              |
| `revert`   | Reverts a previous commit                                           |

---

## Scopes

Use the area of the codebase the change primarily affects. Common scopes for this project:

| Scope        | Area                                              |
|--------------|---------------------------------------------------|
| `render`     | SVG rendering (`src/render/`)                     |
| `providers`  | Chess.com / Lichess API clients (`src/providers/`)|
| `routes`     | Express route definitions (`src/routes/`)         |
| `controllers`| Request handlers (`src/controllers/`)             |
| `services`   | Business logic services (`src/services/`)         |
| `types`      | Type definitions (`src/types/`, `src/types.ts`)   |
| `config`     | Configuration (`src/config.ts`)                   |
| `middleware` | Express middleware (`src/middleware/`)             |
| `docker`     | Dockerfile or `.dockerignore`                     |
| `ci`         | GitHub Actions workflows (`.github/workflows/`)   |
| `deps`       | Dependency upgrades (`package.json`)              |

Scope can be omitted when a change is truly cross-cutting.

---

## Body

Include a body when the **why** behind the change is not obvious from the summary alone:

- Explain the motivation and context
- Describe what was changed at a higher level if necessary
- Reference relevant issues or design decisions

---

## Footer

### Breaking changes

```
BREAKING CHANGE: <description of what changed and migration path>
```

### Issue references

```
Closes #123
Fixes #456
Refs #789
```

---

## Examples

### Simple feature

```
feat(render): add dark theme support for stats card
```

### Bug fix with context

```
fix(providers): handle missing rating field from Chess.com API

Chess.com omits the `rating` key for newly created accounts that
have not played a rated game yet. Fall back to 0 to avoid a
runtime crash in the mapper.

Fixes #42
```

### Refactor with breaking change

```
refactor(types): rename PlayerStats to ChessPlayerStats

BREAKING CHANGE: The exported interface `PlayerStats` has been
renamed to `ChessPlayerStats` to avoid collisions with the Lichess
types. Update all imports accordingly.
```

### Dependency bump

```
chore(deps): upgrade @resvg/resvg-js to 2.7.0
```

### Documentation update

```
docs: update README with self-hosting instructions
```

---

## What NOT to do

- Do not use past tense: ~~"fixed the bug"~~ → "fix the bug"
- Do not combine unrelated changes in a single commit
- Do not leave the summary vague: ~~"misc fixes"~~, ~~"wip"~~, ~~"update"~~
- Do not exceed 72 characters in the header line
