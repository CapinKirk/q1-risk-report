'use client';

import { useState, useMemo } from 'react';
import { SQLDetailRow, Product, Region } from '@/lib/types';

const ITEMS_PER_PAGE = 25;

interface SQLDetailsProps {
  sqlDetails: {
    POR: SQLDetailRow[];
    R360: SQLDetailRow[];
  };
}

export default function SQLDetails({ sqlDetails }: SQLDetailsProps) {
  const [selectedProduct, setSelectedProduct] = useState<Product | 'ALL'>('ALL');
  const [selectedRegion, setSelectedRegion] = useState<Region | 'ALL'>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Combine and filter SQL data
  const filteredSQLs = useMemo(() => {
    let allSQLs: SQLDetailRow[] = [];

    if (selectedProduct === 'ALL' || selectedProduct === 'POR') {
      allSQLs = [...allSQLs, ...sqlDetails.POR];
    }
    if (selectedProduct === 'ALL' || selectedProduct === 'R360') {
      allSQLs = [...allSQLs, ...sqlDetails.R360];
    }

    // Apply region filter
    if (selectedRegion !== 'ALL') {
      allSQLs = allSQLs.filter(s => s.region === selectedRegion);
    }

    // Apply status filter
    if (selectedStatus !== 'ALL') {
      allSQLs = allSQLs.filter(s => s.sql_status === selectedStatus);
    }

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      allSQLs = allSQLs.filter(s =>
        s.company_name.toLowerCase().includes(term) ||
        s.email.toLowerCase().includes(term) ||
        (s.source && s.source.toLowerCase().includes(term)) ||
        (s.opportunity_name && s.opportunity_name.toLowerCase().includes(term)) ||
        (s.loss_reason && s.loss_reason.toLowerCase().includes(term))
      );
    }

    return allSQLs;
  }, [sqlDetails, selectedProduct, selectedRegion, selectedStatus, searchTerm]);

  // Calculate summary stats
  const stats = useMemo(() => {
    const total = filteredSQLs.length;
    const active = filteredSQLs.filter(s => s.sql_status === 'ACTIVE').length;
    const convertedSal = filteredSQLs.filter(s => s.sql_status === 'CONVERTED_SAL' || s.converted_to_sal === 'Yes').length;
    const convertedSqo = filteredSQLs.filter(s => s.sql_status === 'CONVERTED_SQO' || s.converted_to_sqo === 'Yes').length;
    const won = filteredSQLs.filter(s => s.sql_status === 'WON').length;
    const lost = filteredSQLs.filter(s => s.sql_status === 'LOST').length;
    const stalled = filteredSQLs.filter(s => s.sql_status === 'STALLED').length;
    const withOpportunity = filteredSQLs.filter(s => s.has_opportunity === 'Yes').length;
    const oppRate = total > 0 ? (withOpportunity / total) * 100 : 0;
    return { total, active, convertedSal, convertedSqo, won, lost, stalled, withOpportunity, oppRate };
  }, [filteredSQLs]);

  // Get unique statuses for filter dropdown
  const statuses = useMemo(() => {
    const allSQLs = sqlDetails.POR.concat(sqlDetails.R360);
    const uniqueStatuses = Array.from(new Set(allSQLs.map(s => s.sql_status))).filter(Boolean);
    return uniqueStatuses.sort();
  }, [sqlDetails]);

  // Pagination
  const totalPages = Math.ceil(filteredSQLs.length / ITEMS_PER_PAGE);
  const paginatedSQLs = filteredSQLs.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Reset page when filters change
  const handleFilterChange = (setter: (v: any) => void, value: any) => {
    setter(value);
    setCurrentPage(1);
  };

  const hasPOR = sqlDetails.POR.length > 0;
  const hasR360 = sqlDetails.R360.length > 0;
  const hasData = hasPOR || hasR360;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'WON': return { bg: '#dcfce7', color: '#166534' };
      case 'CONVERTED_SQO': return { bg: '#dbeafe', color: '#1e40af' };
      case 'CONVERTED_SAL': return { bg: '#e0e7ff', color: '#3730a3' };
      case 'ACTIVE': return { bg: '#fef3c7', color: '#92400e' };
      case 'STALLED': return { bg: '#fed7aa', color: '#c2410c' };
      case 'LOST': return { bg: '#fee2e2', color: '#991b1b' };
      default: return { bg: '#f3f4f6', color: '#4b5563' };
    }
  };

  return (
    <section className="sql-details-section">
      <h2>SQL Details</h2>
      <p style={{ fontSize: '10px', color: '#6b7280', marginBottom: '12px' }}>
        Sales Qualified Leads with opportunity tracking and loss reasons
      </p>

      {!hasData && (
        <div style={{ padding: '40px', textAlign: 'center', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
          <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>
            No SQL data available for the selected date range.
          </p>
          <p style={{ color: '#9ca3af', fontSize: '12px', marginTop: '8px' }}>
            SQL details require live BigQuery connection. Click "Refresh" to load live data.
          </p>
        </div>
      )}

      {hasData && (
        <>
          {/* Summary Stats */}
      <div className="sql-stats">
        <div className="stat-card">
          <span className="stat-value">{stats.total}</span>
          <span className="stat-label">Total SQLs</span>
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
          <span className="stat-value" style={{ color: '#ca8a04' }}>{stats.stalled}</span>
          <span className="stat-label">Stalled</span>
        </div>
        <div className="stat-card">
          <span className="stat-value" style={{ color: stats.oppRate >= 50 ? '#16a34a' : stats.oppRate >= 25 ? '#ca8a04' : '#dc2626' }}>
            {stats.oppRate.toFixed(1)}%
          </span>
          <span className="stat-label">Opp Rate</span>
        </div>
      </div>

      {/* Filters */}
      <div className="sql-filters">
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
            <option value="CONVERTED_SAL">Converted to SAL</option>
            <option value="CONVERTED_SQO">Converted to SQO</option>
            <option value="WON">Won</option>
            <option value="LOST">Lost</option>
            <option value="STALLED">Stalled</option>
          </select>
        </div>
        <div className="filter-group search">
          <label>Search:</label>
          <input
            type="text"
            placeholder="Company, email, opp name, or loss reason..."
            value={searchTerm}
            onChange={(e) => handleFilterChange(setSearchTerm, e.target.value)}
          />
        </div>
        <div className="filter-group count">
          <span className="result-count">{filteredSQLs.length} records</span>
        </div>
      </div>

      {/* SQL Table */}
      <div className="sql-table-container">
        <table className="sql-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Region</th>
              <th>Company</th>
              <th>Source</th>
              <th>SQL Date</th>
              <th>Days MQL-SQL</th>
              <th>Status</th>
              <th>Opportunity</th>
              <th>Loss Reason</th>
              <th>Salesforce</th>
            </tr>
          </thead>
          <tbody>
            {paginatedSQLs.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>
                  No SQLs found matching the filters
                </td>
              </tr>
            ) : (
              paginatedSQLs.map((sql, idx) => {
                const statusStyle = getStatusColor(sql.sql_status);
                const hasOpp = sql.has_opportunity === 'Yes' || (sql.opportunity_id && sql.opportunity_id !== '');
                return (
                  <tr key={`${sql.record_id}-${idx}`}>
                    <td>
                      <span className={`product-badge ${sql.product.toLowerCase()}`}>
                        {sql.product}
                      </span>
                    </td>
                    <td>{sql.region}</td>
                    <td className="company-cell" title={sql.company_name}>
                      {sql.company_name.length > 25 ? sql.company_name.substring(0, 25) + '...' : sql.company_name}
                    </td>
                    <td className="source-cell">
                      {sql.source || 'N/A'}
                    </td>
                    <td className="date-cell">
                      {sql.sql_date ? new Date(sql.sql_date).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="days-cell">
                      {sql.days_mql_to_sql ?? 'N/A'}
                    </td>
                    <td>
                      <span
                        className="status-badge"
                        style={{ backgroundColor: statusStyle.bg, color: statusStyle.color }}
                      >
                        {sql.sql_status}
                      </span>
                    </td>
                    <td className="opp-cell">
                      {hasOpp ? (
                        <span title={sql.opportunity_name || ''} style={{ color: '#16a34a' }}>
                          {sql.opportunity_name ? (sql.opportunity_name.length > 18 ? sql.opportunity_name.substring(0, 18) + '...' : sql.opportunity_name) : 'Yes'}
                        </span>
                      ) : (
                        <span style={{ color: '#9ca3af' }}>No Opp</span>
                      )}
                    </td>
                    <td className="loss-reason-cell" title={sql.loss_reason || ''}>
                      {sql.sql_status === 'LOST' && sql.loss_reason ? (
                        <span style={{ color: '#dc2626' }}>
                          {sql.loss_reason.length > 20 ? sql.loss_reason.substring(0, 20) + '...' : sql.loss_reason}
                        </span>
                      ) : sql.sql_status === 'STALLED' ? (
                        <span style={{ color: '#ca8a04' }}>
                          {sql.days_in_stage ? `${sql.days_in_stage}d stalled` : 'Stalled'}
                        </span>
                      ) : (
                        <span style={{ color: '#9ca3af' }}>-</span>
                      )}
                    </td>
                    <td>
                      <a
                        href={sql.salesforce_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`sf-link ${hasOpp ? 'opp-link' : ''}`}
                        title={hasOpp ? `Open Opportunity: ${sql.opportunity_name || 'View'}` : 'Open Lead in Salesforce'}
                      >
                        {hasOpp ? 'Opp' : 'Lead'}
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
            Page {currentPage} of {totalPages} ({filteredSQLs.length} total)
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
              const lossReasons: Record<string, number> = {};
              filteredSQLs
                .filter(s => s.sql_status === 'LOST' && s.loss_reason && s.loss_reason !== 'N/A')
                .forEach(s => {
                  const reason = s.loss_reason || 'Unknown';
                  lossReasons[reason] = (lossReasons[reason] || 0) + 1;
                });
              return Object.entries(lossReasons)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 6)
                .map(([reason, count]) => (
                  <div key={reason} className="loss-reason-item">
                    <span className="loss-count">{count}</span>
                    <span className="loss-reason-text">{reason}</span>
                  </div>
                ));
            })()}
          </div>
        </div>
      )}

      <style jsx>{`
        .sql-details-section {
          margin-top: 24px;
        }
        .sql-stats {
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
          background: #f9fafb;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
          min-width: 80px;
        }
        .stat-value {
          font-size: 1.25rem;
          font-weight: 700;
          color: #1f2937;
        }
        .stat-label {
          font-size: 0.65rem;
          color: #6b7280;
          margin-top: 2px;
        }
        .sql-filters {
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
          color: #6b7280;
          font-weight: 500;
        }
        .filter-group select,
        .filter-group input {
          font-size: 0.75rem;
          padding: 4px 8px;
          border: 1px solid #e5e7eb;
          border-radius: 4px;
          background: white;
        }
        .filter-group.search input {
          width: 220px;
        }
        .sql-table-container {
          overflow-x: auto;
        }
        .sql-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.7rem;
        }
        .sql-table th,
        .sql-table td {
          padding: 6px 5px;
          border: 1px solid #e5e7eb;
          text-align: left;
        }
        .sql-table th {
          background-color: #1a1a2e;
          color: white;
          font-weight: 600;
          font-size: 0.65rem;
        }
        .sql-table tbody tr:nth-child(even) {
          background-color: #f9fafb;
        }
        .sql-table tbody tr:hover {
          background-color: #f3f4f6;
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
          background-color: #3b82f6;
        }
        .product-badge.r360 {
          background-color: #8b5cf6;
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
        .loss-reason-cell {
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
          color: #2563eb;
          text-decoration: none;
          font-weight: 500;
          font-size: 0.65rem;
          padding: 2px 6px;
          background: #eff6ff;
          border-radius: 3px;
        }
        .sf-link:hover {
          background: #dbeafe;
          text-decoration: underline;
        }
        .sf-link.opp-link {
          background: #dcfce7;
          color: #166534;
        }
        .sf-link.opp-link:hover {
          background: #bbf7d0;
        }
        .result-count {
          font-size: 0.7rem;
          color: #6b7280;
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
          border: 1px solid #d1d5db;
          border-radius: 4px;
          background: white;
          font-size: 0.7rem;
          cursor: pointer;
          transition: all 0.15s;
        }
        .pagination button:hover:not(:disabled) {
          background: #f3f4f6;
          border-color: #9ca3af;
        }
        .pagination button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .page-info {
          padding: 0 12px;
          font-size: 0.7rem;
          color: #6b7280;
        }
        .loss-summary {
          margin-top: 16px;
          padding: 12px;
          background: #fef2f2;
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
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 8px;
        }
        .loss-reason-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 10px;
          background: white;
          border-radius: 4px;
          border: 1px solid #fecaca;
        }
        .loss-count {
          font-size: 1rem;
          font-weight: 700;
          color: #dc2626;
        }
        .loss-reason-text {
          font-size: 0.7rem;
          color: #4b5563;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      `}</style>
        </>
      )}
    </section>
  );
}
