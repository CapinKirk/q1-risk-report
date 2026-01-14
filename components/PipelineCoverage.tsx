import { ReportData, PipelineRCARow } from '@/lib/types';
import { formatCurrency, formatCoverage } from '@/lib/formatters';

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

  // Sort by region, then product
  allPipeline.sort((a, b) => {
    if (a.region !== b.region) return a.region.localeCompare(b.region);
    if (a.product !== b.product) return a.product.localeCompare(b.product);
    return (a.category || '').localeCompare(b.category || '');
  });

  const getCoverageClass = (coverage: number) => {
    if (coverage >= 3) return 'green';
    if (coverage >= 2) return 'yellow';
    return 'red';
  };

  const getHealthClass = (health: string) => {
    if (health === 'HEALTHY') return 'green';
    if (health === 'ADEQUATE') return 'yellow';
    return 'red';
  };

  return (
    <section>
      <h2>5. Pipeline Coverage by Region & Product</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Region</th>
              <th>Prod</th>
              <th>Cat</th>
              <th className="right">Pipe</th>
              <th className="right">Cov</th>
              <th className="right">Age</th>
              <th className="center">Health</th>
            </tr>
          </thead>
          <tbody>
            {allPipeline.map((p, idx) => {
              const coverage = p.pipeline_coverage_x || 0;
              const age = p.pipeline_avg_age_days || 0;
              const health = p.pipeline_health || 'UNKNOWN';

              return (
                <tr key={`pipeline-${idx}`}>
                  <td>{p.region}</td>
                  <td>{p.product}</td>
                  <td>{p.category}</td>
                  <td className="right">{formatCurrency(p.pipeline_acv)}</td>
                  <td className={`${getCoverageClass(coverage)} right`}>{formatCoverage(coverage)}</td>
                  <td className="right">{Math.round(age)} days</td>
                  <td className={`${getHealthClass(health)} center`}>{health}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
