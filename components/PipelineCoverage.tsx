'use client';

import { ReportData, PipelineRCARow } from '@/lib/types';
import { formatCurrency, formatCoverage } from '@/lib/formatters';
import SortableHeader from './SortableHeader';
import { useSortableTable } from '@/lib/useSortableTable';
import RegionBadge from './RegionBadge';

interface PipelineCoverageProps {
  data: ReportData;
}

export default function PipelineCoverage({ data }: PipelineCoverageProps) {
  const { pipeline_rca } = data;

  // Combine POR and R360 pipeline data
  const allPipeline: (PipelineRCARow & { product: 'POR' | 'R360' })[] = [
    ...pipeline_rca.POR.map(p => ({ ...p, product: 'POR' as const })),
    ...pipeline_rca.R360.map(p => ({ ...p, product: 'R360' as const }))
  ];

  // Don't render if no data
  if (allPipeline.length === 0) {
    return null;
  }

  // Default sort by region, then product, then category
  const defaultSorted = [...allPipeline].sort((a, b) => {
    if (a.region !== b.region) return a.region.localeCompare(b.region);
    if (a.product !== b.product) return a.product.localeCompare(b.product);
    return (a.category || '').localeCompare(b.category || '');
  });

  // Column value extractor for sorting
  const getColumnValue = (row: PipelineRCARow & { product: 'POR' | 'R360' }, column: string) => {
    switch (column) {
      case 'region': return row.region;
      case 'product': return row.product;
      case 'category': return row.category || '';
      case 'pipeline_acv': return row.pipeline_acv || 0;
      case 'pipeline_coverage_x': return row.pipeline_coverage_x || 0;
      case 'pipeline_avg_age_days': return row.pipeline_avg_age_days || 0;
      // Sort health by risk level: HEALTHY (1) < ADEQUATE (2) < AT RISK (3) < UNKNOWN (4)
      case 'pipeline_health': {
        const healthOrder: Record<string, number> = {
          'HEALTHY': 1,
          'ADEQUATE': 2,
          'AT_RISK': 3,
          'AT RISK': 3,
          'UNKNOWN': 4
        };
        return healthOrder[row.pipeline_health || 'UNKNOWN'] || 4;
      }
      default: return null;
    }
  };

  // Initialize sortable table
  const { sortedData, handleSort, getSortDirection } = useSortableTable(
    allPipeline,
    defaultSorted,
    getColumnValue
  );

  const getCoverageClass = (coverage: number) => {
    if (coverage >= 3) return 'green';
    if (coverage >= 2) return 'yellow';
    return 'red';
  };

  const getHealthStyle = (health: string): { bg: string; color: string } => {
    switch (health) {
      case 'HEALTHY': return { bg: '#dcfce7', color: '#166534' };
      case 'ADEQUATE': return { bg: '#fef3c7', color: '#92400e' };
      case 'AT RISK': return { bg: '#fee2e2', color: '#991b1b' };
      default: return { bg: '#f3f4f6', color: '#4b5563' }; // UNKNOWN
    }
  };

  return (
    <section>
      <h2>5. Pipeline Coverage by Region & Product</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <SortableHeader
                label="Region"
                column="region"
                sortDirection={getSortDirection('region')}
                onSort={handleSort}
              />
              <SortableHeader
                label="Prod"
                column="product"
                sortDirection={getSortDirection('product')}
                onSort={handleSort}
              />
              <SortableHeader
                label="Cat"
                column="category"
                sortDirection={getSortDirection('category')}
                onSort={handleSort}
              />
              <SortableHeader
                label="Pipe"
                column="pipeline_acv"
                sortDirection={getSortDirection('pipeline_acv')}
                onSort={handleSort}
                className="right"
              />
              <SortableHeader
                label="Cov"
                column="pipeline_coverage_x"
                sortDirection={getSortDirection('pipeline_coverage_x')}
                onSort={handleSort}
                className="right"
              />
              <SortableHeader
                label="Age"
                column="pipeline_avg_age_days"
                sortDirection={getSortDirection('pipeline_avg_age_days')}
                onSort={handleSort}
                className="right"
              />
              <SortableHeader
                label="Health"
                column="pipeline_health"
                sortDirection={getSortDirection('pipeline_health')}
                onSort={handleSort}
                className="center"
              />
            </tr>
          </thead>
          <tbody>
            {sortedData.map((p, idx) => {
              const coverage = p.pipeline_coverage_x || 0;
              const age = p.pipeline_avg_age_days || 0;
              const health = p.pipeline_health || 'UNKNOWN';

              return (
                <tr key={`pipeline-${idx}`}>
                  <td><RegionBadge region={p.region} /></td>
                  <td>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      background: p.product === 'POR' ? 'linear-gradient(135deg, #22c55e, #16a34a)' : 'linear-gradient(135deg, #ef4444, #dc2626)',
                      color: '#ffffff',
                    }}>
                      {p.product}
                    </span>
                  </td>
                  <td>{p.category}</td>
                  <td className="right">{formatCurrency(p.pipeline_acv)}</td>
                  <td className={`${getCoverageClass(coverage)} right`}>{formatCoverage(coverage)}</td>
                  <td className="right">{Math.round(age)} days</td>
                  <td className="center">
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      backgroundColor: getHealthStyle(health).bg,
                      color: getHealthStyle(health).color,
                    }}>
                      {health}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
