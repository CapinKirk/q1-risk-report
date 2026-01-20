'use client';

import { useState, useMemo } from 'react';
import { SQODetailRow, Product, Region } from '@/lib/types';
import SortableHeader from './SortableHeader';
import { useSortableTable } from '@/lib/useSortableTable';
import { formatCurrency } from '@/lib/formatters';
import RegionBadge from './RegionBadge';

const ITEMS_PER_PAGE = 25;

interface SQODetailsProps {
  sqoDetails: {
    POR: SQODetailRow[];
    R360: SQODetailRow[];
  };
}

type Category = 'NEW LOGO' | 'STRATEGIC' | 'EXPANSION' | 'MIGRATION';

export default function SQODetails({ sqoDetails }: SQODetailsProps) {
  const [selectedProduct, setSelectedProduct] = useState<Product | 'ALL'>('ALL');
  const [selectedRegion, setSelectedRegion] = useState<Region | 'ALL'>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedCategories, setSelectedCategories] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Combine and filter SQO data
  const filteredSQOs = useMemo(() => {
    let allSQOs: SQODetailRow[] = [];

    if (selectedProduct === 'ALL' || selectedProduct === 'POR') {
      allSQOs = [...allSQOs, ...sqoDetails.POR];
    }
    if (selectedProduct === 'ALL' || selectedProduct === 'R360') {
      allSQOs = [...allSQOs, ...sqoDetails.R360];
    }

    // Apply region filter
    if (selectedRegion !== 'ALL') {
      allSQOs = allSQOs.filter(s => s.region === selectedRegion);
    }

    // Apply status filter
    if (selectedStatus !== 'ALL') {
      allSQOs = allSQOs.filter(s => s.sqo_status === selectedStatus);
    }

    // Apply category filter (multi-select)
    if (selectedCategories.length > 0) {
      allSQOs = allSQOs.filter(s => selectedCategories.includes(s.category as Category));
    }

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      allSQOs = allSQOs.filter(s =>
        s.company_name.toLowerCase().includes(term) ||
        s.email.toLowerCase().includes(term) ||
        (s.source && s.source.toLowerCase().includes(term)) ||
        (s.opportunity_name && s.opportunity_name.toLowerCase().includes(term)) ||
        (s.opportunity_stage && s.opportunity_stage.toLowerCase().includes(term))
      );
    }

    return allSQOs;
  }, [sqoDetails, selectedProduct, selectedRegion, selectedStatus, selectedCategories, searchTerm]);

  // Setup sorting
  const { sortedData, handleSort, getSortDirection } = useSortableTable(
    filteredSQOs,
    filteredSQOs,
    (item: SQODetailRow, column: string) => {
      switch (column) {
        case 'product': return item.product;
        case 'region': return item.region;
        case 'company': return item.company_name;
        case 'source': return item.source || '';
        case 'sqo_date': return item.sqo_date || '';
        case 'days_sal_sqo': return item.days_sal_to_sqo ?? 0;
        case 'days_total': return item.days_total_cycle ?? 0;
        case 'status': return item.sqo_status;
        case 'stage': return item.opportunity_stage || '';
        case 'acv': return item.opportunity_acv ?? 0;
        case 'category': return item.category;
        case 'loss_reason': return item.loss_reason || '';
        default: return '';
      }
    }
  );

  // Calculate summary stats
  const stats = useMemo(() => {
    const total = filteredSQOs.length;
    const active = filteredSQOs.filter(s => s.sqo_status === 'ACTIVE').length;
    const won = filteredSQOs.filter(s => s.sqo_status === 'WON').length;
    const lost = filteredSQOs.filter(s => s.sqo_status === 'LOST').length;
    const stalled = filteredSQOs.filter(s => s.sqo_status === 'STALLED').length;
    const winRate = (won + lost) > 0 ? (won / (won + lost)) * 100 : 0;
    const totalAcv = filteredSQOs.reduce((sum, s) => sum + (s.opportunity_acv || 0), 0);
    const wonAcv = filteredSQOs.filter(s => s.sqo_status === 'WON').reduce((sum, s) => sum + (s.opportunity_acv || 0), 0);
    const avgCycleTime = filteredSQOs.length > 0
      ? Math.round(filteredSQOs.reduce((sum, s) => sum + (s.days_total_cycle || 0), 0) / filteredSQOs.length)
      : 0;
    return { total, active, won, lost, stalled, winRate, totalAcv, wonAcv, avgCycleTime };
  }, [filteredSQOs]);

  // Pagination
  const totalPages = Math.ceil(sortedData.length / ITEMS_PER_PAGE);
  const paginatedSQOs = sortedData.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Reset page when filters change
  const handleFilterChange = (setter: (v: any) => void, value: any) => {
    setter(value);
    setCurrentPage(1);
  };

  const hasPOR = sqoDetails.POR.length > 0;
  const hasR360 = sqoDetails.R360.length > 0;
  const hasData = hasPOR || hasR360;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'WON': return { bg: '#dcfce7', color: '#166534' };
      case 'ACTIVE': return { bg: '#dbeafe', color: '#1e40af' };
      case 'STALLED': return { bg: '#fed7aa', color: '#c2410c' };
      case 'LOST': return { bg: '#fee2e2', color: '#991b1b' };
      default: return { bg: '#f3f4f6', color: '#4b5563' };
    }
  };

  return (
    <section className="sqo-details-section">
      <h2>SQO Details (Sales Qualified Opportunity)</h2>
      <p style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginBottom: '12px' }}>
        Sales Qualified Opportunities - qualified opportunities in active sales pipeline
      </p>

      {!hasData && (
        <div style={{ padding: '40px', textAlign: 'center', backgroundColor: 'var(--bg-tertiary)', borderRadius: '8px', border: '1px solid var(--border-primary)' }}>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '14px', margin: 0 }}>
            No SQO data available for the selected date range.
          </p>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '12px', marginTop: '8px' }}>
            SQO details require live BigQuery connection. Click "Refresh" to load live data.
          </p>
        </div>
      )}

      {hasData && (
        <>
          {/* Summary Stats */}
          <div className="sqo-stats">
            <div className="stat-card">
              <span className="stat-value">{stats.total}</span>
              <span className="stat-label">Total SQOs</span>
            </div>
            <div className="stat-card">
              <span className="stat-value" style={{ color: '#16a34a' }}>{stats.won}</span>
              <span className="stat-label">Won</span>
            </div>
            <div className="stat-card">
              <span className="stat-value" style={{ color: '#dc2626' }}>{stats.lost}</span>
              <span className="stat-label">Lost</span>
            </div>
            <div className="stat-card">
              <span className="stat-value" style={{ color: '#2563eb' }}>{stats.active}</span>
              <span className="stat-label">Active</span>
            </div>
            <div className="stat-card">
              <span className="stat-value" style={{ color: stats.winRate >= 50 ? '#16a34a' : stats.winRate >= 25 ? '#ca8a04' : '#dc2626' }}>
                {stats.winRate.toFixed(1)}%
              </span>
              <span className="stat-label">Win Rate</span>
            </div>
            <div className="stat-card">
              <span className="stat-value" style={{ color: '#16a34a' }}>
                {formatCurrency(stats.wonAcv)}
              </span>
              <span className="stat-label">Won ACV</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{stats.avgCycleTime}d</span>
              <span className="stat-label">Avg Cycle</span>
            </div>
          </div>

          {/* Filters */}
          <div className="sqo-filters">
            <div className="filter-group">
              <label>Product:</label>
              <select value={selectedProduct} onChange={(e) => handleFilterChange(setSelectedProduct, e.target.value as Product | 'ALL')}>
                <option value="ALL">All Products</option>
                {hasPOR && <option value="POR">POR</option>}
                {hasR360 && <option value="R360">R360</option>}
              </select>
            </div>
            <div className="filter-group">
              <label>Region:</label>
              <select value={selectedRegion} onChange={(e) => handleFilterChange(setSelectedRegion, e.target.value as Region | 'ALL')}>
                <option value="ALL">All Regions</option>
                <option value="AMER">AMER</option>
                <option value="EMEA">EMEA</option>
                <option value="APAC">APAC</option>
              </select>
            </div>
            <div className="filter-group">
              <label>Status:</label>
              <select value={selectedStatus} onChange={(e) => handleFilterChange(setSelectedStatus, e.target.value)}>
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="WON">Won</option>
                <option value="LOST">Lost</option>
                <option value="STALLED">Stalled</option>
              </select>
            </div>
            <div className="filter-group category-filter">
              <label>Opp Type:</label>
              <div className="category-pills">
                {(['NEW LOGO', 'STRATEGIC', 'EXPANSION', 'MIGRATION'] as Category[]).map((cat) => (
                  <button
                    key={cat}
                    className={`category-pill ${selectedCategories.includes(cat) ? 'active' : ''}`}
                    onClick={() => {
                      setCurrentPage(1);
                      setSelectedCategories(prev =>
                        prev.includes(cat)
                          ? prev.filter(c => c !== cat)
                          : [...prev, cat]
                      );
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            <div className="filter-group search">
              <label>Search:</label>
              <input
                type="text"
                placeholder="Company, opp name, stage..."
                value={searchTerm}
                onChange={(e) => handleFilterChange(setSearchTerm, e.target.value)}
              />
            </div>
            <div className="filter-group count">
              <span className="result-count">{filteredSQOs.length} records</span>
            </div>
          </div>

          {/* SQO Table */}
          <div className="sqo-table-container">
            <table className="sqo-table">
              <thead>
                <tr>
                  <SortableHeader
                    label="Product"
                    column="product"
                    sortDirection={getSortDirection('product')}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="Region"
                    column="region"
                    sortDirection={getSortDirection('region')}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="Category"
                    column="category"
                    sortDirection={getSortDirection('category')}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="Company"
                    column="company"
                    sortDirection={getSortDirection('company')}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="Source"
                    column="source"
                    sortDirection={getSortDirection('source')}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="SQO Date"
                    column="sqo_date"
                    sortDirection={getSortDirection('sqo_date')}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="Total Cycle"
                    column="days_total"
                    sortDirection={getSortDirection('days_total')}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="Stage"
                    column="stage"
                    sortDirection={getSortDirection('stage')}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="ACV"
                    column="acv"
                    sortDirection={getSortDirection('acv')}
                    onSort={handleSort}
                    className="right"
                  />
                  <SortableHeader
                    label="Status"
                    column="status"
                    sortDirection={getSortDirection('status')}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="Lost Reason"
                    column="loss_reason"
                    sortDirection={getSortDirection('loss_reason')}
                    onSort={handleSort}
                  />
                  <th>Salesforce</th>
                </tr>
              </thead>
              <tbody>
                {paginatedSQOs.length === 0 ? (
                  <tr>
                    <td colSpan={12} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-tertiary)' }}>
                      No SQOs found matching the filters
                    </td>
                  </tr>
                ) : (
                  paginatedSQOs.map((sqo, idx) => {
                    const statusStyle = getStatusColor(sqo.sqo_status);
                    return (
                      <tr key={`${sqo.record_id}-${idx}`}>
                        <td>
                          <span className={`product-badge ${sqo.product.toLowerCase()}`}>
                            {sqo.product}
                          </span>
                        </td>
                        <td><RegionBadge region={sqo.region} /></td>
                        <td>
                          <span className={`category-badge ${sqo.category.toLowerCase().replace(' ', '-')}`}>
                            {sqo.category}
                          </span>
                        </td>
                        <td className="company-cell" title={sqo.company_name}>
                          {sqo.company_name.length > 20 ? sqo.company_name.substring(0, 20) + '...' : sqo.company_name}
                        </td>
                        <td className="source-cell">
                          {sqo.source || 'N/A'}
                        </td>
                        <td className="date-cell">
                          {sqo.sqo_date ? new Date(sqo.sqo_date).toISOString().split('T')[0] : 'N/A'}
                        </td>
                        <td className="days-cell">
                          {(sqo.days_total_cycle && sqo.days_total_cycle > 0) ? sqo.days_total_cycle : 0}d
                        </td>
                        <td className="stage-cell" title={sqo.opportunity_stage || ''}>
                          {sqo.opportunity_stage ? (sqo.opportunity_stage.length > 15 ? sqo.opportunity_stage.substring(0, 15) + '...' : sqo.opportunity_stage) : '-'}
                        </td>
                        <td className="acv-cell right">
                          {formatCurrency(sqo.opportunity_acv)}
                        </td>
                        <td>
                          <span
                            className="status-badge"
                            style={{ backgroundColor: statusStyle.bg, color: statusStyle.color }}
                          >
                            {sqo.sqo_status}
                          </span>
                        </td>
                        <td className="loss-reason-cell" title={sqo.loss_reason || ''}>
                          {sqo.sqo_status === 'LOST' ? (sqo.loss_reason && sqo.loss_reason !== 'N/A' ? (sqo.loss_reason.length > 15 ? sqo.loss_reason.substring(0, 15) + '...' : sqo.loss_reason) : '-') : '-'}
                        </td>
                        <td className="center">
                          <a
                            href={sqo.salesforce_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="sf-link"
                            title={`Open: ${sqo.opportunity_name || 'View'}`}
                          >
                            🔗
                          </a>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

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
                Page {currentPage} of {totalPages} ({filteredSQOs.length} total)
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

          {/* Loss Reason Summary */}
          {stats.lost > 0 && (
            <div className="loss-summary">
              <h4>Loss Reason Summary</h4>
              <div className="loss-reasons-grid">
                {(() => {
                  const lossReasons: Record<string, { count: number; acv: number }> = {};
                  filteredSQOs
                    .filter(s => s.sqo_status === 'LOST' && s.loss_reason && s.loss_reason !== 'N/A')
                    .forEach(s => {
                      const reason = s.loss_reason || 'Unknown';
                      if (!lossReasons[reason]) {
                        lossReasons[reason] = { count: 0, acv: 0 };
                      }
                      lossReasons[reason].count += 1;
                      lossReasons[reason].acv += s.opportunity_acv || 0;
                    });
                  return Object.entries(lossReasons)
                    .sort((a, b) => b[1].acv - a[1].acv)
                    .slice(0, 6)
                    .map(([reason, data]) => (
                      <div key={reason} className="loss-reason-item">
                        <span className="loss-count">{data.count}</span>
                        <div className="loss-info">
                          <span className="loss-reason-text">{reason}</span>
                          <span className="loss-acv">{formatCurrency(data.acv)}</span>
                        </div>
                      </div>
                    ));
                })()}
              </div>
            </div>
          )}

          <style jsx>{`
            .sqo-details-section {
              margin-top: 24px;
            }
            .sqo-stats {
              display: flex;
              gap: 12px;
              margin-bottom: 16px;
              flex-wrap: wrap;
            }
            .stat-card {
              display: flex;
              flex-direction: column;
              align-items: center;
              padding: 10px 16px;
              background: var(--bg-tertiary);
              border-radius: 8px;
              border: 1px solid var(--border-primary);
              min-width: 80px;
            }
            .stat-value {
              font-size: 1.25rem;
              font-weight: 700;
              color: var(--text-primary);
            }
            .stat-label {
              font-size: 0.65rem;
              color: var(--text-tertiary);
              margin-top: 2px;
            }
            .sqo-filters {
              display: flex;
              gap: 12px;
              margin-bottom: 12px;
              flex-wrap: wrap;
              align-items: center;
            }
            .filter-group {
              display: flex;
              align-items: center;
              gap: 6px;
            }
            .filter-group label {
              font-size: 0.7rem;
              color: var(--text-tertiary);
              font-weight: 500;
            }
            .filter-group select,
            .filter-group input {
              font-size: 0.75rem;
              padding: 4px 8px;
              border: 1px solid var(--border-primary);
              border-radius: 4px;
              background: var(--bg-secondary);
              color: var(--text-primary);
            }
            .filter-group.search input {
              width: 180px;
            }
            .filter-group.category-filter {
              display: flex;
              align-items: center;
              gap: 6px;
            }
            .category-pills {
              display: flex;
              gap: 4px;
            }
            .category-pill {
              font-size: 0.65rem;
              padding: 3px 8px;
              border: 1px solid var(--border-primary);
              border-radius: 12px;
              background: var(--bg-secondary);
              color: var(--text-tertiary);
              cursor: pointer;
              transition: all 0.15s;
              font-weight: 500;
            }
            .category-pill:hover {
              background: var(--bg-hover);
              border-color: #f59e0b;
            }
            .category-pill.active {
              background: #f59e0b;
              color: white;
              border-color: #f59e0b;
            }
            .sqo-table-container {
              overflow-x: auto;
            }
            .sqo-table {
              width: 100%;
              border-collapse: collapse;
              font-size: 0.7rem;
            }
            .sqo-table th,
            .sqo-table td {
              padding: 6px 5px;
              border: 1px solid var(--border-primary);
              text-align: left;
            }
            .sqo-table th {
              background-color: #1a1a2e;
              color: white;
              font-weight: 600;
              font-size: 0.65rem;
            }
            .sqo-table th.right,
            .sqo-table td.right {
              text-align: right;
            }
            .sqo-table tbody tr:nth-child(even) {
              background-color: var(--bg-tertiary);
            }
            .sqo-table tbody tr:hover {
              background-color: var(--bg-hover);
            }
            .product-badge {
              display: inline-block;
              padding: 2px 5px;
              border-radius: 3px;
              font-size: 0.6rem;
              font-weight: 600;
              color: white;
            }
            .product-badge.por {
              background: linear-gradient(135deg, #22c55e, #16a34a);
            }
            .product-badge.r360 {
              background: linear-gradient(135deg, #ef4444, #dc2626);
            }
            .category-badge {
              display: inline-block;
              padding: 2px 5px;
              border-radius: 3px;
              font-size: 0.55rem;
              font-weight: 600;
            }
            .category-badge.new-logo {
              background-color: #dbeafe;
              color: #1e40af;
            }
            .category-badge.expansion {
              background-color: var(--bg-tertiary);
              color: #7c3aed;
            }
            .category-badge.migration {
              background-color: var(--bg-tertiary);
              color: #c2410c;
            }
            .company-cell {
              max-width: 130px;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
            .source-cell {
              max-width: 70px;
            }
            .date-cell {
              white-space: nowrap;
            }
            .days-cell {
              text-align: center;
            }
            .stage-cell {
              max-width: 100px;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
            .acv-cell {
              white-space: nowrap;
              font-weight: 600;
            }
            .loss-reason-cell {
              max-width: 120px;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
              font-size: 0.65rem;
              color: var(--text-tertiary);
            }
            .status-badge {
              display: inline-block;
              padding: 2px 5px;
              border-radius: 3px;
              font-size: 0.6rem;
              font-weight: 600;
            }
            .sf-link {
              font-size: 1rem;
              text-decoration: none;
            }
            .sf-link:hover {
              opacity: 0.7;
            }
            .result-count {
              font-size: 0.7rem;
              color: var(--text-tertiary);
              font-weight: 500;
            }
            .pagination {
              display: flex;
              justify-content: center;
              align-items: center;
              gap: 8px;
              margin-top: 12px;
              padding: 8px;
            }
            .pagination button {
              padding: 4px 10px;
              border: 1px solid var(--border-primary);
              border-radius: 4px;
              background: var(--bg-secondary);
              color: var(--text-primary);
              font-size: 0.7rem;
              cursor: pointer;
              transition: all 0.15s;
            }
            .pagination button:hover:not(:disabled) {
              background: var(--bg-hover);
              border-color: var(--border-primary);
            }
            .pagination button:disabled {
              opacity: 0.5;
              cursor: not-allowed;
            }
            .page-info {
              padding: 0 12px;
              font-size: 0.7rem;
              color: var(--text-tertiary);
            }
            .loss-summary {
              margin-top: 16px;
              padding: 12px;
              background: var(--danger-bg);
              border-radius: 8px;
              border: 1px solid #fecaca;
            }
            .loss-summary h4 {
              margin: 0 0 10px 0;
              font-size: 0.8rem;
              color: #991b1b;
            }
            .loss-reasons-grid {
              display: grid;
              grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
              gap: 8px;
            }
            .loss-reason-item {
              display: flex;
              align-items: center;
              gap: 8px;
              padding: 6px 10px;
              background: var(--bg-secondary);
              border-radius: 4px;
              border: 1px solid #fecaca;
            }
            .loss-count {
              font-size: 1rem;
              font-weight: 700;
              color: #dc2626;
              min-width: 24px;
            }
            .loss-info {
              display: flex;
              flex-direction: column;
              gap: 2px;
            }
            .loss-reason-text {
              font-size: 0.7rem;
              color: var(--text-primary);
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
            .loss-acv {
              font-size: 0.65rem;
              color: #dc2626;
              font-weight: 600;
            }
          `}</style>
        </>
      )}
    </section>
  );
}
