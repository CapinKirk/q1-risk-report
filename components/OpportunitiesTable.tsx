'use client';

import { useState, useMemo } from 'react';
import { ReportData, DealDetail, Region, Category, Product, Source } from '@/lib/types';
import { formatCurrency } from '@/lib/formatters';

interface OpportunitiesTableProps {
  data: ReportData;
  selectedRegions: Region[];
}

type StatusFilter = 'won' | 'lost' | 'pipeline';
type SortField = 'opportunity_name' | 'acv' | 'close_date' | 'stage' | 'source' | 'owner_name' | 'attainment';
type SortDirection = 'asc' | 'desc';

const ITEMS_PER_PAGE = 25;

const ALL_SOURCES: Source[] = ['INBOUND', 'OUTBOUND', 'AE SOURCED', 'AM SOURCED', 'TRADESHOW', 'PARTNERSHIPS'];

export default function OpportunitiesTable({ data, selectedRegions }: OpportunitiesTableProps) {
  // Filter states
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('won');
  const [categoryFilter, setCategoryFilter] = useState<Category | 'ALL'>('ALL');
  const [productFilter, setProductFilter] = useState<Product | 'ALL'>('ALL');
  const [sourceFilter, setSourceFilter] = useState<Source | 'ALL'>('ALL');
  const [typeFilter, setTypeFilter] = useState<string | 'ALL'>('ALL');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Sorting state
  const [sortField, setSortField] = useState<SortField>('acv');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Combine all deals based on status filter
  const allDeals = useMemo(() => {
    let dealSource: { POR: DealDetail[]; R360: DealDetail[] } | undefined;

    switch (statusFilter) {
      case 'won':
        dealSource = data.won_deals;
        break;
      case 'lost':
        dealSource = data.lost_deals;
        break;
      case 'pipeline':
        dealSource = data.pipeline_deals;
        break;
    }

    if (!dealSource) return [];

    const porDeals = dealSource.POR || [];
    const r360Deals = dealSource.R360 || [];
    return [...porDeals, ...r360Deals];
  }, [data.won_deals, data.lost_deals, data.pipeline_deals, statusFilter]);

  // Get unique deal types from all deals
  const uniqueDealTypes = useMemo(() => {
    const types = new Set<string>();
    allDeals.forEach(d => {
      if (d.deal_type) types.add(d.deal_type);
    });
    return Array.from(types).sort();
  }, [allDeals]);

  // Apply filters
  const filteredDeals = useMemo(() => {
    let deals = allDeals;

    // Filter by selected regions (from global filter)
    if (selectedRegions.length > 0 && selectedRegions.length < 3) {
      deals = deals.filter(d => selectedRegions.includes(d.region));
    }

    // Filter by category
    if (categoryFilter !== 'ALL') {
      deals = deals.filter(d => d.category === categoryFilter);
    }

    // Filter by product
    if (productFilter !== 'ALL') {
      deals = deals.filter(d => d.product === productFilter);
    }

    // Filter by source
    if (sourceFilter !== 'ALL') {
      deals = deals.filter(d => d.source === sourceFilter);
    }

    // Filter by deal type
    if (typeFilter !== 'ALL') {
      deals = deals.filter(d => d.deal_type === typeFilter);
    }

    return deals;
  }, [allDeals, selectedRegions, categoryFilter, productFilter, sourceFilter, typeFilter]);

  // Sort deals
  const sortedDeals = useMemo(() => {
    const sorted = [...filteredDeals].sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      switch (sortField) {
        case 'opportunity_name':
          aVal = (a.opportunity_name || a.account_name).toLowerCase();
          bVal = (b.opportunity_name || b.account_name).toLowerCase();
          break;
        case 'acv':
          aVal = a.acv;
          bVal = b.acv;
          break;
        case 'close_date':
          aVal = a.close_date;
          bVal = b.close_date;
          break;
        case 'stage':
          aVal = a.stage.toLowerCase();
          bVal = b.stage.toLowerCase();
          break;
        case 'source':
          aVal = a.source.toLowerCase();
          bVal = b.source.toLowerCase();
          break;
        case 'owner_name':
          aVal = (a.owner_name || '').toLowerCase();
          bVal = (b.owner_name || '').toLowerCase();
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [filteredDeals, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(sortedDeals.length / ITEMS_PER_PAGE);
  const paginatedDeals = sortedDeals.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Reset page when filters change
  const handleFilterChange = (setter: (v: any) => void, value: any) => {
    setter(value);
    setCurrentPage(1);
  };

  // Handle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Get sort indicator
  const getSortIndicator = (field: SortField) => {
    if (sortField !== field) return '';
    return sortDirection === 'asc' ? ' ↑' : ' ↓';
  };

  // Calculate totals
  const totalACV = filteredDeals.reduce((sum, d) => sum + d.acv, 0);
  const totalCount = filteredDeals.length;

  // Check if we have any deal data
  const hasDeals = data.won_deals || data.lost_deals || data.pipeline_deals;

  if (!hasDeals) {
    return null;
  }

  return (
    <section className="opportunities-section">
      <h2>Opportunities</h2>

      {/* Filters Row */}
      <div className="filters-row">
        <div className="filter-group">
          <label>Status</label>
          <div className="button-group">
            <button
              className={statusFilter === 'won' ? 'active won' : ''}
              onClick={() => handleFilterChange(setStatusFilter, 'won')}
            >
              Won
            </button>
            <button
              className={statusFilter === 'lost' ? 'active lost' : ''}
              onClick={() => handleFilterChange(setStatusFilter, 'lost')}
            >
              Lost
            </button>
            <button
              className={statusFilter === 'pipeline' ? 'active pipeline' : ''}
              onClick={() => handleFilterChange(setStatusFilter, 'pipeline')}
            >
              Pipeline
            </button>
          </div>
        </div>

        <div className="filter-group">
          <label>Category</label>
          <select
            value={categoryFilter}
            onChange={(e) => handleFilterChange(setCategoryFilter, e.target.value)}
          >
            <option value="ALL">All Categories</option>
            <option value="NEW LOGO">New Logo</option>
            <option value="EXPANSION">Expansion</option>
            <option value="MIGRATION">Migration</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Product</label>
          <select
            value={productFilter}
            onChange={(e) => handleFilterChange(setProductFilter, e.target.value)}
          >
            <option value="ALL">All Products</option>
            <option value="POR">Point of Rental</option>
            <option value="R360">Record360</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Source</label>
          <select
            value={sourceFilter}
            onChange={(e) => handleFilterChange(setSourceFilter, e.target.value as Source | 'ALL')}
          >
            <option value="ALL">All Sources</option>
            {ALL_SOURCES.map(source => (
              <option key={source} value={source}>{source}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Deal Type</label>
          <select
            value={typeFilter}
            onChange={(e) => handleFilterChange(setTypeFilter, e.target.value)}
          >
            <option value="ALL">All Types</option>
            {uniqueDealTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        <div className="summary-stats">
          <span className="stat">
            <strong>{totalCount}</strong> deals
          </span>
          <span className="stat">
            <strong>{formatCurrency(totalACV)}</strong> total ACV
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="opportunities-table">
          <thead>
            <tr>
              <th
                className="sortable"
                onClick={() => handleSort('opportunity_name')}
              >
                Opportunity{getSortIndicator('opportunity_name')}
              </th>
              <th>Product</th>
              <th>Region</th>
              <th>Category</th>
              <th
                className="sortable right"
                onClick={() => handleSort('acv')}
              >
                ACV{getSortIndicator('acv')}
              </th>
              <th
                className="sortable"
                onClick={() => handleSort('owner_name')}
              >
                Owner{getSortIndicator('owner_name')}
              </th>
              <th
                className="sortable"
                onClick={() => handleSort('close_date')}
              >
                Close Date{getSortIndicator('close_date')}
              </th>
              <th
                className="sortable"
                onClick={() => handleSort('stage')}
              >
                Stage{getSortIndicator('stage')}
              </th>
              <th
                className="sortable"
                onClick={() => handleSort('source')}
              >
                Source{getSortIndicator('source')}
              </th>
              {statusFilter === 'lost' && <th>Loss Reason</th>}
              <th className="center">SF Link</th>
            </tr>
          </thead>
          <tbody>
            {paginatedDeals.length === 0 ? (
              <tr>
                <td colSpan={statusFilter === 'lost' ? 11 : 10} className="empty-row">
                  No {statusFilter} deals found with current filters
                </td>
              </tr>
            ) : (
              paginatedDeals.map((deal, idx) => (
                <tr key={`${deal.opportunity_id}-${idx}`}>
                  <td className="opp-name" title={deal.opportunity_name || deal.account_name}>
                    {deal.opportunity_name || deal.account_name}
                  </td>
                  <td>
                    <span className={`product-badge ${deal.product.toLowerCase()}`}>
                      {deal.product}
                    </span>
                  </td>
                  <td>{deal.region}</td>
                  <td className="category">{deal.category}</td>
                  <td className="right acv">{formatCurrency(deal.acv)}</td>
                  <td className="owner-name" title={deal.owner_name || '-'}>
                    {deal.owner_name || '-'}
                  </td>
                  <td>{deal.close_date}</td>
                  <td>
                    <span className={`stage-badge ${getStageClass(deal.stage)}`}>
                      {deal.stage}
                    </span>
                  </td>
                  <td className="source">{deal.source}</td>
                  {statusFilter === 'lost' && (
                    <td className="loss-reason">{deal.loss_reason || '-'}</td>
                  )}
                  <td className="center">
                    <a
                      href={deal.salesforce_url}
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

      <style jsx>{`
        .opportunities-section {
          margin-top: 24px;
        }

        .filters-row {
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
          align-items: flex-end;
          margin-bottom: 16px;
          padding: 12px;
          background: var(--bg-tertiary);
          border-radius: 8px;
        }

        .filter-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .filter-group label {
          font-size: 0.7rem;
          font-weight: 600;
          color: var(--text-tertiary);
          text-transform: uppercase;
        }

        .button-group {
          display: flex;
          gap: 0;
        }

        .button-group button {
          padding: 6px 12px;
          border: 1px solid var(--border-primary);
          background: var(--bg-secondary);
          font-size: 0.75rem;
          cursor: pointer;
          transition: all 0.15s;
          color: var(--text-primary);
        }

        .button-group button:first-child {
          border-radius: 4px 0 0 4px;
        }

        .button-group button:last-child {
          border-radius: 0 4px 4px 0;
        }

        .button-group button:not(:last-child) {
          border-right: none;
        }

        .button-group button.active {
          color: white;
          border-color: transparent;
        }

        .button-group button.active.won {
          background: #16a34a;
        }

        .button-group button.active.lost {
          background: #dc2626;
        }

        .button-group button.active.pipeline {
          background: #2563eb;
        }

        .filter-group select {
          padding: 6px 10px;
          border: 1px solid var(--border-primary);
          border-radius: 4px;
          font-size: 0.75rem;
          background: var(--bg-secondary);
          color: var(--text-primary);
          min-width: 140px;
        }

        .summary-stats {
          display: flex;
          gap: 16px;
          margin-left: auto;
          padding: 6px 12px;
          background: var(--bg-secondary);
          border-radius: 4px;
          border: 1px solid var(--border-primary);
        }

        .stat {
          font-size: 0.8rem;
          color: var(--text-primary);
        }

        .stat strong {
          color: var(--text-primary);
        }

        .table-container {
          overflow-x: auto;
          border: 1px solid var(--border-primary);
          border-radius: 8px;
        }

        .opportunities-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.8rem;
        }

        .opportunities-table th {
          background: var(--bg-hover);
          padding: 10px 12px;
          text-align: left;
          font-weight: 600;
          color: var(--text-primary);
          border-bottom: 2px solid var(--border-primary);
          white-space: nowrap;
        }

        .opportunities-table th.sortable {
          cursor: pointer;
          user-select: none;
        }

        .opportunities-table th.sortable:hover {
          background: var(--border-primary);
        }

        .opportunities-table th.right,
        .opportunities-table td.right {
          text-align: right;
        }

        .opportunities-table th.center,
        .opportunities-table td.center {
          text-align: center;
        }

        .opportunities-table td {
          padding: 10px 12px;
          border-bottom: 1px solid var(--bg-hover);
          color: var(--text-primary);
        }

        .opportunities-table tr:hover {
          background: var(--bg-tertiary);
        }

        .opp-name {
          font-weight: 500;
          color: var(--text-primary);
          max-width: 220px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .owner-name {
          max-width: 120px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 0.75rem;
        }

        .product-badge {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 0.65rem;
          font-weight: 600;
        }

        .product-badge.por {
          background: #dbeafe;
          color: #1e40af;
        }

        .product-badge.r360 {
          background: var(--warning-bg);
          color: #92400e;
        }

        .category {
          font-size: 0.7rem;
        }

        .acv {
          font-weight: 600;
          color: var(--text-primary);
        }

        .stage-badge {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 0.65rem;
          font-weight: 500;
        }

        .stage-badge.won {
          background: #dcfce7;
          color: #166534;
        }

        .stage-badge.lost {
          background: var(--danger-bg);
          color: #991b1b;
        }

        .stage-badge.active {
          background: #dbeafe;
          color: #1e40af;
        }

        .stage-badge.late {
          background: var(--warning-bg);
          color: #92400e;
        }

        .source {
          font-size: 0.7rem;
          color: var(--text-tertiary);
        }

        .loss-reason {
          font-size: 0.7rem;
          color: #dc2626;
          max-width: 120px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .sf-link {
          font-size: 1rem;
          text-decoration: none;
        }

        .sf-link:hover {
          opacity: 0.7;
        }

        .empty-row {
          text-align: center;
          color: var(--text-tertiary);
          padding: 40px !important;
          font-style: italic;
        }

        .pagination {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 8px;
          margin-top: 16px;
          padding: 12px;
        }

        .pagination button {
          padding: 6px 12px;
          border: 1px solid var(--border-primary);
          border-radius: 4px;
          background: var(--bg-secondary);
          font-size: 0.75rem;
          cursor: pointer;
          transition: all 0.15s;
          color: var(--text-primary);
        }

        .pagination button:hover:not(:disabled) {
          background: var(--bg-hover);
          border-color: var(--text-tertiary);
        }

        .pagination button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .page-info {
          padding: 0 16px;
          font-size: 0.8rem;
          color: var(--text-tertiary);
        }

        @media (max-width: 768px) {
          .filters-row {
            flex-direction: column;
            align-items: stretch;
          }

          .summary-stats {
            margin-left: 0;
            justify-content: center;
          }

          .opportunities-table {
            font-size: 0.7rem;
          }

          .opportunities-table th,
          .opportunities-table td {
            padding: 6px 8px;
          }
        }
      `}</style>
    </section>
  );
}

function getStageClass(stage: string): string {
  const lower = stage.toLowerCase();
  if (lower.includes('won')) return 'won';
  if (lower.includes('lost')) return 'lost';
  if (lower.includes('negotiation') || lower.includes('proposal')) return 'late';
  return 'active';
}
