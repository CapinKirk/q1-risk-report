'use client';

import { useState, useMemo } from 'react';
import { MQLDetailRow, Product, Region } from '@/lib/types';

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
  const [searchTerm, setSearchTerm] = useState('');

  // Combine and filter MQL data
  const filteredMQLs = useMemo(() => {
    let allMQLs: MQLDetailRow[] = [];

    if (selectedProduct === 'ALL' || selectedProduct === 'POR') {
      allMQLs = [...allMQLs, ...mqlDetails.POR];
    }
    if (selectedProduct === 'ALL' || selectedProduct === 'R360') {
      allMQLs = [...allMQLs, ...mqlDetails.R360];
    }

    // Apply region filter
    if (selectedRegion !== 'ALL') {
      allMQLs = allMQLs.filter(m => m.region === selectedRegion);
    }

    // Apply status filter
    if (selectedStatus !== 'ALL') {
      allMQLs = allMQLs.filter(m => m.mql_status === selectedStatus);
    }

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      allMQLs = allMQLs.filter(m =>
        m.company_name.toLowerCase().includes(term) ||
        m.email.toLowerCase().includes(term) ||
        (m.source && m.source.toLowerCase().includes(term))
      );
    }

    return allMQLs;
  }, [mqlDetails, selectedProduct, selectedRegion, selectedStatus, searchTerm]);

  // Calculate summary stats
  const stats = useMemo(() => {
    const total = filteredMQLs.length;
    const converted = filteredMQLs.filter(m => m.converted_to_sql === 'Yes' || m.mql_status === 'CONVERTED').length;
    const reverted = filteredMQLs.filter(m => m.mql_status === 'REVERTED' || m.was_reverted === true).length;
    const stalled = filteredMQLs.filter(m => m.mql_status === 'STALLED').length;
    const active = filteredMQLs.filter(m => m.mql_status === 'ACTIVE').length;
    const conversionRate = total > 0 ? (converted / total) * 100 : 0;
    const revertedRate = total > 0 ? (reverted / total) * 100 : 0;
    return { total, converted, reverted, stalled, active, conversionRate, revertedRate };
  }, [filteredMQLs]);

  const hasPOR = mqlDetails.POR.length > 0;
  const hasR360 = mqlDetails.R360.length > 0;
  const hasData = hasPOR || hasR360;

  return (
    <section className="mql-details-section">
      <h2>MQL Details</h2>
      <p style={{ fontSize: '10px', color: '#6b7280', marginBottom: '12px' }}>
        Recent MQLs with Salesforce links, company info, and conversion status
      </p>

      {!hasData && (
        <div style={{ padding: '40px', textAlign: 'center', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
          <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>
            No MQL data available for the selected date range.
          </p>
          <p style={{ color: '#9ca3af', fontSize: '12px', marginTop: '8px' }}>
            MQL details require live BigQuery connection. Click "Refresh" to load live data.
          </p>
        </div>
      )}

      {hasData && (
        <>

      {/* Summary Stats */}
      <div className="mql-stats">
        <div className="stat-card">
          <span className="stat-value">{stats.total}</span>
          <span className="stat-label">Total MQLs</span>
        </div>
        <div className="stat-card">
          <span className="stat-value" style={{ color: '#16a34a' }}>{stats.converted}</span>
          <span className="stat-label">Converted to SQL</span>
        </div>
        <div className="stat-card">
          <span className="stat-value" style={{ color: '#dc2626' }}>{stats.reverted}</span>
          <span className="stat-label">Reverted/DQ</span>
        </div>
        <div className="stat-card">
          <span className="stat-value" style={{ color: '#ca8a04' }}>{stats.stalled}</span>
          <span className="stat-label">Stalled (30d+)</span>
        </div>
        <div className="stat-card">
          <span className="stat-value" style={{ color: stats.conversionRate >= 30 ? '#16a34a' : stats.conversionRate >= 15 ? '#ca8a04' : '#dc2626' }}>
            {stats.conversionRate.toFixed(1)}%
          </span>
          <span className="stat-label">Conversion Rate</span>
        </div>
        <div className="stat-card">
          <span className="stat-value" style={{ color: stats.revertedRate <= 10 ? '#16a34a' : stats.revertedRate <= 20 ? '#ca8a04' : '#dc2626' }}>
            {stats.revertedRate.toFixed(1)}%
          </span>
          <span className="stat-label">DQ Rate</span>
        </div>
      </div>

      {/* Filters */}
      <div className="mql-filters">
        <div className="filter-group">
          <label>Product:</label>
          <select value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value as Product | 'ALL')}>
            <option value="ALL">All Products</option>
            {hasPOR && <option value="POR">POR</option>}
            {hasR360 && <option value="R360">R360</option>}
          </select>
        </div>
        <div className="filter-group">
          <label>Region:</label>
          <select value={selectedRegion} onChange={(e) => setSelectedRegion(e.target.value as Region | 'ALL')}>
            <option value="ALL">All Regions</option>
            <option value="AMER">AMER</option>
            <option value="EMEA">EMEA</option>
            <option value="APAC">APAC</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Status:</label>
          <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="CONVERTED">Converted to SQL</option>
            <option value="REVERTED">Reverted/DQ</option>
            <option value="STALLED">Stalled (30d+)</option>
          </select>
        </div>
        <div className="filter-group search">
          <label>Search:</label>
          <input
            type="text"
            placeholder="Company, email, or source..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* MQL Table */}
      <div className="mql-table-container">
        <table className="mql-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Region</th>
              <th>Company</th>
              <th>Source</th>
              <th>MQL Date</th>
              <th>Status</th>
              <th>Days</th>
              <th>Salesforce</th>
            </tr>
          </thead>
          <tbody>
            {filteredMQLs.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>
                  No MQLs found matching the filters
                </td>
              </tr>
            ) : (
              filteredMQLs.slice(0, 50).map((mql, idx) => (
                <tr key={`${mql.record_id}-${idx}`}>
                  <td>
                    <span className={`product-badge ${mql.product.toLowerCase()}`}>
                      {mql.product}
                    </span>
                  </td>
                  <td>{mql.region}</td>
                  <td className="company-cell" title={mql.company_name}>
                    {mql.company_name.length > 30 ? mql.company_name.substring(0, 30) + '...' : mql.company_name}
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
                      View
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {filteredMQLs.length > 50 && (
          <p style={{ fontSize: '10px', color: '#6b7280', marginTop: '8px', textAlign: 'center' }}>
            Showing 50 of {filteredMQLs.length} MQLs
          </p>
        )}
      </div>

      <style jsx>{`
        .mql-details-section {
          margin-top: 24px;
        }
        .mql-stats {
          display: flex;
          gap: 16px;
          margin-bottom: 16px;
        }
        .stat-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 12px 20px;
          background: #f9fafb;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
        }
        .stat-value {
          font-size: 1.5rem;
          font-weight: 700;
          color: #1f2937;
        }
        .stat-label {
          font-size: 0.7rem;
          color: #6b7280;
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
          width: 180px;
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
          border: 1px solid #e5e7eb;
          text-align: left;
        }
        .mql-table th {
          background-color: #1a1a2e;
          color: white;
          font-weight: 600;
        }
        .mql-table tbody tr:nth-child(even) {
          background-color: #f9fafb;
        }
        .mql-table tbody tr:hover {
          background-color: #f3f4f6;
        }
        .product-badge {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 0.65rem;
          font-weight: 600;
          color: white;
        }
        .product-badge.por {
          background-color: #3b82f6;
        }
        .product-badge.r360 {
          background-color: #8b5cf6;
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
          background-color: #fee2e2;
          color: #991b1b;
        }
        .status-badge.stalled {
          background-color: #fef3c7;
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
        }
        .sf-link:hover {
          text-decoration: underline;
        }
      `}</style>
        </>
      )}
    </section>
  );
}
