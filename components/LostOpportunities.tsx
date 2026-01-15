'use client';

import { useState } from 'react';
import { ReportData, LossReasonRow } from '@/lib/types';
import { formatCurrency } from '@/lib/formatters';

const ITEMS_PER_PAGE = 15;

interface LostOpportunitiesProps {
  data: ReportData;
}

export default function LostOpportunities({ data }: LostOpportunitiesProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const { product_totals, attainment_detail, loss_reason_rca } = data;

  // Lost by Product
  const porLost = product_totals.POR;
  const r360Lost = product_totals.R360;
  const totalLostDeals = (porLost?.total_lost_deals || 0) + (r360Lost?.total_lost_deals || 0);
  const totalLostAcv = (porLost?.total_lost_acv || 0) + (r360Lost?.total_lost_acv || 0);
  const totalAvg = totalLostDeals > 0 ? totalLostAcv / totalLostDeals : 0;

  // Lost by Region
  const regionLost: Record<string, { POR_deals: number; POR_acv: number; R360_deals: number; R360_acv: number }> = {};

  attainment_detail.POR.forEach(row => {
    if (!regionLost[row.region]) {
      regionLost[row.region] = { POR_deals: 0, POR_acv: 0, R360_deals: 0, R360_acv: 0 };
    }
    regionLost[row.region].POR_deals += row.qtd_lost_deals || 0;
    regionLost[row.region].POR_acv += row.qtd_lost_acv || 0;
  });

  attainment_detail.R360.forEach(row => {
    if (!regionLost[row.region]) {
      regionLost[row.region] = { POR_deals: 0, POR_acv: 0, R360_deals: 0, R360_acv: 0 };
    }
    regionLost[row.region].R360_deals += row.qtd_lost_deals || 0;
    regionLost[row.region].R360_acv += row.qtd_lost_acv || 0;
  });

  // Sort regions by total ACV lost
  const sortedRegions = Object.entries(regionLost).sort((a, b) =>
    (b[1].POR_acv + b[1].R360_acv) - (a[1].POR_acv + a[1].R360_acv)
  );

  // Top Loss Reasons
  const allLosses: (LossReasonRow & { product: 'POR' | 'R360' })[] = [
    ...loss_reason_rca.POR.map(l => ({ ...l, product: 'POR' as const })),
    ...loss_reason_rca.R360.map(l => ({ ...l, product: 'R360' as const }))
  ];

  const sortedLosses = [...allLosses]
    .sort((a, b) => (b.lost_acv || 0) - (a.lost_acv || 0));

  // Pagination for loss reasons
  const totalPages = Math.ceil(sortedLosses.length / ITEMS_PER_PAGE);
  const paginatedLosses = sortedLosses.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const getSeverityClass = (severity: string) => {
    if (severity === 'CRITICAL') return 'red';
    if (severity === 'HIGH') return 'yellow';
    return '';
  };

  return (
    <section>
      <h2>6. Lost Opportunities Analysis</h2>

      {/* Lost by Product */}
      <h3>Lost Deals by Product</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th className="right">Deals Lost</th>
              <th className="right">ACV Lost</th>
              <th className="right">Avg Deal Size</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>POR</td>
              <td className="right">{Math.round(porLost?.total_lost_deals || 0)}</td>
              <td className="right red">{formatCurrency(porLost?.total_lost_acv)}</td>
              <td className="right">{formatCurrency((porLost?.total_lost_deals || 0) > 0 ? (porLost?.total_lost_acv || 0) / (porLost?.total_lost_deals || 1) : 0)}</td>
            </tr>
            <tr>
              <td>R360</td>
              <td className="right">{Math.round(r360Lost?.total_lost_deals || 0)}</td>
              <td className="right red">{formatCurrency(r360Lost?.total_lost_acv)}</td>
              <td className="right">{formatCurrency((r360Lost?.total_lost_deals || 0) > 0 ? (r360Lost?.total_lost_acv || 0) / (r360Lost?.total_lost_deals || 1) : 0)}</td>
            </tr>
            <tr style={{ fontWeight: 'bold', background: '#f8f9fa' }}>
              <td>TOTAL</td>
              <td className="right">{Math.round(totalLostDeals)}</td>
              <td className="right red">{formatCurrency(totalLostAcv)}</td>
              <td className="right">{formatCurrency(totalAvg)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Lost by Region */}
      <h3>Lost Deals by Region (sorted by ACV lost)</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Region</th>
              <th className="right">POR Deals</th>
              <th className="right">POR ACV</th>
              <th className="right">R360 Deals</th>
              <th className="right">R360 ACV</th>
              <th className="right">Total ACV</th>
            </tr>
          </thead>
          <tbody>
            {sortedRegions.map(([region, data]) => (
              <tr key={region}>
                <td>{region}</td>
                <td className="right">{Math.round(data.POR_deals)}</td>
                <td className="right">{formatCurrency(data.POR_acv)}</td>
                <td className="right">{Math.round(data.R360_deals)}</td>
                <td className="right">{formatCurrency(data.R360_acv)}</td>
                <td className="right red"><strong>{formatCurrency(data.POR_acv + data.R360_acv)}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Top Loss Reasons */}
      <h3>Loss Reasons (sorted by ACV impact) - {sortedLosses.length} total</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Prod</th>
              <th>Region</th>
              <th>Reason</th>
              <th className="right">Deals</th>
              <th className="right">ACV Lost</th>
              <th className="center">Severity</th>
            </tr>
          </thead>
          <tbody>
            {paginatedLosses.map((row, idx) => {
              const reason = (row.loss_reason || 'Unknown').length > 25
                ? row.loss_reason?.substring(0, 22) + '...'
                : row.loss_reason || 'Unknown';

              return (
                <tr key={`loss-${idx}`}>
                  <td>{row.product}</td>
                  <td>{row.region}</td>
                  <td title={row.loss_reason || 'Unknown'}>{reason}</td>
                  <td className="right">{Math.round(row.deal_count || 0)}</td>
                  <td className="right red">{formatCurrency(row.lost_acv)}</td>
                  <td className={`${getSeverityClass(row.severity || 'LOW')} center`}>{row.severity || 'LOW'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '8px',
            marginTop: '12px',
            padding: '8px'
          }}>
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(1)}
              style={{
                padding: '4px 10px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                background: 'white',
                fontSize: '0.75rem',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                opacity: currentPage === 1 ? 0.5 : 1
              }}
            >
              « First
            </button>
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              style={{
                padding: '4px 10px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                background: 'white',
                fontSize: '0.75rem',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                opacity: currentPage === 1 ? 0.5 : 1
              }}
            >
              ‹ Prev
            </button>
            <span style={{ padding: '0 12px', fontSize: '0.75rem', color: '#6b7280' }}>
              Page {currentPage} of {totalPages}
            </span>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              style={{
                padding: '4px 10px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                background: 'white',
                fontSize: '0.75rem',
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                opacity: currentPage === totalPages ? 0.5 : 1
              }}
            >
              Next ›
            </button>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(totalPages)}
              style={{
                padding: '4px 10px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                background: 'white',
                fontSize: '0.75rem',
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                opacity: currentPage === totalPages ? 0.5 : 1
              }}
            >
              Last »
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
