'use client';

import { useState, useMemo, useCallback } from 'react';
import { ReportData, AttainmentRow, Product, DealDetail, Region, Category } from '@/lib/types';
import { formatCurrency, formatPercent, formatCoverage, getRAGClass, getGapColor, getAttainmentColor, getRAGBadgeColor } from '@/lib/formatters';
import { useSortableTable } from '@/lib/useSortableTable';
import SortableHeader from './SortableHeader';
import DealListModal from './DealListModal';
import RegionBadge from './RegionBadge';

interface AttainmentTableProps {
  data: ReportData;
}

type ModalType = 'won' | 'lost' | 'pipeline' | null;

interface ModalState {
  type: ModalType;
  product: Product;
  region: Region;
  category: Category;
}

function ProductAttainmentTable({
  product,
  rows,
  onCellClick,
  hasDeals,
}: {
  product: Product;
  rows: AttainmentRow[];
  onCellClick: (type: 'won' | 'lost' | 'pipeline', row: AttainmentRow) => void;
  hasDeals: boolean;
}) {
  // Default sort by attainment % (worst first)
  const defaultSorted = useMemo(() =>
    [...rows].sort((a, b) => (a.qtd_attainment_pct || 0) - (b.qtd_attainment_pct || 0)),
    [rows]
  );

  const getColumnValue = useCallback((row: AttainmentRow, column: string) => {
    switch (column) {
      case 'region': return row.region;
      case 'category': return row.category;
      case 'fy_target': return (row as any).fy_target || 0;
      case 'q1_target': return row.q1_target || 0;
      case 'qtd_target': return row.qtd_target || 0;
      case 'qtd_acv': return row.qtd_acv || 0;
      case 'qtd_attainment_pct': return row.qtd_attainment_pct || 0;
      case 'fy_progress_pct': return (row as any).fy_progress_pct || 0;
      case 'qtd_gap': return row.qtd_gap || 0;
      case 'qtd_lost_acv': return row.qtd_lost_acv || 0;
      case 'pipeline_acv': return row.pipeline_acv || 0;
      case 'pipeline_coverage_x': return row.pipeline_coverage_x || 0;
      case 'win_rate_pct': return row.win_rate_pct || 0;
      case 'rag_status': return row.rag_status || '';
      default: return null;
    }
  }, []);

  const { sortedData, handleSort, getSortDirection } = useSortableTable(rows, defaultSorted, getColumnValue);

  const productName = product === 'POR' ? 'Point of Rental' : 'Record360';

  return (
    <>
      <h3>{product} - {productName}</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <SortableHeader label="Region" column="region" sortDirection={getSortDirection('region')} onSort={handleSort} />
              <SortableHeader label="Cat" column="category" sortDirection={getSortDirection('category')} onSort={handleSort} />
              <SortableHeader label="FY Tgt" column="fy_target" sortDirection={getSortDirection('fy_target')} onSort={handleSort} className="right" />
              <SortableHeader label="Q1 Tgt" column="q1_target" sortDirection={getSortDirection('q1_target')} onSort={handleSort} className="right" />
              <SortableHeader label="QTD Tgt" column="qtd_target" sortDirection={getSortDirection('qtd_target')} onSort={handleSort} className="right" />
              <SortableHeader label="QTD Act" column="qtd_acv" sortDirection={getSortDirection('qtd_acv')} onSort={handleSort} className="right" />
              <SortableHeader label="QTD Att" column="qtd_attainment_pct" sortDirection={getSortDirection('qtd_attainment_pct')} onSort={handleSort} className="right" />
              <SortableHeader label="QTD Var" column="qtd_gap" sortDirection={getSortDirection('qtd_gap')} onSort={handleSort} className="right" />
              <SortableHeader label="Lost" column="qtd_lost_acv" sortDirection={getSortDirection('qtd_lost_acv')} onSort={handleSort} className="right" />
              <SortableHeader label="Pipe" column="pipeline_acv" sortDirection={getSortDirection('pipeline_acv')} onSort={handleSort} className="right" />
              <SortableHeader label="Cov" column="pipeline_coverage_x" sortDirection={getSortDirection('pipeline_coverage_x')} onSort={handleSort} className="right" />
              <SortableHeader label="Win%" column="win_rate_pct" sortDirection={getSortDirection('win_rate_pct')} onSort={handleSort} className="right" />
              <SortableHeader label="RAG" column="rag_status" sortDirection={getSortDirection('rag_status')} onSort={handleSort} className="center" />
            </tr>
          </thead>
          <tbody>
            {sortedData.map((row, idx) => {
              const rag = row.rag_status || 'RED';
              const coverage = row.pipeline_coverage_x || 0;
              const winRate = row.win_rate_pct || 0;
              const gap = row.qtd_gap || 0;
              const lostAcv = row.qtd_lost_acv || 0;
              const ragBgColor = rag === 'GREEN' ? '#16a34a' : rag === 'YELLOW' ? '#ca8a04' : '#dc2626';

              const fyProgressPct = (row as any).fy_progress_pct || 0;
              const fyTarget = (row as any).fy_target || 0;

              return (
                <tr key={`${row.region}-${row.category}-${idx}`}>
                  <td><RegionBadge region={row.region} /></td>
                  <td>{row.category}</td>
                  <td className="right">{formatCurrency(fyTarget)}</td>
                  <td className="right">{formatCurrency(row.q1_target)}</td>
                  <td className="right">{formatCurrency(row.qtd_target)}</td>
                  <td
                    className={`right ${hasDeals ? 'clickable' : ''}`}
                    onClick={() => hasDeals && onCellClick('won', row)}
                    title={hasDeals ? 'Click to view won deals' : ''}
                  >
                    {formatCurrency(row.qtd_acv)}
                    {hasDeals && ' 📋'}
                  </td>
                  <td className="right attainment-color" style={{ '--att-color': getAttainmentColor(row.qtd_attainment_pct) } as React.CSSProperties}>
                    {formatPercent(row.qtd_attainment_pct)}
                  </td>
                  <td className="right variance-color" style={{ '--var-color': getAttainmentColor(row.qtd_attainment_pct) } as React.CSSProperties}>{formatCurrency(gap)}</td>
                  <td
                    className={`right ${hasDeals && lostAcv > 0 ? 'clickable' : ''}`}
                    onClick={() => hasDeals && lostAcv > 0 && onCellClick('lost', row)}
                    title={hasDeals && lostAcv > 0 ? 'Click to view lost deals' : ''}
                  >
                    {formatCurrency(lostAcv)}
                    {hasDeals && lostAcv > 0 && ' 📋'}
                  </td>
                  <td
                    className={`right ${hasDeals ? 'clickable' : ''}`}
                    onClick={() => hasDeals && onCellClick('pipeline', row)}
                    title={hasDeals ? 'Click to view pipeline deals' : ''}
                  >
                    {formatCurrency(row.pipeline_acv)}
                    {hasDeals && ' 📋'}
                  </td>
                  <td className="right">{formatCoverage(coverage)}</td>
                  <td className="right attainment-color" style={{ '--att-color': getAttainmentColor(winRate) } as React.CSSProperties}>
                    {formatPercent(winRate)}
                  </td>
                  <td className="center">
                    <span className="rag-tile" style={{ backgroundColor: getRAGBadgeColor(rag) }}>
                      {rag}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <style jsx>{`
        .clickable {
          cursor: pointer;
          text-decoration: underline;
          color: #2563eb;
        }
        .clickable:hover {
          background-color: #eff6ff;
        }
        .attainment-color {
          color: var(--att-color) !important;
          font-weight: 600;
        }
        .variance-color {
          color: var(--var-color) !important;
          font-weight: 600;
        }
      `}</style>
    </>
  );
}

export default function AttainmentTable({ data }: AttainmentTableProps) {
  const [modalState, setModalState] = useState<ModalState | null>(null);

  const hasDeals = !!(data.won_deals || data.lost_deals || data.pipeline_deals);

  const handleCellClick = (type: 'won' | 'lost' | 'pipeline', row: AttainmentRow) => {
    setModalState({
      type,
      product: row.product,
      region: row.region,
      category: row.category,
    });
  };

  const closeModal = () => setModalState(null);

  // Get filtered deals for the modal
  const modalDeals = useMemo<DealDetail[]>(() => {
    if (!modalState) return [];

    let dealSource: { POR: DealDetail[]; R360: DealDetail[] } | undefined;

    switch (modalState.type) {
      case 'won':
        dealSource = data.won_deals;
        break;
      case 'lost':
        dealSource = data.lost_deals;
        break;
      case 'pipeline':
        dealSource = data.pipeline_deals;
        break;
      default:
        return [];
    }

    if (!dealSource) return [];

    const productDeals = dealSource[modalState.product] || [];

    // Filter by region and category
    return productDeals.filter(
      (d) => d.region === modalState.region && d.category === modalState.category
    );
  }, [modalState, data.won_deals, data.lost_deals, data.pipeline_deals]);

  const modalTitle = modalState
    ? `${modalState.product} ${modalState.region} ${modalState.category} - ${
        modalState.type === 'won' ? 'Won' : modalState.type === 'lost' ? 'Lost' : 'Pipeline'
      } Deals`
    : '';

  const hasPORData = data.attainment_detail.POR.length > 0;
  const hasR360Data = data.attainment_detail.R360.length > 0;

  // Don't render if no data at all
  if (!hasPORData && !hasR360Data) {
    return null;
  }

  return (
    <section>
      <h2>2. Attainment by Region & Product</h2>
      {hasDeals && (
        <p style={{ fontSize: '10px', color: '#6b7280', marginBottom: '8px' }}>
          Click on QTD Actual, Lost, or Pipeline values to view deal details
        </p>
      )}
      {hasPORData && (
        <ProductAttainmentTable
          product="POR"
          rows={data.attainment_detail.POR}
          onCellClick={handleCellClick}
          hasDeals={hasDeals}
        />
      )}
      {hasR360Data && (
        <ProductAttainmentTable
          product="R360"
          rows={data.attainment_detail.R360}
          onCellClick={handleCellClick}
          hasDeals={hasDeals}
        />
      )}

      {modalState && (
        <DealListModal
          isOpen={true}
          onClose={closeModal}
          deals={modalDeals}
          title={modalTitle}
          dealType={modalState.type as 'won' | 'lost' | 'pipeline'}
        />
      )}
    </section>
  );
}
