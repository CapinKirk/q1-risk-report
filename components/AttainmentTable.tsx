'use client';

import { useState, useMemo } from 'react';
import { ReportData, AttainmentRow, Product, DealDetail, Region, Category } from '@/lib/types';
import { formatCurrency, formatPercent, formatCoverage, getRAGClass, getGapColor, getAttainmentColor, getRAGBadgeColor } from '@/lib/formatters';
import DealListModal from './DealListModal';

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
              <th className="right">FY Tgt</th>
              <th className="right">Q1 Tgt</th>
              <th className="right">QTD Act</th>
              <th className="right">Att%</th>
              <th className="right">FY%</th>
              <th className="right">Gap</th>
              <th className="right">Lost</th>
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
              const lostAcv = row.qtd_lost_acv || 0;
              const ragBgColor = rag === 'GREEN' ? '#16a34a' : rag === 'YELLOW' ? '#ca8a04' : '#dc2626';

              const fyProgressPct = (row as any).fy_progress_pct || 0;
              const fyTarget = (row as any).fy_target || 0;

              return (
                <tr key={`${row.region}-${row.category}-${idx}`}>
                  <td>{row.region}</td>
                  <td>{row.category}</td>
                  <td className="right">{formatCurrency(fyTarget)}</td>
                  <td className="right">{formatCurrency(row.q1_target)}</td>
                  <td
                    className={`right ${hasDeals ? 'clickable' : ''}`}
                    onClick={() => hasDeals && onCellClick('won', row)}
                    title={hasDeals ? 'Click to view won deals' : ''}
                  >
                    {formatCurrency(row.qtd_acv)}
                    {hasDeals && ' 📋'}
                  </td>
                  <td className="right" style={{ color: getAttainmentColor(row.qtd_attainment_pct), fontWeight: 600 }}>
                    {formatPercent(row.qtd_attainment_pct)}
                  </td>
                  <td className="right" style={{ color: '#6b7280' }}>
                    {formatPercent(fyProgressPct)}
                  </td>
                  <td className="right" style={{ color: getGapColor(gap) }}>{formatCurrency(gap)}</td>
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
                  <td className="right" style={{ color: getAttainmentColor(winRate), fontWeight: 600 }}>
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
