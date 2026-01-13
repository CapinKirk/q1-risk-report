import { ReportData, AttainmentRow, Product } from '@/lib/types';
import { formatCurrency, formatPercent, formatCoverage, getRAGClass, getGapColor } from '@/lib/formatters';

interface AttainmentTableProps {
  data: ReportData;
}

function ProductAttainmentTable({ product, rows }: { product: Product; rows: AttainmentRow[] }) {
  // Sort by attainment % (worst first)
  const sorted = [...rows].sort((a, b) => (a.qtd_attainment_pct || 0) - (b.qtd_attainment_pct || 0));

  const productName = product === 'POR' ? 'Point of Rental' : 'Record360';

  return (
    <>
      <h3>{product} - {productName} (sorted worst → best)</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Region</th>
              <th>Cat</th>
              <th className="right">Q1 Tgt</th>
              <th className="right">QTD Act</th>
              <th className="right">Att%</th>
              <th className="right">Gap</th>
              <th className="right">Pipe</th>
              <th className="right">Cov</th>
              <th className="right">Win%</th>
              <th className="center">RAG</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, idx) => {
              const rag = row.rag_status || 'RED';
              const coverage = row.pipeline_coverage_x || 0;
              const winRate = row.win_rate_pct || 0;
              const gap = row.qtd_gap || 0;

              return (
                <tr key={`${row.region}-${row.category}-${idx}`}>
                  <td>{row.region}</td>
                  <td>{row.category}</td>
                  <td className="right">{formatCurrency(row.q1_target)}</td>
                  <td className="right">{formatCurrency(row.qtd_acv)}</td>
                  <td className={`${getRAGClass(rag)} right`}>{formatPercent(row.qtd_attainment_pct)}</td>
                  <td className="right" style={{ color: getGapColor(gap) }}>{formatCurrency(gap)}</td>
                  <td className="right">{formatCurrency(row.pipeline_acv)}</td>
                  <td className="right">{formatCoverage(coverage)}</td>
                  <td className="right">{formatPercent(winRate)}</td>
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

export default function AttainmentTable({ data }: AttainmentTableProps) {
  return (
    <section>
      <h2>2. Attainment by Region & Product</h2>
      <ProductAttainmentTable product="POR" rows={data.attainment_detail.POR} />
      <ProductAttainmentTable product="R360" rows={data.attainment_detail.R360} />
    </section>
  );
}
