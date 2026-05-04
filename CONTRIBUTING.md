# Contributing

Atellier Studio uses organized branches, commit messages, pull request descriptions, and merges so future review stays clear.

## Commit Format

Use:

```txt
type: imperative description

- Specific detail 1
- Specific detail 2
- Impact or result

Context or reasoning, when it is not obvious.
```

The first line must be 72 characters or fewer.

Use imperative mood:

- `add`
- `fix`
- `remove`
- `refactor`

Avoid past tense:

- `added`
- `fixes`
- `removed`

## Commit Types

| Type | When to use |
| --- | --- |
| `feat` | New functionality |
| `fix` | Bug fix |
| `refactor` | Restructure without behavior change |
| `perf` | Performance improvement |
| `docs` | Documentation only |
| `style` | Formatting/style, no logic change |
| `test` | Add or modify tests |
| `chore` | Build, dependencies, tooling |

## Branches

The repository uses a two-level base flow:

- `main`: stable production-ready history
- `dev/1.0.0`: integration branch for ongoing implementation work

Feature work must branch from `dev/1.0.0` and open PRs into `dev/1.0.0`.
Only validated releases should merge from `dev/1.0.0` into `main`.

Use short English branch names with hyphens:

```txt
feat/short-description
fix/short-description
refactor/short-description
chore/short-description
```

Do not commit directly to `main`.

### Branch setup (one-time)

Run this when initializing a local clone:

```bash
git switch main
git branch --set-upstream-to=origin/main main
git pull --ff-only
git switch -c dev/1.0.0
git push -u origin dev/1.0.0
```

If `dev/1.0.0` already exists on origin:

```bash
git fetch origin
git switch -c dev/1.0.0 --track origin/dev/1.0.0
```

## Pull Requests

Prepare these inputs before writing a PR:

1. What changed
2. Why it was necessary
3. How it was solved
4. Specific modifications
5. Benefits delivered

### Title

Start with an action verb and keep it under 80 characters.

Good:

```txt
Add operational spine dashboard
Fix run log persistence
Refactor frontend API hooks
Optimize API loading states
```

Avoid:

```txt
Updated files
Fixed some bugs
```

### Tone

- Professional and concise
- No emojis or decoration
- Accessible technical English
- Group changes by category, not file-by-file
