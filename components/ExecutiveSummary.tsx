import { ReportData, AttainmentRow } from '@/lib/types';
import { formatCurrency, formatPercent, formatCoverage, getRAGColor, getAttainmentColor } from '@/lib/formatters';

interface ExecutiveSummaryProps {
  data: ReportData;
}

export default function ExecutiveSummary({ data }: ExecutiveSummaryProps) {
  const { period, grand_total, product_totals, attainment_detail } = data;

  // Check which products have data
  const hasPOR = attainment_detail.POR.length > 0;
  const hasR360 = attainment_detail.R360.length > 0;

  // Calculate hits and misses
  const allAttainment = [
    ...attainment_detail.POR.map(a => ({ ...a, product: 'POR' as const })),
    ...attainment_detail.R360.map(a => ({ ...a, product: 'R360' as const }))
  ];
  const hits = allAttainment.filter(a => a.rag_status === 'GREEN');
  const misses = allAttainment.filter(a => a.rag_status === 'RED' || a.rag_status === 'YELLOW');

  const qtdAtt = grand_total.total_qtd_attainment_pct || 0;
  const attColor = getAttainmentColor(qtdAtt);

  const cov = grand_total.total_pipeline_coverage_x || 0;
  const covColor = cov >= 3 ? '#16a34a' : cov >= 2 ? '#ca8a04' : '#dc2626';

  const por = product_totals.POR;
  const porAtt = por?.total_qtd_attainment_pct || 0;
  const porColor = getAttainmentColor(porAtt);

  const r360 = product_totals.R360;
  const r360Att = r360?.total_qtd_attainment_pct || 0;
  const r360Color = getAttainmentColor(r360Att);

  return (
    <section>
      <h2>1. Executive Summary</h2>
      <table>
        <thead>
          <tr>
            <th>Metric</th>
            <th className="right">Total</th>
            {hasPOR && <th className="right">POR</th>}
            {hasR360 && <th className="right">R360</th>}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Q1 Target</td>
            <td className="right">{formatCurrency(grand_total.total_q1_target)}</td>
            {hasPOR && <td className="right">{formatCurrency(por?.total_q1_target)}</td>}
            {hasR360 && <td className="right">{formatCurrency(r360?.total_q1_target)}</td>}
          </tr>
          <tr>
            <td>QTD Target</td>
            <td className="right">{formatCurrency(grand_total.total_qtd_target)}</td>
            {hasPOR && <td className="right">{formatCurrency(por?.total_qtd_target)}</td>}
            {hasR360 && <td className="right">{formatCurrency(r360?.total_qtd_target)}</td>}
          </tr>
          <tr>
            <td>QTD Actual</td>
            <td className="right"><strong>{formatCurrency(grand_total.total_qtd_acv)}</strong></td>
            {hasPOR && <td className="right"><strong>{formatCurrency(por?.total_qtd_acv)}</strong></td>}
            {hasR360 && <td className="right"><strong>{formatCurrency(r360?.total_qtd_acv)}</strong></td>}
          </tr>
          <tr>
            <td>QTD Attainment</td>
            <td className="right" style={{ color: attColor }}><strong>{formatPercent(qtdAtt)}</strong></td>
            {hasPOR && <td className="right" style={{ color: porColor }}><strong>{formatPercent(porAtt)}</strong></td>}
            {hasR360 && <td className="right" style={{ color: r360Color }}><strong>{formatPercent(r360Att)}</strong></td>}
          </tr>
          <tr>
            <td>Pipeline Coverage</td>
            <td className="right" style={{ color: covColor }}><strong>{formatCoverage(cov)}</strong></td>
            {hasPOR && <td className="right">{formatCoverage(por?.total_pipeline_coverage_x)}</td>}
            {hasR360 && <td className="right">{formatCoverage(r360?.total_pipeline_coverage_x)}</td>}
          </tr>
          <tr>
            <td>Win Rate</td>
            <td className="right">{formatPercent(grand_total.total_win_rate_pct)}</td>
            {hasPOR && <td className="right">{formatPercent(por?.total_win_rate_pct)}</td>}
            {hasR360 && <td className="right">{formatPercent(r360?.total_win_rate_pct)}</td>}
          </tr>
          <tr>
            <td>Hits / Misses</td>
            <td className="right" colSpan={1 + (hasPOR ? 1 : 0) + (hasR360 ? 1 : 0)}>
              <strong>{hits.length}</strong> on track / <strong>{misses.length}</strong> need attention
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}
