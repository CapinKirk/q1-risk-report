'use client';

import { useState } from 'react';
import { ReportData, LossReasonRow } from '@/lib/types';
import { formatCurrency } from '@/lib/formatters';
import SortableHeader from './SortableHeader';
import { useSortableTable } from '@/lib/useSortableTable';
import RegionBadge from './RegionBadge';

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

  // Check which products have data in the filtered dataset
  const hasPORData = attainment_detail.POR && attainment_detail.POR.length > 0;
  const hasR360Data = attainment_detail.R360 && attainment_detail.R360.length > 0;

  // Product table data structure - only include products with data
  type ProductRow = { product: string; deals: number; acv: number; avg: number };
  const productData: ProductRow[] = [];

  if (hasPORData) {
    productData.push({
      product: 'POR',
      deals: porLost?.total_lost_deals || 0,
      acv: porLost?.total_lost_acv || 0,
      avg: (porLost?.total_lost_deals || 0) > 0 ? (porLost?.total_lost_acv || 0) / (porLost?.total_lost_deals || 1) : 0
    });
  }

  if (hasR360Data) {
    productData.push({
      product: 'R360',
      deals: r360Lost?.total_lost_deals || 0,
      acv: r360Lost?.total_lost_acv || 0,
      avg: (r360Lost?.total_lost_deals || 0) > 0 ? (r360Lost?.total_lost_acv || 0) / (r360Lost?.total_lost_deals || 1) : 0
    });
  }

  const productTable = useSortableTable<ProductRow>(
    productData,
    productData,
    (item, column) => {
      switch (column) {
        case 'product': return item.product;
        case 'deals': return item.deals;
        case 'acv': return item.acv;
        case 'avg': return item.avg;
        default: return '';
      }
    }
  );

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

  // Region table data structure
  type RegionRow = { region: string; por_deals: number; por_acv: number; r360_deals: number; r360_acv: number; total_acv: number };
  const regionData: RegionRow[] = Object.entries(regionLost).map(([region, data]) => ({
    region,
    por_deals: data.POR_deals,
    por_acv: data.POR_acv,
    r360_deals: data.R360_deals,
    r360_acv: data.R360_acv,
    total_acv: data.POR_acv + data.R360_acv
  }));

  // Default sort: by total ACV lost (descending)
  const defaultRegionData = [...regionData].sort((a, b) => b.total_acv - a.total_acv);

  const regionTable = useSortableTable<RegionRow>(
    regionData,
    defaultRegionData,
    (item, column) => {
      switch (column) {
        case 'region': return item.region;
        case 'por_deals': return item.por_deals;
        case 'por_acv': return item.por_acv;
        case 'r360_deals': return item.r360_deals;
        case 'r360_acv': return item.r360_acv;
        case 'total_acv': return item.total_acv;
        default: return '';
      }
    }
  );

  // Top Loss Reasons
  const allLosses: (LossReasonRow & { product: 'POR' | 'R360' })[] = [
    ...loss_reason_rca.POR.map(l => ({ ...l, product: 'POR' as const })),
    ...loss_reason_rca.R360.map(l => ({ ...l, product: 'R360' as const }))
  ];

  // Default sort: by ACV lost (descending)
  const defaultLossData = [...allLosses].sort((a, b) => (b.lost_acv || 0) - (a.lost_acv || 0));

  const lossTable = useSortableTable<LossReasonRow & { product: 'POR' | 'R360' }>(
    allLosses,
    defaultLossData,
    (item, column) => {
      switch (column) {
        case 'product': return item.product;
        case 'region': return item.region;
        case 'reason': return item.loss_reason || 'Unknown';
        case 'deals': return item.deal_count || 0;
        case 'acv': return item.lost_acv || 0;
        case 'severity': return item.severity || 'LOW';
        default: return '';
      }
    }
  );

  // Pagination for loss reasons
  const totalPages = Math.ceil(lossTable.sortedData.length / ITEMS_PER_PAGE);
  const paginatedLosses = lossTable.sortedData.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const getSeverityStyle = (severity: string): { bg: string; color: string } => {
    switch (severity) {
      case 'CRITICAL': return { bg: '#fee2e2', color: '#991b1b' };
      case 'HIGH': return { bg: '#fef3c7', color: '#92400e' };
      case 'MEDIUM': return { bg: '#e0e7ff', color: '#3730a3' };
      default: return { bg: '#f3f4f6', color: '#4b5563' }; // LOW
    }
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
              <SortableHeader
                label="Product"
                column="product"
                sortDirection={productTable.getSortDirection('product')}
                onSort={productTable.handleSort}
              />
              <SortableHeader
                label="Deals Lost"
                column="deals"
                sortDirection={productTable.getSortDirection('deals')}
                onSort={productTable.handleSort}
                className="right"
              />
              <SortableHeader
                label="ACV Lost"
                column="acv"
                sortDirection={productTable.getSortDirection('acv')}
                onSort={productTable.handleSort}
                className="right"
              />
              <SortableHeader
                label="Avg Deal Size"
                column="avg"
                sortDirection={productTable.getSortDirection('avg')}
                onSort={productTable.handleSort}
                className="right"
              />
            </tr>
          </thead>
          <tbody>
            {productTable.sortedData.map((row) => (
              <tr key={row.product}>
                <td>
                  <span style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    background: row.product === 'POR' ? 'linear-gradient(135deg, #22c55e, #16a34a)' : 'linear-gradient(135deg, #ef4444, #dc2626)',
                    color: '#ffffff',
                  }}>
                    {row.product}
                  </span>
                </td>
                <td className="right">{Math.round(row.deals)}</td>
                <td className="right red">{formatCurrency(row.acv)}</td>
                <td className="right">{formatCurrency(row.avg)}</td>
              </tr>
            ))}
            <tr style={{ fontWeight: 'bold', background: 'var(--bg-tertiary)' }}>
              <td>TOTAL</td>
              <td className="right">{Math.round(totalLostDeals)}</td>
              <td className="right red">{formatCurrency(totalLostAcv)}</td>
              <td className="right">{formatCurrency(totalAvg)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Lost by Region */}
      <h3>Lost Deals by Region</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <SortableHeader
                label="Region"
                column="region"
                sortDirection={regionTable.getSortDirection('region')}
                onSort={regionTable.handleSort}
              />
              {hasPORData && (
                <>
                  <SortableHeader
                    label="POR Deals"
                    column="por_deals"
                    sortDirection={regionTable.getSortDirection('por_deals')}
                    onSort={regionTable.handleSort}
                    className="right"
                  />
                  <SortableHeader
                    label="POR ACV"
                    column="por_acv"
                    sortDirection={regionTable.getSortDirection('por_acv')}
                    onSort={regionTable.handleSort}
                    className="right"
                  />
                </>
              )}
              {hasR360Data && (
                <>
                  <SortableHeader
                    label="R360 Deals"
                    column="r360_deals"
                    sortDirection={regionTable.getSortDirection('r360_deals')}
                    onSort={regionTable.handleSort}
                    className="right"
                  />
                  <SortableHeader
                    label="R360 ACV"
                    column="r360_acv"
                    sortDirection={regionTable.getSortDirection('r360_acv')}
                    onSort={regionTable.handleSort}
                    className="right"
                  />
                </>
              )}
              <SortableHeader
                label="Total ACV"
                column="total_acv"
                sortDirection={regionTable.getSortDirection('total_acv')}
                onSort={regionTable.handleSort}
                className="right"
              />
            </tr>
          </thead>
          <tbody>
            {regionTable.sortedData.map((row) => (
              <tr key={row.region}>
                <td><RegionBadge region={row.region} /></td>
                {hasPORData && (
                  <>
                    <td className="right">{Math.round(row.por_deals)}</td>
                    <td className="right">{formatCurrency(row.por_acv)}</td>
                  </>
                )}
                {hasR360Data && (
                  <>
                    <td className="right">{Math.round(row.r360_deals)}</td>
                    <td className="right">{formatCurrency(row.r360_acv)}</td>
                  </>
                )}
                <td className="right red"><strong>{formatCurrency(row.total_acv)}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Top Loss Reasons */}
      <h3>Loss Reasons - {lossTable.sortedData.length} total</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <SortableHeader
                label="Prod"
                column="product"
                sortDirection={lossTable.getSortDirection('product')}
                onSort={lossTable.handleSort}
              />
              <SortableHeader
                label="Region"
                column="region"
                sortDirection={lossTable.getSortDirection('region')}
                onSort={lossTable.handleSort}
              />
              <SortableHeader
                label="Reason"
                column="reason"
                sortDirection={lossTable.getSortDirection('reason')}
                onSort={lossTable.handleSort}
              />
              <SortableHeader
                label="Deals"
                column="deals"
                sortDirection={lossTable.getSortDirection('deals')}
                onSort={lossTable.handleSort}
                className="right"
              />
              <SortableHeader
                label="ACV Lost"
                column="acv"
                sortDirection={lossTable.getSortDirection('acv')}
                onSort={lossTable.handleSort}
                className="right"
              />
              <SortableHeader
                label="Severity"
                column="severity"
                sortDirection={lossTable.getSortDirection('severity')}
                onSort={lossTable.handleSort}
                className="center"
              />
            </tr>
          </thead>
          <tbody>
            {paginatedLosses.map((row, idx) => {
              const reason = (row.loss_reason || 'Unknown').length > 25
                ? row.loss_reason?.substring(0, 22) + '...'
                : row.loss_reason || 'Unknown';

              return (
                <tr key={`loss-${idx}`}>
                  <td>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      background: row.product === 'POR' ? 'linear-gradient(135deg, #22c55e, #16a34a)' : 'linear-gradient(135deg, #ef4444, #dc2626)',
                      color: '#ffffff',
                    }}>
                      {row.product}
                    </span>
                  </td>
                  <td><RegionBadge region={row.region} /></td>
                  <td title={row.loss_reason || 'Unknown'}>{reason}</td>
                  <td className="right">{Math.round(row.deal_count || 0)}</td>
                  <td className="right red">{formatCurrency(row.lost_acv)}</td>
                  <td className="center">
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      backgroundColor: getSeverityStyle(row.severity || 'LOW').bg,
                      color: getSeverityStyle(row.severity || 'LOW').color,
                    }}>
                      {row.severity || 'LOW'}
                    </span>
                  </td>
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
                border: '1px solid var(--border-primary)',
                borderRadius: '4px',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
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
                border: '1px solid var(--border-primary)',
                borderRadius: '4px',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                fontSize: '0.75rem',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                opacity: currentPage === 1 ? 0.5 : 1
              }}
            >
              ‹ Prev
            </button>
            <span style={{ padding: '0 12px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Page {currentPage} of {totalPages}
            </span>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              style={{
                padding: '4px 10px',
                border: '1px solid var(--border-primary)',
                borderRadius: '4px',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
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
                border: '1px solid var(--border-primary)',
                borderRadius: '4px',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
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
