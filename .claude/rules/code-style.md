---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---

# TypeScript/React Code Style

## Types
- Define shared interfaces in `lib/types.ts`
- Use `interface` for object shapes, `type` for unions
- Avoid `any` - use `unknown` or proper types
- Suffix types descriptively: `Row`, `Data`, `Props`, `Response`

## Components
- Add `'use client'` only when needed (useState, useEffect, handlers)
- Import order: React → Types → Utilities → Components
- Use inline styles or styled JSX for component styling
- Props interface directly above component

## Naming
| Type | Convention | Example |
|------|------------|---------|
| Folders | kebab-case | `user-profile/` |
| Components | PascalCase | `AttainmentTable.tsx` |
| Types | PascalCase | `ReportData` |
| Functions | camelCase | `formatCurrency()` |
| Constants | UPPER_SNAKE | `API_TIMEOUT` |
| Handlers | handle prefix | `handleClick` |

## Imports
Use `@/` alias for absolute imports:
- `@/lib/types` - Type definitions
- `@/lib/formatters` - Utilities
- `@/components/ComponentName` - Components

## Error Handling
- Wrap async in try/catch
- Log with context: `console.error('Context:', error)`
- Use optional chaining: `data?.field`
