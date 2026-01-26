'use client';

import { useState, useMemo } from 'react';
import { MQLDetailRow, Product, Region, LeadType } from '@/lib/types';
import SortableHeader from './SortableHeader';
import { useSortableTable } from '@/lib/useSortableTable';
import RegionBadge from './RegionBadge';

const ITEMS_PER_PAGE = 25;

type SourceType = 'INBOUND' | 'OUTBOUND' | 'AE SOURCED' | 'AM SOURCED' | 'TRADESHOW' | 'PARTNERSHIPS';
const ALL_SOURCES: SourceType[] = ['INBOUND', 'OUTBOUND', 'AE SOURCED', 'AM SOURCED', 'TRADESHOW', 'PARTNERSHIPS'];

interface MQLDetailsProps {
  mqlDetails: {
    POR: MQLDetailRow[];
    R360: MQLDetailRow[];
  };
}

export default function MQLDetails({ mqlDetails }: MQLDetailsProps) {
  const [selectedProduct, setSelectedProduct] = useState<Product | 'ALL'>('ALL');
  const [selectedRegion, setSelectedRegion] = useState<Region | 'ALL'>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedLeadTypes, setSelectedLeadTypes] = useState<LeadType[]>(['MQL', 'EQL']); // Both enabled by default
  const [selectedSources, setSelectedSources] = useState<SourceType[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Toggle lead type filter
  const toggleLeadType = (type: LeadType) => {
    setSelectedLeadTypes(prev => {
      if (prev.includes(type)) {
        // Don't allow deselecting all - keep at least one
        if (prev.length === 1) return prev;
        return prev.filter(t => t !== type);
      }
      return [...prev, type];
    });
    setCurrentPage(1);
  };

  // Combine and filter MQL data
  const filteredMQLs = useMemo(() => {
    let allMQLs: MQLDetailRow[] = [];

    if (selectedProduct === 'ALL' || selectedProduct === 'POR') {
      allMQLs = [...allMQLs, ...mqlDetails.POR];
    }
    if (selectedProduct === 'ALL' || selectedProduct === 'R360') {
      allMQLs = [...allMQLs, ...mqlDetails.R360];
    }

    // Apply lead type filter (MQL/EQL)
    allMQLs = allMQLs.filter(m => selectedLeadTypes.includes(m.lead_type || 'MQL'));

    // Apply region filter
    if (selectedRegion !== 'ALL') {
      allMQLs = allMQLs.filter(m => m.region === selectedRegion);
    }

    // Apply status filter
    if (selectedStatus !== 'ALL') {
      allMQLs = allMQLs.filter(m => m.mql_status === selectedStatus);
    }

    // Apply source filter (multi-select)
    if (selectedSources.length > 0) {
      allMQLs = allMQLs.filter(m => {
        const sourceUpper = (m.source || 'INBOUND').toUpperCase();
        return selectedSources.some(s => sourceUpper.includes(s));
      });
    }

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      allMQLs = allMQLs.filter(m =>
        m.company_name.toLowerCase().includes(term) ||
        m.email.toLowerCase().includes(term) ||
        (m.source && m.source.toLowerCase().includes(term)) ||
        (m.category && m.category.toLowerCase().includes(term))
      );
    }

    return allMQLs;
  }, [mqlDetails, selectedProduct, selectedRegion, selectedStatus, selectedLeadTypes, selectedSources, searchTerm]);

  // Sorting
  const { sortedData, handleSort, getSortDirection } = useSortableTable(
    filteredMQLs,
    filteredMQLs,
    (item, column) => {
      if (column === 'lead_type') return item.lead_type || 'MQL';
      if (column === 'category') return item.category || 'NEW LOGO';
      if (column === 'product') return item.product;
      if (column === 'region') return item.region;
      if (column === 'company_name') return item.company_name;
      if (column === 'source') return item.source || '';
      if (column === 'mql_date') return item.mql_date || '';
      if (column === 'mql_status') return item.mql_status || (item.converted_to_sql === 'Yes' ? 'CONVERTED' : 'ACTIVE');
      if (column === 'days_in_stage') return item.days_in_stage ?? -1; // Treat null as -1 for sorting
      return '';
    }
  );

  // Calculate summary stats
  const stats = useMemo(() => {
    const total = filteredMQLs.length;
    const mqlCount = filteredMQLs.filter(m => (m.lead_type || 'MQL') === 'MQL').length;
    const eqlCount = filteredMQLs.filter(m => m.lead_type === 'EQL').length;
    const converted = filteredMQLs.filter(m => m.converted_to_sql === 'Yes' || m.mql_status === 'CONVERTED').length;
    const reverted = filteredMQLs.filter(m => m.mql_status === 'REVERTED' || m.was_reverted === true).length;
    const stalled = filteredMQLs.filter(m => m.mql_status === 'STALLED').length;
    const active = filteredMQLs.filter(m => m.mql_status === 'ACTIVE').length;
    const conversionRate = total > 0 ? (converted / total) * 100 : 0;
    const revertedRate = total > 0 ? (reverted / total) * 100 : 0;
    // Category breakdown
    const newLogo = filteredMQLs.filter(m => m.category === 'NEW LOGO').length;
    const expansion = filteredMQLs.filter(m => m.category === 'EXPANSION').length;
    const migration = filteredMQLs.filter(m => m.category === 'MIGRATION').length;
    return { total, mqlCount, eqlCount, converted, reverted, stalled, active, conversionRate, revertedRate, newLogo, expansion, migration };
  }, [filteredMQLs]);

  // Pagination - memoized to ensure proper re-rendering
  const totalPages = Math.ceil(sortedData.length / ITEMS_PER_PAGE);
  const paginatedMQLs = useMemo(() => {
    return sortedData.slice(
      (currentPage - 1) * ITEMS_PER_PAGE,
      currentPage * ITEMS_PER_PAGE
    );
  }, [sortedData, currentPage]);

  // Reset page when filters change
  const handleFilterChange = (setter: (v: any) => void, value: any) => {
    setter(value);
    setCurrentPage(1);
  };

  const hasPOR = mqlDetails.POR.length > 0;
  const hasR360 = mqlDetails.R360.length > 0;
  const hasData = hasPOR || hasR360;

  return (
    <section className="mql-details-section">
      <h2>Lead Details (MQL + EQL)</h2>
      <p style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginBottom: '12px' }}>
        MQL = Marketing Qualified Leads (New Business) | EQL = Existing Qualified Leads (Expansion/Migration)
      </p>

      {!hasData && (
        <div style={{ padding: '40px', textAlign: 'center', backgroundColor: 'var(--bg-tertiary)', borderRadius: '8px', border: '1px solid var(--border-primary)' }}>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '14px', margin: 0 }}>
            No lead data available for the selected date range.
          </p>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '12px', marginTop: '8px' }}>
            Lead details require live BigQuery connection. Click "Refresh" to load live data.
          </p>
        </div>
      )}

      {hasData && (
        <>

      {/* Lead Type Toggle */}
      <div className="lead-type-toggle">
        <span className="toggle-label">Lead Type:</span>
        <button
          className={`toggle-btn mql ${selectedLeadTypes.includes('MQL') ? 'active' : ''}`}
          onClick={() => toggleLeadType('MQL')}
        >
          MQL ({stats.mqlCount})
        </button>
        <button
          className={`toggle-btn eql ${selectedLeadTypes.includes('EQL') ? 'active' : ''}`}
          onClick={() => toggleLeadType('EQL')}
        >
          EQL ({stats.eqlCount})
        </button>
      </div>

      {/* Summary Stats */}
      <div className="mql-stats">
        <div className="stat-card">
          <span className="stat-value">{stats.total}</span>
          <span className="stat-label">Total Leads</span>
        </div>
        <div className="stat-card blue">
          <span className="stat-value">{stats.newLogo}</span>
          <span className="stat-label">New Logo</span>
        </div>
        <div className="stat-card purple">
          <span className="stat-value">{stats.expansion}</span>
          <span className="stat-label">Expansion</span>
        </div>
        <div className="stat-card orange">
          <span className="stat-value">{stats.migration}</span>
          <span className="stat-label">Migration</span>
        </div>
        <div className="stat-card">
          <span className="stat-value" style={{ color: '#16a34a' }}>{stats.converted}</span>
          <span className="stat-label">Converted</span>
        </div>
        <div className="stat-card">
          <span className="stat-value" style={{ color: stats.conversionRate >= 30 ? '#16a34a' : stats.conversionRate >= 15 ? '#ca8a04' : '#dc2626' }}>
            {stats.conversionRate.toFixed(1)}%
          </span>
          <span className="stat-label">Conv. Rate</span>
        </div>
      </div>

      {/* Filters */}
      <div className="mql-filters">
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
            <option value="CONVERTED">Converted to SQL</option>
            <option value="REVERTED">Reverted/DQ</option>
            <option value="STALLED">Stalled (30d+)</option>
          </select>
        </div>
        <div className="filter-group source-filter">
          <label>Source:</label>
          <div className="source-pills">
            {ALL_SOURCES.map((src) => (
              <button
                key={src}
                className={`source-pill ${selectedSources.includes(src) ? 'active' : ''}`}
                onClick={() => {
                  setCurrentPage(1);
                  setSelectedSources(prev =>
                    prev.includes(src)
                      ? prev.filter(s => s !== src)
                      : [...prev, src]
                  );
                }}
              >
                {src}
              </button>
            ))}
          </div>
        </div>
        <div className="filter-group search">
          <label>Search:</label>
          <input
            type="text"
            placeholder="Company, email, or source..."
            value={searchTerm}
            onChange={(e) => handleFilterChange(setSearchTerm, e.target.value)}
          />
        </div>
        <div className="filter-group count">
          <span className="result-count">{filteredMQLs.length} records</span>
        </div>
      </div>

      {/* Lead Table */}
      <div className="mql-table-container">
        <table className="mql-table">
          <thead>
            <tr>
              <SortableHeader
                label="Type"
                column="lead_type"
                sortDirection={getSortDirection('lead_type')}
                onSort={handleSort}
              />
              <SortableHeader
                label="Category"
                column="category"
                sortDirection={getSortDirection('category')}
                onSort={handleSort}
              />
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
                label="Company"
                column="company_name"
                sortDirection={getSortDirection('company_name')}
                onSort={handleSort}
              />
              <SortableHeader
                label="Source"
                column="source"
                sortDirection={getSortDirection('source')}
                onSort={handleSort}
              />
              <SortableHeader
                label="Date"
                column="mql_date"
                sortDirection={getSortDirection('mql_date')}
                onSort={handleSort}
              />
              <SortableHeader
                label="Status"
                column="mql_status"
                sortDirection={getSortDirection('mql_status')}
                onSort={handleSort}
              />
              <SortableHeader
                label="Days"
                column="days_in_stage"
                sortDirection={getSortDirection('days_in_stage')}
                onSort={handleSort}
              />
              <th>SF</th>
            </tr>
          </thead>
          <tbody>
            {paginatedMQLs.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-tertiary)' }}>
                  No leads found matching the filters
                </td>
              </tr>
            ) : (
              paginatedMQLs.map((mql, idx) => (
                <tr key={`${mql.lead_type}-${mql.product}-${mql.company_name}-${mql.mql_date}-${idx}`}>
                  <td>
                    <span className={`lead-type-badge ${(mql.lead_type || 'MQL').toLowerCase()}`}>
                      {mql.lead_type || 'MQL'}
                    </span>
                  </td>
                  <td>
                    <span className={`category-badge ${(mql.category || 'NEW LOGO').toLowerCase().replace(' ', '-')}`}>
                      {mql.category || 'NEW LOGO'}
                    </span>
                  </td>
                  <td>
                    <span className={`product-badge ${mql.product.toLowerCase()}`}>
                      {mql.product}
                    </span>
                  </td>
                  <td><RegionBadge region={mql.region} /></td>
                  <td className="company-cell" title={mql.company_name}>
                    {mql.company_name.length > 25 ? mql.company_name.substring(0, 25) + '...' : mql.company_name}
                  </td>
                  <td className="source-cell">
                    {mql.source || 'N/A'}
                  </td>
                  <td className="date-cell">
                    {mql.mql_date ? new Date(mql.mql_date).toLocaleDateString() : 'N/A'}
                  </td>
                  <td>
                    <span className={`status-badge ${(mql.mql_status || (mql.converted_to_sql === 'Yes' ? 'CONVERTED' : 'ACTIVE')).toLowerCase()}`}>
                      {mql.mql_status || (mql.converted_to_sql === 'Yes' ? 'CONVERTED' : 'ACTIVE')}
                    </span>
                  </td>
                  <td className="days-cell">
                    {mql.days_in_stage ?? '-'}
                  </td>
                  <td>
                    <a
                      href={mql.salesforce_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="sf-link"
                      title="Open in Salesforce"
                    >
                      🔗
                    </a>
                  </td>
                </tr>
              ))
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
            Page {currentPage} of {totalPages} ({filteredMQLs.length} total)
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

      <style jsx>{`
        .mql-details-section {
          margin-top: 24px;
        }
        .lead-type-toggle {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
        }
        .toggle-label {
          font-size: 0.75rem;
          color: var(--text-tertiary);
          font-weight: 500;
        }
        .toggle-btn {
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
          border: 2px solid;
        }
        .toggle-btn.mql {
          border-color: #3b82f6;
          background: var(--bg-secondary);
          color: #3b82f6;
        }
        .toggle-btn.mql.active {
          background: #3b82f6;
          color: white;
        }
        .toggle-btn.eql {
          border-color: #8b5cf6;
          background: var(--bg-secondary);
          color: #8b5cf6;
        }
        .toggle-btn.eql.active {
          background: #8b5cf6;
          color: white;
        }
        .mql-stats {
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
        .stat-card.blue {
          background: var(--bg-tertiary);
          border-color: #93c5fd;
        }
        .stat-card.purple {
          background: var(--bg-tertiary);
          border-color: #c4b5fd;
        }
        .stat-card.orange {
          background: var(--bg-tertiary);
          border-color: #fdba74;
        }
        .stat-value {
          font-size: 1.3rem;
          font-weight: 700;
          color: var(--text-primary);
        }
        .stat-label {
          font-size: 0.65rem;
          color: var(--text-tertiary);
          margin-top: 4px;
        }
        .mql-filters {
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
        .filter-group.source-filter {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .source-pills {
          display: flex;
          gap: 3px;
          flex-wrap: wrap;
        }
        .source-pill {
          font-size: 0.6rem;
          padding: 2px 6px;
          border: 1px solid var(--border-primary);
          border-radius: 10px;
          background: var(--bg-secondary);
          color: var(--text-tertiary);
          cursor: pointer;
          transition: all 0.15s;
          font-weight: 500;
        }
        .source-pill:hover {
          background: var(--bg-hover);
          border-color: #3b82f6;
        }
        .source-pill.active {
          background: #3b82f6;
          color: white;
          border-color: #3b82f6;
        }
        .mql-table-container {
          overflow-x: auto;
        }
        .mql-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.75rem;
        }
        .mql-table th,
        .mql-table td {
          padding: 8px 6px;
          border: 1px solid var(--border-primary);
          text-align: left;
        }
        .mql-table th {
          background-color: #1a1a2e;
          color: white;
          font-weight: 600;
        }
        .mql-table tbody tr:nth-child(even) {
          background-color: var(--bg-tertiary);
        }
        .mql-table tbody tr:hover {
          background-color: var(--bg-hover);
        }
        .lead-type-badge {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 0.6rem;
          font-weight: 700;
          color: white;
        }
        .lead-type-badge.mql {
          background-color: #3b82f6;
        }
        .lead-type-badge.eql {
          background-color: #8b5cf6;
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
        .product-badge {
          display: inline-block;
          padding: 2px 6px;
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
        .company-cell,
        .email-cell {
          max-width: 180px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .source-cell {
          max-width: 100px;
        }
        .date-cell {
          white-space: nowrap;
        }
        .status-badge {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 0.65rem;
          font-weight: 600;
        }
        .status-badge.converted {
          background-color: #dcfce7;
          color: #166534;
        }
        .status-badge.active {
          background-color: #dbeafe;
          color: #1e40af;
        }
        .status-badge.reverted {
          background-color: var(--danger-bg);
          color: #991b1b;
        }
        .status-badge.stalled {
          background-color: var(--warning-bg);
          color: #92400e;
        }
        .days-cell {
          text-align: center;
          font-size: 0.7rem;
        }
        .sf-link {
          color: #2563eb;
          text-decoration: none;
          font-weight: 500;
          padding: 2px 6px;
          background: var(--bg-tertiary);
          border-radius: 3px;
          font-size: 0.65rem;
        }
        .sf-link:hover {
          background: var(--bg-hover);
          text-decoration: underline;
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
          font-size: 0.7rem;
          cursor: pointer;
          transition: all 0.15s;
          color: var(--text-primary);
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
      `}</style>
        </>
      )}
    </section>
  );
}
