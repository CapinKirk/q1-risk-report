'use client';

import { useMemo, useState, useEffect } from 'react';
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
 * Base weights - POR: EQL/MQL=10%, SQL=20%, SAL=30%, SQO=40%
 * R360: EQL/MQL=14.3%, SQL=28.6%, SQO=57.1% (no SAL stage)
 *
 * IMPORTANT: Stages with 0 targets are EXCLUDED from the calculation
 * and their weights are redistributed proportionally to other stages.
 */
function calculateTOFScore(
  mqlPct: number, sqlPct: number, salPct: number, sqoPct: number,
  product: Product = 'POR',
  targets?: { mql: number; sql: number; sal: number; sqo: number }
): number {
  // Base weights
  let mqlWeight = product === 'R360' ? 0.143 : 0.10;
  let sqlWeight = product === 'R360' ? 0.286 : 0.20;
  let salWeight = product === 'R360' ? 0 : 0.30;  // R360 has no SAL
  let sqoWeight = product === 'R360' ? 0.571 : 0.40;

  // If targets are provided, exclude stages with 0 targets
  if (targets) {
    const activeStages: { pct: number; weight: number }[] = [];

    if (targets.mql > 0) activeStages.push({ pct: mqlPct, weight: mqlWeight });
    if (targets.sql > 0) activeStages.push({ pct: sqlPct, weight: sqlWeight });
    if (targets.sal > 0 && product !== 'R360') activeStages.push({ pct: salPct, weight: salWeight });
    if (targets.sqo > 0) activeStages.push({ pct: sqoPct, weight: sqoWeight });

    // If no stages have targets, return 0
    if (activeStages.length === 0) return 0;

    // Redistribute weights proportionally among active stages
    const totalActiveWeight = activeStages.reduce((sum, s) => sum + s.weight, 0);
    const score = activeStages.reduce((sum, s) => {
      const normalizedWeight = s.weight / totalActiveWeight;
      return sum + (s.pct * normalizedWeight);
    }, 0);

    return Math.round(score);
  }

  // Fallback: use original calculation (for backward compatibility)
  if (product === 'R360') {
    return Math.round((mqlPct * 0.143) + (sqlPct * 0.286) + (sqoPct * 0.571));
  }
  return Math.round((mqlPct * 0.10) + (sqlPct * 0.20) + (salPct * 0.30) + (sqoPct * 0.40));
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
  eqlActual: number;
  eqlTarget: number;
  eqlPacingPct: number;
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

type SortKey = 'label' | 'eqlActual' | 'eqlTarget' | 'eqlPacingPct' |
               'mqlActual' | 'mqlTarget' | 'mqlPacingPct' |
               'sqlActual' | 'sqlTarget' | 'sqlPacingPct' |
               'salActual' | 'salTarget' | 'salPacingPct' |
               'sqoActual' | 'sqoTarget' | 'sqoPacingPct' | 'tofScore';

type SortDirection = 'asc' | 'desc';

interface SortConfig {
  key: SortKey;
  direction: SortDirection;
}

function sortData<T extends { label: string; eqlActual: number; eqlTarget: number; eqlPacingPct: number; mqlActual: number; mqlTarget: number; mqlPacingPct: number; sqlActual: number; sqlTarget: number; sqlPacingPct: number; salActual: number; salTarget: number; salPacingPct: number; sqoActual: number; sqoTarget: number; sqoPacingPct: number; tofScore: number }>(
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

  // Sync local filters with page-level filters when available products change
  // This ensures component respects page-level product filter
  useEffect(() => {
    setSelectedProducts(availableProducts);
  }, [availableProducts]);

  useEffect(() => {
    setSelectedSources(availableSources);
  }, [availableSources]);

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

          const mqlPacingPct = qtdTargetMql > 0 ? Math.round((row.actual_mql / qtdTargetMql) * 100) : (row.actual_mql > 0 ? 100 : 0);
          const sqlPacingPct = qtdTargetSql > 0 ? Math.round((row.actual_sql / qtdTargetSql) * 100) : (row.actual_sql > 0 ? 100 : 0);
          const salPacingPct = qtdTargetSal > 0 ? Math.round((row.actual_sal / qtdTargetSal) * 100) : (row.actual_sal > 0 ? 100 : 0);
          const sqoPacingPct = qtdTargetSqo > 0 ? Math.round((row.actual_sqo / qtdTargetSqo) * 100) : (row.actual_sqo > 0 ? 100 : 0);

          rows.push({
            id: `${product}-${row.region}-${row.source}`,
            product,
            region: row.region,
            category,
            source: row.source,
            leadStageLabel: getLeadStageLabel(category),
            eqlActual: 0,
            eqlTarget: 0,
            eqlPacingPct: 0,
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
            tofScore: calculateTOFScore(mqlPacingPct, sqlPacingPct, salPacingPct, sqoPacingPct, product,
              { mql: qtdTargetMql, sql: qtdTargetSql, sal: qtdTargetSal, sqo: qtdTargetSqo }),
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

        const mqlPacingPct = (row.qtd_target_mql || 0) > 0 ? Math.round(((row.actual_mql || 0) / (row.qtd_target_mql || 1)) * 100) : ((row.actual_mql || 0) > 0 ? 100 : 0);
        const sqlPacingPct = (row.qtd_target_sql || 0) > 0 ? Math.round(((row.actual_sql || 0) / (row.qtd_target_sql || 1)) * 100) : ((row.actual_sql || 0) > 0 ? 100 : 0);
        const salPacingPct = (row.qtd_target_sal || 0) > 0 ? Math.round(((row.actual_sal || 0) / (row.qtd_target_sal || 1)) * 100) : ((row.actual_sal || 0) > 0 ? 100 : 0);
        const sqoPacingPct = (row.qtd_target_sqo || 0) > 0 ? Math.round(((row.actual_sqo || 0) / (row.qtd_target_sqo || 1)) * 100) : ((row.actual_sqo || 0) > 0 ? 100 : 0);

        const qtdTargetMql = row.qtd_target_mql || 0;
        const qtdTargetSql = row.qtd_target_sql || 0;
        const qtdTargetSal = row.qtd_target_sal || 0;
        const qtdTargetSqo = row.qtd_target_sqo || 0;

        const leadStageLabel = getLeadStageLabel(row.category);

        rows.push({
          id: `${product}-${row.region}-${row.category}`,
          product,
          region: row.region,
          category: row.category,
          source: 'ALL',
          leadStageLabel,
          eqlActual: leadStageLabel === 'EQL' ? (row.actual_mql || 0) : 0,
          eqlTarget: leadStageLabel === 'EQL' ? qtdTargetMql : 0,
          eqlPacingPct: leadStageLabel === 'EQL' ? mqlPacingPct : 0,
          mqlActual: leadStageLabel === 'MQL' ? (row.actual_mql || 0) : 0,
          mqlTarget: leadStageLabel === 'MQL' ? qtdTargetMql : 0,
          mqlPacingPct: leadStageLabel === 'MQL' ? mqlPacingPct : 0,
          sqlActual: row.actual_sql || 0,
          sqlTarget: qtdTargetSql,
          sqlPacingPct,
          salActual: row.actual_sal || 0,
          salTarget: qtdTargetSal,
          salPacingPct,
          sqoActual: row.actual_sqo || 0,
          sqoTarget: qtdTargetSqo,
          sqoPacingPct,
          tofScore: calculateTOFScore(mqlPacingPct, sqlPacingPct, salPacingPct, sqoPacingPct, product,
            { mql: qtdTargetMql, sql: qtdTargetSql, sal: qtdTargetSal, sqo: qtdTargetSqo }),
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
      eqlActual: number; eqlTarget: number;
      mqlActual: number; mqlTarget: number;
      sqlActual: number; sqlTarget: number;
      salActual: number; salTarget: number;
      sqoActual: number; sqoTarget: number;
    }>();

    baseData.forEach(row => {
      const existing = categoryMap.get(row.category) || {
        eqlActual: 0, eqlTarget: 0, mqlActual: 0, mqlTarget: 0, sqlActual: 0, sqlTarget: 0,
        salActual: 0, salTarget: 0, sqoActual: 0, sqoTarget: 0,
      };
      categoryMap.set(row.category, {
        eqlActual: existing.eqlActual + row.eqlActual,
        eqlTarget: existing.eqlTarget + row.eqlTarget,
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
      eqlActual: number; eqlTarget: number; eqlPacingPct: number;
      mqlActual: number; mqlTarget: number; mqlPacingPct: number;
      sqlActual: number; sqlTarget: number; sqlPacingPct: number;
      salActual: number; salTarget: number; salPacingPct: number;
      sqoActual: number; sqoTarget: number; sqoPacingPct: number;
      tofScore: number;
    }> = [];

    categoryMap.forEach((data, category) => {
      const eqlPacingPct = data.eqlTarget > 0 ? Math.round((data.eqlActual / data.eqlTarget) * 100) : (data.eqlActual > 0 ? 100 : 0);
      const mqlPacingPct = data.mqlTarget > 0 ? Math.round((data.mqlActual / data.mqlTarget) * 100) : (data.mqlActual > 0 ? 100 : 0);
      const sqlPacingPct = data.sqlTarget > 0 ? Math.round((data.sqlActual / data.sqlTarget) * 100) : (data.sqlActual > 0 ? 100 : 0);
      const salPacingPct = data.salTarget > 0 ? Math.round((data.salActual / data.salTarget) * 100) : (data.salActual > 0 ? 100 : 0);
      const sqoPacingPct = data.sqoTarget > 0 ? Math.round((data.sqoActual / data.sqoTarget) * 100) : (data.sqoActual > 0 ? 100 : 0);

      // Use R360 weights if R360 is the only EFFECTIVE product (selected AND available)
      const effectiveProducts = selectedProducts.filter(p => availableProducts.includes(p));
      const effectiveProduct: Product = effectiveProducts.length === 1 && effectiveProducts[0] === 'R360' ? 'R360' : 'POR';
      result.push({
        label: category,
        type: 'category',
        category,
        leadStageLabel: getLeadStageLabel(category),
        eqlActual: data.eqlActual,
        eqlTarget: data.eqlTarget,
        eqlPacingPct,
        mqlActual: data.mqlActual,
        mqlTarget: data.mqlTarget,
        mqlPacingPct,
        sqlActual: data.sqlActual,
        sqlTarget: data.sqlTarget,
        sqlPacingPct,
        salActual: data.salActual,
        salTarget: data.salTarget,
        salPacingPct,
        sqoActual: data.sqoActual,
        sqoTarget: data.sqoTarget,
        sqoPacingPct,
        tofScore: calculateTOFScore(mqlPacingPct, sqlPacingPct, salPacingPct, sqoPacingPct, effectiveProduct,
          { mql: data.mqlTarget, sql: data.sqlTarget, sal: data.salTarget, sqo: data.sqoTarget }),
      });
    });

    return result.sort((a, b) => a.tofScore - b.tofScore);
  }, [categoryData, selectedProducts, selectedRegions, selectedCategories, availableProducts]);

  // Aggregate by source (separate view)
  const sourceAggregatedData = useMemo(() => {
    const baseData = unifiedData.filter(row =>
      selectedProducts.includes(row.product) &&
      selectedRegions.includes(row.region) &&
      selectedSources.includes(row.source)
    );

    // Aggregate by source
    const sourceMap = new Map<string, {
      eqlActual: number; eqlTarget: number;
      mqlActual: number; mqlTarget: number;
      sqlActual: number; sqlTarget: number;
      salActual: number; salTarget: number;
      sqoActual: number; sqoTarget: number;
    }>();

    baseData.forEach(row => {
      const existing = sourceMap.get(row.source) || {
        eqlActual: 0, eqlTarget: 0, mqlActual: 0, mqlTarget: 0, sqlActual: 0, sqlTarget: 0,
        salActual: 0, salTarget: 0, sqoActual: 0, sqoTarget: 0,
      };
      sourceMap.set(row.source, {
        eqlActual: existing.eqlActual + row.eqlActual,
        eqlTarget: existing.eqlTarget + row.eqlTarget,
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
      eqlActual: number; eqlTarget: number; eqlPacingPct: number;
      mqlActual: number; mqlTarget: number; mqlPacingPct: number;
      sqlActual: number; sqlTarget: number; sqlPacingPct: number;
      salActual: number; salTarget: number; salPacingPct: number;
      sqoActual: number; sqoTarget: number; sqoPacingPct: number;
      tofScore: number;
    }> = [];

    sourceMap.forEach((data, source) => {
      // Only skip if BOTH actuals AND targets are all zero (truly empty)
      const hasActuals = data.eqlActual > 0 || data.mqlActual > 0 || data.sqlActual > 0 || data.salActual > 0 || data.sqoActual > 0;
      const hasTargets = data.eqlTarget > 0 || data.mqlTarget > 0 || data.sqlTarget > 0 || data.salTarget > 0 || data.sqoTarget > 0;
      if (!hasActuals && !hasTargets) return;

      const eqlPacingPct = data.eqlTarget > 0 ? Math.round((data.eqlActual / data.eqlTarget) * 100) : (data.eqlActual > 0 ? 100 : 0);
      const mqlPacingPct = data.mqlTarget > 0 ? Math.round((data.mqlActual / data.mqlTarget) * 100) : (data.mqlActual > 0 ? 100 : 0);
      const sqlPacingPct = data.sqlTarget > 0 ? Math.round((data.sqlActual / data.sqlTarget) * 100) : (data.sqlActual > 0 ? 100 : 0);
      const salPacingPct = data.salTarget > 0 ? Math.round((data.salActual / data.salTarget) * 100) : (data.salActual > 0 ? 100 : 0);
      const sqoPacingPct = data.sqoTarget > 0 ? Math.round((data.sqoActual / data.sqoTarget) * 100) : (data.sqoActual > 0 ? 100 : 0);

      // Use R360 weights if R360 is the only EFFECTIVE product (selected AND available)
      const effectiveProducts = selectedProducts.filter(p => availableProducts.includes(p));
      const effectiveProduct: Product = effectiveProducts.length === 1 && effectiveProducts[0] === 'R360' ? 'R360' : 'POR';
      result.push({
        label: source,
        type: 'source',
        source,
        eqlActual: data.eqlActual,
        eqlTarget: data.eqlTarget,
        eqlPacingPct,
        mqlActual: data.mqlActual,
        mqlTarget: data.mqlTarget,
        mqlPacingPct,
        sqlActual: data.sqlActual,
        sqlTarget: data.sqlTarget,
        sqlPacingPct,
        salActual: data.salActual,
        salTarget: data.salTarget,
        salPacingPct,
        sqoActual: data.sqoActual,
        sqoTarget: data.sqoTarget,
        sqoPacingPct,
        tofScore: calculateTOFScore(mqlPacingPct, sqlPacingPct, salPacingPct, sqoPacingPct, effectiveProduct,
          { mql: data.mqlTarget, sql: data.sqlTarget, sal: data.salTarget, sqo: data.sqoTarget }),
      });
    });

    return result.sort((a, b) => a.tofScore - b.tofScore);
  }, [unifiedData, selectedProducts, selectedRegions, selectedSources, availableProducts]);

  // Aggregate by region
  const regionAggregatedData = useMemo(() => {
    const baseData = categoryData.filter(row =>
      selectedProducts.includes(row.product) &&
      selectedRegions.includes(row.region) &&
      selectedCategories.includes(row.category)
    );

    const regionMap = new Map<Region, {
      eqlActual: number; eqlTarget: number;
      mqlActual: number; mqlTarget: number;
      sqlActual: number; sqlTarget: number;
      salActual: number; salTarget: number;
      sqoActual: number; sqoTarget: number;
    }>();

    baseData.forEach(row => {
      const existing = regionMap.get(row.region) || {
        eqlActual: 0, eqlTarget: 0, mqlActual: 0, mqlTarget: 0, sqlActual: 0, sqlTarget: 0,
        salActual: 0, salTarget: 0, sqoActual: 0, sqoTarget: 0,
      };
      regionMap.set(row.region, {
        eqlActual: existing.eqlActual + row.eqlActual,
        eqlTarget: existing.eqlTarget + row.eqlTarget,
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
      eqlActual: number; eqlTarget: number; eqlPacingPct: number;
      mqlActual: number; mqlTarget: number; mqlPacingPct: number;
      sqlActual: number; sqlTarget: number; sqlPacingPct: number;
      salActual: number; salTarget: number; salPacingPct: number;
      sqoActual: number; sqoTarget: number; sqoPacingPct: number;
      tofScore: number;
    }> = [];

    regionMap.forEach((data, region) => {
      const eqlPacingPct = data.eqlTarget > 0 ? Math.round((data.eqlActual / data.eqlTarget) * 100) : (data.eqlActual > 0 ? 100 : 0);
      const mqlPacingPct = data.mqlTarget > 0 ? Math.round((data.mqlActual / data.mqlTarget) * 100) : (data.mqlActual > 0 ? 100 : 0);
      const sqlPacingPct = data.sqlTarget > 0 ? Math.round((data.sqlActual / data.sqlTarget) * 100) : (data.sqlActual > 0 ? 100 : 0);
      const salPacingPct = data.salTarget > 0 ? Math.round((data.salActual / data.salTarget) * 100) : (data.salActual > 0 ? 100 : 0);
      const sqoPacingPct = data.sqoTarget > 0 ? Math.round((data.sqoActual / data.sqoTarget) * 100) : (data.sqoActual > 0 ? 100 : 0);

      // Use R360 weights if R360 is the only EFFECTIVE product (selected AND available)
      const effectiveProducts = selectedProducts.filter(p => availableProducts.includes(p));
      const effectiveProduct: Product = effectiveProducts.length === 1 && effectiveProducts[0] === 'R360' ? 'R360' : 'POR';
      result.push({
        label: region,
        type: 'region',
        region,
        ...data,
        eqlPacingPct,
        mqlPacingPct,
        sqlPacingPct,
        salPacingPct,
        sqoPacingPct,
        tofScore: calculateTOFScore(mqlPacingPct, sqlPacingPct, salPacingPct, sqoPacingPct, effectiveProduct,
          { mql: data.mqlTarget, sql: data.sqlTarget, sal: data.salTarget, sqo: data.sqoTarget }),
      });
    });

    return result.sort((a, b) => a.tofScore - b.tofScore);
  }, [categoryData, selectedProducts, selectedRegions, selectedCategories, availableProducts]);

  // Calculate totals
  if (categoryData.length === 0 && unifiedData.length === 0) {
    return null;
  }

  // Check if only R360 is the effective product (R360 has no SAL stage)
  // Use intersection of selected AND available products
  const effectiveProductsForDisplay = selectedProducts.filter(p => availableProducts.includes(p));
  const isR360Only = effectiveProductsForDisplay.length === 1 && effectiveProductsForDisplay[0] === 'R360';

  // Reusable table row renderer
  const renderStageColumns = (row: { eqlActual: number; eqlTarget: number; eqlPacingPct: number; mqlActual: number; mqlTarget: number; mqlPacingPct: number; sqlActual: number; sqlTarget: number; sqlPacingPct: number; salActual: number; salTarget: number; salPacingPct: number; sqoActual: number; sqoTarget: number; sqoPacingPct: number; tofScore: number }, isBold = false) => (
    <>
      {/* EQL columns */}
      <td className="number-cell">{(row.eqlActual > 0 || row.eqlTarget > 0) ? (isBold ? <strong>{row.eqlActual.toLocaleString()}</strong> : row.eqlActual.toLocaleString()) : <span className="na-cell">—</span>}</td>
      <td className="number-cell target-cell">{(row.eqlActual > 0 || row.eqlTarget > 0) ? (isBold ? <strong>{row.eqlTarget.toLocaleString()}</strong> : row.eqlTarget.toLocaleString()) : <span className="na-cell">—</span>}</td>
      <td className="pacing-cell">{(row.eqlActual > 0 || row.eqlTarget > 0) ? <span className="rag-tile" style={{ backgroundColor: getRagColor(getRAG(row.eqlPacingPct)) }}>{isBold ? <strong>{row.eqlPacingPct}%</strong> : `${row.eqlPacingPct}%`}</span> : <span className="na-cell">—</span>}</td>
      {/* MQL columns */}
      <td className="number-cell">{(row.mqlActual > 0 || row.mqlTarget > 0) ? (isBold ? <strong>{row.mqlActual.toLocaleString()}</strong> : row.mqlActual.toLocaleString()) : <span className="na-cell">—</span>}</td>
      <td className="number-cell target-cell">{(row.mqlActual > 0 || row.mqlTarget > 0) ? (isBold ? <strong>{row.mqlTarget.toLocaleString()}</strong> : row.mqlTarget.toLocaleString()) : <span className="na-cell">—</span>}</td>
      <td className="pacing-cell">{(row.mqlActual > 0 || row.mqlTarget > 0) ? <span className="rag-tile" style={{ backgroundColor: getRagColor(getRAG(row.mqlPacingPct)) }}>{isBold ? <strong>{row.mqlPacingPct}%</strong> : `${row.mqlPacingPct}%`}</span> : <span className="na-cell">—</span>}</td>
      <td className="number-cell">{isBold ? <strong>{row.sqlActual.toLocaleString()}</strong> : row.sqlActual.toLocaleString()}</td>
      <td className="number-cell target-cell">{isBold ? <strong>{row.sqlTarget.toLocaleString()}</strong> : row.sqlTarget.toLocaleString()}</td>
      <td className="pacing-cell">
        <span className="rag-tile" style={{ backgroundColor: getRagColor(getRAG(row.sqlPacingPct)) }}>
          {isBold ? <strong>{row.sqlPacingPct}%</strong> : `${row.sqlPacingPct}%`}
        </span>
      </td>
      <td className="number-cell">
        {isR360Only ? <span className="na-cell">—</span> : (isBold ? <strong>{row.salActual.toLocaleString()}</strong> : row.salActual.toLocaleString())}
      </td>
      <td className="number-cell target-cell">
        {isR360Only ? <span className="na-cell">—</span> : (isBold ? <strong>{row.salTarget.toLocaleString()}</strong> : row.salTarget.toLocaleString())}
      </td>
      <td className="pacing-cell">
        {isR360Only ? (
          <span className="na-cell">N/A</span>
        ) : (
          <span className="rag-tile" style={{ backgroundColor: getRagColor(getRAG(row.salPacingPct)) }}>
            {isBold ? <strong>{row.salPacingPct}%</strong> : `${row.salPacingPct}%`}
          </span>
        )}
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
    data: Array<{ label: string; eqlActual: number; eqlTarget: number; eqlPacingPct: number; mqlActual: number; mqlTarget: number; mqlPacingPct: number; sqlActual: number; sqlTarget: number; sqlPacingPct: number; salActual: number; salTarget: number; salPacingPct: number; sqoActual: number; sqoTarget: number; sqoPacingPct: number; tofScore: number; category?: Category; leadStageLabel?: 'MQL' | 'EQL' }>,
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
              <th colSpan={3} className={isR360Only ? 'na-header' : ''}>SAL{isR360Only && ' (N/A)'}</th>
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
        </table>
      </div>
    );
  };

  return (
    <section>
      <h2>Full Funnel Pacing ({isR360Only ? 'MQL' : 'EQL/MQL'} → SQO)</h2>
      <p className="section-subtitle">
        <span className="lead-label mql">MQL</span> Marketing Qualified Lead (NEW LOGO)
        {!isR360Only && (
          <>
            <span className="separator">|</span>
            <span className="lead-label eql">EQL</span> Existing Qualified Lead (EXPANSION, MIGRATION)
          </>
        )}
        <span className="separator">|</span>
        <span className="tof-label">TOF Score</span> {isR360Only
          ? '14% MQL + 29% SQL + 57% SQO (no SAL)'
          : 'POR: 10% EQL/MQL + 20% SQL + 30% SAL + 40% SQO | R360: 14% MQL + 29% SQL + 57% SQO (no SAL)'
        }
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
          {renderTable(aggregatedData, 'Category', true, categorySortConfig, setCategorySortConfig)}
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
            {renderTable(sourceAggregatedData, 'Source', false, sourceSortConfig, setSourceSortConfig)}
          </div>
        )}

        <div className="table-section">
          <h3 className="table-title">By Region</h3>
          {renderTable(regionAggregatedData, 'Region', false, regionSortConfig, setRegionSortConfig)}
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

        /* N/A styling for R360 SAL columns */
        .na-cell {
          color: var(--text-muted);
          font-style: italic;
          font-size: 0.6rem;
        }
        .na-header {
          opacity: 0.5;
        }
      `}</style>
    </section>
  );
}
