---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---

# Code Style Guidelines

## TypeScript Conventions

### Type Definitions
- Define interfaces in `lib/types.ts` for shared types
- Use `interface` for object shapes, `type` for unions/aliases
- Suffix with descriptive names: `Row`, `Data`, `Props`, `Response`

```typescript
// Good
interface AttainmentRow {
  product: Product;
  region: Region;
  qtd_acv: number;
}

// Avoid
interface Data { ... }
```

### Strict Typing
- Avoid `any` - use `unknown` if type is truly unknown
- Use union types for known values: `'POR' | 'R360'`
- Export all types from `lib/types.ts`

## React Components

### File Structure
```typescript
'use client';  // Only if needed (useState, useEffect, event handlers)

// 1. React imports
import { useState, useMemo } from 'react';

// 2. Type imports
import { SomeType } from '@/lib/types';

// 3. Utility imports
import { formatCurrency } from '@/lib/formatters';

// 4. Component imports
import ChildComponent from './ChildComponent';

// 5. Interface definition
interface Props { ... }

// 6. Component
export default function ComponentName({ prop1, prop2 }: Props) {
  // State declarations
  const [state, setState] = useState();

  // Computed values
  const computed = useMemo(() => ..., [deps]);

  // Event handlers
  const handleClick = () => { ... };

  // Render
  return <section>...</section>;
}
```

### Styling
- Use inline styles for component-specific styling
- Use CSS classes for shared/global styles
- Styled JSX for scoped component styles

```typescript
// Inline for simple cases
<div style={{ padding: '16px', background: '#f9fafb' }}>

// Styled JSX for complex cases
<style jsx>{`
  .container { padding: 16px; }
  .highlight { color: #16a34a; }
`}</style>
```

## API Routes

### Pattern
```typescript
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    // Validate input
    if (!body.startDate) {
      return NextResponse.json({ error: 'startDate required' }, { status: 400 });
    }
    // Process
    const result = await processData(body);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Always provide GET for documentation
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/endpoint-name',
    method: 'POST',
    parameters: { ... },
    example: { ... }
  });
}
```

## Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Folders | kebab-case | `user-profile/`, `api/` |
| Components | PascalCase | `AttainmentTable.tsx` |
| Utilities | camelCase | `formatCurrency.ts` |
| Types | PascalCase | `ReportData`, `AttainmentRow` |
| Constants | UPPER_SNAKE | `ITEMS_PER_PAGE`, `API_TIMEOUT` |
| Functions | camelCase | `calculateAttainment()` |
| Event handlers | camelCase + handle | `handleClick`, `handleFilterChange` |

## Imports

Use absolute imports with `@/` alias:
```typescript
import { ReportData } from '@/lib/types';
import { formatCurrency } from '@/lib/formatters';
import AttainmentTable from '@/components/AttainmentTable';
```

## Error Handling

- Always wrap async operations in try/catch
- Log errors with context: `console.error('Context:', error)`
- Return user-friendly error messages
- Use optional chaining for potentially null values: `data?.field`
