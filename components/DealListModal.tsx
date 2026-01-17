'use client';

import { useState, useMemo } from 'react';
import { DealDetail } from '@/lib/types';
import { formatCurrency } from '@/lib/formatters';

const ITEMS_PER_PAGE = 25;

interface DealListModalProps {
  isOpen: boolean;
  onClose: () => void;
  deals: DealDetail[];
  title: string;
  dealType: 'won' | 'lost' | 'pipeline';
}

type SortField = 'acv' | 'close_date' | 'account_name';
type SortDir = 'asc' | 'desc';

export default function DealListModal({
  isOpen,
  onClose,
  deals,
  title,
  dealType,
}: DealListModalProps) {
  const [sortField, setSortField] = useState<SortField>('acv');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [currentPage, setCurrentPage] = useState(1);

  const sortedDeals = useMemo(() => {
    return [...deals].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'acv':
          comparison = a.acv - b.acv;
          break;
        case 'close_date':
          comparison = new Date(a.close_date).getTime() - new Date(b.close_date).getTime();
          break;
        case 'account_name':
          comparison = a.account_name.localeCompare(b.account_name);
          break;
      }
      return sortDir === 'desc' ? -comparison : comparison;
    });
  }, [deals, sortField, sortDir]);

  const totalAcv = useMemo(() => {
    return deals.reduce((sum, d) => sum + (d.acv || 0), 0);
  }, [deals]);

  // Pagination
  const totalPages = Math.ceil(sortedDeals.length / ITEMS_PER_PAGE);
  const paginatedDeals = sortedDeals.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleSort = (field: SortField) => {
    setCurrentPage(1); // Reset page when sorting changes
    if (field === sortField) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const getSortIndicator = (field: SortField) => {
    if (field !== sortField) return '';
    return sortDir === 'asc' ? ' ▲' : ' ▼';
  };

  const exportToCSV = () => {
    const headers = ['Account', 'ACV', 'Close Date', 'Stage', 'Source', dealType === 'lost' ? 'Loss Reason' : '', 'Salesforce URL'];
    const rows = sortedDeals.map(d => [
      d.account_name,
      d.acv.toString(),
      d.close_date,
      d.stage,
      d.source,
      dealType === 'lost' ? (d.loss_reason || '') : '',
      d.salesforce_url,
    ]);

    const csv = [headers.filter(h => h), ...rows.map(r => r.filter((_, i) => headers[i]))].map(row =>
      row.map(cell => `"${cell}"`).join(',')
    ).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-summary">
          <span><strong>{deals.length}</strong> deals</span>
          <span><strong>{formatCurrency(totalAcv)}</strong> total ACV</span>
          <button className="export-btn" onClick={exportToCSV}>Export CSV</button>
        </div>

        <div className="modal-table-wrap">
          <table className="deal-table">
            <thead>
              <tr>
                <th
                  className="sortable"
                  onClick={() => handleSort('account_name')}
                >
                  Account{getSortIndicator('account_name')}
                </th>
                <th
                  className="sortable right"
                  onClick={() => handleSort('acv')}
                >
                  ACV{getSortIndicator('acv')}
                </th>
                <th
                  className="sortable"
                  onClick={() => handleSort('close_date')}
                >
                  Close Date{getSortIndicator('close_date')}
                </th>
                <th>Stage</th>
                <th>Source</th>
                {dealType === 'lost' && <th>Loss Reason</th>}
                <th className="center">Link</th>
              </tr>
            </thead>
            <tbody>
              {paginatedDeals.map((deal, idx) => (
                <tr key={idx}>
                  <td className="account-cell">{deal.account_name}</td>
                  <td className="right">{formatCurrency(deal.acv)}</td>
                  <td>{deal.close_date}</td>
                  <td>{deal.stage}</td>
                  <td>{deal.source}</td>
                  {dealType === 'lost' && <td>{deal.loss_reason || '-'}</td>}
                  <td className="center">
                    <a
                      href={deal.salesforce_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="sf-link"
                    >
                      Open SF
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(1)}
              >
                « First
              </button>
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              >
                ‹ Prev
              </button>
              <span className="page-info">
                Page {currentPage} of {totalPages}
              </span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              >
                Next ›
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(totalPages)}
              >
                Last »
              </button>
            </div>
          )}
        </div>

        <style jsx>{`
          .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.6);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
          }
          .modal-content {
            background: var(--bg-secondary);
            border-radius: 8px;
            width: 90%;
            max-width: 900px;
            max-height: 80vh;
            display: flex;
            flex-direction: column;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
          }
          .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 20px;
            border-bottom: 1px solid var(--border-primary);
          }
          .modal-header h3 {
            margin: 0;
            font-size: 16px;
            color: var(--text-primary);
          }
          .close-btn {
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: var(--text-secondary);
            padding: 0;
            line-height: 1;
          }
          .close-btn:hover {
            color: var(--text-primary);
          }
          .modal-summary {
            display: flex;
            gap: 20px;
            padding: 12px 20px;
            background: var(--bg-tertiary);
            border-bottom: 1px solid var(--border-primary);
            align-items: center;
          }
          .modal-summary span {
            font-size: 12px;
            color: #4b5563;
          }
          .export-btn {
            margin-left: auto;
            padding: 6px 12px;
            background: #1a1a2e;
            color: white;
            border: none;
            border-radius: 4px;
            font-size: 11px;
            cursor: pointer;
          }
          .export-btn:hover {
            background: #2d2d44;
          }
          .modal-table-wrap {
            flex: 1;
            overflow: auto;
            padding: 0 20px 20px;
          }
          .deal-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
            margin-top: 12px;
          }
          .deal-table th {
            position: sticky;
            top: 0;
            background: #1a1a2e;
            color: white;
            padding: 8px 10px;
            text-align: left;
            font-weight: 600;
            white-space: nowrap;
          }
          .deal-table th.sortable {
            cursor: pointer;
          }
          .deal-table th.sortable:hover {
            background: #2d2d44;
          }
          .deal-table td {
            padding: 8px 10px;
            border-bottom: 1px solid var(--border-primary);
          }
          .deal-table tr:hover {
            background: var(--bg-tertiary);
          }
          .account-cell {
            max-width: 200px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .sf-link {
            color: #2563eb;
            text-decoration: none;
            font-size: 10px;
            padding: 4px 8px;
            background: #eff6ff;
            border-radius: 4px;
          }
          .sf-link:hover {
            background: #dbeafe;
            text-decoration: underline;
          }
          .right {
            text-align: right;
          }
          .center {
            text-align: center;
          }
          .pagination {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 8px;
            margin-top: 12px;
            padding: 8px;
            border-top: 1px solid var(--border-primary);
          }
          .pagination button {
            padding: 4px 10px;
            border: 1px solid #d1d5db;
            border-radius: 4px;
            background: var(--bg-secondary);
            font-size: 0.7rem;
            cursor: pointer;
            transition: all 0.15s;
          }
          .pagination button:hover:not(:disabled) {
            background: var(--bg-tertiary);
            border-color: #9ca3af;
          }
          .pagination button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
          .page-info {
            padding: 0 12px;
            font-size: 0.7rem;
            color: var(--text-secondary);
          }
        `}</style>
      </div>
    </div>
  );
}
