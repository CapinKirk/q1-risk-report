'use client';

import { useState, useMemo } from 'react';
import { SALDetailRow, Product, Region } from '@/lib/types';
import SortableHeader from './SortableHeader';
import { useSortableTable } from '@/lib/useSortableTable';
import { formatCurrency } from '@/lib/formatters';
import RegionBadge from './RegionBadge';

const ITEMS_PER_PAGE = 25;

interface SALDetailsProps {
  salDetails: {
    POR: SALDetailRow[];
    R360: SALDetailRow[];
  };
}

type Category = 'NEW LOGO' | 'EXPANSION' | 'MIGRATION';

export default function SALDetails({ salDetails }: SALDetailsProps) {
  const [selectedProduct, setSelectedProduct] = useState<Product | 'ALL'>('ALL');
  const [selectedRegion, setSelectedRegion] = useState<Region | 'ALL'>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedCategories, setSelectedCategories] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Combine and filter SAL data
  const filteredSALs = useMemo(() => {
    let allSALs: SALDetailRow[] = [];

    if (selectedProduct === 'ALL' || selectedProduct === 'POR') {
      allSALs = [...allSALs, ...salDetails.POR];
    }
    if (selectedProduct === 'ALL' || selectedProduct === 'R360') {
      allSALs = [...allSALs, ...salDetails.R360];
    }

    // Apply region filter
    if (selectedRegion !== 'ALL') {
      allSALs = allSALs.filter(s => s.region === selectedRegion);
    }

    // Apply status filter
    if (selectedStatus !== 'ALL') {
      allSALs = allSALs.filter(s => s.sal_status === selectedStatus);
    }

    // Apply category filter (multi-select)
    if (selectedCategories.length > 0) {
      allSALs = allSALs.filter(s => selectedCategories.includes(s.category as Category));
    }

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      allSALs = allSALs.filter(s =>
        s.company_name.toLowerCase().includes(term) ||
        s.email.toLowerCase().includes(term) ||
        (s.source && s.source.toLowerCase().includes(term)) ||
        (s.opportunity_name && s.opportunity_name.toLowerCase().includes(term))
      );
    }

    return allSALs;
  }, [salDetails, selectedProduct, selectedRegion, selectedStatus, selectedCategories, searchTerm]);

  // Setup sorting
  const { sortedData, handleSort, getSortDirection } = useSortableTable(
    filteredSALs,
    filteredSALs,
    (item: SALDetailRow, column: string) => {
      switch (column) {
        case 'product': return item.product;
        case 'region': return item.region;
        case 'company': return item.company_name;
        case 'source': return item.source || '';
        case 'sal_date': return item.sal_date || '';
        case 'days_sql_sal': return item.days_sql_to_sal ?? 0;
        case 'status': return item.sal_status;
        case 'opportunity': return item.opportunity_name || '';
        case 'category': return item.category;
        default: return '';
      }
    }
  );

  // Calculate summary stats
  const stats = useMemo(() => {
    const total = filteredSALs.length;
    const active = filteredSALs.filter(s => s.sal_status === 'ACTIVE').length;
    const convertedSqo = filteredSALs.filter(s => s.sal_status === 'CONVERTED_SQO' || s.converted_to_sqo === 'Yes').length;
    const won = filteredSALs.filter(s => s.sal_status === 'WON').length;
    const lost = filteredSALs.filter(s => s.sal_status === 'LOST').length;
    const stalled = filteredSALs.filter(s => s.sal_status === 'STALLED').length;
    const withOpportunity = filteredSALs.filter(s => s.has_opportunity === 'Yes').length;
    const oppRate = total > 0 ? (withOpportunity / total) * 100 : 0;
    const conversionRate = total > 0 ? (convertedSqo / total) * 100 : 0;
    return { total, active, convertedSqo, won, lost, stalled, withOpportunity, oppRate, conversionRate };
  }, [filteredSALs]);

  // Pagination
  const totalPages = Math.ceil(sortedData.length / ITEMS_PER_PAGE);
  const paginatedSALs = sortedData.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Reset page when filters change
  const handleFilterChange = (setter: (v: any) => void, value: any) => {
    setter(value);
    setCurrentPage(1);
  };

  const hasPOR = salDetails.POR.length > 0;
  const hasR360 = salDetails.R360.length > 0;
  const hasData = hasPOR || hasR360;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'WON': return { bg: '#dcfce7', color: '#166534' };
      case 'CONVERTED_SQO': return { bg: '#dbeafe', color: '#1e40af' };
      case 'ACTIVE': return { bg: '#fef3c7', color: '#92400e' };
      case 'STALLED': return { bg: '#fed7aa', color: '#c2410c' };
      case 'LOST': return { bg: '#fee2e2', color: '#991b1b' };
      default: return { bg: '#f3f4f6', color: '#4b5563' };
    }
  };

  return (
    <section className="sal-details-section">
      <h2>SAL Details (Sales Accepted Lead)</h2>
      <p style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginBottom: '12px' }}>
        Sales Accepted Leads - qualified leads accepted by sales for opportunity development (POR only)
      </p>

      {!hasData && (
        <div style={{ padding: '40px', textAlign: 'center', backgroundColor: 'var(--bg-tertiary)', borderRadius: '8px', border: '1px solid var(--border-primary)' }}>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '14px', margin: 0 }}>
            No SAL data available for the selected date range.
          </p>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '12px', marginTop: '8px' }}>
            SAL details require live BigQuery connection. Click "Refresh" to load live data.
          </p>
        </div>
      )}

      {hasData && (
        <>
          {/* Summary Stats */}
          <div className="sal-stats">
            <div className="stat-card">
              <span className="stat-value">{stats.total}</span>
              <span className="stat-label">Total SALs</span>
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
              <span className="stat-value" style={{ color: '#2563eb' }}>{stats.convertedSqo}</span>
              <span className="stat-label">Converted SQO</span>
            </div>
            <div className="stat-card">
              <span className="stat-value" style={{ color: stats.conversionRate >= 50 ? '#16a34a' : stats.conversionRate >= 25 ? '#ca8a04' : '#dc2626' }}>
                {stats.conversionRate.toFixed(1)}%
              </span>
              <span className="stat-label">Conv. to SQO</span>
            </div>
          </div>

          {/* Filters */}
          <div className="sal-filters">
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
                <option value="CONVERTED_SQO">Converted to SQO</option>
                <option value="WON">Won</option>
                <option value="LOST">Lost</option>
                <option value="STALLED">Stalled</option>
              </select>
            </div>
            <div className="filter-group category-filter">
              <label>Opp Type:</label>
              <div className="category-pills">
                {(['NEW LOGO', 'EXPANSION', 'MIGRATION'] as Category[]).map((cat) => (
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
                placeholder="Company, email, opp name..."
                value={searchTerm}
                onChange={(e) => handleFilterChange(setSearchTerm, e.target.value)}
              />
            </div>
            <div className="filter-group count">
              <span className="result-count">{filteredSALs.length} records</span>
            </div>
          </div>

          {/* SAL Table */}
          <div className="sal-table-container">
            <table className="sal-table">
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
                    label="SAL Date"
                    column="sal_date"
                    sortDirection={getSortDirection('sal_date')}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="Days SQL-SAL"
                    column="days_sql_sal"
                    sortDirection={getSortDirection('days_sql_sal')}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="Status"
                    column="status"
                    sortDirection={getSortDirection('status')}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="Opportunity"
                    column="opportunity"
                    sortDirection={getSortDirection('opportunity')}
                    onSort={handleSort}
                  />
                  <th>Salesforce</th>
                </tr>
              </thead>
              <tbody>
                {paginatedSALs.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-tertiary)' }}>
                      No SALs found matching the filters
                    </td>
                  </tr>
                ) : (
                  paginatedSALs.map((sal, idx) => {
                    const statusStyle = getStatusColor(sal.sal_status);
                    const hasOpp = sal.has_opportunity === 'Yes' || (sal.opportunity_id && sal.opportunity_id !== '');
                    return (
                      <tr key={`${sal.record_id}-${idx}`}>
                        <td>
                          <span className={`product-badge ${sal.product.toLowerCase()}`}>
                            {sal.product}
                          </span>
                        </td>
                        <td><RegionBadge region={sal.region} /></td>
                        <td>
                          <span className={`category-badge ${sal.category.toLowerCase().replace(' ', '-')}`}>
                            {sal.category}
                          </span>
                        </td>
                        <td className="company-cell" title={sal.company_name}>
                          {sal.company_name.length > 25 ? sal.company_name.substring(0, 25) + '...' : sal.company_name}
                        </td>
                        <td className="source-cell">
                          {sal.source || 'N/A'}
                        </td>
                        <td className="date-cell">
                          {sal.sal_date ? new Date(sal.sal_date).toISOString().split('T')[0] : 'N/A'}
                        </td>
                        <td className="days-cell">
                          {sal.days_sql_to_sal ?? 'N/A'}
                        </td>
                        <td>
                          <span
                            className="status-badge"
                            style={{ backgroundColor: statusStyle.bg, color: statusStyle.color }}
                          >
                            {sal.sal_status}
                          </span>
                        </td>
                        <td className="opp-cell">
                          {hasOpp ? (
                            <span title={sal.opportunity_name || ''} style={{ color: '#16a34a' }}>
                              {sal.opportunity_name ? (sal.opportunity_name.length > 18 ? sal.opportunity_name.substring(0, 18) + '...' : sal.opportunity_name) : 'Yes'}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-tertiary)' }}>No Opp</span>
                          )}
                        </td>
                        <td className="center">
                          <a
                            href={sal.salesforce_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="sf-link"
                            title={hasOpp ? `Open Opportunity: ${sal.opportunity_name || 'View'}` : 'Open Lead in Salesforce'}
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
                Page {currentPage} of {totalPages} ({filteredSALs.length} total)
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
                  filteredSALs
                    .filter(s => s.sal_status === 'LOST' && s.loss_reason && s.loss_reason !== 'N/A')
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
            .sal-details-section {
              margin-top: 24px;
            }
            .sal-stats {
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
            .sal-filters {
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
              border-color: #10b981;
            }
            .category-pill.active {
              background: #10b981;
              color: white;
              border-color: #10b981;
            }
            .sal-table-container {
              overflow-x: auto;
            }
            .sal-table {
              width: 100%;
              border-collapse: collapse;
              font-size: 0.7rem;
            }
            .sal-table th,
            .sal-table td {
              padding: 6px 5px;
              border: 1px solid var(--border-primary);
              text-align: left;
            }
            .sal-table th {
              background-color: #1a1a2e;
              color: white;
              font-weight: 600;
              font-size: 0.65rem;
            }
            .sal-table tbody tr:nth-child(even) {
              background-color: var(--bg-tertiary);
            }
            .sal-table tbody tr:hover {
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
              max-width: 150px;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
            .source-cell {
              max-width: 80px;
            }
            .date-cell {
              white-space: nowrap;
            }
            .days-cell {
              text-align: center;
            }
            .opp-cell {
              max-width: 120px;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
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
