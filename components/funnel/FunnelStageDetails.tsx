'use client';

import { useState, useMemo } from 'react';
import { Product, Region, LeadType, MQLDetailRow, SQLDetailRow, SALDetailRow, SQODetailRow } from '@/lib/types';
import SortableHeader from '../SortableHeader';
import { useSortableTable } from '@/lib/useSortableTable';
import RegionBadge from '../RegionBadge';

const ITEMS_PER_PAGE = 25;

// Stage type definitions
export type FunnelStage = 'MQL' | 'SQL' | 'SAL' | 'SQO';

// Union type for all detail row types
type FunnelDetailRow = MQLDetailRow | SQLDetailRow | SALDetailRow | SQODetailRow;

// Stage configuration
interface StageConfig {
  title: string;
  description: string;
  statusField: string;
  dateField: string;
  statusOptions: { value: string; label: string }[];
  columns: ColumnConfig[];
  hasLeadTypeToggle?: boolean;
}

interface ColumnConfig {
  key: string;
  label: string;
  width?: string;
  render?: (row: any) => React.ReactNode;
}

// Stage configurations
const STAGE_CONFIGS: Record<FunnelStage, StageConfig> = {
  MQL: {
    title: 'Lead Details (MQL + EQL)',
    description: 'MQL = Marketing Qualified Leads (New Business) | EQL = Existing Qualified Leads (Expansion/Migration)',
    statusField: 'mql_status',
    dateField: 'mql_date',
    hasLeadTypeToggle: true,
    statusOptions: [
      { value: 'ACTIVE', label: 'Active' },
      { value: 'CONVERTED', label: 'Converted to SQL' },
      { value: 'DISQUALIFIED', label: 'Disqualified' },
      { value: 'STALLED', label: 'Stalled (30d+)' },
    ],
    columns: [
      { key: 'lead_type', label: 'Type' },
      { key: 'category', label: 'Category' },
      { key: 'product', label: 'Product' },
      { key: 'region', label: 'Region' },
      { key: 'company_name', label: 'Company' },
      { key: 'source', label: 'Source' },
      { key: 'mql_date', label: 'Date' },
      { key: 'mql_status', label: 'Status' },
      { key: 'lost_reason', label: 'DQ Reason' },
      { key: 'days_in_stage', label: 'Days' },
    ],
  },
  SQL: {
    title: 'SQL Details (Sales Qualified Leads)',
    description: 'Leads that have been qualified by sales and are in active pursuit',
    statusField: 'sql_status',
    dateField: 'sql_date',
    statusOptions: [
      { value: 'ACTIVE', label: 'Active' },
      { value: 'CONVERTED_SAL', label: 'Converted to SAL' },
      { value: 'CONVERTED_SQO', label: 'Converted to SQO' },
      { value: 'WON', label: 'Won' },
      { value: 'STALLED', label: 'Stalled' },
      { value: 'LOST', label: 'Lost' },
    ],
    columns: [
      { key: 'category', label: 'Category' },
      { key: 'product', label: 'Product' },
      { key: 'region', label: 'Region' },
      { key: 'company_name', label: 'Company' },
      { key: 'source', label: 'Source' },
      { key: 'sql_date', label: 'SQL Date' },
      { key: 'days_mql_to_sql', label: 'MQL→SQL' },
      { key: 'sql_status', label: 'Status' },
      { key: 'opportunity_name', label: 'Opportunity' },
      { key: 'loss_reason', label: 'Loss Reason' },
      { key: 'days_in_stage', label: 'Days' },
    ],
  },
  SAL: {
    title: 'SAL Details (Sales Accepted Leads)',
    description: 'Leads accepted by sales with active opportunity development',
    statusField: 'sal_status',
    dateField: 'sal_date',
    statusOptions: [
      { value: 'ACTIVE', label: 'Active' },
      { value: 'CONVERTED_SQO', label: 'Converted to SQO' },
      { value: 'WON', label: 'Won' },
      { value: 'STALLED', label: 'Stalled' },
      { value: 'LOST', label: 'Lost' },
    ],
    columns: [
      { key: 'category', label: 'Category' },
      { key: 'product', label: 'Product' },
      { key: 'region', label: 'Region' },
      { key: 'company_name', label: 'Company' },
      { key: 'source', label: 'Source' },
      { key: 'sal_date', label: 'SAL Date' },
      { key: 'days_sql_to_sal', label: 'SQL→SAL' },
      { key: 'sal_status', label: 'Status' },
      { key: 'opportunity_name', label: 'Opportunity' },
      { key: 'opportunity_acv', label: 'ACV' },
      { key: 'days_in_stage', label: 'Days' },
    ],
  },
  SQO: {
    title: 'SQO Details (Sales Qualified Opportunities)',
    description: 'Fully qualified opportunities with active deals in pipeline',
    statusField: 'sqo_status',
    dateField: 'sqo_date',
    statusOptions: [
      { value: 'ACTIVE', label: 'Active' },
      { value: 'WON', label: 'Won' },
      { value: 'LOST', label: 'Lost' },
      { value: 'STALLED', label: 'Stalled' },
    ],
    columns: [
      { key: 'category', label: 'Category' },
      { key: 'product', label: 'Product' },
      { key: 'region', label: 'Region' },
      { key: 'company_name', label: 'Company' },
      { key: 'source', label: 'Source' },
      { key: 'sqo_date', label: 'SQO Date' },
      { key: 'days_total_cycle', label: 'Cycle' },
      { key: 'sqo_status', label: 'Status' },
      { key: 'opportunity_name', label: 'Opportunity' },
      { key: 'opportunity_acv', label: 'ACV' },
      { key: 'opportunity_stage', label: 'Stage' },
      { key: 'days_in_stage', label: 'Days' },
    ],
  },
};

// Generic props interface
interface FunnelStageDetailsProps<T extends FunnelDetailRow> {
  stage: FunnelStage;
  data: {
    POR: T[];
    R360: T[];
  };
}

// Helper to get status from row based on stage
function getStatus(row: FunnelDetailRow, stage: FunnelStage): string {
  switch (stage) {
    case 'MQL':
      return (row as MQLDetailRow).mql_status || ((row as MQLDetailRow).converted_to_sql === 'Yes' ? 'CONVERTED' : 'ACTIVE');
    case 'SQL':
      return (row as SQLDetailRow).sql_status || 'ACTIVE';
    case 'SAL':
      return (row as SALDetailRow).sal_status || 'ACTIVE';
    case 'SQO':
      return (row as SQODetailRow).sqo_status || 'ACTIVE';
    default:
      return 'ACTIVE';
  }
}

// Helper to get date from row based on stage
function getDate(row: FunnelDetailRow, stage: FunnelStage): string {
  switch (stage) {
    case 'MQL':
      return (row as MQLDetailRow).mql_date || '';
    case 'SQL':
      return (row as SQLDetailRow).sql_date || '';
    case 'SAL':
      return (row as SALDetailRow).sal_date || '';
    case 'SQO':
      return (row as SQODetailRow).sqo_date || '';
    default:
      return '';
  }
}

// Format currency
function formatCurrency(value: number | undefined): string {
  if (value === undefined || value === null) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

// Format date
function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return 'N/A';
  try {
    return new Date(dateStr).toISOString().split('T')[0];
  } catch {
    return dateStr;
  }
}

export default function FunnelStageDetails<T extends FunnelDetailRow>({
  stage,
  data,
}: FunnelStageDetailsProps<T>) {
  const config = STAGE_CONFIGS[stage];

  const [selectedProduct, setSelectedProduct] = useState<Product | 'ALL'>('ALL');
  const [selectedRegion, setSelectedRegion] = useState<Region | 'ALL'>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedLeadTypes, setSelectedLeadTypes] = useState<LeadType[]>(['MQL', 'EQL']);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Toggle lead type filter (MQL only)
  const toggleLeadType = (type: LeadType) => {
    setSelectedLeadTypes(prev => {
      if (prev.includes(type)) {
        if (prev.length === 1) return prev;
        return prev.filter(t => t !== type);
      }
      return [...prev, type];
    });
    setCurrentPage(1);
  };

  // Combine and filter data
  const filteredData = useMemo(() => {
    let allData: T[] = [];

    if (selectedProduct === 'ALL' || selectedProduct === 'POR') {
      allData = [...allData, ...data.POR];
    }
    if (selectedProduct === 'ALL' || selectedProduct === 'R360') {
      allData = [...allData, ...data.R360];
    }

    // Apply lead type filter (MQL stage only)
    if (stage === 'MQL' && config.hasLeadTypeToggle) {
      allData = allData.filter(item => {
        const mqlItem = item as unknown as MQLDetailRow;
        return selectedLeadTypes.includes(mqlItem.lead_type || 'MQL');
      });
    }

    // Apply region filter
    if (selectedRegion !== 'ALL') {
      allData = allData.filter(item => item.region === selectedRegion);
    }

    // Apply status filter
    if (selectedStatus !== 'ALL') {
      allData = allData.filter(item => getStatus(item, stage) === selectedStatus);
    }

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      allData = allData.filter(item =>
        item.company_name.toLowerCase().includes(term) ||
        item.email.toLowerCase().includes(term) ||
        (item.source && item.source.toLowerCase().includes(term))
      );
    }

    return allData;
  }, [data, selectedProduct, selectedRegion, selectedStatus, selectedLeadTypes, searchTerm, stage, config.hasLeadTypeToggle]);

  // Sorting
  const { sortedData, handleSort, getSortDirection } = useSortableTable(
    filteredData,
    filteredData,
    (item: T, column: string) => {
      const anyItem = item as any;
      if (column === 'days_in_stage') return anyItem.days_in_stage ?? -1;
      if (column === 'opportunity_acv') return anyItem.opportunity_acv ?? 0;
      if (column === 'days_mql_to_sql') return anyItem.days_mql_to_sql ?? 0;
      if (column === 'days_sql_to_sal') return anyItem.days_sql_to_sal ?? 0;
      if (column === 'days_sal_to_sqo') return anyItem.days_sal_to_sqo ?? 0;
      if (column === 'days_total_cycle') return anyItem.days_total_cycle ?? 0;
      return anyItem[column] || '';
    }
  );

  // Calculate stats
  const stats = useMemo(() => {
    const total = filteredData.length;
    const byStatus: Record<string, number> = {};
    const byCategory: Record<string, number> = {};

    filteredData.forEach(item => {
      const status = getStatus(item, stage);
      byStatus[status] = (byStatus[status] || 0) + 1;

      const category = (item as any).category || 'NEW LOGO';
      byCategory[category] = (byCategory[category] || 0) + 1;
    });

    // MQL-specific stats
    let mqlCount = 0, eqlCount = 0;
    if (stage === 'MQL') {
      filteredData.forEach(item => {
        const mqlItem = item as unknown as MQLDetailRow;
        if ((mqlItem.lead_type || 'MQL') === 'MQL') mqlCount++;
        else eqlCount++;
      });
    }

    return { total, byStatus, byCategory, mqlCount, eqlCount };
  }, [filteredData, stage]);

  // Pagination
  const totalPages = Math.ceil(sortedData.length / ITEMS_PER_PAGE);
  const paginatedData = useMemo(() => {
    return sortedData.slice(
      (currentPage - 1) * ITEMS_PER_PAGE,
      currentPage * ITEMS_PER_PAGE
    );
  }, [sortedData, currentPage]);

  // Reset page on filter change
  const handleFilterChange = (setter: (v: any) => void, value: any) => {
    setter(value);
    setCurrentPage(1);
  };

  const hasPOR = data.POR.length > 0;
  const hasR360 = data.R360.length > 0;
  const hasData = hasPOR || hasR360;

  // Render cell based on column key
  const renderCell = (row: T, columnKey: string): React.ReactNode => {
    const anyRow = row as any;

    switch (columnKey) {
      case 'lead_type':
        return (
          <span className={`lead-type-badge ${(anyRow.lead_type || 'MQL').toLowerCase()}`}>
            {anyRow.lead_type || 'MQL'}
          </span>
        );
      case 'category':
        return (
          <span className={`category-badge ${(anyRow.category || 'NEW LOGO').toLowerCase().replace(' ', '-')}`}>
            {anyRow.category || 'NEW LOGO'}
          </span>
        );
      case 'product':
        return (
          <span className={`product-badge ${row.product.toLowerCase()}`}>
            {row.product}
          </span>
        );
      case 'region':
        return <RegionBadge region={row.region} />;
      case 'company_name':
        return (
          <span className="company-cell" title={row.company_name}>
            {row.company_name.length > 25 ? row.company_name.substring(0, 25) + '...' : row.company_name}
          </span>
        );
      case 'source':
        return anyRow.source || 'N/A';
      case 'mql_date':
      case 'sql_date':
      case 'sal_date':
      case 'sqo_date':
        return formatDate(anyRow[columnKey]);
      case 'mql_status':
      case 'sql_status':
      case 'sal_status':
      case 'sqo_status':
        const status = getStatus(row, stage);
        return (
          <span className={`status-badge ${status.toLowerCase().replace('_', '-')}`}>
            {status === 'DISQUALIFIED' ? 'DQ' : status.replace('_', ' ')}
          </span>
        );
      case 'lost_reason':
      case 'loss_reason':
        const reason = anyRow.lost_reason || anyRow.loss_reason;
        if (!reason) return '-';
        return (
          <span className="lost-reason-text" title={reason}>
            {reason.length > 20 ? reason.substring(0, 20) + '...' : reason}
          </span>
        );
      case 'days_in_stage':
      case 'days_mql_to_sql':
      case 'days_sql_to_sal':
      case 'days_sal_to_sqo':
      case 'days_total_cycle':
        return anyRow[columnKey] ?? '-';
      case 'opportunity_name':
        const oppName = anyRow.opportunity_name;
        if (!oppName) return '-';
        return (
          <span title={oppName}>
            {oppName.length > 20 ? oppName.substring(0, 20) + '...' : oppName}
          </span>
        );
      case 'opportunity_acv':
        return formatCurrency(anyRow.opportunity_acv);
      case 'opportunity_stage':
        return anyRow.opportunity_stage || '-';
      default:
        return anyRow[columnKey] || '-';
    }
  };

  return (
    <section className="funnel-stage-details-section">
      <h2>{config.title}</h2>
      <p style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginBottom: '12px' }}>
        {config.description}
      </p>

      {!hasData && (
        <div style={{ padding: '40px', textAlign: 'center', backgroundColor: 'var(--bg-tertiary)', borderRadius: '8px', border: '1px solid var(--border-primary)' }}>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '14px', margin: 0 }}>
            No {stage} data available for the selected date range.
          </p>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '12px', marginTop: '8px' }}>
            Details require live BigQuery connection. Click "Refresh" to load live data.
          </p>
        </div>
      )}

      {hasData && (
        <>
          {/* Lead Type Toggle (MQL only) */}
          {stage === 'MQL' && config.hasLeadTypeToggle && (
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
          )}

          {/* Summary Stats */}
          <div className="stage-stats">
            <div className="stat-card">
              <span className="stat-value">{stats.total}</span>
              <span className="stat-label">Total</span>
            </div>
            <div className="stat-card blue">
              <span className="stat-value">{stats.byCategory['NEW LOGO'] || 0}</span>
              <span className="stat-label">New Logo</span>
            </div>
            <div className="stat-card purple">
              <span className="stat-value">{stats.byCategory['EXPANSION'] || 0}</span>
              <span className="stat-label">Expansion</span>
            </div>
            <div className="stat-card orange">
              <span className="stat-value">{stats.byCategory['MIGRATION'] || 0}</span>
              <span className="stat-label">Migration</span>
            </div>
            {Object.entries(stats.byStatus).slice(0, 3).map(([status, count]) => (
              <div key={status} className="stat-card">
                <span className="stat-value" style={{
                  color: status === 'WON' || status === 'CONVERTED' ? '#16a34a' :
                         status === 'LOST' || status === 'DISQUALIFIED' ? '#dc2626' :
                         status === 'STALLED' ? '#ca8a04' : 'inherit'
                }}>
                  {count}
                </span>
                <span className="stat-label">{status.replace('_', ' ')}</span>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="stage-filters">
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
                {config.statusOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
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
              <span className="result-count">{filteredData.length} records</span>
            </div>
          </div>

          {/* Data Table */}
          <div className="stage-table-container">
            <table className="stage-table">
              <thead>
                <tr>
                  {config.columns.map(col => (
                    <SortableHeader
                      key={col.key}
                      label={col.label}
                      column={col.key}
                      sortDirection={getSortDirection(col.key)}
                      onSort={handleSort}
                    />
                  ))}
                  <th>SF</th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.length === 0 ? (
                  <tr>
                    <td colSpan={config.columns.length + 1} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-tertiary)' }}>
                      No records found matching the filters
                    </td>
                  </tr>
                ) : (
                  paginatedData.map((row, idx) => (
                    <tr key={`${row.product}-${row.company_name}-${getDate(row, stage)}-${idx}`}>
                      {config.columns.map(col => (
                        <td key={col.key}>{renderCell(row, col.key)}</td>
                      ))}
                      <td className="center">
                        <a
                          href={row.salesforce_url}
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
              <button disabled={currentPage === 1} onClick={() => setCurrentPage(1)}>« First</button>
              <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>‹ Prev</button>
              <span className="page-info">Page {currentPage} of {totalPages} ({filteredData.length} total)</span>
              <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>Next ›</button>
              <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(totalPages)}>Last »</button>
            </div>
          )}

          <style jsx>{`
            .funnel-stage-details-section { margin-top: 24px; }
            .lead-type-toggle { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
            .toggle-label { font-size: 0.75rem; color: var(--text-tertiary); font-weight: 500; }
            .toggle-btn { padding: 6px 14px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; cursor: pointer; transition: all 0.15s; border: 2px solid; }
            .toggle-btn.mql { border-color: #3b82f6; background: var(--bg-secondary); color: #3b82f6; }
            .toggle-btn.mql.active { background: #3b82f6; color: white; }
            .toggle-btn.eql { border-color: #8b5cf6; background: var(--bg-secondary); color: #8b5cf6; }
            .toggle-btn.eql.active { background: #8b5cf6; color: white; }
            .stage-stats { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
            .stat-card { display: flex; flex-direction: column; align-items: center; padding: 10px 16px; background: var(--bg-tertiary); border-radius: 8px; border: 1px solid var(--border-primary); min-width: 80px; }
            .stat-card.blue { border-color: #93c5fd; }
            .stat-card.purple { border-color: #c4b5fd; }
            .stat-card.orange { border-color: #fdba74; }
            .stat-value { font-size: 1.3rem; font-weight: 700; color: var(--text-primary); }
            .stat-label { font-size: 0.65rem; color: var(--text-tertiary); margin-top: 4px; }
            .stage-filters { display: flex; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; align-items: center; }
            .filter-group { display: flex; align-items: center; gap: 6px; }
            .filter-group label { font-size: 0.7rem; color: var(--text-tertiary); font-weight: 500; }
            .filter-group select, .filter-group input { font-size: 0.75rem; padding: 4px 8px; border: 1px solid var(--border-primary); border-radius: 4px; background: var(--bg-secondary); color: var(--text-primary); }
            .filter-group.search input { width: 180px; }
            .stage-table-container { overflow-x: auto; }
            .stage-table { width: 100%; border-collapse: collapse; font-size: 0.75rem; }
            .stage-table th, .stage-table td { padding: 8px 6px; border: 1px solid var(--border-primary); text-align: left; }
            .stage-table th { background-color: #1a1a2e; color: white; font-weight: 600; }
            .stage-table tbody tr:nth-child(even) { background-color: var(--bg-tertiary); }
            .stage-table tbody tr:hover { background-color: var(--bg-hover); }
            .lead-type-badge { display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 0.6rem; font-weight: 700; color: white; }
            .lead-type-badge.mql { background-color: #3b82f6; }
            .lead-type-badge.eql { background-color: #8b5cf6; }
            .category-badge { display: inline-block; padding: 2px 5px; border-radius: 3px; font-size: 0.55rem; font-weight: 600; }
            .category-badge.new-logo { background-color: #dbeafe; color: #1e40af; }
            .category-badge.expansion { background-color: var(--bg-tertiary); color: #7c3aed; }
            .category-badge.migration { background-color: var(--bg-tertiary); color: #c2410c; }
            .product-badge { display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 0.6rem; font-weight: 600; color: white; }
            .product-badge.por { background: linear-gradient(135deg, #22c55e, #16a34a); }
            .product-badge.r360 { background: linear-gradient(135deg, #ef4444, #dc2626); }
            .status-badge { display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 0.65rem; font-weight: 600; }
            .status-badge.converted, .status-badge.converted-sal, .status-badge.converted-sqo, .status-badge.won { background-color: #dcfce7; color: #166534; }
            .status-badge.active { background-color: #dbeafe; color: #1e40af; }
            .status-badge.disqualified, .status-badge.lost { background-color: var(--danger-bg); color: #991b1b; }
            .status-badge.stalled { background-color: var(--warning-bg); color: #92400e; }
            .lost-reason-text { display: inline-block; padding: 1px 4px; background: var(--bg-tertiary); border-radius: 3px; font-size: 0.6rem; }
            .sf-link { font-size: 1rem; text-decoration: none; }
            .sf-link:hover { opacity: 0.7; }
            .result-count { font-size: 0.7rem; color: var(--text-tertiary); font-weight: 500; }
            .pagination { display: flex; justify-content: center; align-items: center; gap: 8px; margin-top: 12px; padding: 8px; }
            .pagination button { padding: 4px 10px; border: 1px solid var(--border-primary); border-radius: 4px; background: var(--bg-secondary); font-size: 0.7rem; cursor: pointer; transition: all 0.15s; color: var(--text-primary); }
            .pagination button:hover:not(:disabled) { background: var(--bg-hover); }
            .pagination button:disabled { opacity: 0.5; cursor: not-allowed; }
            .page-info { padding: 0 12px; font-size: 0.7rem; color: var(--text-tertiary); }
          `}</style>
        </>
      )}
    </section>
  );
}
