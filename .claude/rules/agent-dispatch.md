# Agent Dispatch Guide

## Quick Selection

| Task Pattern | Agent | Model | Parallel? |
|--------------|-------|-------|-----------|
| "Find X in codebase" | `Explore` | haiku | Yes |
| "Run command X" | `Bash` | haiku | Yes |
| "Build/test/deploy" | `Bash` | haiku | Sequential |
| "Implement feature X" | `general-purpose` | sonnet | Backend+Frontend parallel |
| "Fix bug in X" | `general-purpose` | sonnet | No |
| "Plan implementation" | `Plan` | sonnet | No |

## Standard Workflows

### Feature Development
```
1. Explore (find related code) ─┬─ parallel
2. Plan (design approach)       │
3. general-purpose (backend)  ──┼─ parallel
4. general-purpose (frontend) ──┘
5. Bash (build + test)
6. Bash (deploy)
```

### Bug Fix
```
1. Explore (find root cause)
2. general-purpose (implement fix)
3. Bash (build + test + deploy)
```

### Query Debugging
```
1. Bash (curl API, check response)
2. Read (check route.ts query)
3. Edit (fix query)
4. Bash (deploy + verify)
```

## Model Cost Optimization

- **haiku**: File search, simple commands, quick lookups
- **sonnet**: Code implementation, complex analysis
- **opus**: Only for critical architecture decisions

## Parallel Execution Rules

- Independent searches: **parallel**
- Independent file reads: **parallel**
- Build → Test → Deploy: **sequential**
- Backend + Frontend implementation: **parallel**
