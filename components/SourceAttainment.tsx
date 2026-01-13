import { ReportData, Product, SourceAttainmentRow, FunnelByCategoryRow, FunnelBySourceRow } from '@/lib/types';
import { formatCurrency, formatPercent, getRAGClass, getGapColor, getPctClass } from '@/lib/formatters';

interface SourceAttainmentProps {
  data: ReportData;
}

function SourceACVTable({ product, rows, period }: { product: Product; rows: SourceAttainmentRow[]; period: { as_of_date: string; quarter_pct_complete: number; days_elapsed: number; total_days: number } }) {
  const sorted = [...rows].sort((a, b) => (a.attainment_pct || 0) - (b.attainment_pct || 0));

  return (
    <>
      <h3>{product} ACV by Source (sorted worst → best)</h3>
      <p style={{ fontSize: '10px', color: '#666', margin: '3px 0' }}>
        As of {period.as_of_date} ({period.quarter_pct_complete.toFixed(1)}% Q1 - Day {period.days_elapsed}/{period.total_days})
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Region</th>
              <th>Source</th>
              <th className="right">Q1 Tgt</th>
              <th className="right">QTD Tgt</th>
              <th className="right">QTD Act</th>
              <th className="right">Att%</th>
              <th className="right">Gap</th>
              <th className="center">RAG</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, idx) => {
              const attPct = row.attainment_pct || 0;
              const gap = row.gap || 0;
              const rag = row.rag_status || 'RED';

              return (
                <tr key={`${row.region}-${row.source}-${idx}`}>
                  <td>{row.region}</td>
                  <td>{row.source}</td>
                  <td className="right">{formatCurrency(row.q1_target)}</td>
                  <td className="right">{formatCurrency(row.qtd_target)}</td>
                  <td className="right">{formatCurrency(row.qtd_acv)}</td>
                  <td className={`${getPctClass(attPct)} right`}>{formatPercent(attPct)}</td>
                  <td className="right" style={{ color: getGapColor(gap) }}>{formatCurrency(gap)}</td>
                  <td className={`${getRAGClass(rag)} center`}>{rag}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function FunnelByCategoryTable({ product, rows }: { product: Product; rows: FunnelByCategoryRow[] }) {
  // Sort by average pacing % (worst first)
  const sorted = [...rows].sort((a, b) => {
    const avgA = ((a.mql_pacing_pct || 0) + (a.sql_pacing_pct || 0) + (a.sal_pacing_pct || 0) + (a.sqo_pacing_pct || 0)) / 4;
    const avgB = ((b.mql_pacing_pct || 0) + (b.sql_pacing_pct || 0) + (b.sal_pacing_pct || 0) + (b.sqo_pacing_pct || 0)) / 4;
    return avgA - avgB;
  });

  return (
    <>
      <h4>{product}</h4>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Cat</th>
              <th>Region</th>
              <th className="right">TOF Score</th>
              <th>Stage</th>
              <th className="right">Q1 Tgt</th>
              <th className="right">QTD Tgt</th>
              <th className="right">Actual</th>
              <th className="right">Att%</th>
              <th className="right">Gap</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, idx) => {
              const category = row.category || '';
              const mqlLabel = ['EXPANSION', 'MIGRATION'].includes(category.toUpperCase()) ? 'EQL' : 'MQL';

              const stages: Array<{ label: string; q1: number; qtd: number; actual: number; pct: number; gap: number }> = [];

              if ((row.q1_target_mql || 0) > 0) {
                stages.push({ label: mqlLabel, q1: row.q1_target_mql, qtd: row.qtd_target_mql, actual: row.actual_mql, pct: row.mql_pacing_pct, gap: row.mql_gap });
              }
              if ((row.q1_target_sql || 0) > 0) {
                stages.push({ label: 'SQL', q1: row.q1_target_sql, qtd: row.qtd_target_sql, actual: row.actual_sql, pct: row.sql_pacing_pct, gap: row.sql_gap });
              }
              if ((row.q1_target_sal || 0) > 0) {
                stages.push({ label: 'SAL', q1: row.q1_target_sal, qtd: row.qtd_target_sal, actual: row.actual_sal, pct: row.sal_pacing_pct, gap: row.sal_gap });
              }
              if ((row.q1_target_sqo || 0) > 0) {
                stages.push({ label: 'SQO', q1: row.q1_target_sqo, qtd: row.qtd_target_sqo, actual: row.actual_sqo, pct: row.sqo_pacing_pct, gap: row.sqo_gap });
              }

              if (stages.length === 0) return null;

              return stages.map((stage, stageIdx) => (
                <tr key={`${row.region}-${category}-${stage.label}-${idx}`}>
                  {stageIdx === 0 && (
                    <>
                      <td rowSpan={stages.length}><strong>{category}</strong></td>
                      <td rowSpan={stages.length}>{row.region}</td>
                      <td rowSpan={stages.length} className={`${getPctClass(row.weighted_tof_score)} right`}>
                        <strong>{formatPercent(row.weighted_tof_score)}</strong>
                      </td>
                    </>
                  )}
                  <td>{stage.label}</td>
                  <td className="right">{Math.round(stage.q1 || 0)}</td>
                  <td className="right">{Math.round(stage.qtd || 0)}</td>
                  <td className="right">{Math.round(stage.actual || 0)}</td>
                  <td className={`${getPctClass(stage.pct)} right`}>{formatPercent(stage.pct)}</td>
                  <td className="right" style={{ color: getGapColor(stage.gap) }}>
                    {stage.gap >= 0 ? '+' : ''}{Math.round(stage.gap || 0)}
                  </td>
                </tr>
              ));
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function SourceAttainment({ data }: SourceAttainmentProps) {
  const { period, source_attainment, funnel_by_category, funnel_by_source } = data;

  return (
    <section>
      <h2>3. Source Attainment by Channel</h2>

      {/* Source ACV Tables */}
      <SourceACVTable product="POR" rows={source_attainment.POR} period={period} />
      <SourceACVTable product="R360" rows={source_attainment.R360} period={period} />

      {/* Funnel by Category */}
      <h3>Full Funnel Attainment by Category (EQL/MQL → SQO)</h3>
      <p style={{ fontSize: '10px', color: '#666', margin: '3px 0' }}>
        EQL for EXPANSION/MIGRATION, MQL for NEW BUSINESS | TOF Score: Weighted attainment (EQL/MQL=10%, SQL=20%, SAL=30%, SQO=40%)
      </p>
      <FunnelByCategoryTable product="POR" rows={funnel_by_category.POR} />
      <FunnelByCategoryTable product="R360" rows={funnel_by_category.R360} />
    </section>
  );
}
