'use client';

import { useMemo, useState } from 'react';
import { Region, Product, Category, FunnelByCategoryRow, FunnelBySourceActuals, RAGStatus } from '@/lib/types';
import SortableHeader from './SortableHeader';
import { useSortableTable } from '@/lib/useSortableTable';

interface FunnelMilestoneAttainmentProps {
  funnelData: {
    POR: FunnelByCategoryRow[];
    R360: FunnelByCategoryRow[];
  };
  funnelBySource?: {
    POR: FunnelBySourceActuals[];
    R360: FunnelBySourceActuals[];
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getRAG(pct: number): RAGStatus {
  if (pct >= 90) return 'GREEN';
  if (pct >= 70) return 'YELLOW';
  return 'RED';
}

function getRagColor(rag: RAGStatus): string {
  switch (rag) {
    case 'GREEN': return '#16a34a';
    case 'YELLOW': return '#ca8a04';
    case 'RED': return '#dc2626';
    default: return '#6b7280';
  }
}

/**
 * TOF Score: Weighted attainment across funnel stages
 * EQL/MQL=10%, SQL=20%, SAL=30%, SQO=40%
 */
function calculateTOFScore(mql: number, sql: number, sal: number, sqo: number): number {
  return Math.round((mql * 0.10) + (sql * 0.20) + (sal * 0.30) + (sqo * 0.40));
}

function getLeadStageLabel(category: Category): 'MQL' | 'EQL' {
  return (category === 'NEW LOGO' || category === 'STRATEGIC') ? 'MQL' : 'EQL';
}

// ============================================================================
// INTERFACES
// ============================================================================

interface UnifiedRowData {
  id: string;
  product: Product;
  region: Region;
  category: Category;
  source: string;
  leadStageLabel: 'MQL' | 'EQL';
  mqlActual: number;
  mqlTarget: number;
  mqlPacingPct: number;
  sqlActual: number;
  sqlTarget: number;
  sqlPacingPct: number;
  salActual: number;
  salTarget: number;
  salPacingPct: number;
  sqoActual: number;
  sqoTarget: number;
  sqoPacingPct: number;
  tofScore: number;
}

// ============================================================================
// MULTI-SELECT FILTER COMPONENT
// ============================================================================

interface MultiSelectProps<T extends string> {
  label: string;
  options: T[];
  selected: T[];
  onChange: (selected: T[]) => void;
  allLabel?: string;
}

function MultiSelect<T extends string>({ label, options, selected, onChange, allLabel = 'All' }: MultiSelectProps<T>) {
  const allSelected = selected.length === options.length;

  const toggleOption = (option: T) => {
    // If all are selected and user clicks an individual option, select ONLY that option
    if (allSelected) {
      onChange([option]);
      return;
    }

    if (selected.includes(option)) {
      // Don't allow deselecting all
      if (selected.length === 1) return;
      onChange(selected.filter(s => s !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  const toggleAll = () => {
    if (allSelected) {
      // Select only first option
      onChange([options[0]]);
    } else {
      onChange([...options]);
    }
  };

  return (
    <div className="multi-select">
      <span className="multi-select-label">{label}:</span>
      <button
        className={`filter-chip ${allSelected ? 'active' : ''}`}
        onClick={toggleAll}
      >
        {allSelected && <span className="check-icon">✓</span>}
        {allLabel}
      </button>
      {options.map(option => {
        const isSelected = selected.includes(option);
        const showActive = isSelected && !allSelected;
        return (
          <button
            key={option}
            className={`filter-chip ${showActive ? 'active' : ''} ${allSelected ? 'dim' : ''} ${!isSelected && !allSelected ? 'unselected' : ''}`}
            onClick={() => toggleOption(option)}
          >
            {showActive && <span className="check-icon">✓</span>}
            {option}
          </button>
        );
      })}
      <style jsx>{`
        .multi-select {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .multi-select-label {
          font-size: 0.7rem;
          font-weight: 600;
          color: var(--text-secondary);
          min-width: 55px;
        }
        .filter-chip {
          padding: 4px 10px;
          font-size: 0.65rem;
          font-weight: 500;
          border: 2px solid var(--border-primary);
          background: var(--bg-secondary);
          color: var(--text-secondary);
          border-radius: 14px;
          cursor: pointer;
          transition: all 0.15s;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .filter-chip:hover {
          background: var(--bg-hover);
          border-color: var(--text-tertiary);
        }
        .filter-chip.active {
          background: #2563eb;
          color: white;
          border-color: #2563eb;
          font-weight: 600;
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.3);
        }
        .filter-chip.active:hover {
          background: #1d4ed8;
          border-color: #1d4ed8;
        }
        .filter-chip.unselected {
          background: var(--bg-tertiary);
          color: var(--text-muted);
          border-style: dashed;
          opacity: 0.7;
        }
        .filter-chip.unselected:hover {
          opacity: 1;
          border-style: solid;
          background: var(--bg-hover);
        }
        .filter-chip.dim {
          opacity: 0.5;
          background: var(--bg-tertiary);
        }
        .filter-chip.dim:hover {
          opacity: 1;
        }
        .check-icon {
          font-size: 0.6rem;
          font-weight: bold;
        }
      `}</style>
    </div>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

// ============================================================================
// SORTING TYPES AND HELPERS
// ============================================================================

type SortKey = 'label' | 'mqlActual' | 'mqlTarget' | 'mqlPacingPct' |
               'sqlActual' | 'sqlTarget' | 'sqlPacingPct' |
               'salActual' | 'salTarget' | 'salPacingPct' |
               'sqoActual' | 'sqoTarget' | 'sqoPacingPct' | 'tofScore';

type SortDirection = 'asc' | 'desc';

interface SortConfig {
  key: SortKey;
  direction: SortDirection;
}

function sortData<T extends { label: string; mqlActual: number; mqlTarget: number; mqlPacingPct: number; sqlActual: number; sqlTarget: number; sqlPacingPct: number; salActual: number; salTarget: number; salPacingPct: number; sqoActual: number; sqoTarget: number; sqoPacingPct: number; tofScore: number }>(
  data: T[],
  sortConfig: SortConfig | null
): T[] {
  if (!sortConfig) return data;

  return [...data].sort((a, b) => {
    const aVal = sortConfig.key === 'label' ? a.label : a[sortConfig.key];
    const bVal = sortConfig.key === 'label' ? b.label : b[sortConfig.key];

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortConfig.direction === 'asc'
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }

    const numA = aVal as number;
    const numB = bVal as number;
    return sortConfig.direction === 'asc' ? numA - numB : numB - numA;
  });
}

export default function FunnelMilestoneAttainment({ funnelData, funnelBySource }: FunnelMilestoneAttainmentProps) {
  // Sort state for each table
  const [categorySortConfig, setCategorySortConfig] = useState<SortConfig | null>(null);
  const [sourceSortConfig, setSourceSortConfig] = useState<SortConfig | null>(null);
  const [regionSortConfig, setRegionSortConfig] = useState<SortConfig | null>(null);

  // Available options
  const availableProducts: Product[] = useMemo(() => {
    const products: Product[] = [];
    if (funnelData.POR.length > 0 || (funnelBySource?.POR && funnelBySource.POR.length > 0)) products.push('POR');
    if (funnelData.R360.length > 0 || (funnelBySource?.R360 && funnelBySource.R360.length > 0)) products.push('R360');
    return products;
  }, [funnelData, funnelBySource]);

  const availableRegions: Region[] = ['AMER', 'EMEA', 'APAC'];
  const availableCategories: Category[] = ['NEW LOGO', 'STRATEGIC', 'EXPANSION', 'MIGRATION'];

  const availableSources: string[] = useMemo(() => {
    const sources = new Set<string>();
    if (funnelBySource) {
      funnelBySource.POR.forEach(r => sources.add(r.source));
      funnelBySource.R360.forEach(r => sources.add(r.source));
    }
    return Array.from(sources).sort();
  }, [funnelBySource]);

  // Multi-select filter states
  const [selectedProducts, setSelectedProducts] = useState<Product[]>(availableProducts);
  const [selectedRegions, setSelectedRegions] = useState<Region[]>(availableRegions);
  const [selectedCategories, setSelectedCategories] = useState<Category[]>(availableCategories);
  const [selectedSources, setSelectedSources] = useState<string[]>(availableSources);

  // Build unified dataset from source data (most granular)
  const unifiedData = useMemo(() => {
    const rows: UnifiedRowData[] = [];

    if (funnelBySource) {
      const processRows = (sourceRows: FunnelBySourceActuals[], product: Product) => {
        sourceRows.forEach(row => {
          // Determine category based on source patterns or default to NEW LOGO
          // In the source data, we don't have category directly, so we'll aggregate by source
          const category: Category = 'NEW LOGO'; // Default - source view doesn't have category

          // Use QTD targets for pacing calculations (not Q1 targets)
          const qtdTargetMql = row.qtd_target_mql || 0;
          const qtdTargetSql = row.qtd_target_sql || 0;
          const qtdTargetSal = row.qtd_target_sal || 0;
          const qtdTargetSqo = row.qtd_target_sqo || 0;

          const mqlPacingPct = qtdTargetMql > 0 ? Math.round((row.actual_mql / qtdTargetMql) * 100) : 100;
          const sqlPacingPct = qtdTargetSql > 0 ? Math.round((row.actual_sql / qtdTargetSql) * 100) : 100;
          const salPacingPct = qtdTargetSal > 0 ? Math.round((row.actual_sal / qtdTargetSal) * 100) : 100;
          const sqoPacingPct = qtdTargetSqo > 0 ? Math.round((row.actual_sqo / qtdTargetSqo) * 100) : 100;

          rows.push({
            id: `${product}-${row.region}-${row.source}`,
            product,
            region: row.region,
            category,
            source: row.source,
            leadStageLabel: getLeadStageLabel(category),
            mqlActual: row.actual_mql,
            mqlTarget: qtdTargetMql,
            mqlPacingPct,
            sqlActual: row.actual_sql,
            sqlTarget: qtdTargetSql,
            sqlPacingPct,
            salActual: row.actual_sal,
            salTarget: qtdTargetSal,
            salPacingPct,
            sqoActual: row.actual_sqo,
            sqoTarget: qtdTargetSqo,
            sqoPacingPct,
            tofScore: calculateTOFScore(mqlPacingPct, sqlPacingPct, salPacingPct, sqoPacingPct),
          });
        });
      };

      processRows(funnelBySource.POR, 'POR');
      processRows(funnelBySource.R360, 'R360');
    }

    return rows;
  }, [funnelBySource]);

  // Build category-based data (separate aggregation)
  const categoryData = useMemo(() => {
    const rows: UnifiedRowData[] = [];
    const funnelCategories: Category[] = ['NEW LOGO', 'STRATEGIC', 'EXPANSION', 'MIGRATION'];

    const processRows = (catRows: FunnelByCategoryRow[], product: Product) => {
      catRows.forEach(row => {
        if (!funnelCategories.includes(row.category)) return;

        const mqlPacingPct = (row.qtd_target_mql || 0) > 0 ? Math.round(((row.actual_mql || 0) / (row.qtd_target_mql || 1)) * 100) : 100;
        const sqlPacingPct = (row.qtd_target_sql || 0) > 0 ? Math.round(((row.actual_sql || 0) / (row.qtd_target_sql || 1)) * 100) : 100;
        const salPacingPct = (row.qtd_target_sal || 0) > 0 ? Math.round(((row.actual_sal || 0) / (row.qtd_target_sal || 1)) * 100) : 100;
        const sqoPacingPct = (row.qtd_target_sqo || 0) > 0 ? Math.round(((row.actual_sqo || 0) / (row.qtd_target_sqo || 1)) * 100) : 100;

        rows.push({
          id: `${product}-${row.region}-${row.category}`,
          product,
          region: row.region,
          category: row.category,
          source: 'ALL',
          leadStageLabel: getLeadStageLabel(row.category),
          mqlActual: row.actual_mql || 0,
          mqlTarget: row.qtd_target_mql || 0,
          mqlPacingPct,
          sqlActual: row.actual_sql || 0,
          sqlTarget: row.qtd_target_sql || 0,
          sqlPacingPct,
          salActual: row.actual_sal || 0,
          salTarget: row.qtd_target_sal || 0,
          salPacingPct,
          sqoActual: row.actual_sqo || 0,
          sqoTarget: row.qtd_target_sqo || 0,
          sqoPacingPct,
          tofScore: calculateTOFScore(mqlPacingPct, sqlPacingPct, salPacingPct, sqoPacingPct),
        });
      });
    };

    processRows(funnelData.POR, 'POR');
    processRows(funnelData.R360, 'R360');

    return rows;
  }, [funnelData]);

  // Aggregate filtered data by the visible dimensions
  const aggregatedData = useMemo(() => {
    // Use category data as base, filter and aggregate
    const baseData = categoryData.filter(row =>
      selectedProducts.includes(row.product) &&
      selectedRegions.includes(row.region) &&
      selectedCategories.includes(row.category)
    );

    // Aggregate by category (sum across products and regions)
    const categoryMap = new Map<Category, {
      mqlActual: number; mqlTarget: number;
      sqlActual: number; sqlTarget: number;
      salActual: number; salTarget: number;
      sqoActual: number; sqoTarget: number;
    }>();

    baseData.forEach(row => {
      const existing = categoryMap.get(row.category) || {
        mqlActual: 0, mqlTarget: 0, sqlActual: 0, sqlTarget: 0,
        salActual: 0, salTarget: 0, sqoActual: 0, sqoTarget: 0,
      };
      categoryMap.set(row.category, {
        mqlActual: existing.mqlActual + row.mqlActual,
        mqlTarget: existing.mqlTarget + row.mqlTarget,
        sqlActual: existing.sqlActual + row.sqlActual,
        sqlTarget: existing.sqlTarget + row.sqlTarget,
        salActual: existing.salActual + row.salActual,
        salTarget: existing.salTarget + row.salTarget,
        sqoActual: existing.sqoActual + row.sqoActual,
        sqoTarget: existing.sqoTarget + row.sqoTarget,
      });
    });

    const result: Array<{
      label: string;
      type: 'category';
      category: Category;
      leadStageLabel: 'MQL' | 'EQL';
      mqlActual: number; mqlTarget: number; mqlPacingPct: number;
      sqlActual: number; sqlTarget: number; sqlPacingPct: number;
      salActual: number; salTarget: number; salPacingPct: number;
      sqoActual: number; sqoTarget: number; sqoPacingPct: number;
      tofScore: number;
    }> = [];

    categoryMap.forEach((data, category) => {
      const mqlPacingPct = data.mqlTarget > 0 ? Math.round((data.mqlActual / data.mqlTarget) * 100) : 100;
      const sqlPacingPct = data.sqlTarget > 0 ? Math.round((data.sqlActual / data.sqlTarget) * 100) : 100;
      const salPacingPct = data.salTarget > 0 ? Math.round((data.salActual / data.salTarget) * 100) : 100;
      const sqoPacingPct = data.sqoTarget > 0 ? Math.round((data.sqoActual / data.sqoTarget) * 100) : 100;

      result.push({
        label: category,
        type: 'category',
        category,
        leadStageLabel: getLeadStageLabel(category),
        ...data,
        mqlPacingPct,
        sqlPacingPct,
        salPacingPct,
        sqoPacingPct,
        tofScore: calculateTOFScore(mqlPacingPct, sqlPacingPct, salPacingPct, sqoPacingPct),
      });
    });

    return result.sort((a, b) => a.tofScore - b.tofScore);
  }, [categoryData, selectedProducts, selectedRegions, selectedCategories]);

  // Aggregate by source (separate view)
  const sourceAggregatedData = useMemo(() => {
    const baseData = unifiedData.filter(row =>
      selectedProducts.includes(row.product) &&
      selectedRegions.includes(row.region) &&
      selectedSources.includes(row.source)
    );

    // Aggregate by source
    const sourceMap = new Map<string, {
      mqlActual: number; mqlTarget: number;
      sqlActual: number; sqlTarget: number;
      salActual: number; salTarget: number;
      sqoActual: number; sqoTarget: number;
    }>();

    baseData.forEach(row => {
      const existing = sourceMap.get(row.source) || {
        mqlActual: 0, mqlTarget: 0, sqlActual: 0, sqlTarget: 0,
        salActual: 0, salTarget: 0, sqoActual: 0, sqoTarget: 0,
      };
      sourceMap.set(row.source, {
        mqlActual: existing.mqlActual + row.mqlActual,
        mqlTarget: existing.mqlTarget + row.mqlTarget,
        sqlActual: existing.sqlActual + row.sqlActual,
        sqlTarget: existing.sqlTarget + row.sqlTarget,
        salActual: existing.salActual + row.salActual,
        salTarget: existing.salTarget + row.salTarget,
        sqoActual: existing.sqoActual + row.sqoActual,
        sqoTarget: existing.sqoTarget + row.sqoTarget,
      });
    });

    const result: Array<{
      label: string;
      type: 'source';
      source: string;
      mqlActual: number; mqlTarget: number; mqlPacingPct: number;
      sqlActual: number; sqlTarget: number; sqlPacingPct: number;
      salActual: number; salTarget: number; salPacingPct: number;
      sqoActual: number; sqoTarget: number; sqoPacingPct: number;
      tofScore: number;
    }> = [];

    sourceMap.forEach((data, source) => {
      // Only skip if BOTH actuals AND targets are all zero (truly empty)
      const hasActuals = data.mqlActual > 0 || data.sqlActual > 0 || data.salActual > 0 || data.sqoActual > 0;
      const hasTargets = data.mqlTarget > 0 || data.sqlTarget > 0 || data.salTarget > 0 || data.sqoTarget > 0;
      if (!hasActuals && !hasTargets) return;

      const mqlPacingPct = data.mqlTarget > 0 ? Math.round((data.mqlActual / data.mqlTarget) * 100) : 100;
      const sqlPacingPct = data.sqlTarget > 0 ? Math.round((data.sqlActual / data.sqlTarget) * 100) : 100;
      const salPacingPct = data.salTarget > 0 ? Math.round((data.salActual / data.salTarget) * 100) : 100;
      const sqoPacingPct = data.sqoTarget > 0 ? Math.round((data.sqoActual / data.sqoTarget) * 100) : 100;

      result.push({
        label: source,
        type: 'source',
        source,
        ...data,
        mqlPacingPct,
        sqlPacingPct,
        salPacingPct,
        sqoPacingPct,
        tofScore: calculateTOFScore(mqlPacingPct, sqlPacingPct, salPacingPct, sqoPacingPct),
      });
    });

    return result.sort((a, b) => a.tofScore - b.tofScore);
  }, [unifiedData, selectedProducts, selectedRegions, selectedSources]);

  // Aggregate by region
  const regionAggregatedData = useMemo(() => {
    const baseData = categoryData.filter(row =>
      selectedProducts.includes(row.product) &&
      selectedRegions.includes(row.region) &&
      selectedCategories.includes(row.category)
    );

    const regionMap = new Map<Region, {
      mqlActual: number; mqlTarget: number;
      sqlActual: number; sqlTarget: number;
      salActual: number; salTarget: number;
      sqoActual: number; sqoTarget: number;
    }>();

    baseData.forEach(row => {
      const existing = regionMap.get(row.region) || {
        mqlActual: 0, mqlTarget: 0, sqlActual: 0, sqlTarget: 0,
        salActual: 0, salTarget: 0, sqoActual: 0, sqoTarget: 0,
      };
      regionMap.set(row.region, {
        mqlActual: existing.mqlActual + row.mqlActual,
        mqlTarget: existing.mqlTarget + row.mqlTarget,
        sqlActual: existing.sqlActual + row.sqlActual,
        sqlTarget: existing.sqlTarget + row.sqlTarget,
        salActual: existing.salActual + row.salActual,
        salTarget: existing.salTarget + row.salTarget,
        sqoActual: existing.sqoActual + row.sqoActual,
        sqoTarget: existing.sqoTarget + row.sqoTarget,
      });
    });

    const result: Array<{
      label: string;
      type: 'region';
      region: Region;
      mqlActual: number; mqlTarget: number; mqlPacingPct: number;
      sqlActual: number; sqlTarget: number; sqlPacingPct: number;
      salActual: number; salTarget: number; salPacingPct: number;
      sqoActual: number; sqoTarget: number; sqoPacingPct: number;
      tofScore: number;
    }> = [];

    regionMap.forEach((data, region) => {
      const mqlPacingPct = data.mqlTarget > 0 ? Math.round((data.mqlActual / data.mqlTarget) * 100) : 100;
      const sqlPacingPct = data.sqlTarget > 0 ? Math.round((data.sqlActual / data.sqlTarget) * 100) : 100;
      const salPacingPct = data.salTarget > 0 ? Math.round((data.salActual / data.salTarget) * 100) : 100;
      const sqoPacingPct = data.sqoTarget > 0 ? Math.round((data.sqoActual / data.sqoTarget) * 100) : 100;

      result.push({
        label: region,
        type: 'region',
        region,
        ...data,
        mqlPacingPct,
        sqlPacingPct,
        salPacingPct,
        sqoPacingPct,
        tofScore: calculateTOFScore(mqlPacingPct, sqlPacingPct, salPacingPct, sqoPacingPct),
      });
    });

    return result.sort((a, b) => a.tofScore - b.tofScore);
  }, [categoryData, selectedProducts, selectedRegions, selectedCategories]);

  // Calculate totals
  const categoryTotals = useMemo(() => {
    const total = aggregatedData.reduce((acc, row) => ({
      mqlActual: acc.mqlActual + row.mqlActual,
      mqlTarget: acc.mqlTarget + row.mqlTarget,
      sqlActual: acc.sqlActual + row.sqlActual,
      sqlTarget: acc.sqlTarget + row.sqlTarget,
      salActual: acc.salActual + row.salActual,
      salTarget: acc.salTarget + row.salTarget,
      sqoActual: acc.sqoActual + row.sqoActual,
      sqoTarget: acc.sqoTarget + row.sqoTarget,
    }), {
      mqlActual: 0, mqlTarget: 0, sqlActual: 0, sqlTarget: 0,
      salActual: 0, salTarget: 0, sqoActual: 0, sqoTarget: 0,
    });

    const mqlPacingPct = total.mqlTarget > 0 ? Math.round((total.mqlActual / total.mqlTarget) * 100) : 100;
    const sqlPacingPct = total.sqlTarget > 0 ? Math.round((total.sqlActual / total.sqlTarget) * 100) : 100;
    const salPacingPct = total.salTarget > 0 ? Math.round((total.salActual / total.salTarget) * 100) : 100;
    const sqoPacingPct = total.sqoTarget > 0 ? Math.round((total.sqoActual / total.sqoTarget) * 100) : 100;

    return {
      ...total,
      mqlPacingPct,
      sqlPacingPct,
      salPacingPct,
      sqoPacingPct,
      tofScore: calculateTOFScore(mqlPacingPct, sqlPacingPct, salPacingPct, sqoPacingPct),
    };
  }, [aggregatedData]);

  const sourceTotals = useMemo(() => {
    const total = sourceAggregatedData.reduce((acc, row) => ({
      mqlActual: acc.mqlActual + row.mqlActual,
      mqlTarget: acc.mqlTarget + row.mqlTarget,
      sqlActual: acc.sqlActual + row.sqlActual,
      sqlTarget: acc.sqlTarget + row.sqlTarget,
      salActual: acc.salActual + row.salActual,
      salTarget: acc.salTarget + row.salTarget,
      sqoActual: acc.sqoActual + row.sqoActual,
      sqoTarget: acc.sqoTarget + row.sqoTarget,
    }), {
      mqlActual: 0, mqlTarget: 0, sqlActual: 0, sqlTarget: 0,
      salActual: 0, salTarget: 0, sqoActual: 0, sqoTarget: 0,
    });

    const mqlPacingPct = total.mqlTarget > 0 ? Math.round((total.mqlActual / total.mqlTarget) * 100) : 100;
    const sqlPacingPct = total.sqlTarget > 0 ? Math.round((total.sqlActual / total.sqlTarget) * 100) : 100;
    const salPacingPct = total.salTarget > 0 ? Math.round((total.salActual / total.salTarget) * 100) : 100;
    const sqoPacingPct = total.sqoTarget > 0 ? Math.round((total.sqoActual / total.sqoTarget) * 100) : 100;

    return {
      ...total,
      mqlPacingPct,
      sqlPacingPct,
      salPacingPct,
      sqoPacingPct,
      tofScore: calculateTOFScore(mqlPacingPct, sqlPacingPct, salPacingPct, sqoPacingPct),
    };
  }, [sourceAggregatedData]);

  const regionTotals = useMemo(() => {
    const total = regionAggregatedData.reduce((acc, row) => ({
      mqlActual: acc.mqlActual + row.mqlActual,
      mqlTarget: acc.mqlTarget + row.mqlTarget,
      sqlActual: acc.sqlActual + row.sqlActual,
      sqlTarget: acc.sqlTarget + row.sqlTarget,
      salActual: acc.salActual + row.salActual,
      salTarget: acc.salTarget + row.salTarget,
      sqoActual: acc.sqoActual + row.sqoActual,
      sqoTarget: acc.sqoTarget + row.sqoTarget,
    }), {
      mqlActual: 0, mqlTarget: 0, sqlActual: 0, sqlTarget: 0,
      salActual: 0, salTarget: 0, sqoActual: 0, sqoTarget: 0,
    });

    const mqlPacingPct = total.mqlTarget > 0 ? Math.round((total.mqlActual / total.mqlTarget) * 100) : 100;
    const sqlPacingPct = total.sqlTarget > 0 ? Math.round((total.sqlActual / total.sqlTarget) * 100) : 100;
    const salPacingPct = total.salTarget > 0 ? Math.round((total.salActual / total.salTarget) * 100) : 100;
    const sqoPacingPct = total.sqoTarget > 0 ? Math.round((total.sqoActual / total.sqoTarget) * 100) : 100;

    return {
      ...total,
      mqlPacingPct,
      sqlPacingPct,
      salPacingPct,
      sqoPacingPct,
      tofScore: calculateTOFScore(mqlPacingPct, sqlPacingPct, salPacingPct, sqoPacingPct),
    };
  }, [regionAggregatedData]);

  if (categoryData.length === 0 && unifiedData.length === 0) {
    return null;
  }

  // Reusable table row renderer
  const renderStageColumns = (row: { mqlActual: number; mqlTarget: number; mqlPacingPct: number; sqlActual: number; sqlTarget: number; sqlPacingPct: number; salActual: number; salTarget: number; salPacingPct: number; sqoActual: number; sqoTarget: number; sqoPacingPct: number; tofScore: number }, isBold = false) => (
    <>
      <td className="number-cell">{isBold ? <strong>{row.mqlActual.toLocaleString()}</strong> : row.mqlActual.toLocaleString()}</td>
      <td className="number-cell target-cell">{isBold ? <strong>{row.mqlTarget.toLocaleString()}</strong> : row.mqlTarget.toLocaleString()}</td>
      <td className="pacing-cell">
        <span className="rag-tile" style={{ backgroundColor: getRagColor(getRAG(row.mqlPacingPct)) }}>
          {isBold ? <strong>{row.mqlPacingPct}%</strong> : `${row.mqlPacingPct}%`}
        </span>
      </td>
      <td className="number-cell">{isBold ? <strong>{row.sqlActual.toLocaleString()}</strong> : row.sqlActual.toLocaleString()}</td>
      <td className="number-cell target-cell">{isBold ? <strong>{row.sqlTarget.toLocaleString()}</strong> : row.sqlTarget.toLocaleString()}</td>
      <td className="pacing-cell">
        <span className="rag-tile" style={{ backgroundColor: getRagColor(getRAG(row.sqlPacingPct)) }}>
          {isBold ? <strong>{row.sqlPacingPct}%</strong> : `${row.sqlPacingPct}%`}
        </span>
      </td>
      <td className="number-cell">{isBold ? <strong>{row.salActual.toLocaleString()}</strong> : row.salActual.toLocaleString()}</td>
      <td className="number-cell target-cell">{isBold ? <strong>{row.salTarget.toLocaleString()}</strong> : row.salTarget.toLocaleString()}</td>
      <td className="pacing-cell">
        <span className="rag-tile" style={{ backgroundColor: getRagColor(getRAG(row.salPacingPct)) }}>
          {isBold ? <strong>{row.salPacingPct}%</strong> : `${row.salPacingPct}%`}
        </span>
      </td>
      <td className="number-cell">{isBold ? <strong>{row.sqoActual.toLocaleString()}</strong> : row.sqoActual.toLocaleString()}</td>
      <td className="number-cell target-cell">{isBold ? <strong>{row.sqoTarget.toLocaleString()}</strong> : row.sqoTarget.toLocaleString()}</td>
      <td className="pacing-cell">
        <span className="rag-tile" style={{ backgroundColor: getRagColor(getRAG(row.sqoPacingPct)) }}>
          {isBold ? <strong>{row.sqoPacingPct}%</strong> : `${row.sqoPacingPct}%`}
        </span>
      </td>
      <td className="tof-score-cell">
        <span className="rag-tile" style={{ backgroundColor: getRagColor(getRAG(row.tofScore)), padding: '4px 10px' }}>
          {isBold ? <strong>{row.tofScore}%</strong> : `${row.tofScore}%`}
        </span>
      </td>
    </>
  );

  const handleSort = (
    key: SortKey,
    currentConfig: SortConfig | null,
    setConfig: React.Dispatch<React.SetStateAction<SortConfig | null>>
  ) => {
    if (currentConfig?.key === key) {
      // Toggle direction or clear
      if (currentConfig.direction === 'asc') {
        setConfig({ key, direction: 'desc' });
      } else {
        setConfig(null); // Clear sort
      }
    } else {
      setConfig({ key, direction: 'desc' }); // Default to descending (worst first)
    }
  };

  const getSortIndicator = (key: SortKey, config: SortConfig | null): string => {
    if (config?.key !== key) return '';
    return config.direction === 'asc' ? ' ↑' : ' ↓';
  };

  const renderTable = (
    data: Array<{ label: string; mqlActual: number; mqlTarget: number; mqlPacingPct: number; sqlActual: number; sqlTarget: number; sqlPacingPct: number; salActual: number; salTarget: number; salPacingPct: number; sqoActual: number; sqoTarget: number; sqoPacingPct: number; tofScore: number; category?: Category; leadStageLabel?: 'MQL' | 'EQL' }>,
    totals: typeof categoryTotals,
    labelHeader: string,
    showLeadBadge = false,
    sortConfig: SortConfig | null = null,
    setSortConfig: React.Dispatch<React.SetStateAction<SortConfig | null>> | null = null
  ) => {
    const sortedData = sortConfig ? sortData(data, sortConfig) : data;
    const canSort = setSortConfig !== null;

    const headerClick = (key: SortKey) => {
      if (canSort && setSortConfig) {
        handleSort(key, sortConfig, setSortConfig);
      }
    };

    return (
      <div className="table-container">
        <table className="funnel-table">
          <thead>
            <tr>
              <th
                rowSpan={2}
                className={canSort ? 'sortable-header' : ''}
                onClick={() => headerClick('label')}
              >
                {labelHeader}{getSortIndicator('label', sortConfig)}
              </th>
              <th colSpan={3}>EQL/MQL</th>
              <th colSpan={3}>SQL</th>
              <th colSpan={3}>SAL</th>
              <th colSpan={3}>SQO</th>
              <th
                rowSpan={2}
                className={canSort ? 'sortable-header' : ''}
                onClick={() => headerClick('tofScore')}
              >
                TOF Score{getSortIndicator('tofScore', sortConfig)}
              </th>
            </tr>
            <tr className="sub-header">
              <th className={canSort ? 'sortable-header' : ''} onClick={() => headerClick('mqlActual')}>Act{getSortIndicator('mqlActual', sortConfig)}</th>
              <th className={canSort ? 'sortable-header' : ''} onClick={() => headerClick('mqlTarget')}>Tgt{getSortIndicator('mqlTarget', sortConfig)}</th>
              <th className={canSort ? 'sortable-header' : ''} onClick={() => headerClick('mqlPacingPct')}>Pace{getSortIndicator('mqlPacingPct', sortConfig)}</th>
              <th className={canSort ? 'sortable-header' : ''} onClick={() => headerClick('sqlActual')}>Act{getSortIndicator('sqlActual', sortConfig)}</th>
              <th className={canSort ? 'sortable-header' : ''} onClick={() => headerClick('sqlTarget')}>Tgt{getSortIndicator('sqlTarget', sortConfig)}</th>
              <th className={canSort ? 'sortable-header' : ''} onClick={() => headerClick('sqlPacingPct')}>Pace{getSortIndicator('sqlPacingPct', sortConfig)}</th>
              <th className={canSort ? 'sortable-header' : ''} onClick={() => headerClick('salActual')}>Act{getSortIndicator('salActual', sortConfig)}</th>
              <th className={canSort ? 'sortable-header' : ''} onClick={() => headerClick('salTarget')}>Tgt{getSortIndicator('salTarget', sortConfig)}</th>
              <th className={canSort ? 'sortable-header' : ''} onClick={() => headerClick('salPacingPct')}>Pace{getSortIndicator('salPacingPct', sortConfig)}</th>
              <th className={canSort ? 'sortable-header' : ''} onClick={() => headerClick('sqoActual')}>Act{getSortIndicator('sqoActual', sortConfig)}</th>
              <th className={canSort ? 'sortable-header' : ''} onClick={() => headerClick('sqoTarget')}>Tgt{getSortIndicator('sqoTarget', sortConfig)}</th>
              <th className={canSort ? 'sortable-header' : ''} onClick={() => headerClick('sqoPacingPct')}>Pace{getSortIndicator('sqoPacingPct', sortConfig)}</th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map(row => (
              <tr key={row.label}>
                <td className="label-cell">
                  {showLeadBadge && row.category ? (
                    <>
                      <span className={`category-badge ${row.category.toLowerCase().replace(/\s+/g, '-')}`}>
                        {row.category}
                      </span>
                      <span className={`lead-badge ${row.leadStageLabel?.toLowerCase()}`}>{row.leadStageLabel}</span>
                    </>
                  ) : (
                    <span className={`source-badge ${row.label.toLowerCase().replace(/\s+/g, '-')}`}>
                      {row.label}
                    </span>
                  )}
                </td>
                {renderStageColumns(row)}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="totals-row">
              <td className="label-cell"><strong>TOTAL</strong></td>
              {renderStageColumns(totals, true)}
            </tr>
          </tfoot>
        </table>
      </div>
    );
  };

  return (
    <section>
      <h2>Full Funnel Pacing (EQL/MQL → SQO)</h2>
      <p className="section-subtitle">
        <span className="lead-label mql">MQL</span> Marketing Qualified Lead (NEW LOGO)
        <span className="separator">|</span>
        <span className="lead-label eql">EQL</span> Existing Qualified Lead (EXPANSION, MIGRATION)
        <span className="separator">|</span>
        <span className="tof-label">TOF Score</span> = 10% EQL/MQL + 20% SQL + 30% SAL + 40% SQO
      </p>

      {/* Multi-Select Filters */}
      <div className="filters-container">
        <MultiSelect
          label="Product"
          options={availableProducts}
          selected={selectedProducts}
          onChange={setSelectedProducts}
        />
        <MultiSelect
          label="Region"
          options={availableRegions}
          selected={selectedRegions}
          onChange={setSelectedRegions}
        />
      </div>

      {/* Three tables side by side or stacked */}
      <div className="tables-grid">
        <div className="table-section">
          <h3 className="table-title">By Category</h3>
          <MultiSelect
            label="Filter"
            options={availableCategories}
            selected={selectedCategories}
            onChange={setSelectedCategories}
          />
          {renderTable(aggregatedData, categoryTotals, 'Category', true, categorySortConfig, setCategorySortConfig)}
        </div>

        {availableSources.length > 0 && (
          <div className="table-section">
            <h3 className="table-title">By Source</h3>
            <MultiSelect
              label="Filter"
              options={availableSources}
              selected={selectedSources}
              onChange={setSelectedSources}
            />
            {renderTable(sourceAggregatedData, sourceTotals, 'Source', false, sourceSortConfig, setSourceSortConfig)}
          </div>
        )}

        <div className="table-section">
          <h3 className="table-title">By Region</h3>
          {renderTable(regionAggregatedData, regionTotals, 'Region', false, regionSortConfig, setRegionSortConfig)}
        </div>
      </div>

      <style jsx>{`
        .section-subtitle {
          font-size: 10px;
          color: var(--text-secondary);
          margin: -4px 0 12px 0;
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .lead-label {
          padding: 1px 6px;
          border-radius: 10px;
          font-weight: 700;
          font-size: 9px;
        }
        .lead-label.mql { background: var(--info-bg); color: var(--info-text); }
        .lead-label.eql { background: var(--success-bg); color: var(--success-text); }
        .tof-label { font-weight: 600; color: var(--text-primary); }
        .separator { color: var(--border-primary); }

        .filters-container {
          display: flex;
          gap: 24px;
          margin-bottom: 16px;
          flex-wrap: wrap;
          padding: 12px;
          background: var(--bg-tertiary);
          border-radius: 8px;
          border: 1px solid var(--border-primary);
        }

        .tables-grid {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .table-section {
          background: var(--bg-secondary);
          border: 1px solid var(--border-primary);
          border-radius: 8px;
          padding: 12px;
        }

        .table-title {
          font-size: 0.85rem;
          font-weight: 600;
          margin: 0 0 8px 0;
          color: var(--text-primary);
        }

        .table-container {
          overflow-x: auto;
          margin-top: 8px;
        }
        .funnel-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.7rem;
        }
        .funnel-table th,
        .funnel-table td {
          padding: 6px 4px;
          border: 1px solid var(--border-primary);
          text-align: center;
        }
        .funnel-table th {
          background-color: #1a1a2e;
          color: white;
          font-weight: 600;
          font-size: 0.65rem;
        }
        .funnel-table th.sortable-header {
          cursor: pointer;
          user-select: none;
          transition: background-color 0.15s;
        }
        .funnel-table th.sortable-header:hover {
          background-color: #2a2a4e;
        }
        .sub-header th.sortable-header:hover {
          background-color: #3d3d64;
        }
        .sub-header th {
          background-color: #2d2d44;
          font-weight: 500;
          font-size: 0.6rem;
          padding: 4px 2px;
        }
        .label-cell {
          text-align: left;
          font-weight: 500;
          white-space: nowrap;
        }
        .number-cell {
          font-family: monospace;
          font-size: 0.65rem;
        }
        .target-cell {
          color: var(--text-muted);
        }
        .pacing-cell {
          padding: 3px;
        }
        .tof-score-cell {
          background-color: var(--bg-tertiary);
          padding: 3px;
        }
        .totals-row {
          background-color: var(--bg-hover);
        }

        /* Category badges */
        .category-badge {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 0.6rem;
          font-weight: 600;
          margin-right: 4px;
        }
        .category-badge.new-logo { background: var(--info-bg); color: var(--info-text); }
        .category-badge.expansion { background: var(--success-bg); color: var(--success-text); }
        .category-badge.migration { background: var(--warning-bg); color: var(--warning-text); }

        .lead-badge {
          display: inline-block;
          padding: 1px 5px;
          border-radius: 10px;
          font-size: 0.55rem;
          font-weight: 700;
          letter-spacing: 0.3px;
        }
        .lead-badge.mql { background: var(--info-bg); color: var(--info-text); }
        .lead-badge.eql { background: var(--success-bg); color: var(--success-text); }

        /* Source badges */
        .source-badge {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 0.6rem;
          font-weight: 600;
          background: var(--border-primary);
          color: var(--text-primary);
        }
        .source-badge.inbound { background: var(--info-bg); color: var(--info-text); }
        .source-badge.outbound { background: var(--warning-bg); color: var(--warning-text); }
        .source-badge.ae-sourced { background: var(--success-bg); color: var(--success-text); }
        .source-badge.am-sourced { background: var(--bg-tertiary); color: var(--accent-purple); }
        .source-badge.tradeshow { background: var(--bg-tertiary); color: var(--danger-text); }
        .source-badge.partnerships { background: var(--bg-tertiary); color: var(--accent-indigo); }
        .source-badge.amer { background: var(--info-bg); color: var(--info-text); }
        .source-badge.emea { background: var(--success-bg); color: var(--success-text); }
        .source-badge.apac { background: var(--warning-bg); color: var(--warning-text); }
      `}</style>
    </section>
  );
}
