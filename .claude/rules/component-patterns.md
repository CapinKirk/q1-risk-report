# Component Patterns

## FunnelStageDetails (Unified Funnel Component)

Replaces duplicate MQL/SQL/SAL/SQO components with a single config-driven component.

### Usage
```tsx
import { FunnelStageDetails } from '@/components/funnel';

// MQL stage
<FunnelStageDetails stage="MQL" data={reportData.mql_details} />

// SQL stage
<FunnelStageDetails stage="SQL" data={reportData.sql_details} />

// SAL stage (POR only)
<FunnelStageDetails stage="SAL" data={reportData.sal_details} />

// SQO stage
<FunnelStageDetails stage="SQO" data={reportData.sqo_details} />
```

### Stage Configuration
Each stage has specific:
- **Title**: Display name
- **Status field**: Which field to use for status coloring
- **Status options**: Available status filters
- **Column visibility**: Which columns to show

```typescript
const STAGE_CONFIGS = {
  MQL: {
    title: 'Lead Details (MQL + EQL)',
    statusField: 'mql_status',
    statusOptions: ['NEW', 'CONTACTED', 'QUALIFIED', 'DISQUALIFIED'],
    columns: ['company', 'email', 'lead_type', 'source', 'mql_status', 'days_in_stage'],
  },
  // ... other stages
};
```

### Data Structure
```typescript
interface FunnelDetailRow {
  company: string;
  email: string;
  region: Region;
  lead_type?: LeadType;
  source?: Source;
  created_date?: string;
  mql_date?: string;
  sql_date?: string;
  sal_date?: string;
  sqo_date?: string;
  mql_status?: string;
  sql_status?: string;
  sal_status?: string;
  sqo_status?: string;
  opportunity_stage?: string;
  opportunity_acv?: number;
  days_in_stage?: number;
}
```

---

## Shared Hooks

### useFilters
Manages product, region, and search filter state.

```tsx
import { useFilters, filterByProduct, filterByRegion, filterBySearch } from '@/lib/hooks';

function MyComponent({ data }) {
  const {
    selectedProduct, setProduct,
    selectedRegion, setRegion,
    searchTerm, setSearchTerm,
    reset
  } = useFilters();

  // Apply filters
  const productFiltered = filterByProduct(data, selectedProduct);
  const regionFiltered = filterByRegion(productFiltered, selectedRegion);
  const filtered = filterBySearch(regionFiltered, searchTerm, ['company', 'email']);

  return (
    <>
      <SimpleFilterBar
        selectedProduct={selectedProduct}
        onProductChange={setProduct}
        selectedRegion={selectedRegion}
        onRegionChange={setRegion}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
      />
      <DataTable data={filtered} />
    </>
  );
}
```

### usePagination
Handles pagination logic with 25 items per page default.

```tsx
import { usePagination } from '@/lib/hooks';

function MyComponent({ data }) {
  const {
    currentPage,
    totalPages,
    paginatedItems,
    goToPage,
    nextPage,
    prevPage,
    hasNextPage,
    hasPrevPage
  } = usePagination(data, 25);

  return (
    <>
      <DataTable data={paginatedItems} />
      <CompactPagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={goToPage}
      />
    </>
  );
}
```

### useSortableTable
Handles table column sorting.

```tsx
import { useSortableTable } from '@/lib/hooks';

function MyComponent({ data }) {
  const { sortedData, sortConfig, requestSort, getSortIndicator } = useSortableTable(data);

  return (
    <table>
      <thead>
        <tr>
          <th onClick={() => requestSort('company')}>
            Company {getSortIndicator('company')}
          </th>
          <th onClick={() => requestSort('amount')}>
            Amount {getSortIndicator('amount')}
          </th>
        </tr>
      </thead>
      <tbody>
        {sortedData.map(row => <tr>...</tr>)}
      </tbody>
    </table>
  );
}
```

---

## Core UI Components

### Badge
Unified badge component for all badge types.

```tsx
import { Badge, ProductBadge, RegionBadge, StatusBadge, RAGBadge } from '@/components/core';

// Generic badge
<Badge type="product" value="POR" />
<Badge type="region" value="AMER" size="sm" />

// Convenience components
<ProductBadge value="R360" />
<RegionBadge value="EMEA" />
<StatusBadge value="WON" />
<RAGBadge value="GREEN" />
```

### FilterBar / SimpleFilterBar
Consistent filter controls.

```tsx
import { FilterBar, SimpleFilterBar } from '@/components/core';

// Full control
<FilterBar
  showProductFilter
  selectedProduct={product}
  onProductChange={setProduct}
  showRegionFilter
  selectedRegion={region}
  onRegionChange={setRegion}
  showStatusFilter
  selectedStatus={status}
  statusOptions={[{ value: 'WON', label: 'Won' }, ...]}
  onStatusChange={setStatus}
  showSearch
  searchTerm={search}
  onSearchChange={setSearch}
/>

// Simplified (product + region + search)
<SimpleFilterBar
  selectedProduct={product}
  onProductChange={setProduct}
  selectedRegion={region}
  onRegionChange={setRegion}
  searchTerm={search}
  onSearchChange={setSearch}
/>
```

### StatsBar / RAGStatsBar
Display summary statistics.

```tsx
import { StatsBar, RAGStatsBar } from '@/components/core';

// Generic stats
<StatsBar stats={[
  { label: 'Total', value: 150 },
  { label: 'Active', value: 85, color: '#059669' },
  { label: 'Lost', value: 12, color: '#dc2626' },
]} />

// RAG convenience
<RAGStatsBar
  total={150}
  active={85}
  converted={40}
  stalled={13}
  lost={12}
/>
```

### Pagination / CompactPagination
Page navigation.

```tsx
import { Pagination, CompactPagination } from '@/components/core';

// Full pagination with info
<Pagination
  currentPage={1}
  totalPages={10}
  onPageChange={setPage}
  totalItems={250}
  itemsPerPage={25}
/>

// Compact (just arrows + page indicator)
<CompactPagination
  currentPage={1}
  totalPages={10}
  onPageChange={setPage}
/>
```

---

## Migration Checklist

When migrating existing components to new patterns:

1. [ ] Replace inline filter state with `useFilters` hook
2. [ ] Replace inline pagination logic with `usePagination` hook
3. [ ] Replace custom filter UI with `SimpleFilterBar`
4. [ ] Replace custom badges with `Badge` components
5. [ ] Replace duplicate funnel details with `FunnelStageDetails`
6. [ ] Update imports to use `@/components/core` and `@/lib/hooks`
7. [ ] Verify build passes: `npm run build`
8. [ ] Run tests: `npx playwright test`
